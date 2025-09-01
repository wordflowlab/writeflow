import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { z } from 'zod'
import { Message, ConversationSummary } from '../../types/Memory.js'

// 基于 Claude Code 的 8 段结构化总结算法
export class ConversationSummarizer {
  // 8段总结模板 - 完全复刻 Claude Code 的总结结构
  static readonly SUMMARY_TEMPLATE = {
    context: "会话背景和目标",
    keyTopics: "主要讨论话题",
    decisions: "重要决策和结论", 
    technicalDetails: "技术实现细节",
    challenges: "遇到的问题和解决方案",
    outcomes: "产出和成果",
    nextSteps: "待办事项和后续计划",
    metadata: "参与者、时间范围、关键词"
  }

  static async generateSummary(messages: Message[], sessionId: string): Promise<ConversationSummary> {
    const timeRange = {
      start: messages[0]?.timestamp || new Date(),
      end: messages[messages.length - 1]?.timestamp || new Date()
    }

    // 提取关键信息
    const participants = Array.from(new Set(messages.map(m => m.role)))
    const topics = this.extractTopics(messages)
    const keyPoints = this.extractKeyPoints(messages)
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0)

    // 生成结构化总结
    const summary = this.generateStructuredSummary(messages, {
      context: this.extractContext(messages),
      keyTopics: topics.slice(0, 5),
      decisions: this.extractDecisions(messages),
      technicalDetails: this.extractTechnicalDetails(messages),
      challenges: this.extractChallenges(messages),
      outcomes: this.extractOutcomes(messages),
      nextSteps: this.extractNextSteps(messages),
      metadata: { participants, timeRange, messageCount: messages.length }
    })

    return {
      id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timeRange,
      messageCount: messages.length,
      totalTokens,
      summary,
      keyPoints,
      participants,
      topics,
      createdAt: new Date()
    }
  }

  private static extractContext(messages: Message[]): string {
    // 从前几条消息提取会话背景
    const contextMessages = messages.slice(0, 3)
    return contextMessages
      .filter(m => m.role === 'user')
      .map(m => m.content.substring(0, 200))
      .join(' ')
  }

  private static extractTopics(messages: Message[]): string[] {
    const allContent = messages.map(m => m.content).join(' ')
    
    // 简单的关键词提取（可以后续增强为更复杂的 NLP）
    const keywords = allContent
      .toLowerCase()
      .match(/\b[a-z\u4e00-\u9fff]{3,}\b/g)
    
    if (!keywords) return []
    
    // 统计词频并返回高频词
    const frequency: Record<string, number> = {}
    keywords.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  private static extractKeyPoints(messages: Message[]): string[] {
    return messages
      .filter(m => m.role === 'assistant')
      .map(m => {
        // 提取句子中的关键点
        const sentences = m.content.split(/[。！？\n]/).filter(s => s.trim().length > 10)
        return sentences[0] // 每条消息的第一个关键句子
      })
      .filter(Boolean)
      .slice(0, 8)
  }

  private static extractDecisions(messages: Message[]): string {
    const decisionKeywords = ['决定', '确定', '选择', 'decide', 'choose']
    return this.extractByKeywords(messages, decisionKeywords)
  }

  private static extractTechnicalDetails(messages: Message[]): string {
    const techKeywords = ['实现', '代码', '函数', '类', 'class', 'function', 'implement']
    return this.extractByKeywords(messages, techKeywords)
  }

  private static extractChallenges(messages: Message[]): string {
    const challengeKeywords = ['问题', '错误', '失败', 'error', 'issue', 'problem']
    return this.extractByKeywords(messages, challengeKeywords)
  }

  private static extractOutcomes(messages: Message[]): string {
    const outcomeKeywords = ['完成', '成功', '结果', 'complete', 'success', 'result']
    return this.extractByKeywords(messages, outcomeKeywords)
  }

  private static extractNextSteps(messages: Message[]): string {
    const nextStepKeywords = ['下一步', '接下来', '计划', 'next', 'plan', 'todo']
    return this.extractByKeywords(messages, nextStepKeywords)
  }

  private static extractByKeywords(messages: Message[], keywords: string[]): string {
    const relevantMessages = messages.filter(m => {
      const content = m.content.toLowerCase()
      return keywords.some(keyword => content.includes(keyword))
    })
    
    return relevantMessages
      .map(m => m.content.substring(0, 100))
      .slice(0, 3)
      .join(' | ')
  }

  private static generateStructuredSummary(messages: Message[], sections: any): string {
    return `
## 会话总结

### 背景与目标
${sections.context || '无特定背景'}

### 主要话题
${sections.keyTopics.join(', ') || '无明确话题'}

### 重要决策
${sections.decisions || '无重要决策'}

### 技术细节
${sections.technicalDetails || '无技术实现'}

### 问题与解决
${sections.challenges || '无明显问题'}

### 成果产出
${sections.outcomes || '无具体产出'}

### 后续计划
${sections.nextSteps || '无后续计划'}

### 元数据
- 消息数量: ${sections.metadata.messageCount}
- 参与者: ${sections.metadata.participants.join(', ')}
- 时间范围: ${sections.metadata.timeRange.start.toISOString().split('T')[0]} 至 ${sections.metadata.timeRange.end.toISOString().split('T')[0]}
    `.trim()
  }
}

// Zod Schema
const ConversationSummarySchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  timeRange: z.object({
    start: z.string().transform((str: string) => new Date(str)),
    end: z.string().transform((str: string) => new Date(str))
  }),
  messageCount: z.number(),
  totalTokens: z.number(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  participants: z.array(z.string()),
  topics: z.array(z.string()),
  createdAt: z.string().transform((str: string) => new Date(str))
})

const SummaryArraySchema = z.array(ConversationSummarySchema)

export class MidTermMemory {
  private summariesDir: string
  private summariesFile: string

  constructor() {
    this.summariesDir = this.getSummariesDirectory()
    this.summariesFile = path.join(this.summariesDir, 'conversation-summaries.json')
    this.ensureDirectoryExistsSync()
  }

  private getSummariesDirectory(): string {
    const configDir = process.env.WRITEFLOW_CONFIG_DIR ?? path.join(os.homedir(), '.writeflow')
    return path.join(configDir, 'memory', 'mid-term')
  }

  private ensureDirectoryExistsSync(): void {
    try {
      require('fs').mkdirSync(this.summariesDir, { recursive: true })
    } catch (error) {
      console.error('创建中期记忆目录失败:', error)
    }
  }

  async loadSummaries(): Promise<ConversationSummary[]> {
    try {
      const exists = await fs.access(this.summariesFile).then(() => true).catch(() => false)
      if (!exists) {
        return []
      }

      const data = await fs.readFile(this.summariesFile, 'utf-8')
      const parsed = JSON.parse(data)
      const validatedData = SummaryArraySchema.parse(parsed)
      
      return validatedData
    } catch (error) {
      console.error('加载中期记忆失败:', error)
      return []
    }
  }

  async saveSummaries(summaries: ConversationSummary[]): Promise<void> {
    try {
      const data = JSON.stringify(summaries, null, 2)
      await fs.writeFile(this.summariesFile, data, { encoding: 'utf-8', flag: 'w' })
    } catch (error) {
      console.error('保存中期记忆失败:', error)
      throw error
    }
  }

  async addSummary(messages: Message[], sessionId: string): Promise<ConversationSummary> {
    const summaries = await this.loadSummaries()
    const newSummary = await ConversationSummarizer.generateSummary(messages, sessionId)
    
    summaries.push(newSummary)
    await this.saveSummaries(summaries)
    return newSummary
  }

  async getSummaryBySessionId(sessionId: string): Promise<ConversationSummary | null> {
    const summaries = await this.loadSummaries()
    return summaries.find(s => s.sessionId === sessionId) || null
  }

  async getSummariesByTimeRange(start: Date, end: Date): Promise<ConversationSummary[]> {
    const summaries = await this.loadSummaries()
    return summaries.filter(s => 
      s.timeRange.start >= start && s.timeRange.end <= end
    )
  }

  async searchSummariesByTopic(topic: string): Promise<ConversationSummary[]> {
    const summaries = await this.loadSummaries()
    const lowerTopic = topic.toLowerCase()
    
    return summaries.filter(s => 
      s.topics.some(t => t.toLowerCase().includes(lowerTopic)) ||
      s.summary.toLowerCase().includes(lowerTopic) ||
      s.keyPoints.some(p => p.toLowerCase().includes(lowerTopic))
    )
  }

  async getRecentSummaries(limit: number = 10): Promise<ConversationSummary[]> {
    const summaries = await this.loadSummaries()
    return summaries
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }

  async deleteSummary(summaryId: string): Promise<boolean> {
    const summaries = await this.loadSummaries()
    const index = summaries.findIndex(s => s.id === summaryId)
    
    if (index === -1) {
      return false
    }

    summaries.splice(index, 1)
    await this.saveSummaries(summaries)
    return true
  }

  async clearAllSummaries(): Promise<void> {
    await this.saveSummaries([])
  }

  async getStats(): Promise<{
    summaryCount: number
    totalSessions: number
    totalMessages: number
    totalTokens: number
    oldestSummary?: Date
    newestSummary?: Date
    topTopics: Array<{ topic: string; count: number }>
  }> {
    const summaries = await this.loadSummaries()
    
    if (summaries.length === 0) {
      return {
        summaryCount: 0,
        totalSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        topTopics: []
      }
    }

    // 统计话题频率
    const topicFrequency: Record<string, number> = {}
    summaries.forEach(s => {
      s.topics.forEach(topic => {
        topicFrequency[topic] = (topicFrequency[topic] || 0) + 1
      })
    })

    const topTopics = Object.entries(topicFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }))

    return {
      summaryCount: summaries.length,
      totalSessions: new Set(summaries.map(s => s.sessionId)).size,
      totalMessages: summaries.reduce((sum, s) => sum + s.messageCount, 0),
      totalTokens: summaries.reduce((sum, s) => sum + s.totalTokens, 0),
      oldestSummary: new Date(Math.min(...summaries.map(s => s.createdAt.getTime()))),
      newestSummary: new Date(Math.max(...summaries.map(s => s.createdAt.getTime()))),
      topTopics
    }
  }
}