import { Message } from './message.js'

export enum AgentState {
  Idle = 'idle',
  Processing = 'processing', 
  WaitingForInput = 'waiting_for_input',
  PlanMode = 'plan_mode',
  AcceptEdits = 'accept_edits',
  BypassPermissions = 'bypass_permissions',
  Error = 'error'
}

export enum PlanMode {
  Default = 'default',
  Plan = 'plan',
  AcceptEdits = 'acceptEdits',
  BypassPermissions = 'bypassPermissions'
}

export interface AgentResponse {
  type: 'success' | 'error' | 'prompt' | 'component' | 'progress' | 'plan'
  content?: string
  jsx?: React.ReactElement
  allowedTools?: string[]
  maxTokens?: number
  metadata?: Record<string, any>
}

export interface AgentContext {
  userId?: string
  sessionId: string
  workingDirectory?: string
  currentProject?: string
  preferences?: {
    language: string
    outputStyle: string
  }
  tools?: string[]
  conversationHistory?: any[]
  currentState?: AgentState
  planMode?: PlanMode
  activeTools?: string[]
  configuration?: AgentConfiguration
  statistics?: AgentStatistics
}

export interface AgentConfiguration {
  maxConcurrentTools: number
  toolTimeout: number
  contextCompressionThreshold: number
  maxContextTokens: number
  securityLevel: 'strict' | 'normal' | 'permissive'
}

export interface AgentStatistics {
  messagesProcessed: number
  toolInvocations: number
  averageResponseTime: number
  errorCount: number
  lastActivity: number
}

export interface UserIntent {
  type: 'slash_command' | 'article_request' | 'edit_request' | 'research_request' | 'general_query'
  confidence: number
  command?: string
  args?: string
  target?: string
  metadata?: Record<string, any>
}

export interface ArticleContext {
  currentArticle?: string
  activeOutline?: any
  writingGoals?: string[]
  userPreferences?: Record<string, any>
  researchMaterial?: any[]
  dialogueHistory?: Message[]
  referenceArticles?: any[]
  toolUsageHistory?: any[]
  tokenCount?: number
  compressionLevel?: number
  lastUpdated?: number
}