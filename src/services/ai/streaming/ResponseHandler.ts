/**
 * 响应处理器
 * 提供统一的流式和非流式响应处理接口
 */

import type { 
  ContentBlock 
} from '../../../types/UIMessage.js'
import { parseAIResponse, parseStreamingChunk } from '../ResponseParser.js'
import { getContentProcessor } from '../content/index.js'
import { getOutputFormatter } from '../../../ui/utils/outputFormatter.js'

export interface ResponseHandlerOptions {
  enableFormatting?: boolean
  enableContentProcessing?: boolean
  enableCollapsible?: boolean
  parseMarkdown?: boolean
  enhanceOutput?: boolean
}

export interface ProcessedResponse {
  content: string
  contentBlocks: ContentBlock[]
  formatted?: string
  metadata?: {
    wordCount: number
    estimatedReadTime: number
    complexity: string
    contentType: string
  }
  processingTime: number
}

export class ResponseHandler {
  private contentProcessor = getContentProcessor()
  private outputFormatter = getOutputFormatter()

  /**
   * 处理完整响应（非流式）
   */
  async processResponse(
    content: string,
    options: ResponseHandlerOptions = {}
  ): Promise<ProcessedResponse> {
    const startTime = Date.now()
    
    const {
      enableFormatting = true,
      enableContentProcessing = true,
      enableCollapsible = true,
      parseMarkdown = true,
      enhanceOutput = false
    } = options

    let processedContent = content

    // 内容处理
    let contentBlocks: ContentBlock[] = []
    let metadata: any = {}

    if (enableContentProcessing) {
      const result = this.contentProcessor.processAIResponse(processedContent, {
        enableCollapsible,
        parseMarkdown,
        enableAnalysis: true,
        enhanceFormatting: enhanceOutput
      })

      contentBlocks = result.contentBlocks
      
      if (result.analysis && result.stats) {
        metadata = {
          wordCount: result.stats.wordCount,
          estimatedReadTime: Math.ceil(result.stats.wordCount / 200), // 200词/分钟
          complexity: result.analysis.complexity,
          contentType: result.analysis.contentType
        }
      }
    } else {
      // 基础解析
      const parsed = parseAIResponse(processedContent)
      contentBlocks = parsed.content
    }

    // 格式化输出
    let formatted: string | undefined
    if (enableFormatting) {
      formatted = await this.formatResponse(processedContent, options)
    }

    const processingTime = Date.now() - startTime

    return {
      content: processedContent,
      contentBlocks,
      formatted,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      processingTime
    }
  }

  /**
   * 处理流式响应块
   */
  async processStreamingChunk(
    chunk: string,
    accumulated: string = '',
    options: ResponseHandlerOptions = {}
  ): Promise<{
    processedChunk: string
    processedAccumulated: string
    shouldUpdate: boolean
    contentBlocks?: ContentBlock[]
  }> {
    const startTime = Date.now()

    // 解析流式块
    const parsedChunk = parseStreamingChunk(chunk, [])
    const newAccumulated = accumulated + chunk

    // 判断是否需要更新显示
    const shouldUpdate = this.shouldUpdateDisplay(
      chunk, 
      newAccumulated, 
      startTime
    )

    let contentBlocks: ContentBlock[] | undefined

    // 如果需要更新且启用了内容处理
    if (shouldUpdate && options.enableContentProcessing) {
      const result = this.contentProcessor.processSmartContent(newAccumulated, {
        enableCollapsible: options.enableCollapsible,
        parseMarkdown: options.parseMarkdown
      })
      contentBlocks = result.contentBlocks
    }

    return {
      processedChunk: chunk,
      processedAccumulated: newAccumulated,
      shouldUpdate,
      contentBlocks
    }
  }

  /**
   * 批量处理响应
   */
  async processBatchResponses(
    responses: string[],
    options: ResponseHandlerOptions = {}
  ): Promise<ProcessedResponse[]> {
    // 并行处理多个响应
    const promises = responses.map(response => 
      this.processResponse(response, options)
    )

    return Promise.all(promises)
  }

  /**
   * 格式化响应
   */
  private async formatResponse(
    content: string,
    options: ResponseHandlerOptions
  ): Promise<string> {
    try {
      // 使用输出格式化器
      const result = this.outputFormatter.formatStreamOutput(content, {
        enableColors: true,
        theme: 'dark'
      })
      return result.content
    } catch (error) {
      console.warn('响应格式化失败:', error)
      return content
    }
  }

  /**
   * 判断是否应该更新显示
   */
  private shouldUpdateDisplay(
    chunk: string,
    accumulated: string,
    startTime: number
  ): boolean {
    // 基于内容长度的更新策略
    if (chunk.length > 50) return true
    if (accumulated.length % 100 === 0) return true

    // 基于时间的更新策略
    const elapsed = Date.now() - startTime
    if (elapsed > 100) return true // 100ms更新一次

    // 特殊内容立即更新
    if (chunk.includes('\n') || chunk.includes('```')) return true

    return false
  }

  /**
   * 创建响应摘要
   */
  createResponseSummary(content: string): {
    summary: string
    keyPoints: string[]
    stats: {
      wordCount: number
      lineCount: number
      hasCodeBlocks: boolean
      hasTables: boolean
      estimatedReadTime: number
    }
  } {
    const lines = content.split('\n')
    const words = content.split(/\s+/).filter(w => w.length > 0)
    const hasCodeBlocks = /```[\s\S]*?```/.test(content)
    const hasTables = /\|.*\|/.test(content)

    // 提取关键点（简化实现）
    const keyPoints = lines
      .filter(line => line.trim().length > 20 && line.trim().length < 200)
      .filter(line => !line.startsWith('```'))
      .slice(0, 3)
      .map(line => line.trim())

    // 生成摘要
    const firstSentence = content.split(/[.!?]/)[0]?.trim() || ''
    const summary = firstSentence.length > 150 
      ? firstSentence.substring(0, 147) + '...'
      : firstSentence

    return {
      summary: summary || '无摘要',
      keyPoints,
      stats: {
        wordCount: words.length,
        lineCount: lines.length,
        hasCodeBlocks,
        hasTables,
        estimatedReadTime: Math.ceil(words.length / 200)
      }
    }
  }

  /**
   * 验证响应质量
   */
  validateResponse(content: string): {
    isValid: boolean
    issues: string[]
    suggestions: string[]
    score: number
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // 长度检查
    if (content.length < 10) {
      issues.push('内容过短')
      suggestions.push('增加更多详细信息')
      score -= 30
    }

    // 格式检查
    if (content.includes('undefined') || content.includes('null')) {
      issues.push('包含未定义值')
      suggestions.push('检查数据处理逻辑')
      score -= 20
    }

    // 编码检查
    if (/[\u0000-\u001f]/.test(content)) {
      issues.push('包含控制字符')
      suggestions.push('清理文本编码')
      score -= 15
    }

    // 结构检查
    const lines = content.split('\n')
    const emptyLines = lines.filter(line => line.trim() === '').length
    if (emptyLines > lines.length * 0.5) {
      issues.push('空行过多')
      suggestions.push('优化内容结构')
      score -= 10
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      score: Math.max(0, score)
    }
  }

  /**
   * 优化响应内容
   */
  optimizeResponse(content: string): string {
    let optimized = content

    // 清理多余的空行
    optimized = optimized.replace(/\n{3,}/g, '\n\n')

    // 清理行尾空格
    optimized = optimized.replace(/ +$/gm, '')

    // 统一列表格式
    optimized = optimized.replace(/^(\s*)[-*+]\s+/gm, '$1- ')

    // 清理代码块格式
    optimized = optimized.replace(/```(\w+)?\s*\n([\s\S]*?)\n\s*```/g, (match, lang, code) => {
      const cleanCode = code.trim()
      const language = lang || 'text'
      return `\`\`\`${language}\n${cleanCode}\n\`\`\``
    })

    return optimized.trim()
  }

  /**
   * 计算响应相似度
   */
  calculateSimilarity(content1: string, content2: string): number {
    // 简化的相似度计算
    const words1 = new Set(content1.toLowerCase().split(/\s+/))
    const words2 = new Set(content2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }
}

// 全局实例
let globalResponseHandler: ResponseHandler | null = null

/**
 * 获取全局响应处理器实例
 */
export function getResponseHandler(): ResponseHandler {
  if (!globalResponseHandler) {
    globalResponseHandler = new ResponseHandler()
  }
  return globalResponseHandler
}

/**
 * 便捷函数：处理响应
 */
export async function processResponse(
  content: string,
  options?: ResponseHandlerOptions
): Promise<ProcessedResponse> {
  return getResponseHandler().processResponse(content, options)
}

/**
 * 便捷函数：处理流式块
 */
export async function processStreamingChunk(
  chunk: string,
  accumulated?: string,
  options?: ResponseHandlerOptions
) {
  return getResponseHandler().processStreamingChunk(chunk, accumulated, options)
}