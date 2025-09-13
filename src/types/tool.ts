export interface ToolInput {
  [key: string]: any
}

export interface ToolResult {
  success: boolean
  content?: string
  metadata?: Record<string, any>
  error?: string
  warnings?: string[]
}

export interface FileMetadata {
  path: string
  size: number
  wordCount: number
  lineCount: number
  encoding: string
  format: FileFormat
  lastModified: number
  checksum: string
}

export type FileFormat = 'markdown' | 'html' | 'text' | 'docx' | 'pdf' | 'unknown'

export interface WritingTool {
  name: string
  description: string
  securityLevel: 'safe' | 'ai-powered' | 'restricted'
  
  execute(input: ToolInput): Promise<ToolResult>
  validateInput?(input: ToolInput): Promise<boolean>
}

/**
 * 增强版 WritingTool 接口
 * 向后兼容，为复杂工具提供额外功能
 */
export interface EnhancedWritingTool extends WritingTool {
  // 流式输出支持（用于长时间运行的工具）
  executeStream?(input: ToolInput): AsyncGenerator<ToolResult, void, unknown>
  
  // 内嵌专用提示词（基于最佳实践）
  getPrompt?(options?: { safeMode?: boolean }): Promise<string>
  
  // 细粒度权限验证
  validatePermission?(input: ToolInput, context?: ToolContext): Promise<PermissionResult>
  
  // 结果渲染（支持富文本输出）
  renderResult?(result: ToolResult): string
  
  // 工具配置
  config?: ToolConfig
}

/**
 * 工具执行上下文
 */
export interface ToolContext {
  messageId?: string
  userId?: string
  workspaceId?: string
  safeMode?: boolean
  abortController?: AbortController
  options?: Record<string, any>
}

/**
 * 权限验证结果
 */
export interface PermissionResult {
  granted: boolean
  reason?: string
  requiredPermissions?: string[]
  warningMessage?: string
}

/**
 * 工具配置
 */
export interface ToolConfig {
  // 工具是否只读
  readOnly?: boolean
  // 是否支持并发执行
  concurrencySafe?: boolean
  // 是否需要用户许可
  requiresPermission?: boolean
  // 超时时间（毫秒）
  timeout?: number
  // 工具类别
  category?: string
}

export interface FileState {
  path: string
  lastRead: number
  checksum: string
  isModified: boolean
  backupPath?: string
}

export interface ReadOptions {
  offset?: number
  limit?: number
  encoding?: string
  detectMalicious?: boolean
}

export interface WriteOptions {
  backup?: boolean
  atomic?: boolean
  validateChecksum?: boolean
  encoding?: string
}