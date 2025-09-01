export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tokens?: number
  metadata?: Record<string, any>
}

export interface ConversationSummary {
  id: string
  sessionId: string
  timeRange: {
    start: Date
    end: Date
  }
  messageCount: number
  totalTokens: number
  summary: string
  keyPoints: string[]
  participants: string[]
  topics: string[]
  createdAt: Date
}

export interface KnowledgeEntry {
  id: string
  topic: string
  content: string
  source: string
  confidence: number
  tags: string[]
  references: string[]
  createdAt: Date
  updatedAt: Date
  accessCount: number
}

export interface MemoryStats {
  shortTerm: {
    messageCount: number
    totalTokens: number
    oldestMessage?: Date
    newestMessage?: Date
  }
  midTerm: {
    summaryCount: number
    totalSessions: number
    oldestSummary?: Date
    newestSummary?: Date
  }
  longTerm: {
    knowledgeCount: number
    topicCount: number
    totalReferences: number
  }
}

export enum CompressionThreshold {
  TOKEN_LIMIT = 90, // 90% 的上下文限制时触发压缩
  MESSAGE_LIMIT = 50 // 超过 50 条消息时考虑压缩
}

export enum MemoryPriority {
  HIGH = 'high',
  MEDIUM = 'medium', 
  LOW = 'low'
}