import { StreamAdapter, StreamChunk, StreamAdapterConfig } from './StreamAdapter.js'

/**
 * OpenAI 响应数据结构
 */
interface OpenAIStreamResponse {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      content?: string
      role?: string
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

/**
 * OpenAI 流式适配器
 * 
 * 处理 OpenAI 格式的 SSE 流：
 * - data: {"choices": [{"delta": {"content": "文本"}}]}
 * - data: [DONE]
 */
export class OpenAIStreamAdapter extends StreamAdapter {
  constructor(config?: Partial<StreamAdapterConfig>) {
    super(config)
  }

  /**
   * 解析 OpenAI 流式数据
   */
  parseStream(data: string): StreamChunk[] {
    const chunks: StreamChunk[] = []
    
    // 按行分割处理
    const lines = data.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (!trimmed || trimmed.startsWith(':')) {
        // 跳过空行和注释行
        continue
      }
      
      if (trimmed === 'data: [DONE]') {
        chunks.push({
          content: '',
          done: true,
          raw: trimmed
        })
        continue
      }
      
      if (trimmed.startsWith('data: ')) {
        try {
          const jsonStr = trimmed.substring(6) // 移除 'data: '
          const response: OpenAIStreamResponse = JSON.parse(jsonStr)
          
          // 提取内容
          const choice = response.choices?.[0]
          if (choice) {
            const content = choice.delta?.content || ''
            const isDone = choice.finish_reason !== null
            
            chunks.push({
              content,
              done: isDone,
              raw: response,
              usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
              } : undefined
            })
          }
        } catch (_error) {
          // 解析错误，创建错误块
          chunks.push({
            content: '',
            done: false,
            error: `Failed to parse OpenAI response: ${error}`,
            raw: trimmed
          })
        }
      }
    }
    
    return chunks
  }

  /**
   * 检查是否为流结束标识
   */
  isStreamEnd(data: string): boolean {
    return data.trim() === 'data: [DONE]'
  }

  /**
   * 处理 OpenAI 特定的错误格式
   */
  private parseError(data: string): StreamChunk | null {
    try {
      if (data.startsWith('data: ')) {
        const jsonStr = data.substring(6)
        const response = JSON.parse(jsonStr)
        
        if (response.error) {
          return {
            content: '',
            done: true,
            error: response.error.message || 'OpenAI API Error',
            raw: response
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
    
    return null
  }

  /**
   * 重写 processData 以处理 OpenAI 特定逻辑
   */
  public processData(rawData: string): void {
    // 检查错误响应
    const errorChunk = this.parseError(rawData)
    if (errorChunk) {
      this.emit('chunk', errorChunk)
      return
    }
    
    // 调用父类处理逻辑
    super.processData(rawData)
  }
}

/**
 * 便捷工厂函数
 */
export function createOpenAIStreamAdapter(config?: Partial<StreamAdapterConfig>): OpenAIStreamAdapter {
  return new OpenAIStreamAdapter(config)
}