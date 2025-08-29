import { WU2ContextCompressor } from './wU2-compressor.js'
import { ArticleContext } from '@/types/agent.js'
import { Message } from '@/types/message.js'
import { ContextSnapshot, ContextMetrics } from '@/types/context.js'

/**
 * 上下文管理器
 * 负责管理写作会话的上下文状态
 */
export class ContextManager {
  private compressor: WU2ContextCompressor
  private context: ArticleContext
  private snapshots: ContextSnapshot[] = []

  constructor() {
    this.compressor = new WU2ContextCompressor()
    this.context = this.initializeContext()
  }

  /**
   * 初始化空白上下文
   */
  private initializeContext(): ArticleContext {
    return {
      researchMaterial: [],
      dialogueHistory: [],
      referenceArticles: [],
      toolUsageHistory: [],
      tokenCount: 0,
      compressionLevel: 0,
      lastUpdated: Date.now()
    }
  }

  /**
   * 获取当前上下文
   */
  getCurrentContext(): ArticleContext {
    return { ...this.context }
  }

  /**
   * 更新上下文
   */
  async updateContext(message: Message, updates: Partial<ArticleContext>): Promise<void> {
    // 更新上下文
    this.context = { ...this.context, ...updates }
    
    // 添加消息到对话历史
    if (!this.context.dialogueHistory) {
      this.context.dialogueHistory = []
    }
    this.context.dialogueHistory.push(message)
    
    // 检查是否需要压缩
    if (this.compressor.shouldCompress(this.context)) {
      console.log('[ContextManager] 触发上下文压缩')
      const { compressed } = await this.compressor.compress(this.context)
      this.context = compressed
    }
    
    this.context.lastUpdated = Date.now()
  }

  /**
   * 添加研究材料
   */
  addResearchMaterial(material: any): void {
    if (!this.context.researchMaterial) {
      this.context.researchMaterial = []
    }
    this.context.researchMaterial.push(material)
  }

  /**
   * 设置当前文章
   */
  setCurrentArticle(article: string): void {
    this.context.currentArticle = article
  }

  /**
   * 设置活动大纲
   */
  setActiveOutline(outline: any): void {
    this.context.activeOutline = outline
  }

  /**
   * 创建上下文快照
   */
  createSnapshot(): ContextSnapshot {
    const snapshot: ContextSnapshot = {
      sessionId: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      tokenCount: this.compressor.getContextMetrics(this.context).currentTokens,
      compressionLevel: this.context.compressionLevel || 0,
      researchItems: this.context.researchMaterial?.length || 0,
      dialogueItems: this.context.dialogueHistory?.length || 0,
      referenceArticles: this.context.referenceArticles?.length || 0
    }
    
    this.snapshots.push(snapshot)
    return snapshot
  }

  /**
   * 获取上下文指标
   */
  getMetrics(): ContextMetrics {
    return this.compressor.getContextMetrics(this.context)
  }

  /**
   * 获取压缩统计
   */
  getCompressionStats() {
    return this.compressor.getCompressionStats()
  }

  /**
   * 清理上下文
   */
  clearContext(): void {
    this.context = this.initializeContext()
    this.snapshots = []
    console.log('[ContextManager] 上下文已清理')
  }

  /**
   * 导出上下文（用于调试）
   */
  exportContext(): {
    context: ArticleContext
    snapshots: ContextSnapshot[]
    metrics: ContextMetrics
    compressionStats: any
  } {
    return {
      context: this.getCurrentContext(),
      snapshots: [...this.snapshots],
      metrics: this.getMetrics(),
      compressionStats: this.getCompressionStats()
    }
  }
}