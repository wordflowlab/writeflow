/**

 * WriteFlow 消息系统 - 采用 AsyncGenerator 流式架构
 * 支持实时工具执行显示的消息类型和创建函数
 */

import { debugLog } from './log.js'

import { randomUUID } from 'crypto'
type UUID = string
import type { 
  MessageParam,
  ContentBlock,
  ContentBlockParam,
  ToolResultBlockParam,
  Message as APIAssistantMessage,
} from '@anthropic-ai/sdk/resources/index.mjs'
import type { Tool } from '../Tool.js'

// 📋 常量定义 - 标准架构
export const INTERRUPT_MESSAGE = '[Request interrupted by user]'
export const INTERRUPT_MESSAGE_FOR_TOOL_USE = '[Request interrupted by user for tool use]'
export const CANCEL_MESSAGE = 'The user doesn\'t want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.'
export const REJECT_MESSAGE = 'The user doesn\'t want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.'
export const NO_RESPONSE_REQUESTED = 'No response requested.'
export const NO_CONTENT_MESSAGE = '[No content]'

// 📝 消息类型定义 - 实现流式架构消息类型系统
export type UserMessage = {
  message: MessageParam
  type: 'user'
  uuid: UUID
  toolUseResult?: FullToolUseResult
  options?: {
    isKodingRequest?: boolean
    kodingContext?: string
    isCustomCommand?: boolean
    commandName?: string
    commandArgs?: string
  }
}

export type AssistantMessage = {
  costUSD: number
  durationMs: number
  message: APIAssistantMessage
  type: 'assistant'
  uuid: UUID
  isApiErrorMessage?: boolean
  responseId?: string
}

export type ProgressMessage = {
  content: AssistantMessage
  normalizedMessages: NormalizedMessage[]
  siblingToolUseIDs: Set<string>
  tools: Tool[]
  toolUseID: string
  type: 'progress'
  uuid: UUID
}

// 🎯 联合消息类型
export type Message = UserMessage | AssistantMessage | ProgressMessage

// 🔧 工具执行结果类型
export type FullToolUseResult = {
  data: unknown
  resultForAssistant: ToolResultBlockParam['content']
}

// 📊 标准化消息类型（用于消息处理）
export type NormalizedUserMessage = UserMessage

export type NormalizedMessage =
  | NormalizedUserMessage
  | AssistantMessage
  | ProgressMessage

// 🏭 消息创建函数 - 实现 AsyncGenerator 消息工厂

/**
 * 创建基础助手消息 - 流式架构基础消息创建
 */
function baseCreateAssistantMessage(
  content: ContentBlock[],
  extra?: Partial<AssistantMessage>,
): AssistantMessage {
  return {
    type: 'assistant',
    costUSD: 0,
    durationMs: 0,
    uuid: randomUUID(),
    message: {
      id: randomUUID(),
      model: '<synthetic>',
      role: 'assistant',
      stop_reason: 'stop_sequence',
      stop_sequence: '',
      type: 'message',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation: null,
        server_tool_use: null,
        service_tier: null,
      },
      content,
    },
    ...extra,
  }
}

/**
 * 创建助手消息 - 流式架构实现
 */
export function createAssistantMessage(content: string): AssistantMessage {
  return baseCreateAssistantMessage([
    {
      type: 'text' as const,
      text: content === '' ? NO_CONTENT_MESSAGE : content,
      citations: [],
    },
  ])
}

/**
 * 创建助手错误消息 - 流式架构实现
 */
export function createAssistantAPIErrorMessage(
  content: string,
): AssistantMessage {
  return baseCreateAssistantMessage(
    [
      {
        type: 'text' as const,
        text: content === '' ? NO_CONTENT_MESSAGE : content,
        citations: [],
      },
    ],
    { isApiErrorMessage: true },
  )
}

/**
 * 创建用户消息 - 流式架构实现
 */
export function createUserMessage(
  content: string | ContentBlockParam[],
  toolUseResult?: FullToolUseResult,
): UserMessage {
  const m: UserMessage = {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
    uuid: randomUUID(),
    toolUseResult,
  }
  return m
}

/**
 * 创建进度消息 - 核心！实现实时进度显示
 * 这是实时工具执行显示的关键函数
 */
export function createProgressMessage(
  toolUseID: string,
  siblingToolUseIDs: Set<string>,
  content: AssistantMessage,
  normalizedMessages: NormalizedMessage[],
  tools: Tool[],
): ProgressMessage {
  return {
    type: 'progress',
    content,
    normalizedMessages,
    siblingToolUseIDs,
    tools,
    toolUseID,
    uuid: randomUUID(),
  }
}

/**
 * 创建工具结果停止消息 - 流式架构实现
 */
export function createToolResultStopMessage(
  toolUseID: string,
): ToolResultBlockParam {
  return {
    type: 'tool_result',
    content: CANCEL_MESSAGE,
    is_error: true,
    tool_use_id: toolUseID,
  }
}

/**
 * 标准化消息处理 - 实现 API 兼容层核心逻辑
 */
export function normalizeMessages(messages: Message[]): NormalizedMessage[] {
  return messages.flatMap(message => {
    if (message.type === 'progress') {
      return [message] as NormalizedMessage[]
    }
    if (typeof message.message.content === 'string') {
      return [message] as NormalizedMessage[]
    }
    return message.message.content.map(_ => {
      switch (message.type) {
        case 'assistant':
          return {
            type: 'assistant',
            uuid: randomUUID(),
            costUSD: message.costUSD,
            durationMs: message.durationMs,
            message: {
              ...message.message,
              content: [_],
            },
          } as AssistantMessage
        case 'user':
          return {
            type: 'user',
            uuid: randomUUID(),
            message: {
              role: 'user',
              content: [_],
            },
            toolUseResult: message.toolUseResult,
          } as UserMessage
      }
    })
  })
}

/**
 * 消息格式化为 API 调用格式 - 基于 DeepSeek v3.1 官方文档
 * 正确处理工具结果消息，使用官方支持的 role: "tool" 格式
 */
export function normalizeMessagesForAPI(messages: Message[]): MessageParam[] {
  const apiMessages: any[] = []
  const isDebugMode = process.env.WRITEFLOW_DEBUG_STREAM === 'verbose'
  
  if (isDebugMode) {
    debugLog(`🔧 [消息构造] 开始构造API消息，输入消息数: ${messages.length}`)
  }
  
  for (const m of messages) {
    if (m.type === 'progress') continue // 过滤掉进度消息
    
    if (isDebugMode) {
      debugLog(`🔧 [消息构造] 处理消息类型: ${m.type}，UUID: ${m.uuid.slice(0, 8)}...`)
    }
    
    switch (m.type) {
      case 'user':
        if (typeof m.message.content === 'string') {
          // 普通用户消息
          apiMessages.push({
            role: 'user',
            content: m.message.content,
          })
        } else if (Array.isArray(m.message.content)) {
          // 🎯 修复工具结果消息构造 - 改用DeepSeek兼容格式
          let toolResultContent = ''
          for (const block of m.message.content) {
            if (block.type === 'tool_result') {
              // 关键修复：DeepSeek 不支持 role: "tool"，改用用户消息格式
              const resultText = typeof block.content === 'string' 
                ? block.content 
                : JSON.stringify(block.content)
              
              toolResultContent += `[工具执行结果 ${block.tool_use_id}]\n${resultText}\n\n`
              
              if (isDebugMode) {
                debugLog(`🔧 [消息构造] 工具结果转换为用户消息: ${block.tool_use_id}`)
              }
            } else {
              // 其他类型的内容块
              const blockContent = (block as any).content || (block as any).text || JSON.stringify(block)
              toolResultContent += `${String(blockContent)  }\n`
            }
          }
          
          if (toolResultContent.trim()) {
            apiMessages.push({
              role: 'user',
              content: toolResultContent.trim(),
            })
          }
        } else {
          apiMessages.push({
            role: 'user',
            content: String(m.message.content || ''),
          })
        }
        break
        
      case 'assistant':
        apiMessages.push({
          role: 'assistant',
          content: typeof m.message.content === 'string' 
            ? m.message.content
            : m.message.content.map(block => 
                block.type === 'text' ? block.text : JSON.stringify(block),
              ).join('\n'),
        })
        break
        
      default:
        // 其他类型消息直接使用原始格式
        if ((m as any).message && typeof (m as any).message === 'object') {
          apiMessages.push((m as any).message)
        }
    }
  }
  
  if (isDebugMode) {
    debugLog(`🔧 [消息构造] 完成构造，输出API消息数: ${apiMessages.length}`)
    debugLog(`🔧 [消息构造] 最后3条消息:`, apiMessages.slice(-3).map((msg: any) => ({
      role: msg.role,
      contentLength: typeof msg.content === 'string' ? msg.content.length : 'non-string',
      preview: typeof msg.content === 'string' ? `${msg.content.slice(0, 50)  }...` : 'non-string',
    })))
  }
  
  return apiMessages
}