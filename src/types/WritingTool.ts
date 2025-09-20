import { z } from 'zod'

/**
 * 工具使用上下文
 */
export interface ToolUseContext {
  messageId?: string
  agentId?: string
  planModeManager?: any
  abortController: AbortController
  options?: {
    verbose?: boolean
    safeMode?: boolean
  }
}

/**
 * 验证结果
 */
export interface ValidationResult {
  result: boolean
  message?: string
  errorCode?: number
  meta?: any
}

/**
 * 工具结果
 */
export interface ToolResult<TOutput = any> {
  success: boolean
  content: string
  data?: TOutput
  metadata?: any
}

/**
 * 统一的写作工具接口
 * WriteFlow 工具系统的设计理念
 */
export interface WritingTool<
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput = any,
> {
  /** 工具名称 */
  name: string
  
  /** 工具描述 */
  description: string | (() => Promise<string>)
  
  /** 输入参数 Schema */
  inputSchema: TInput
  
  /** 安全等级 */
  securityLevel: 'safe' | 'dangerous'
  
  // 权限控制方法
  
  /** 是否为只读工具 */
  isReadOnly(): boolean
  
  /** 是否可以绕过只读模式 */
  canBypassReadOnlyMode?(): boolean
  
  /** 是否需要权限检查 */
  needsPermissions?(input?: z.infer<TInput>): boolean
  
  /** 是否支持并发执行 */
  isConcurrencySafe?(): boolean
  
  /** 是否启用 */
  isEnabled?(): Promise<boolean>
  
  // 验证方法
  
  /** 输入验证 */
  validateInput?(
    input: z.infer<TInput>,
    context?: ToolUseContext,
  ): Promise<ValidationResult>
  
  // 执行方法
  
  /** 执行工具 */
  execute(
    input: z.infer<TInput>, _context: ToolUseContext,
  ): Promise<ToolResult<TOutput>>
  
  // UI 渲染方法（可选）
  
  /** 渲染工具使用消息 */
  renderToolUseMessage?(
    input: z.infer<TInput>,
    options: { verbose: boolean },
  ): string
  
  /** 渲染工具结果 */
  renderToolResultMessage?(output: TOutput): React.ReactElement
  
  /** 渲染被拒绝消息 */
  renderToolUseRejectedMessage?(): React.ReactElement
}

/**
 * 工具权限级别
 */
export enum ToolPermissionLevel {
  READ_ONLY = 'read_only',
  SAFE_WRITE = 'safe_write', 
  SYSTEM_MODIFY = 'system_modify',
  DANGEROUS = 'dangerous'
}

/**
 * 获取工具权限级别
 */
export function getToolPermissionLevel(tool: WritingTool): ToolPermissionLevel {
  if (tool.isReadOnly()) {
    return ToolPermissionLevel.READ_ONLY
  }
  
  if (tool.securityLevel === 'safe') {
    return ToolPermissionLevel.SAFE_WRITE
  }
  
  if (tool.securityLevel === 'dangerous') {
    return ToolPermissionLevel.DANGEROUS
  }
  
  return ToolPermissionLevel.SYSTEM_MODIFY
}