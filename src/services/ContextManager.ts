import { debugLog } from '../utils/log.js'

/**
 * 智能上下文管理器
 * 优化token消费，实现上下文窗口管理和压缩
 * 优化上下文管理，实现智能压缩和内容筛选
 */


export interface ContextEntry {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  tokens: number
  importance: number // 0-1，重要性评分
  type: 'conversation' | 'tool_use' | 'system_info' | 'background'
}

export interface ContextWindow {
  maxTokens: number
  currentTokens: number
  entries: ContextEntry[]
  compressionRatio: number // 压缩比例
}

export interface ContextCompressionOptions {
  targetTokens: number
  preserveRecent: number // 保留最近N条消息
  preserveImportant: boolean // 保留重要消息
  enableSummarization: boolean // 启用自动摘要
}

/**
 * 智能上下文管理器
 */
export class ContextManager {
  private maxContextTokens: number
  private compressionThreshold: number
  private window: ContextWindow
  
  constructor(maxContextTokens: number = 32000) {
    this.maxContextTokens = maxContextTokens
    this.compressionThreshold = Math.floor(maxContextTokens * 0.8) // 80% 阈值
    
    this.window = {
      maxTokens: maxContextTokens,
      currentTokens: 0,
      entries: [],
      compressionRatio: 1.0,
    }
  }
  
  /**
   * 添加上下文条目
   */
  addEntry(entry: Omit<ContextEntry, 'id' | 'timestamp'>): string {
    const contextEntry: ContextEntry = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      ...entry,
    }
    
    this.window.entries.push(contextEntry)
    this.window.currentTokens += entry.tokens
    
    // 检查是否需要压缩
    if (this.window.currentTokens > this.compressionThreshold) {
      this.compressContext()
    }
    
    return contextEntry.id
  }
  
  /**
   * 获取当前上下文
   */
  getContext(): ContextEntry[] {
    return [...this.window.entries]
  }
  
  /**
   * 获取用于AI调用的上下文字符串
   */
  getContextForAI(options?: { maxTokens?: number }): string {
    const maxTokens = options?.maxTokens || this.maxContextTokens
    let totalTokens = 0
    const selectedEntries: ContextEntry[] = []
    
    // 从最新的条目开始选择，直到达到token限制
    for (let i = this.window.entries.length - 1; i >= 0; i--) {
      const entry = this.window.entries[i]
      if (totalTokens + entry.tokens <= maxTokens) {
        selectedEntries.unshift(entry)
        totalTokens += entry.tokens
      } else {
        break
      }
    }
    
    return selectedEntries
      .map(entry => `[${entry.role}] ${entry.content}`)
      .join('\n\n')
  }
  
  /**
   * 智能上下文压缩
   */
  private compressContext(): void {
    const options: ContextCompressionOptions = {
      targetTokens: Math.floor(this.maxContextTokens * 0.6), // 压缩到60%
      preserveRecent: 5, // 保留最近5条消息
      preserveImportant: true,
      enableSummarization: true,
    }
    
    const { entries } = this.window
    const totalEntries = entries.length
    
    if (totalEntries <= options.preserveRecent) {
      return // 条目数量不足，无需压缩
    }
    
    // 分离最近的条目（始终保留）
    const recentEntries = entries.slice(-options.preserveRecent)
    const oldEntries = entries.slice(0, -options.preserveRecent)
    
    // 对旧条目进行重要性排序和压缩
    const compressedOldEntries = this.compressOldEntries(oldEntries, options)
    
    // 重建上下文窗口
    const newEntries = [...compressedOldEntries, ...recentEntries]
    const newTokenCount = newEntries.reduce((sum, entry) => sum + entry.tokens, 0)
    
    this.window.entries = newEntries
    this.window.currentTokens = newTokenCount
    this.window.compressionRatio = newTokenCount / this.window.currentTokens || 1
    
    debugLog(`🗜️  上下文压缩完成: ${totalEntries} → ${newEntries.length} 条目, token数: ${this.window.currentTokens} → ${newTokenCount}`)
  }
  
  /**
   * 压缩旧条目
   */
  private compressOldEntries(
    entries: ContextEntry[], 
    options: ContextCompressionOptions,
  ): ContextEntry[] {
    if (entries.length === 0) return []
    
    // 按重要性排序
    const sortedByImportance = entries
      .slice()
      .sort((a, b) => b.importance - a.importance)
    
    const compressed: ContextEntry[] = []
    let currentTokens = 0
    const targetTokens = options.targetTokens * 0.4 // 给旧内容分配40%的目标token
    
    // 保留重要的条目
    if (options.preserveImportant) {
      for (const entry of sortedByImportance) {
        if (entry.importance > 0.7 && currentTokens + entry.tokens <= targetTokens) {
          compressed.push(entry)
          currentTokens += entry.tokens
        }
      }
    }
    
    // 如果启用摘要功能，创建摘要条目
    if (options.enableSummarization && entries.length > 10) {
      const summaryEntry = this.createSummaryEntry(entries)
      if (currentTokens + summaryEntry.tokens <= targetTokens) {
        compressed.push(summaryEntry)
        currentTokens += summaryEntry.tokens
      }
    }
    
    return compressed.sort((a, b) => a.timestamp - b.timestamp) // 按时间排序
  }
  
  /**
   * 创建摘要条目
   */
  private createSummaryEntry(entries: ContextEntry[]): ContextEntry {
    const conversationEntries = entries.filter(e => e.type === 'conversation')
    const toolEntries = entries.filter(e => e.type === 'tool_use')
    
    const summaryParts: string[] = []
    
    if (conversationEntries.length > 0) {
      summaryParts.push(`对话摘要: 包含${conversationEntries.length}条对话消息`)
    }
    
    if (toolEntries.length > 0) {
      const toolTypes = [...new Set(toolEntries.map(e => e.content.match(/使用工具: (\w+)/)?.[1]).filter(Boolean))]
      summaryParts.push(`工具使用: ${toolTypes.join(', ')} (${toolEntries.length}次调用)`)
    }
    
    const summaryContent = summaryParts.join('; ')
    const estimatedTokens = Math.floor(summaryContent.length / 4) // 粗略估算
    
    return {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: `[上下文摘要] ${summaryContent}`,
      timestamp: Date.now(),
      tokens: estimatedTokens,
      importance: 0.8, // 摘要具有较高重要性
      type: 'background',
    }
  }
  
  /**
   * 计算文本的重要性评分
   */
  calculateImportance(content: string, type: ContextEntry['type']): number {
    let score = 0.5 // 基础分数
    
    // 根据类型调整分数
    switch (type) {
      case 'conversation':
        score = 0.6
        break
      case 'tool_use':
        score = 0.7
        break
      case 'system_info':
        score = 0.8
        break
      case 'background':
        score = 0.3
        break
    }
    
    // 根据内容特征调整分数
    const lowerContent = content.toLowerCase()
    
    // 包含错误信息的内容重要性较高
    if (lowerContent.includes('error') || lowerContent.includes('错误') || lowerContent.includes('失败')) {
      score += 0.2
    }
    
    // 包含决策或结论的内容重要性较高
    if (lowerContent.includes('决定') || lowerContent.includes('结论') || lowerContent.includes('完成')) {
      score += 0.15
    }
    
    // 很长的内容可能包含重要信息
    if (content.length > 1000) {
      score += 0.1
    }
    
    // 很短的内容重要性较低
    if (content.length < 50) {
      score -= 0.1
    }
    
    return Math.max(0, Math.min(1, score)) // 限制在 0-1 范围内
  }
  
  /**
   * 获取上下文统计信息
   */
  getStats() {
    const { entries, currentTokens, maxTokens, compressionRatio } = this.window
    
    const typeStats = entries.reduce((stats, entry) => {
      stats[entry.type] = (stats[entry.type] || 0) + 1
      return stats
    }, {} as Record<string, number>)
    
    const avgImportance = entries.length > 0 
      ? entries.reduce((sum, e) => sum + e.importance, 0) / entries.length 
      : 0
    
    return {
      totalEntries: entries.length,
      currentTokens,
      maxTokens,
      utilizationRatio: currentTokens / maxTokens,
      compressionRatio,
      typeDistribution: typeStats,
      averageImportance: avgImportance,
      oldestEntry: entries.length > 0 ? entries[0].timestamp : null,
      newestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
    }
  }
  
  /**
   * 清理上下文
   */
  clear(): void {
    this.window.entries = []
    this.window.currentTokens = 0
    this.window.compressionRatio = 1.0
  }
  
  /**
   * 导出上下文数据
   */
  export(): ContextWindow {
    return { ...this.window }
  }
  
  /**
   * 导入上下文数据
   */
  import(contextWindow: ContextWindow): void {
    this.window = { ...contextWindow }
  }
}

/**
 * 全局上下文管理器实例
 */
let globalContextManager: ContextManager | null = null

/**
 * 获取全局上下文管理器
 */
export function getContextManager(): ContextManager {
  if (!globalContextManager) {
    globalContextManager = new ContextManager()
  }
  return globalContextManager
}

/**
 * 创建新的上下文管理器实例
 */
export function createContextManager(maxTokens?: number): ContextManager {
  return new ContextManager(maxTokens)
}

/**
 * 估算文本token数量（粗略估算）
 */
export function estimateTokens(text: string): number {
  // 中文字符约1.5个token，英文单词约1个token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length
  
  return Math.ceil(chineseChars * 1.5 + englishWords)
}

/**
 * 智能分割长文本
 */
export function smartSplitText(text: string, maxTokensPerChunk: number): string[] {
  const totalTokens = estimateTokens(text)
  
  if (totalTokens <= maxTokensPerChunk) {
    return [text]
  }
  
  const chunks: string[] = []
  const sentences = text.split(/[。！？.!?]+/).filter(Boolean)
  
  let currentChunk = ''
  let currentTokens = 0
  
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence)
    
    if (currentTokens + sentenceTokens > maxTokensPerChunk && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
      currentTokens = sentenceTokens
    } else {
      currentChunk += (currentChunk ? '' : '') + sentence
      currentTokens += sentenceTokens
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}