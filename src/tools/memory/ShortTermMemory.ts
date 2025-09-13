import { promises as fs, mkdirSync } from 'fs'
import path from 'path'
import os from 'os'
import { z } from 'zod'
import { Message, CompressionThreshold } from '../../types/Memory.js'

// Token 计算工具 - 基于 Claude Code 的 token 估算
import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'

export class TokenCalculator {
  private static readonly AVG_CHARS_PER_TOKEN = 4
  private static readonly CONTEXT_LIMIT = 200000 // 200K tokens Claude限制

  static estimateTokens(text: string): number {
    // 简单的 token 估算：字符数 / 4，特殊处理中文
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars
    
    // 中文字符通常占用更多 tokens
    return Math.ceil((chineseChars * 1.5 + otherChars) / this.AVG_CHARS_PER_TOKEN)
  }

  static getContextLimit(): number {
    return this.CONTEXT_LIMIT
  }

  static getCompressionThreshold(): number {
    return Math.floor(this.CONTEXT_LIMIT * (CompressionThreshold.TOKEN_LIMIT / 100))
  }
}

// Zod Schema 验证
const MessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().transform((str: string) => new Date(str)),
  tokens: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional()
})

const MessageArraySchema = z.array(MessageSchema)

export class ShortTermMemory {
  private messagesDir: string
  private sessionFile: string
  private sessionId: string
  private messages: Message[] = []

  constructor(sessionId?: string) {
    this.sessionId = sessionId || this.generateSessionId()
    this.messagesDir = this.getMessagesDirectory()
    this.sessionFile = path.join(this.messagesDir, `${this.sessionId}-messages.json`)
    this.ensureDirectoryExistsSync()
  }

  private getMessagesDirectory(): string {
    const configDir = process.env.WRITEFLOW_CONFIG_DIR ?? path.join(os.homedir(), '.writeflow')
    return path.join(configDir, 'memory', 'short-term')
  }

  private ensureDirectoryExistsSync(): void {
    try {
      mkdirSync(this.messagesDir, { recursive: true })
    } catch (error) {
      logError('创建短期记忆目录失败:', error)
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  async loadMessages(): Promise<Message[]> {
    try {
      const exists = await fs.access(this.sessionFile).then(() => true).catch(() => false)
      if (!exists) {
        return []
      }

      const data = await fs.readFile(this.sessionFile, 'utf-8')
      const parsed = JSON.parse(data)
      const validatedData = MessageArraySchema.parse(parsed)
      
      return validatedData.map(item => ({
        ...item,
        role: item.role as 'user' | 'assistant' | 'system',
        tokens: item.tokens || TokenCalculator.estimateTokens(item.content)
      }))
    } catch (error) {
      logError('加载短期记忆失败:', error)
      return []
    }
  }

  async saveMessages(messages: Message[]): Promise<void> {
    try {
      const data = JSON.stringify(messages, null, 2)
      await fs.writeFile(this.sessionFile, data, { encoding: 'utf-8', flag: 'w' })
      this.messages = messages
    } catch (error) {
      logError('保存短期记忆失败:', error)
      throw error
    }
  }

  async addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, any>): Promise<Message> {
    const messages = await this.loadMessages()
    const now = new Date()
    
    const newMessage: Message = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: now,
      tokens: TokenCalculator.estimateTokens(content),
      metadata
    }

    messages.push(newMessage)
    await this.saveMessages(messages)
    return newMessage
  }

  async getRecentMessages(limit?: number): Promise<Message[]> {
    const messages = await this.loadMessages()
    return limit ? messages.slice(-limit) : messages
  }

  async getTotalTokens(): Promise<number> {
    const messages = await this.loadMessages()
    return messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0)
  }

  async checkCompressionNeeded(): Promise<{ needed: boolean; currentTokens: number; threshold: number }> {
    const currentTokens = await this.getTotalTokens()
    const threshold = TokenCalculator.getCompressionThreshold()
    
    return {
      needed: currentTokens >= threshold,
      currentTokens,
      threshold
    }
  }

  async getOldestMessages(count: number): Promise<Message[]> {
    const messages = await this.loadMessages()
    return messages.slice(0, count)
  }

  async removeMessages(messageIds: string[]): Promise<void> {
    const messages = await this.loadMessages()
    const filteredMessages = messages.filter(msg => !messageIds.includes(msg.id))
    await this.saveMessages(filteredMessages)
  }

  async clearAllMessages(): Promise<void> {
    await this.saveMessages([])
  }

  async getMessageById(id: string): Promise<Message | null> {
    const messages = await this.loadMessages()
    return messages.find(msg => msg.id === id) || null
  }

  async getMessagesByRole(role: 'user' | 'assistant' | 'system'): Promise<Message[]> {
    const messages = await this.loadMessages()
    return messages.filter(msg => msg.role === role)
  }

  async getMessagesByTimeRange(start: Date, end: Date): Promise<Message[]> {
    const messages = await this.loadMessages()
    return messages.filter(msg => 
      msg.timestamp >= start && msg.timestamp <= end
    )
  }

  getSessionId(): string {
    return this.sessionId
  }

  getSessionFile(): string {
    return this.sessionFile
  }

  getStats(): { sessionId: string; storagePath: string; messageCount: number; totalTokens: number } {
    return {
      sessionId: this.sessionId,
      storagePath: this.sessionFile,
      messageCount: this.messages.length,
      totalTokens: this.messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0)
    }
  }
}