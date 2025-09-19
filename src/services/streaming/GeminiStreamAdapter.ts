import { StreamAdapter, StreamChunk, StreamAdapterConfig } from './StreamAdapter.js'

/**
 * Gemini 候选响应结构
 */
interface GeminiCandidate {
  content: {
    parts: Array<{
      text?: string
    }>
  }
  finishReason?: string
  index?: number
  safetyRatings?: Array<{
    category: string
    probability: string
  }>
}

/**
 * Gemini 流式响应数据结构
 */
interface GeminiStreamResponse {
  candidates: GeminiCandidate[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  promptFeedback?: {
    blockReason?: string
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }
}

/**
 * Gemini 错误响应结构
 */
interface GeminiErrorResponse {
  error: {
    code: number
    message: string
    status: string
  }
}

/**
 * Gemini 流式适配器
 * 
 * 处理 Google Gemini 格式的流式响应：
 * - 使用 alt=sse 参数
 * - 返回 JSON 块增量数据
 * - 无特殊的 SSE 格式，直接为 JSON 响应
 */
export class GeminiStreamAdapter extends StreamAdapter {
  private accumulatedText: string = ''
  private totalPromptTokens: number = 0
  private totalCandidatesTokens: number = 0

  constructor(config?: Partial<StreamAdapterConfig>) {
    super(config)
  }

  /**
   * 解析 Gemini 流式数据
   */
  parseStream(data: string): StreamChunk[] {
    const chunks: StreamChunk[] = []
    
    // Gemini 返回的可能是多个 JSON 对象
    // 需要尝试解析每个可能的 JSON 块
    const jsonBlocks = this.extractJsonBlocks(data)
    
    for (const jsonBlock of jsonBlocks) {
      try {
        const response: GeminiStreamResponse | GeminiErrorResponse = JSON.parse(jsonBlock)
        
        // 检查是否为错误响应
        if ('error' in response) {
          chunks.push(this.handleGeminiError(response))
          continue
        }
        
        // 处理正常响应
        const chunk = this.handleResponse(response)
        if (chunk) {
          chunks.push(chunk)
        }
        
      } catch (_error) {
        // JSON 解析失败，创建错误块
        chunks.push({
          content: '',
          done: false,
          error: `Failed to parse Gemini response: ${error}`,
          raw: jsonBlock
        })
      }
    }
    
    return chunks
  }

  /**
   * 从数据中提取 JSON 块
   * Gemini 可能返回多个连续的 JSON 对象
   */
  private extractJsonBlocks(data: string): string[] {
    const blocks: string[] = []
    let currentBlock = ''
    let braceCount = 0
    let inString = false
    let escaped = false
    
    for (let i = 0; i < data.length; i++) {
      const char = data[i]
      
      if (escaped) {
        escaped = false
        currentBlock += char
        continue
      }
      
      if (char === '\\' && inString) {
        escaped = true
        currentBlock += char
        continue
      }
      
      if (char === '"') {
        inString = !inString
        currentBlock += char
        continue
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++
          currentBlock += char
        } else if (char === '}') {
          braceCount--
          currentBlock += char
          
          // 当大括号平衡时，我们有一个完整的 JSON 对象
          if (braceCount === 0 && currentBlock.trim()) {
            blocks.push(currentBlock.trim())
            currentBlock = ''
          }
        } else if (braceCount > 0) {
          currentBlock += char
        }
      } else {
        currentBlock += char
      }
    }
    
    // 如果还有未完成的块，添加到结果中
    if (currentBlock.trim() && braceCount === 0) {
      blocks.push(currentBlock.trim())
    }
    
    return blocks
  }

  /**
   * 处理 Gemini 响应
   */
  private handleResponse(response: GeminiStreamResponse): StreamChunk | null {
    const candidate = response.candidates?.[0]
    
    if (!candidate) {
      return null
    }
    
    // 提取文本内容
    const textPart = candidate.content.parts?.[0]
    const content = textPart?.text || ''
    
    // 检查是否完成
    const isDone = candidate.finishReason !== undefined
    
    // 更新token统计
    if (response.usageMetadata) {
      this.totalPromptTokens = response.usageMetadata.promptTokenCount || 0
      this.totalCandidatesTokens = response.usageMetadata.candidatesTokenCount || 0
    }
    
    // 累积文本（Gemini 可能发送完整文本而不是增量）
    const deltaContent = this.calculateDelta(content)
    
    return {
      content: deltaContent,
      done: isDone,
      raw: response,
      usage: response.usageMetadata ? {
        promptTokens: this.totalPromptTokens,
        completionTokens: this.totalCandidatesTokens,
        totalTokens: (this.totalPromptTokens + this.totalCandidatesTokens)
      } : undefined
    }
  }

  /**
   * 计算增量内容
   * 由于 Gemini 可能发送完整文本，我们需要计算增量
   */
  private calculateDelta(fullContent: string): string {
    if (fullContent.startsWith(this.accumulatedText)) {
      const delta = fullContent.substring(this.accumulatedText.length)
      this.accumulatedText = fullContent
      return delta
    }
    
    // 如果不是增量更新，返回全部内容
    this.accumulatedText = fullContent
    return fullContent
  }

  /**
   * 处理 Gemini 错误响应
   */
  private handleGeminiError(errorResponse: GeminiErrorResponse): StreamChunk {
    return {
      content: '',
      done: true,
      error: `Gemini API Error (${errorResponse.error.code}): ${errorResponse.error.message}`,
      raw: errorResponse
    }
  }

  /**
   * 检查是否为流结束标识
   * Gemini 通过 finishReason 或连接关闭来表示结束
   */
  isStreamEnd(data: string): boolean {
    try {
      const jsonBlocks = this.extractJsonBlocks(data)
      for (const block of jsonBlocks) {
        const response = JSON.parse(block)
        if (response.candidates?.[0]?.finishReason) {
          return true
        }
        if (response.error) {
          return true
        }
      }
    } catch {
      // 解析失败不认为是结束
    }
    
    return false
  }

  /**
   * 重写 reset 方法以清理 Gemini 特定状态
   */
  public reset(): void {
    super.reset()
    this.accumulatedText = ''
    this.totalPromptTokens = 0
    this.totalCandidatesTokens = 0
  }

  /**
   * 获取 Gemini 特有的状态信息
   */
  public getGeminiStatus(): {
    connected: boolean
    bufferSize: number
    config: StreamAdapterConfig
    accumulatedTextLength: number
    supportsMultimodal: boolean
  } {
    const baseStatus = this.getStatus()
    return {
      ...baseStatus,
      accumulatedTextLength: this.accumulatedText.length,
      supportsMultimodal: true  // Gemini 支持多模态
    }
  }
}

/**
 * 便捷工厂函数
 */
export function createGeminiStreamAdapter(config?: Partial<StreamAdapterConfig>): GeminiStreamAdapter {
  return new GeminiStreamAdapter(config)
}