import { z } from 'zod'
import * as React from 'react'

// 工具执行上下文
export interface ToolUseContext {
  messageId?: string
  agentId?: string
  safeMode?: boolean
  abortController: AbortController
  readFileTimestamps: { [filePath: string]: number }
  options?: {
    verbose?: boolean
    safeMode?: boolean
    messageLogName?: string
    autoApprove?: boolean
  }
}

// 权限检查结果
export interface PermissionResult {
  isAllowed: boolean
  denialReason?: string
  behavior?: 'allow' | 'deny' | 'ask'
}

// 输入验证结果
export interface ValidationResult {
  result: boolean
  message?: string
  errorCode?: number
  meta?: any
}

// WriteFlow 工具标准接口 - 统一的工具规范
export interface WriteFlowTool<
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput = any,
> {
  name: string
  description: () => Promise<string>
  inputSchema: TInput
  inputJSONSchema?: Record<string, unknown>
  
  // 工具元数据
  isReadOnly: () => boolean
  isConcurrencySafe: () => boolean
  isEnabled: () => Promise<boolean>
  
  // 权限和验证
  needsPermissions: (input?: any) => boolean
  checkPermissions: (input: any, context: ToolUseContext) => Promise<PermissionResult>
  validateInput?: (input: any, context?: ToolUseContext) => Promise<ValidationResult>
  
  // 执行和渲染 - 支持两种返回类型：Promise（简单工具）和 AsyncGenerator（复杂工具）
  call: (
    input: any,
    context: ToolUseContext,
  ) => Promise<TOutput> | AsyncGenerator<
    { type: 'result' | 'progress' | 'error'; data?: TOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string },
    void,
    unknown
  >
  
  // 结果渲染
  renderResultForAssistant: (output: TOutput) => string
  renderToolUseMessage: (input: any, options: { verbose: boolean }) => string
  renderToolUseRejectedMessage?: () => React.ReactElement
  renderToolResultMessage?: (output: TOutput) => React.ReactElement
  
  // 用户界面
  userFacingName?: () => string
  prompt?: (options?: { safeMode?: boolean }) => Promise<string>
}

// 向后兼容的旧接口
export interface Tool {
  name: string
  description: string | (() => Promise<string>)
  execute: (args: any) => Promise<any>
}

export type SetToolJSXFn = (jsx: React.ReactNode | null, shouldHidePromptInput?: boolean) => void

// 工具执行错误类型
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}

// 工具权限错误类型
export class ToolPermissionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly requiredPermission: string
  ) {
    super(message)
    this.name = 'ToolPermissionError'
  }
}