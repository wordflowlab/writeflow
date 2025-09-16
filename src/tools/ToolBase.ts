import { z } from 'zod'
import { WriteFlowTool, ToolUseContext, PermissionResult, ValidationResult } from '../Tool.js'

import { debugLog, logError, logWarn } from './../utils/log.js'
/**
import { debugLog, logError, logWarn, infoLog } from './../utils/log.js'

 * 工具调用事件类型 - 采用现代化设计
 */
export interface ToolCallEvent {
  type: 'progress' | 'result' | 'error' | 'permission_request' | 'input_request'
  message?: string
  data?: any
  progress?: number // 0-100
  error?: Error
  resultForAssistant?: string
}

/**
 * WriteFlow 工具基类 - 采用 AsyncGenerator 流式架构
 * 提供统一的工具实现模式和完善的生命周期管理
 */
export abstract class ToolBase<
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput = any,
> implements WriteFlowTool<TInput, TOutput> {
  abstract name: string
  abstract inputSchema: TInput
  
  // 工具类别 - 用于组织和分类
  abstract category: 'file' | 'system' | 'search' | 'web' | 'ai' | 'memory' | 'writing' | 'other'
  
  // 子类必须实现的核心方法
  abstract description(): Promise<string>
  abstract call(
    input: z.infer<TInput>,
    context: ToolUseContext,
  ): Promise<TOutput> | AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: TOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown>

  // 工具版本 - 用于兼容性检查
  version: string = '1.0.0'
  
  // 工具标签 - 用于快速过滤和搜索  
  tags: string[] = []
  
  // 默认实现 - 子类可以覆盖
  async isEnabled(): Promise<boolean> {
    return true
  }

  isReadOnly(): boolean {
    return false
  }

  isConcurrencySafe(): boolean {
    return false
  }

  needsPermissions(input?: z.infer<TInput>): boolean {
    return !this.isReadOnly()
  }

  // 工具资源估算 - 用于性能优化
  estimateResourceUsage(input?: z.infer<TInput>): {
    cpu: 'low' | 'medium' | 'high'
    memory: 'low' | 'medium' | 'high'  
    io: 'none' | 'light' | 'heavy'
    network: boolean
    duration: 'fast' | 'medium' | 'slow' // <1s, 1-10s, >10s
  } {
    return {
      cpu: 'low',
      memory: 'low',
      io: 'light',
      network: false,
      duration: 'fast',
    }
  }

  async checkPermissions(
    input: z.infer<TInput>,
    context: ToolUseContext,
  ): Promise<PermissionResult> {
    if (!this.needsPermissions(input)) {
      return { isAllowed: true }
    }
    
    // 默认实现：安全模式下拒绝非只读操作
    if (context.safeMode && !this.isReadOnly()) {
      return {
        isAllowed: false,
        denialReason: `工具 ${this.name} 需要写入权限，但当前处于安全模式`,
        behavior: 'deny',
      }
    }

    return { isAllowed: true }
  }

  // 工具依赖检查 - 检查运行环境是否满足要求
  async checkDependencies(): Promise<{
    satisfied: boolean
    missing?: string[]
    warnings?: string[]
  }> {
    return { satisfied: true }
  }

  // 工具兼容性检查 - 检查与其他工具的兼容性
  isCompatibleWith(otherTool: WriteFlowTool): boolean {
    return true
  }

  async validateInput(
    input: z.infer<TInput>,
    context?: ToolUseContext,
  ): Promise<ValidationResult> {
    const result = this.inputSchema.safeParse(input)
    if (!result.success) {
      return {
        result: false,
        message: `输入验证失败: ${result.error.message}`,
        errorCode: 400,
      }
    }
    return { result: true }
  }

  renderResultForAssistant(output: TOutput): string {
    if (typeof output === 'string') {
      return output
    }
    if (output && typeof output === 'object' && 'resultForAssistant' in output) {
      return String(output.resultForAssistant)
    }
    return JSON.stringify(output, null, 2)
  }

  renderToolUseMessage(
    input: z.infer<TInput>,
    options: { verbose: boolean },
  ): string {
    const resourceInfo = this.estimateResourceUsage(input)
    const resourceLabel = resourceInfo.duration === 'slow' ? '(可能需要较长时间)' : 
                         resourceInfo.io === 'heavy' ? '(磁盘密集型)' :
                         resourceInfo.network ? '(需要网络)' : ''
    
    if (options.verbose) {
      return `🔧 正在执行 ${this.name} 工具 ${resourceLabel}\n参数: ${JSON.stringify(input, null, 2)}`
    }
    return `🔧 正在执行 ${this.name}... ${resourceLabel}`
  }

  userFacingName(): string {
    return this.name
  }

  async prompt(options?: { safeMode?: boolean }): Promise<string> {
    const description = await this.description()
    const resourceUsage = this.estimateResourceUsage()
    const safetyNote = this.isReadOnly() ? '这是一个只读工具，安全性高。' : '此工具可能会修改系统状态，请谨慎使用。'
    const performanceNote = resourceUsage.duration === 'slow' ? '\n⚠️  此工具执行时间较长，请耐心等待。' : ''
    
    return `${description}\n\n${safetyNote}${performanceNote}\n\n请确保参数格式正确，遵循工具的使用规范。`
  }

  // 输入JSON Schema生成 - 从 Zod schema 转换
  get inputJSONSchema(): Record<string, unknown> | undefined {
    try {
      return this.zodSchemaToJsonSchema(this.inputSchema)
    } catch (error) {
      logWarn(`[${this.name}] JSON Schema 生成失败:`, error)
      return undefined
    }
  }

  // 工具执行包装器 - 提供完整的生命周期管理
  protected async *executeWithErrorHandling(
    operation: () => AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: TOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown>,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: TOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    const startTime = Date.now()
    let success = true
    
    try {
      // 检查中止信号
      if (context.abortController.signal.aborted) {
        yield { type: 'error', error: new Error('工具执行被中止'), message: '工具执行被用户中止' }
        return
      }
      
      yield* operation()
    } catch (error) {
      success = false
      const errorMessage = error instanceof Error ? error.message : String(error)
      logError(`[${this.name}] 执行失败:`, errorMessage)
      
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(errorMessage),
        message: `${this.name} 执行失败: ${errorMessage}`,
        resultForAssistant: `工具 ${this.name} 执行失败: ${errorMessage}`,
      }
    } finally {
      const duration = Date.now() - startTime
      if (context.options?.verbose) {
        debugLog(`[${this.name}] 执行${success ? '成功' : '失败'}, 耗时: ${duration}ms`)
      }
    }
  }

  // Zod Schema 到 JSON Schema 的转换
  private zodSchemaToJsonSchema(zodSchema: any): Record<string, unknown> {
    const shapeDef = zodSchema._def?.shape
    if (!shapeDef) {
      return {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      }
    }

    // 🔥 如果shape是函数，需要调用它来获取实际形状
    const shape = typeof shapeDef === 'function' ? shapeDef() : shapeDef
    
    const properties: any = {}
    const required: string[] = []

    for (const [key, zodType] of Object.entries(shape)) {
      const fieldSchema = this.zodTypeToJsonSchema(zodType as any)
      properties[key] = fieldSchema
      
      // 检查是否是必需字段
      if (!(zodType as any)._def?.optional) {
        required.push(key)
      }
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    }
  }

  // 将单个 Zod 类型转换为 JSON Schema 字段
  private zodTypeToJsonSchema(zodType: any): any {
    const typeName = zodType._def.typeName
    
    switch (typeName) {
      case 'ZodString':
        return {
          type: 'string',
          description: zodType.description || '',
          ...(zodType._def.checks?.some((c: any) => c.kind === 'min') && {
            minLength: zodType._def.checks.find((c: any) => c.kind === 'min')?.value,
          }),
          ...(zodType._def.checks?.some((c: any) => c.kind === 'max') && {
            maxLength: zodType._def.checks.find((c: any) => c.kind === 'max')?.value,
          }),
        }
      case 'ZodNumber':
        return {
          type: 'number', 
          description: zodType.description || '',
          ...(zodType._def.checks?.some((c: any) => c.kind === 'min') && {
            minimum: zodType._def.checks.find((c: any) => c.kind === 'min')?.value,
          }),
          ...(zodType._def.checks?.some((c: any) => c.kind === 'max') && {
            maximum: zodType._def.checks.find((c: any) => c.kind === 'max')?.value,
          }),
        }
      case 'ZodBoolean':
        return {
          type: 'boolean',
          description: zodType.description || '',
        }
      case 'ZodOptional':
        return this.zodTypeToJsonSchema(zodType._def.innerType)
      case 'ZodDefault':
        const innerSchema = this.zodTypeToJsonSchema(zodType._def.innerType)
        innerSchema.default = zodType._def.defaultValue()
        return innerSchema
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToJsonSchema(zodType._def.type),
          description: zodType.description || '',
        }
      case 'ZodEnum':
        return {
          type: 'string',
          enum: zodType._def.values,
          description: zodType.description || '',
        }
      case 'ZodLiteral':
        return {
          type: typeof zodType._def.value,
          const: zodType._def.value,
          description: zodType.description || '',
        }
      default:
        return {
          type: 'string',
          description: zodType.description || `Unsupported Zod type: ${typeName}`,
        }
    }
  }

  // 通用文件路径验证
  protected validateFilePath(filePath: string): void {
    if (!filePath) {
      throw new Error('文件路径不能为空')
    }
    
    if (filePath.includes('..')) {
      throw new Error('文件路径不能包含 ".." (安全限制)')
    }
    
    // 可以添加更多安全检查
  }

  // 通用文件权限检查
  protected async checkFilePermissions(
    filePath: string,
    operation: 'read' | 'write',
    context: ToolUseContext,
  ): Promise<void> {
    // 基础路径验证
    this.validateFilePath(filePath)
    
    // 安全模式检查
    if (context.safeMode && operation === 'write') {
      throw new Error('安全模式下不允许写入文件')
    }
    
    // 可以添加更多权限检查逻辑
  }
}