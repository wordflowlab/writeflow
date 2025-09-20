import { logWarn } from '../../utils/log.js'
import { EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult, ToolConfig } from '../../types/tool.js'

/**
 * 外部工具接口定义
 * 用于适配来自其他代码库的工具
 */
export interface ExternalTool<TInput = any, TOutput = any> {
  name: string
  description?: () => Promise<string>
  prompt?: (options?: { safeMode?: boolean }) => Promise<string>
  isReadOnly: () => boolean
  isConcurrencySafe: () => boolean
  needsPermissions: (input?: TInput) => boolean
  isEnabled: () => Promise<boolean>
  
  // 生成器执行方法
  call: (
    input: TInput, _context: any,
    canUseTool?: any
  ) => AsyncGenerator<
    { type: 'result'; data: TOutput; resultForAssistant?: string },
    void,
    unknown
  >
  
  renderResultForAssistant?: (output: TOutput) => string
}

/**
 * 遗留工具适配器基类
 * 将外部工具转换为 WriteFlow 兼容的 EnhancedWritingTool
 */
export class LegacyToolAdapter implements EnhancedWritingTool {
  public name: string
  public description: string
  public securityLevel: 'safe' | 'ai-powered' | 'restricted'
  public config: ToolConfig

  constructor(private externalTool: ExternalTool) {
    this.name = externalTool.name
    this.description = '正在加载工具描述...'
    this.securityLevel = this.mapSecurityLevel()
    this.config = this.createConfig()
    
    // 异步初始化描述
    this.initializeDescription()
  }

  /**
   * 异步初始化描述
   */
  private async initializeDescription(): Promise<void> {
    try {
      if (this.externalTool.description) {
        this.description = await this.externalTool.description()
      }
    } catch (_error) {
      logWarn(`Failed to load description for tool ${this.name}:`, _error)
      this.description = `${this.name} 工具`
    }
  }

  /**
   * 映射安全级别
   */
  private mapSecurityLevel(): 'safe' | 'ai-powered' | 'restricted' {
    if (this.externalTool.isReadOnly()) {
      return 'safe'
    }
    return this.externalTool.needsPermissions({}) ? 'restricted' : 'ai-powered'
  }

  /**
   * 创建工具配置
   */
  private createConfig(): ToolConfig {
    return {
      readOnly: this.externalTool.isReadOnly(),
      concurrencySafe: this.externalTool.isConcurrencySafe(),
      requiresPermission: this.externalTool.needsPermissions({}),
      timeout: 120000, // 默认2分钟超时
      category: 'legacy-migrated'
    }
  }

  /**
   * 主要执行方法 - 转换生成器为 Promise
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      // 检查工具是否启用
      if (!(await this.externalTool.isEnabled())) {
        return {
          success: false,
          error: `工具 ${this.name} 当前不可用`
        }
      }

      // 创建执行上下文
      const executionContext = this.createExecutionContext()
      
      // 执行外部工具并获取第一个（通常是唯一的）结果
      const generator = this.externalTool.call(input, executionContext)
      const result = await generator.next()
      
      if (result.done || !result.value) {
        return {
          success: false,
          error: '工具执行未返回结果'
        }
      }

      const { data, resultForAssistant } = result.value
      
      // 转换结果格式
      return {
        success: true,
        content: resultForAssistant || this.formatResult(data),
        metadata: {
          originalData: data,
          toolName: this.name
        }
      }

    } catch (_error) {
      return {
        success: false,
        error: `工具执行失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 流式执行方法 - 直接使用外部生成器
   */
  async* executeStream(input: ToolInput): AsyncGenerator<ToolResult, void, unknown> {
    try {
      if (!(await this.externalTool.isEnabled())) {
        yield {
          success: false,
          error: `工具 ${this.name} 当前不可用`
        }
        return
      }

      const executionContext = this.createExecutionContext()
      const generator = this.externalTool.call(input, executionContext)
      
      for await (const result of generator) {
        if (result.type === 'result') {
          const { data, resultForAssistant } = result
          yield {
            success: true,
            content: resultForAssistant || this.formatResult(data),
            metadata: {
              originalData: data,
              toolName: this.name
            }
          }
        }
      }
    } catch (_error) {
      yield {
        success: false,
        error: `流式执行失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 获取专用提示词
   */
  async getPrompt(options?: { safeMode?: boolean }): Promise<string> {
    if (this.externalTool.prompt) {
      return this.externalTool.prompt(options)
    }
    return `这是 ${this.name} 工具的默认提示词。`
  }

  /**
   * 权限验证
   */
  async validatePermission(input: ToolInput, context?: ToolContext): Promise<PermissionResult> {
    const needsPermission = this.externalTool.needsPermissions(input)
    
    return {
      granted: !needsPermission || context?.options?.autoApprove === true,
      reason: needsPermission ? '此工具需要用户授权' : undefined,
      requiredPermissions: needsPermission ? [this.name] : [],
      warningMessage: needsPermission ? `工具 ${this.name} 将执行可能影响系统的操作` : undefined
    }
  }

  /**
   * 结果渲染
   */
  renderResult(result: ToolResult): string {
    if (this.externalTool.renderResultForAssistant && result.metadata?.originalData) {
      return this.externalTool.renderResultForAssistant(result.metadata.originalData)
    }
    return result.content || '执行完成'
  }

  /**
   * 输入验证（可选）
   */
  async validateInput(input: ToolInput): Promise<boolean> {
    // 外部工具通常使用 schema 验证，这里简化处理
    return input != null
  }

  /**
   * 创建执行上下文
   */
  private createExecutionContext(): any {
    return {
      messageId: undefined,
      abortController: new AbortController(),
      readFileTimestamps: {},
      options: {
        verbose: false,
        safeMode: false
      }
    }
  }

  /**
   * 格式化结果数据
   */
  private formatResult(data: any): string {
    if (typeof data === 'string') {
      return data
    }
    if (Array.isArray(data)) {
      // 处理 TextBlock[] 类型（Anthropic SDK）
      return data.map(block => 
        typeof block === 'object' && block.text ? block.text : String(block)
      ).join('\n')
    }
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data, null, 2)
    }
    return String(data)
  }
}