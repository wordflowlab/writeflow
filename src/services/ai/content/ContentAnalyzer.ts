/**
 * 内容分析模块
 * 负责分析内容类型、复杂度和折叠策略
 */

import type { 
  CollapsibleContentType, 
  ContentAnalysis
} from '../../../types/CollapsibleContent.js'
import { 
  AUTO_COLLAPSE_THRESHOLDS,
  CONTENT_TYPE_PATTERNS 
} from '../../../types/CollapsibleContent.js'

export class ContentAnalyzer {
  
  /**
   * 分析内容是否需要折叠
   */
  analyzeContentForCollapsible(content: string): ContentAnalysis {
    const lines = content.split('\n')
    const lineCount = lines.length
    const charCount = content.length
    const hasLongLines = lines.some(line => line.length > 120)
    const hasCodeBlocks = /```[\s\S]*?```/.test(content)
    
    // 检测内容类型
    let contentType: CollapsibleContentType = 'long-text'
    for (const [type, pattern] of Object.entries(CONTENT_TYPE_PATTERNS)) {
      if (pattern.test(content)) {
        contentType = type as CollapsibleContentType
        break
      }
    }
    
    // 创作内容永远不折叠
    const isCreative = this.isCreativeContent(content)
    if (isCreative) {
      return {
        shouldAutoCollapse: false,
        estimatedLines: lineCount,
        contentType: 'creative-content',
        hasCodeBlocks,
        hasLongLines,
        complexity: lineCount > 50 ? 'complex' : lineCount > 20 ? 'medium' : 'simple'
      }
    }
    
    // 判断是否应该自动折叠
    let shouldAutoCollapse = false
    switch (contentType) {
      case 'tool-execution':
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.toolOutputLines
        break
      case 'code-block':
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.codeBlockLines
        break
      case 'error-message':
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.errorMessageLines
        break
      case 'creative-content':
      case 'creative-writing':
      case 'article':
      case 'novel':
        shouldAutoCollapse = false
        break
      default:
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.lines || 
                           charCount > AUTO_COLLAPSE_THRESHOLDS.characters
    }
    
    return {
      shouldAutoCollapse,
      estimatedLines: lineCount,
      contentType,
      hasCodeBlocks,
      hasLongLines,
      complexity: hasCodeBlocks || lineCount > 50 ? 'complex' : 
                  lineCount > 20 || hasLongLines ? 'medium' : 'simple'
    }
  }
  
  /**
   * 检测是否为创作内容
   */
  isCreativeContent(content: string): boolean {
    const creativePatternsOrder = [
      CONTENT_TYPE_PATTERNS['creative-content'],
      CONTENT_TYPE_PATTERNS['creative-writing'], 
      CONTENT_TYPE_PATTERNS['article'],
      CONTENT_TYPE_PATTERNS['novel']
    ]
    
    return creativePatternsOrder.some(pattern => pattern.test(content))
  }

  /**
   * 分析内容复杂度
   */
  analyzeComplexity(content: string): 'simple' | 'medium' | 'complex' {
    const lines = content.split('\n')
    const lineCount = lines.length
    const hasCodeBlocks = /```[\s\S]*?```/.test(content)
    const hasLongLines = lines.some(line => line.length > 120)
    const hasTables = /\|.*\|/.test(content)
    const hasLinks = /\[.*\]\(.*\)/.test(content)
    
    // 复杂度评分
    let complexity = 0
    if (lineCount > 50) complexity += 2
    else if (lineCount > 20) complexity += 1
    
    if (hasCodeBlocks) complexity += 2
    if (hasLongLines) complexity += 1
    if (hasTables) complexity += 1
    if (hasLinks) complexity += 0.5
    
    if (complexity >= 4) return 'complex'
    if (complexity >= 2) return 'medium'
    return 'simple'
  }

  /**
   * 检测内容类型
   */
  detectContentType(content: string): CollapsibleContentType {
    for (const [type, pattern] of Object.entries(CONTENT_TYPE_PATTERNS)) {
      if (pattern.test(content)) {
        return type as CollapsibleContentType
      }
    }
    return 'long-text'
  }

  /**
   * 计算内容统计信息
   */
  getContentStats(content: string) {
    const lines = content.split('\n')
    return {
      lineCount: lines.length,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      hasLongLines: lines.some(line => line.length > 120),
      hasCodeBlocks: /```[\s\S]*?```/.test(content),
      hasTables: /\|.*\|/.test(content),
      hasLinks: /\[.*\]\(.*\)/.test(content),
      averageLineLength: Math.round(content.length / lines.length)
    }
  }
}

// 全局实例
let globalContentAnalyzer: ContentAnalyzer | null = null

/**
 * 获取全局内容分析器实例
 */
export function getContentAnalyzer(): ContentAnalyzer {
  if (!globalContentAnalyzer) {
    globalContentAnalyzer = new ContentAnalyzer()
  }
  return globalContentAnalyzer
}

/**
 * 便捷函数：分析内容是否需要折叠
 */
export function analyzeContentForCollapsible(content: string): ContentAnalysis {
  return getContentAnalyzer().analyzeContentForCollapsible(content)
}

/**
 * 便捷函数：检测是否为创作内容
 */
export function isCreativeContent(content: string): boolean {
  return getContentAnalyzer().isCreativeContent(content)
}