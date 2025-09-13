import { promises as fs, mkdirSync } from 'fs'
import path from 'path'
import os from 'os'
import { z } from 'zod'
import { KnowledgeEntry, MemoryPriority } from '../../types/Memory.js'

// 知识图谱构建器 - 基于 Claude Code 的知识管理
import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'

export class KnowledgeGraph {
  static generateKnowledgeId(): string {
    return `knowledge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  static calculateConfidence(
    source: string, 
    references: string[], 
    accessCount: number
  ): number {
    let confidence = 0.5 // 基准置信度

    // 根据来源调整置信度
    if (source.includes('claude') || source.includes('assistant')) {
      confidence += 0.2
    }
    
    if (source.includes('user') || source.includes('manual')) {
      confidence += 0.1
    }

    // 根据引用数量调整
    confidence += Math.min(references.length * 0.05, 0.2)

    // 根据访问次数调整
    confidence += Math.min(accessCount * 0.02, 0.1)

    return Math.min(confidence, 1.0)
  }

  static extractTags(content: string): string[] {
    // 提取内容中的标签和关键词
    const tags = new Set<string>()
    
    // 技术相关关键词
    const techPattern = /\b(typescript|javascript|react|node|npm|class|function|interface|type|async|await)\b/gi
    const techMatches = content.match(techPattern)
    if (techMatches) {
      techMatches.forEach(match => tags.add(match.toLowerCase()))
    }

    // 动作相关关键词
    const actionPattern = /\b(实现|创建|修改|删除|更新|优化|重构|测试|调试|部署)\b/g
    const actionMatches = content.match(actionPattern)
    if (actionMatches) {
      actionMatches.forEach(match => tags.add(match))
    }

    // 文件类型
    const filePattern = /\.(ts|js|tsx|jsx|json|md|yaml|yml)\b/g
    const fileMatches = content.match(filePattern)
    if (fileMatches) {
      fileMatches.forEach(match => tags.add(`file${match}`))
    }

    return Array.from(tags).slice(0, 20) // 限制标签数量
  }

  static findReferences(content: string): string[] {
    const references = new Set<string>()
    
    // 提取文件路径引用
    const pathPattern = /[./]\w+(?:\/\w+)*\.\w+/g
    const pathMatches = content.match(pathPattern)
    if (pathMatches) {
      pathMatches.forEach(match => references.add(match))
    }

    // 提取函数和类名引用
    const namePattern = /\b[A-Z][a-zA-Z0-9]+(?:Manager|Service|Tool|Component|Handler)\b/g
    const nameMatches = content.match(namePattern)
    if (nameMatches) {
      nameMatches.forEach(match => references.add(match))
    }

    // 提取命令引用
    const cmdPattern = /\/\w+/g
    const cmdMatches = content.match(cmdPattern)
    if (cmdMatches) {
      cmdMatches.forEach(match => references.add(match))
    }

    return Array.from(references).slice(0, 10)
  }
}

// Zod Schema
const KnowledgeEntrySchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  content: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
  references: z.array(z.string()),
  createdAt: z.string().transform((str: string) => new Date(str)),
  updatedAt: z.string().transform((str: string) => new Date(str)),
  accessCount: z.number().min(0)
})

const KnowledgeArraySchema = z.array(KnowledgeEntrySchema)

export class LongTermMemory {
  private knowledgeDir: string
  private knowledgeFile: string

  constructor() {
    this.knowledgeDir = this.getKnowledgeDirectory()
    this.knowledgeFile = path.join(this.knowledgeDir, 'knowledge-base.json')
    this.ensureDirectoryExistsSync()
  }

  private getKnowledgeDirectory(): string {
    const configDir = process.env.WRITEFLOW_CONFIG_DIR ?? path.join(os.homedir(), '.writeflow')
    return path.join(configDir, 'memory', 'long-term')
  }

  private ensureDirectoryExistsSync(): void {
    try {
      mkdirSync(this.knowledgeDir, { recursive: true })
    } catch (error) {
      logError('创建长期记忆目录失败:', error)
    }
  }

  async loadKnowledge(): Promise<KnowledgeEntry[]> {
    try {
      const exists = await fs.access(this.knowledgeFile).then(() => true).catch(() => false)
      if (!exists) {
        return []
      }

      const data = await fs.readFile(this.knowledgeFile, 'utf-8')
      const parsed = JSON.parse(data)
      const validatedData = KnowledgeArraySchema.parse(parsed)
      
      return validatedData
    } catch (error) {
      logError('加载长期记忆失败:', error)
      return []
    }
  }

  async saveKnowledge(entries: KnowledgeEntry[]): Promise<void> {
    try {
      const data = JSON.stringify(entries, null, 2)
      await fs.writeFile(this.knowledgeFile, data, { encoding: 'utf-8', flag: 'w' })
    } catch (error) {
      logError('保存长期记忆失败:', error)
      throw error
    }
  }

  async addKnowledge(
    topic: string,
    content: string,
    source: string = 'system'
  ): Promise<KnowledgeEntry> {
    const entries = await this.loadKnowledge()
    const now = new Date()
    
    // 检查是否已存在相同主题的知识
    const existingEntry = entries.find(e => e.topic === topic)
    
    if (existingEntry) {
      // 更新现有条目
      existingEntry.content = content
      existingEntry.updatedAt = now
      existingEntry.accessCount += 1
      existingEntry.confidence = KnowledgeGraph.calculateConfidence(
        source,
        existingEntry.references,
        existingEntry.accessCount
      )
      
      await this.saveKnowledge(entries)
      return existingEntry
    } else {
      // 创建新条目
      const tags = KnowledgeGraph.extractTags(content)
      const references = KnowledgeGraph.findReferences(content)
      
      const newEntry: KnowledgeEntry = {
        id: KnowledgeGraph.generateKnowledgeId(),
        topic,
        content,
        source,
        confidence: KnowledgeGraph.calculateConfidence(source, references, 1),
        tags,
        references,
        createdAt: now,
        updatedAt: now,
        accessCount: 1
      }

      entries.push(newEntry)
      await this.saveKnowledge(entries)
      return newEntry
    }
  }

  async getKnowledgeByTopic(topic: string): Promise<KnowledgeEntry | null> {
    const entries = await this.loadKnowledge()
    const entry = entries.find(e => e.topic.toLowerCase() === topic.toLowerCase())
    
    if (entry) {
      // 增加访问计数并更新置信度
      entry.accessCount += 1
      entry.confidence = KnowledgeGraph.calculateConfidence(
        entry.source,
        entry.references,
        entry.accessCount
      )
      await this.saveKnowledge(entries)
    }
    
    return entry || null
  }

  async searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
    const entries = await this.loadKnowledge()
    const lowerQuery = query.toLowerCase()
    
    const matches = entries.filter(e => 
      e.topic.toLowerCase().includes(lowerQuery) ||
      e.content.toLowerCase().includes(lowerQuery) ||
      e.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      e.references.some(ref => ref.toLowerCase().includes(lowerQuery))
    )

    // 按置信度和访问次数排序
    return matches.sort((a, b) => {
      const scoreA = a.confidence * 0.7 + (a.accessCount / 100) * 0.3
      const scoreB = b.confidence * 0.7 + (b.accessCount / 100) * 0.3
      return scoreB - scoreA
    })
  }

  async getKnowledgeByTags(tags: string[]): Promise<KnowledgeEntry[]> {
    const entries = await this.loadKnowledge()
    const lowerTags = tags.map(t => t.toLowerCase())
    
    return entries.filter(e => 
      e.tags.some(tag => lowerTags.includes(tag.toLowerCase()))
    )
  }

  async getRelatedKnowledge(entryId: string): Promise<KnowledgeEntry[]> {
    const entries = await this.loadKnowledge()
    const targetEntry = entries.find(e => e.id === entryId)
    
    if (!targetEntry) {
      return []
    }

    // 基于标签和引用查找相关知识
    const related = entries.filter(e => {
      if (e.id === entryId) return false
      
      // 检查共同标签
      const commonTags = e.tags.filter(tag => 
        targetEntry.tags.includes(tag)
      ).length
      
      // 检查共同引用
      const commonRefs = e.references.filter(ref => 
        targetEntry.references.includes(ref)
      ).length
      
      return commonTags > 0 || commonRefs > 0
    })

    // 按相关性排序
    return related.sort((a, b) => {
      const scoreA = a.tags.filter(tag => targetEntry.tags.includes(tag)).length +
                    a.references.filter(ref => targetEntry.references.includes(ref)).length
      const scoreB = b.tags.filter(tag => targetEntry.tags.includes(tag)).length +
                    b.references.filter(ref => targetEntry.references.includes(ref)).length
      return scoreB - scoreA
    }).slice(0, 5)
  }

  async updateKnowledge(
    id: string, 
    updates: Partial<Pick<KnowledgeEntry, 'topic' | 'content' | 'tags' | 'references'>>
  ): Promise<KnowledgeEntry | null> {
    const entries = await this.loadKnowledge()
    const index = entries.findIndex(e => e.id === id)
    
    if (index === -1) {
      return null
    }

    const entry = entries[index]
    const now = new Date()

    // 应用更新
    if (updates.topic) entry.topic = updates.topic
    if (updates.content) entry.content = updates.content
    if (updates.tags) entry.tags = updates.tags
    if (updates.references) entry.references = updates.references
    
    entry.updatedAt = now
    entry.accessCount += 1
    entry.confidence = KnowledgeGraph.calculateConfidence(
      entry.source,
      entry.references,
      entry.accessCount
    )

    await this.saveKnowledge(entries)
    return entry
  }

  async deleteKnowledge(id: string): Promise<boolean> {
    const entries = await this.loadKnowledge()
    const index = entries.findIndex(e => e.id === id)
    
    if (index === -1) {
      return false
    }

    entries.splice(index, 1)
    await this.saveKnowledge(entries)
    return true
  }

  async getTopTopics(limit: number = 10): Promise<Array<{ topic: string; count: number }>> {
    const entries = await this.loadKnowledge()
    const topicFrequency: Record<string, number> = {}
    
    entries.forEach(e => {
      e.tags.forEach(tag => {
        topicFrequency[tag] = (topicFrequency[tag] || 0) + 1
      })
    })

    return Object.entries(topicFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([topic, count]) => ({ topic, count }))
  }

  async getHighConfidenceKnowledge(minConfidence: number = 0.8): Promise<KnowledgeEntry[]> {
    const entries = await this.loadKnowledge()
    return entries
      .filter(e => e.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
  }

  async clearAllKnowledge(): Promise<void> {
    await this.saveKnowledge([])
  }

  async getStats(): Promise<{
    knowledgeCount: number
    topicCount: number
    totalReferences: number
    averageConfidence: number
    mostAccessedEntry?: KnowledgeEntry
    newestEntry?: KnowledgeEntry
    oldestEntry?: KnowledgeEntry
    topTags: Array<{ tag: string; count: number }>
  }> {
    const entries = await this.loadKnowledge()
    
    if (entries.length === 0) {
      return {
        knowledgeCount: 0,
        topicCount: 0,
        totalReferences: 0,
        averageConfidence: 0,
        topTags: []
      }
    }

    // 统计标签频率
    const tagFrequency: Record<string, number> = {}
    entries.forEach(e => {
      e.tags.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1
      })
    })

    const topTags = Object.entries(tagFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    return {
      knowledgeCount: entries.length,
      topicCount: new Set(entries.map(e => e.topic)).size,
      totalReferences: entries.reduce((sum, e) => sum + e.references.length, 0),
      averageConfidence: entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length,
      mostAccessedEntry: entries.reduce((max, e) => e.accessCount > max.accessCount ? e : max),
      newestEntry: entries.reduce((newest, e) => e.createdAt > newest.createdAt ? e : newest),
      oldestEntry: entries.reduce((oldest, e) => e.createdAt < oldest.createdAt ? e : oldest),
      topTags
    }
  }
}