import { Message } from './message.js'

export interface ResearchItem {
  id: string
  content: string
  summary?: string
  source: string
  url?: string
  createdAt: number
  referenceCount: number
  relevanceScore: number
  keywords: string[]
}

export interface DialogueItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  importance: number
  tokens: number
}

export interface ReferenceArticle {
  id: string
  title: string
  content: string
  author?: string
  url?: string
  publishedAt?: number
  relevanceScore: number
  keyPoints: string[]
}

export interface ContextCompressionResult {
  originalTokens: number
  compressedTokens: number
  compressionRatio: number
  itemsRemoved: number
  compressionTime: number
}

export interface ContextSnapshot {
  sessionId: string
  timestamp: number
  tokenCount: number
  compressionLevel: number
  researchItems: number
  dialogueItems: number
  referenceArticles: number
}

export interface CompressionConfig {
  threshold: number
  preserveRatio: number
  maxResearchItems: number
  maxDialogueHistory: number
  maxReferenceArticles: number
  intelligentRanking: boolean
}

export interface ContextMetrics {
  currentTokens: number
  maxTokens: number
  utilizationRatio: number
  compressionHistory: ContextCompressionResult[]
  lastCompression?: number
  memoryUsage: number
}