/**
 * 内容处理器统一入口
 * 整合内容分析和折叠管理，提供统一的内容处理接口
 */

import type { 
  ContentBlock 
} from '../../../types/UIMessage.js'
import { 
  createTextBlock 
} from '../../../types/UIMessage.js'
import type { 
  CollapsibleContentType, 
  ContentAnalysis
} from '../../../types/CollapsibleContent.js'
import { parseAIResponse } from '../ResponseParser.js'
import { getContentAnalyzer } from './ContentAnalyzer.js'
import { 
  getCollapsibleManager, 
  type CollapsibleOptions 
} from './CollapsibleManager.js'

export interface ContentProcessingOptions {
  enableCollapsible?: boolean
  collapsibleOptions?: CollapsibleOptions
  enableAnalysis?: boolean
  parseMarkdown?: boolean
  enhanceFormatting?: boolean
}

export interface ContentProcessingResult {
  contentBlocks: ContentBlock[]
  analysis?: ContentAnalysis
  stats?: any
  recommendations?: {
    shouldCollapse: boolean
    reason: string
    confidence: number
  }
}

export class ContentProcessor {
  private contentAnalyzer = getContentAnalyzer()
  private collapsibleManager = getCollapsibleManager()

  /**
   * 处理 AI 响应内容
   */
  processAIResponse(
    content: string,
    options: ContentProcessingOptions = {}
  ): ContentProcessingResult {
    const {
      enableCollapsible = true,
      enableAnalysis = false,
      parseMarkdown = true,
      enhanceFormatting = false
    } = options

    let processedContent = content

    // 增强格式化
    if (enhanceFormatting) {
      processedContent = this.enhanceContentFormatting(processedContent)
    }

    // 解析 Markdown 结构
    let parsedResponse: ParsedResponse | null = null
    if (parseMarkdown) {
      parsedResponse = parseAIResponse(processedContent)
    }

    // 内容分析
    let analysis: ContentAnalysis | undefined
    let stats: any
    let recommendations: any

    if (enableAnalysis) {
      analysis = this.contentAnalyzer.analyzeContentForCollapsible(processedContent)
      stats = this.contentAnalyzer.getContentStats(processedContent)
      recommendations = this.collapsibleManager.getCollapseRecommendation(processedContent)
    }

    // 创建内容块
    let contentBlocks: ContentBlock[]

    if (enableCollapsible) {
      contentBlocks = this.collapsibleManager.createCollapsibleContentBlocks(
        processedContent,
        options.collapsibleOptions
      )
    } else {
      contentBlocks = parsedResponse?.content || [createTextBlock(processedContent)]
    }

    return {
      contentBlocks,
      analysis,
      stats,
      recommendations
    }
  }

  /**
   * 处理特定类型的内容
   */
  processTypedContent(
    content: string,
    contentType: CollapsibleContentType,
    options: ContentProcessingOptions = {}
  ): ContentProcessingResult {
    const contentBlocks = this.collapsibleManager.createTypedCollapsibleBlock(
      content,
      contentType,
      options.collapsibleOptions
    )

    let analysis: ContentAnalysis | undefined
    if (options.enableAnalysis) {
      analysis = this.contentAnalyzer.analyzeContentForCollapsible(content)
    }

    return {
      contentBlocks,
      analysis
    }
  }

  /**
   * 智能内容处理
   */
  processSmartContent(
    content: string,
    options: ContentProcessingOptions = {}
  ): ContentProcessingResult {
    // 自动检测内容类型
    const contentType = this.contentAnalyzer.detectContentType(content)
    
    // 获取处理建议
    const recommendations = this.collapsibleManager.getCollapseRecommendation(content)
    
    // 智能分割和处理
    const contentBlocks = this.collapsibleManager.createSmartCollapsibleBlocks(content)
    
    let analysis: ContentAnalysis | undefined
    if (options.enableAnalysis) {
      analysis = this.contentAnalyzer.analyzeContentForCollapsible(content)
    }

    return {
      contentBlocks,
      analysis,
      recommendations
    }
  }

  /**
   * 批量处理多个内容
   */
  processBatchContent(
    contents: string[],
    options: ContentProcessingOptions = {}
  ): ContentProcessingResult[] {
    return contents.map(content => 
      this.processAIResponse(content, options)
    )
  }

  /**
   * 增强内容格式化
   */
  private enhanceContentFormatting(content: string): string {
    let enhanced = content

    // 改善代码块格式
    enhanced = enhanced.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanCode = code.trim()
      const language = lang || 'text'
      return `\`\`\`${language}\n${cleanCode}\n\`\`\``
    })

    // 改善列表格式
    enhanced = enhanced.replace(/^(\s*)[-*+]\s+/gm, '$1- ')

    // 改善标题格式
    enhanced = enhanced.replace(/^(#{1,6})\s*(.+)$/gm, (match, hashes, title) => {
      return `${hashes} ${title.trim()}`
    })

    // 移除多余的空行
    enhanced = enhanced.replace(/\n{3,}/g, '\n\n')

    return enhanced.trim()
  }

  /**
   * 内容质量评估
   */
  assessContentQuality(content: string): {
    score: number
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    const stats = this.contentAnalyzer.getContentStats(content)

    // 检查内容长度
    if (stats.charCount < 50) {
      issues.push('内容过短')
      suggestions.push('增加更多详细信息')
      score -= 20
    }

    // 检查行长度
    if (stats.hasLongLines) {
      issues.push('部分行过长')
      suggestions.push('考虑断行以提高可读性')
      score -= 10
    }

    // 检查结构化程度
    if (!stats.hasCodeBlocks && !stats.hasTables && stats.lineCount > 20) {
      suggestions.push('考虑使用标题、列表或代码块来改善结构')
      score -= 5
    }

    // 检查创作内容
    if (this.contentAnalyzer.isCreativeContent(content)) {
      suggestions.push('创作内容质量良好，保持当前风格')
      score += 10
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      suggestions
    }
  }

  /**
   * 获取内容摘要
   */
  generateContentSummary(content: string): {
    summary: string
    keyPoints: string[]
    contentType: CollapsibleContentType
    complexity: string
  } {
    const analysis = this.contentAnalyzer.analyzeContentForCollapsible(content)
    const stats = this.contentAnalyzer.getContentStats(content)

    // 提取关键点（简单实现）
    const lines = content.split('\n').filter(line => line.trim())
    const keyPoints = lines
      .filter(line => line.length > 20 && line.length < 200)
      .slice(0, 3)
      .map(line => line.trim())

    // 生成摘要
    const firstSentence = content.split(/[.!?]/)[0]?.trim() || ''
    const summary = firstSentence.length > 100 
      ? firstSentence.substring(0, 97) + '...'
      : firstSentence

    return {
      summary: summary || '无摘要',
      keyPoints,
      contentType: analysis.contentType,
      complexity: analysis.complexity
    }
  }
}

// 全局实例
let globalContentProcessor: ContentProcessor | null = null

/**
 * 获取全局内容处理器实例
 */
export function getContentProcessor(): ContentProcessor {
  if (!globalContentProcessor) {
    globalContentProcessor = new ContentProcessor()
  }
  return globalContentProcessor
}

/**
 * 便捷函数：处理 AI 响应内容
 */
export function processAIResponse(
  content: string,
  options?: ContentProcessingOptions
): ContentProcessingResult {
  return getContentProcessor().processAIResponse(content, options)
}

/**
 * 便捷函数：智能内容处理
 */
export function processSmartContent(
  content: string,
  options?: ContentProcessingOptions
): ContentProcessingResult {
  return getContentProcessor().processSmartContent(content, options)
}