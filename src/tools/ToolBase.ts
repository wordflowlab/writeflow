import { z } from 'zod'
import { WriteFlowTool, ToolUseContext, PermissionResult, ValidationResult } from '../Tool.js'

/**
 * WriteFlow 工具基类
 * 提供通用的工具实现模式和默认行为
 */
export abstract class ToolBase<
  TInput extends z.ZodObject<any> = z.ZodObject<any>,
  TOutput = any,
> implements WriteFlowTool<TInput, TOutput> {
  abstract name: string
  abstract inputSchema: TInput
  
  // 子类必须实现的核心方法
  abstract description(): Promise<string>
  abstract call(
    input: z.infer<TInput>,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result'; data: TOutput; resultForAssistant?: string }, void, unknown>

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
    return JSON.stringify(output, null, 2)
  }

  renderToolUseMessage(
    input: z.infer<TInput>,
    options: { verbose: boolean },
  ): string {
    if (options.verbose) {
      return `正在执行 ${this.name} 工具，参数: ${JSON.stringify(input, null, 2)}`
    }
    return `正在执行 ${this.name}...`
  }

  userFacingName(): string {
    return this.name
  }

  async prompt(options?: { safeMode?: boolean }): Promise<string> {
    const description = await this.description()
    return `${description}\n\n使用此工具时请确保参数正确，并注意操作的安全性。`
  }

  // 输入JSON Schema生成（可选）
  get inputJSONSchema(): Record<string, unknown> | undefined {
    // 这里可以实现 Zod 到 JSON Schema 的转换
    return undefined
  }

  // 工具执行包装器 - 提供错误处理和日志
  protected async *executeWithErrorHandling<T>(
    operation: () => AsyncGenerator<T, void, unknown>,
    toolName: string,
  ): AsyncGenerator<T, void, unknown> {
    try {
      yield* operation()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[${toolName}] 执行失败:`, errorMessage)
      throw new Error(`${toolName} 执行失败: ${errorMessage}`)
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