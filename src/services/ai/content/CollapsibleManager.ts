/**
 * 可折叠内容管理模块
 * 负责创建和管理可折叠的内容块
 */

import type { 
  ContentBlock,
  LongContentBlock 
} from '../../../types/UIMessage.js'
import { 
  createTextBlock, 
  createLongContentBlock
} from '../../../types/UIMessage.js'
import type { 
  CollapsibleContentType, 
  ContentAnalysis
} from '../../../types/CollapsibleContent.js'
import { 
  AUTO_COLLAPSE_THRESHOLDS
} from '../../../types/CollapsibleContent.js'
import { getContentAnalyzer } from './ContentAnalyzer.js'

export interface CollapsibleOptions {
  forceCollapse?: boolean
  maxLines?: number
  customThreshold?: number
  preserveCreativeContent?: boolean
}

export class CollapsibleManager {
  private contentAnalyzer = getContentAnalyzer()

  /**
   * 将长内容转换为可折叠的内容块
   */
  createCollapsibleContentBlocks(
    content: string, 
    options: CollapsibleOptions = {}
  ): ContentBlock[] {
    const analysis = this.contentAnalyzer.analyzeContentForCollapsible(content)
    
    // 检查是否需要创建可折叠块
    const shouldCollapse = this.shouldCreateCollapsibleBlock(analysis, options)
    
    if (!shouldCollapse) {
      return [createTextBlock(content)]
    }
    
    return [this.createLongContentBlock(content, analysis, options)]
  }

  /**
   * 创建长内容块
   */
  private createLongContentBlock(
    content: string,
    analysis: ContentAnalysis,
    options: CollapsibleOptions
  ): LongContentBlock {
    const maxLines = options.maxLines || AUTO_COLLAPSE_THRESHOLDS.lines
    
    return createLongContentBlock(
      content,
      analysis.contentType,
      undefined,
      {
        collapsed: options.forceCollapse || analysis.shouldAutoCollapse,
        maxLines,
        autoCollapse: !options.forceCollapse
      },
      {
        estimatedLines: analysis.estimatedLines,
        hasLongContent: true,
        contentType: analysis.contentType
      }
    )
  }

  /**
   * 判断是否应该创建可折叠块
   */
  private shouldCreateCollapsibleBlock(
    analysis: ContentAnalysis,
    options: CollapsibleOptions
  ): boolean {
    // 强制折叠
    if (options.forceCollapse) {
      return true
    }

    // 保护创作内容
    if (options.preserveCreativeContent !== false && 
        this.contentAnalyzer.isCreativeContent('')) {
      return false
    }

    // 使用自定义阈值
    if (options.customThreshold) {
      return analysis.estimatedLines > options.customThreshold
    }

    // 使用分析结果
    return analysis.shouldAutoCollapse
  }

  /**
   * 批量处理多个内容块
   */
  processMultipleContents(
    contents: string[],
    options: CollapsibleOptions = {}
  ): ContentBlock[] {
    return contents.flatMap(content => 
      this.createCollapsibleContentBlocks(content, options)
    )
  }

  /**
   * 创建特定类型的折叠块
   */
  createTypedCollapsibleBlock(
    content: string,
    contentType: CollapsibleContentType,
    options: CollapsibleOptions = {}
  ): ContentBlock[] {
    const stats = this.contentAnalyzer.getContentStats(content)
    
    // 根据内容类型确定折叠策略
    let shouldCollapse = false
    let maxLines = AUTO_COLLAPSE_THRESHOLDS.lines

    switch (contentType) {
      case 'tool-execution':
        shouldCollapse = stats.lineCount > AUTO_COLLAPSE_THRESHOLDS.toolOutputLines
        maxLines = AUTO_COLLAPSE_THRESHOLDS.toolOutputLines
        break
      case 'code-block':
        shouldCollapse = stats.lineCount > AUTO_COLLAPSE_THRESHOLDS.codeBlockLines
        maxLines = AUTO_COLLAPSE_THRESHOLDS.codeBlockLines
        break
      case 'error-message':
        shouldCollapse = stats.lineCount > AUTO_COLLAPSE_THRESHOLDS.errorMessageLines
        maxLines = AUTO_COLLAPSE_THRESHOLDS.errorMessageLines
        break
      case 'creative-content':
      case 'creative-writing':
      case 'article':
      case 'novel':
        shouldCollapse = false
        break
      default:
        shouldCollapse = stats.lineCount > maxLines || 
                        stats.charCount > AUTO_COLLAPSE_THRESHOLDS.characters
    }

    if (!shouldCollapse && !options.forceCollapse) {
      return [createTextBlock(content)]
    }

    return [createLongContentBlock(
      content,
      contentType,
      undefined,
      {
        collapsed: options.forceCollapse || shouldCollapse,
        maxLines: options.maxLines || maxLines,
        autoCollapse: !options.forceCollapse
      },
      {
        estimatedLines: stats.lineCount,
        hasLongContent: true,
        contentType
      }
    )]
  }

  /**
   * 智能内容分割和折叠
   */
  createSmartCollapsibleBlocks(content: string): ContentBlock[] {
    // 如果内容较短，直接返回文本块
    if (content.length < 500) {
      return [createTextBlock(content)]
    }

    // 尝试按段落分割
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim())
    
    if (paragraphs.length > 1) {
      return paragraphs.flatMap(paragraph => {
        const trimmed = paragraph.trim()
        if (trimmed.length < 200) {
          return [createTextBlock(trimmed)]
        }
        return this.createCollapsibleContentBlocks(trimmed)
      })
    }

    // 整体处理
    return this.createCollapsibleContentBlocks(content)
  }

  /**
   * 获取折叠建议
   */
  getCollapseRecommendation(content: string): {
    shouldCollapse: boolean
    reason: string
    confidence: number
  } {
    const analysis = this.contentAnalyzer.analyzeContentForCollapsible(content)
    const stats = this.contentAnalyzer.getContentStats(content)

    if (this.contentAnalyzer.isCreativeContent(content)) {
      return {
        shouldCollapse: false,
        reason: '创作内容，建议保持展开以便阅读',
        confidence: 0.9
      }
    }

    if (analysis.shouldAutoCollapse) {
      let reason = '内容较长'
      if (stats.lineCount > 50) reason += ` (${stats.lineCount} 行)`
      if (stats.charCount > 2000) reason += ` (${Math.round(stats.charCount/1000)}k 字符)`
      
      return {
        shouldCollapse: true,
        reason: reason + '，建议折叠以提高阅读体验',
        confidence: 0.8
      }
    }

    return {
      shouldCollapse: false,
      reason: '内容长度适中，无需折叠',
      confidence: 0.7
    }
  }
}

// 全局实例
let globalCollapsibleManager: CollapsibleManager | null = null

/**
 * 获取全局可折叠内容管理器实例
 */
export function getCollapsibleManager(): CollapsibleManager {
  if (!globalCollapsibleManager) {
    globalCollapsibleManager = new CollapsibleManager()
  }
  return globalCollapsibleManager
}

/**
 * 便捷函数：创建可折叠内容块
 */
export function createCollapsibleContentBlocks(
  content: string, 
  options?: CollapsibleOptions
): ContentBlock[] {
  return getCollapsibleManager().createCollapsibleContentBlocks(content, options)
}