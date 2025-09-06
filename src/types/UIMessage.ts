/**
 * UI 消息类型定义
 * 完全参考 Kode 的架构实现，用于 REPL 界面消息显示
 */

import type { UUID } from 'crypto'

// 基础内容块类型
export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: any
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | any[]
  is_error?: boolean
}

export interface ThinkingBlock {
  type: 'thinking'
  content: string
}

// 内容块联合类型
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock

// 消息参数类型（发送给 API）
export interface MessageParam {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

// API 响应消息类型
export interface APIAssistantMessage {
  role: 'assistant'
  content: ContentBlock[]
}

// 用户消息类型
export interface UserMessage {
  type: 'user'
  uuid: UUID
  message: MessageParam
  timestamp: Date
  toolUseResult?: any // 工具执行结果
  options?: {
    isKodingRequest?: boolean
    kodingContext?: string
  }
}

// 助手消息类型
export interface AssistantMessage {
  type: 'assistant'
  uuid: UUID
  message: APIAssistantMessage
  costUSD: number
  durationMs: number
  timestamp: Date
  isApiErrorMessage?: boolean
  responseId?: string
}

// 进度消息类型（用于工具执行状态）
export interface ProgressMessage {
  type: 'progress'
  uuid: UUID
  content: AssistantMessage
  normalizedMessages: NormalizedMessage[]
  siblingToolUseIDs: Set<string>
  toolUseID: string
  timestamp: Date
}

// 消息联合类型
export type UIMessage = UserMessage | AssistantMessage | ProgressMessage

// 标准化消息类型（用于渲染）
export type NormalizedMessage = UIMessage

// 消息工厂函数
export function createUserMessage(content: string): UserMessage {
  return {
    type: 'user',
    uuid: crypto.randomUUID() as UUID,
    message: {
      role: 'user',
      content
    },
    timestamp: new Date()
  }
}

export function createAssistantMessage(
  content: ContentBlock[],
  costUSD: number = 0,
  durationMs: number = 0
): AssistantMessage {
  return {
    type: 'assistant',
    uuid: crypto.randomUUID() as UUID,
    message: {
      role: 'assistant',
      content
    },
    costUSD,
    durationMs,
    timestamp: new Date()
  }
}

export function createTextBlock(text: string): TextBlock {
  return {
    type: 'text',
    text
  }
}

export function createToolUseBlock(
  id: string,
  name: string,
  input: any
): ToolUseBlock {
  return {
    type: 'tool_use',
    id,
    name,
    input
  }
}

export function createToolResultBlock(
  tool_use_id: string,
  content: string | any[],
  is_error: boolean = false
): ToolResultBlock {
  return {
    type: 'tool_result',
    tool_use_id,
    content,
    is_error
  }
}

// 消息验证函数
export function isTextBlock(block: ContentBlock): block is TextBlock {
  return block.type === 'text'
}

export function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use'
}

export function isToolResultBlock(block: ContentBlock): block is ToolResultBlock {
  return block.type === 'tool_result'
}

export function isThinkingBlock(block: ContentBlock): block is ThinkingBlock {
  return block.type === 'thinking'
}

export function isUserMessage(message: UIMessage): message is UserMessage {
  return message.type === 'user'
}

export function isAssistantMessage(message: UIMessage): message is AssistantMessage {
  return message.type === 'assistant'
}

export function isProgressMessage(message: UIMessage): message is ProgressMessage {
  return message.type === 'progress'
}

// 消息内容提取函数
export function getTextContent(message: AssistantMessage): string {
  return message.message.content
    .filter(isTextBlock)
    .map(block => block.text)
    .join('')
}

export function getToolUseBlocks(message: AssistantMessage): ToolUseBlock[] {
  return message.message.content.filter(isToolUseBlock)
}

export function getToolResultBlocks(message: AssistantMessage): ToolResultBlock[] {
  return message.message.content.filter(isToolResultBlock)
}

// 消息合并函数（用于流式输出）
export function mergeTextBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = []
  let currentText = ''
  
  for (const block of blocks) {
    if (isTextBlock(block)) {
      currentText += block.text
    } else {
      if (currentText) {
        result.push(createTextBlock(currentText))
        currentText = ''
      }
      result.push(block)
    }
  }
  
  if (currentText) {
    result.push(createTextBlock(currentText))
  }
  
  return result
}

// 消息转换函数（兼容性）
export function convertLegacyMessage(legacyMessage: {
  uuid: string
  type: 'user' | 'assistant' | 'system'
  message: string
  timestamp: Date
  costUSD?: number
  durationMs?: number
}): UIMessage {
  if (legacyMessage.type === 'user') {
    return {
      type: 'user',
      uuid: legacyMessage.uuid as UUID,
      message: {
        role: 'user',
        content: legacyMessage.message
      },
      timestamp: legacyMessage.timestamp
    }
  } else {
    return {
      type: 'assistant',
      uuid: legacyMessage.uuid as UUID,
      message: {
        role: 'assistant',
        content: [createTextBlock(legacyMessage.message)]
      },
      costUSD: legacyMessage.costUSD || 0,
      durationMs: legacyMessage.durationMs || 0,
      timestamp: legacyMessage.timestamp
    }
  }
}