import { ArticleContext } from '../../types/agent.js'
import { Message } from '../../types/message.js'
import { 
  ResearchItem, 
  DialogueItem, 
  ReferenceArticle,
  ContextCompressionResult,
  CompressionConfig,
  ContextMetrics
} from '../../types/context.js'

/**
 * wU2 上下文压缩器
 * 复刻 Claude Code 的上下文管理机制
 * 
 * 核心功能：
 * - 92% 阈值触发压缩
 * - 智能内容排序和筛选
 * - 保留核心上下文信息
 * - 压缩性能监控
 */
export class WU2ContextCompressor {
  private readonly DEFAULT_CONFIG: CompressionConfig = {
    threshold: 0.92, // 92% 阈值
    preserveRatio: 0.3, // 保留30%内容
    maxResearchItems: 20,
    maxDialogueHistory: 50,
    maxReferenceArticles: 10,
    intelligentRanking: true
  }

  private compressionHistory: ContextCompressionResult[] = []
  
  constructor(private config: Partial<CompressionConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config }
  }

  /**
   * 主压缩方法
   * 当上下文token数超过92%阈值时触发
   */
  async compress(context: ArticleContext): Promise<{
    compressed: ArticleContext
    result: ContextCompressionResult
  }> {
    const startTime = Date.now()
    const originalTokens = this.calculateTokens(context)
    const maxTokens = this.getMaxContextTokens()
    
    // 检查是否需要压缩
    if (originalTokens < maxTokens * (this.config.threshold || 0.92)) {
      return {
        compressed: context,
        result: {
          originalTokens,
          compressedTokens: originalTokens,
          compressionRatio: 0,
          itemsRemoved: 0,
          compressionTime: 0
        }
      }
    }

    console.log(`[wU2] 触发上下文压缩: ${originalTokens} tokens > ${Math.floor(maxTokens * (this.config.threshold || 0.92))} tokens`)

    // 执行智能压缩
    const compressed = await this.performIntelligentCompression(context)
    
    // 计算压缩结果
    const compressedTokens = this.calculateTokens(compressed)
    const compressionTime = Date.now() - startTime
    
    const result: ContextCompressionResult = {
      originalTokens,
      compressedTokens,
      compressionRatio: 1 - (compressedTokens / originalTokens),
      itemsRemoved: this.calculateItemsRemoved(context, compressed),
      compressionTime
    }
    
    // 记录压缩历史
    this.compressionHistory.push(result)
    
    console.log(`[wU2] 压缩完成: ${originalTokens} -> ${compressedTokens} tokens (${(result.compressionRatio * 100).toFixed(1)}% 减少, ${compressionTime}ms)`)
    
    return { compressed, result }
  }

  /**
   * 智能压缩执行
   */
  private async performIntelligentCompression(context: ArticleContext): Promise<ArticleContext> {
    return {
      // 核心上下文（永不压缩）
      currentArticle: context.currentArticle,
      activeOutline: context.activeOutline,
      writingGoals: context.writingGoals,
      userPreferences: context.userPreferences,
      
      // 智能压缩内容
      researchMaterial: await this.compressResearchMaterial(context.researchMaterial || []),
      dialogueHistory: await this.compressDialogueHistory(context.dialogueHistory || []),
      referenceArticles: await this.compressReferences(context.referenceArticles || []),
      toolUsageHistory: await this.compressToolHistory(context.toolUsageHistory || []),
      
      // 更新元数据
      tokenCount: 0, // 将重新计算
      compressionLevel: (context.compressionLevel || 0) + 1,
      lastUpdated: Date.now()
    }
  }

  /**
   * 压缩研究材料
   */
  private async compressResearchMaterial(materials: ResearchItem[]): Promise<ResearchItem[]> {
    if (materials.length === 0) return materials
    
    // 按重要性评分排序
    const scored = materials.map(item => ({
      item,
      score: this.calculateImportanceScore(item)
    })).sort((a, b) => b.score - a.score)
    
    // 保留前N个最重要的内容
    const keepCount = Math.min(
      Math.ceil(materials.length * (this.config.preserveRatio || 0.3)),
      this.config.maxResearchItems || 20
    )
    
    const kept = scored.slice(0, keepCount)
    
    // 压缩保留的内容
    return kept.map(({ item }) => ({
      ...item,
      content: this.summarizeText(item.content, 200), // 压缩到200字
      summary: this.extractKeyPoints(item.content, 3) // 提取3个关键点
    }))
  }

  /**
   * 压缩对话历史
   */
  private async compressDialogueHistory(history: Message[]): Promise<Message[]> {
    if (history.length === 0) return history
    
    // 转换为 DialogueItem 便于处理
    const dialogueItems: DialogueItem[] = history.map(msg => ({
      id: msg.id,
      role: msg.source === 'user' ? 'user' : 'assistant',
      content: typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload),
      timestamp: msg.timestamp,
      importance: this.calculateDialogueImportance(msg),
      tokens: this.estimateTokens(msg.payload)
    }))
    
    // 按重要性和时间排序
    const sorted = dialogueItems.sort((a, b) => {
      // 优先保留重要对话
      if (a.importance !== b.importance) {
        return b.importance - a.importance
      }
      // 然后按时间排序
      return b.timestamp - a.timestamp
    })
    
    // 保留指定数量的对话
    const kept = sorted.slice(0, this.config.maxDialogueHistory)
    
    // 转换回 Message 格式
    return kept.map(item => ({
      id: item.id,
      type: item.role === 'user' ? 'user_input' : 'agent_response',
      priority: 50,
      payload: item.content,
      timestamp: item.timestamp,
      source: item.role
    })) as Message[]
  }

  /**
   * 压缩参考文章
   */
  private async compressReferences(references: ReferenceArticle[]): Promise<ReferenceArticle[]> {
    if (references.length === 0) return references
    
    // 按相关性评分排序
    const sorted = references.sort((a, b) => b.relevanceScore - a.relevanceScore)
    
    // 保留最相关的文章
    const kept = sorted.slice(0, this.config.maxReferenceArticles)
    
    // 压缩文章内容
    return kept.map(ref => ({
      ...ref,
      content: this.summarizeText(ref.content, 500), // 压缩到500字
      keyPoints: ref.keyPoints.slice(0, 5) // 保留前5个要点
    }))
  }

  /**
   * 压缩工具使用历史
   */
  private async compressToolHistory(history: any[]): Promise<any[]> {
    // 只保留最近的工具使用记录
    const recent = history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
    
    // 移除详细的输入输出，只保留摘要
    return recent.map(item => ({
      toolName: item.toolName,
      timestamp: item.timestamp,
      success: item.success,
      summary: item.summary || this.generateToolSummary(item)
    }))
  }

  /**
   * 计算重要性评分
   */
  private calculateImportanceScore(item: ResearchItem): number {
    let score = 0
    
    // 时效性（最近的内容得分更高）
    const daysSinceCreated = (Date.now() - item.createdAt) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 1 - daysSinceCreated / 30) * 0.3
    
    // 引用频率
    score += Math.min(item.referenceCount / 10, 1) * 0.3
    
    // 内容质量（长度、结构等）
    score += Math.min(item.content.length / 2000, 1) * 0.2
    
    // 相关性评分
    score += item.relevanceScore * 0.2
    
    return score
  }

  /**
   * 计算对话重要性
   */
  private calculateDialogueImportance(message: Message): number {
    let importance = 1
    
    // 斜杠命令更重要
    if (message.type === 'slash_command') {
      importance += 2
    }
    
    // 长对话更重要
    const content = typeof message.payload === 'string' ? message.payload : ''
    if (content.length > 500) {
      importance += 1
    }
    
    // 包含关键词的对话更重要
    const keywords = ['大纲', 'outline', '写作', '研究', '发布']
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        importance += 0.5
        break
      }
    }
    
    return importance
  }

  /**
   * 文本摘要（简单实现）
   */
  private summarizeText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    
    // 简单截断，保留开头和结尾
    const keepStart = Math.floor(maxLength * 0.7)
    const keepEnd = maxLength - keepStart - 10
    
    return text.slice(0, keepStart) + 
           '\n...[已压缩]...\n' + 
           text.slice(-keepEnd)
  }

  /**
   * 提取关键点
   */
  private extractKeyPoints(text: string, maxPoints: number): string {
    // 简单实现：提取每个段落的第一句
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 10)
    return sentences.slice(0, maxPoints).join('；')
  }

  /**
   * 估算token数量
   */
  private estimateTokens(content: any): number {
    // 添加安全检查
    if (!content) return 0
    
    const text = typeof content === 'string' ? content : JSON.stringify(content)
    if (!text) return 0
    
    // 粗略估算：中文1字=1token，英文1词=0.75token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    return chineseChars + Math.ceil(englishWords * 0.75)
  }

  /**
   * 计算上下文总token数
   */
  private calculateTokens(context: ArticleContext): number {
    let total = 0
    
    if (context.currentArticle) {
      total += this.estimateTokens(context.currentArticle)
    }
    
    if (context.researchMaterial) {
      total += context.researchMaterial.reduce((sum, item) => 
        sum + this.estimateTokens(item), 0)
    }
    
    if (context.dialogueHistory) {
      total += context.dialogueHistory.reduce((sum, msg) => {
        // 兼容两种格式：payload 或 content
        const content = msg.payload || (msg as any).content
        return sum + this.estimateTokens(content)
      }, 0)
    }
    
    if (context.referenceArticles) {
      total += context.referenceArticles.reduce((sum, ref) => 
        sum + this.estimateTokens(ref), 0)
    }
    
    return total
  }

  /**
   * 获取最大上下文token数
   */
  private getMaxContextTokens(): number {
    // Claude 的上下文窗口大小
    return 128000
  }

  /**
   * 计算被移除的项目数
   */
  private calculateItemsRemoved(original: ArticleContext, compressed: ArticleContext): number {
    let removed = 0
    
    removed += (original.researchMaterial?.length || 0) - (compressed.researchMaterial?.length || 0)
    removed += (original.dialogueHistory?.length || 0) - (compressed.dialogueHistory?.length || 0)
    removed += (original.referenceArticles?.length || 0) - (compressed.referenceArticles?.length || 0)
    
    return removed
  }

  /**
   * 生成工具使用摘要
   */
  private generateToolSummary(toolUsage: any): string {
    return `${toolUsage.toolName}: ${toolUsage.success ? '成功' : '失败'}`
  }

  /**
   * 获取压缩统计
   */
  getCompressionStats(): {
    totalCompressions: number
    averageRatio: number
    averageTime: number
    totalItemsRemoved: number
  } {
    if (this.compressionHistory.length === 0) {
      return {
        totalCompressions: 0,
        averageRatio: 0,
        averageTime: 0,
        totalItemsRemoved: 0
      }
    }
    
    const totalRatio = this.compressionHistory.reduce((sum, r) => sum + r.compressionRatio, 0)
    const totalTime = this.compressionHistory.reduce((sum, r) => sum + r.compressionTime, 0)
    const totalRemoved = this.compressionHistory.reduce((sum, r) => sum + r.itemsRemoved, 0)
    
    return {
      totalCompressions: this.compressionHistory.length,
      averageRatio: totalRatio / this.compressionHistory.length,
      averageTime: totalTime / this.compressionHistory.length,
      totalItemsRemoved: totalRemoved
    }
  }

  /**
   * 获取当前上下文指标
   */
  getContextMetrics(context: ArticleContext): ContextMetrics {
    const currentTokens = this.calculateTokens(context)
    const maxTokens = this.getMaxContextTokens()
    
    return {
      currentTokens,
      maxTokens,
      utilizationRatio: currentTokens / maxTokens,
      compressionHistory: [...this.compressionHistory],
      lastCompression: this.compressionHistory.length > 0 
        ? this.compressionHistory[this.compressionHistory.length - 1].compressionTime 
        : undefined,
      memoryUsage: process.memoryUsage().heapUsed
    }
  }

  /**
   * 检查是否需要压缩
   */
  shouldCompress(context: ArticleContext): boolean {
    const tokens = this.calculateTokens(context)
    const maxTokens = this.getMaxContextTokens()
    return tokens >= maxTokens * (this.config.threshold || 0.92)
  }

  /**
   * 重置压缩历史
   */
  resetCompressionHistory(): void {
    this.compressionHistory = []
  }
}