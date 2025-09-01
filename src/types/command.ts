import React from 'react'
import { AgentContext } from './agent.js'

export interface ParsedCommand {
  name: string
  args: string
  type: 'mcp' | 'custom' | 'standard'
  isMCP: boolean
  isCustom: boolean
}

export interface SlashCommand {
  type: 'local' | 'local-jsx' | 'prompt'
  name: string
  description: string
  aliases?: string[]
  usage?: string
  examples?: string[]
  allowedTools?: string[]
  progressMessage?: string
  
  // 不同类型的执行方法
  call?: (args: string, context: AgentContext) => Promise<string>
  getPromptForCommand?: (args: string, context: AgentContext) => Promise<string>
  
  userFacingName(): string
}

export interface CommandResult {
  success: boolean
  messages?: CommandMessage[]
  jsx?: React.ReactElement
  shouldQuery?: boolean
  allowedTools?: string[]
  maxThinkingTokens?: number
  skipHistory?: boolean
  error?: string
}

export interface CommandMessage {
  role: 'assistant' | 'user'
  content: string
  isMeta?: boolean
  jsx?: boolean    // 标记为 JSX 消息
  data?: any       // 结构化数据
}

export interface CommandCallbacks {
  onJSXResult?: (result: { jsx: React.ReactElement; shouldHidePromptInput: boolean }) => void
  onProgress?: (message: string) => void
  onError?: (error: string) => void
}

export interface CommandExecutorConfig {
  maxConcurrentCommands: number
  commandTimeout: number
  enableThinkingTokens: boolean
  defaultMaxTokens: number
}