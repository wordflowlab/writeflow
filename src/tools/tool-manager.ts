import { WritingTool, EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult } from '../types/tool.js'
import { ExitPlanModeTool } from './ExitPlanMode.js'
import { createTodoToolAdapters } from './writing/index.js'
import { MCPListTool } from './system/MCPListTool.js'
import { ThinkingExtractTool } from './system/ThinkingExtractTool.js'
import { LsTool } from './system/LsTool.js'
import { URLFetcherTool } from './system/URLFetcherTool.js'
import { TaskTool } from './system/TaskTool.js'
import { ThinkTool } from './system/ThinkTool.js'
import { MemoryReadTool } from './memory/MemoryReadTool.js'
import { MemoryWriteTool } from './memory/MemoryWriteTool.js'
import { NotebookReadTool } from './notebook/NotebookReadTool.js'
import { NotebookEditTool } from './notebook/NotebookEditTool.js'
import { AskExpertModelTool } from './ai/AskExpertModelTool.js'
import { WebSearchTool } from './web/WebSearchTool.js'
import { MCPTool } from './system/MCPTool.js'
import { EnhancedBashTool } from './system/EnhancedBashTool.js'

/**
 * 工具管理器
 * 负责注册和执行所有写作工具
 */
export class ToolManager {
  private tools = new Map<string, WritingTool>()
  private executionHistory: Array<{
    toolName: string
    timestamp: number
    success: boolean
    duration: number
  }> = []
  private defaultContext: ToolContext = {
    safeMode: false,
    options: {},
  }

  constructor() {
    this.registerBaseTools()
  }

  /**
   * 注册基础工具
   */
  private registerBaseTools(): void {
    const baseTools: WritingTool[] = [
      new ExitPlanModeTool(),
    ]

    // 添加 Todo 工具（适配器返回的是兼容的 WritingTool）
    const todoTools = createTodoToolAdapters()
    baseTools.push(...todoTools)

    // 系统类增补：MCP 与 thinking 工具（最小可用）
    baseTools.push(new MCPListTool())
    baseTools.push(new ThinkingExtractTool())
    baseTools.push(new LsTool())
    baseTools.push(new URLFetcherTool())
    baseTools.push(new TaskTool())
    baseTools.push(new ThinkTool())
    baseTools.push(new MemoryReadTool())
    baseTools.push(new MemoryWriteTool())
    baseTools.push(new NotebookReadTool())
    baseTools.push(new NotebookEditTool())
    baseTools.push(new AskExpertModelTool())
    
    // 新增增强工具
    baseTools.push(new WebSearchTool())
    baseTools.push(new MCPTool())
    baseTools.push(new EnhancedBashTool())

    baseTools.forEach(tool => {
      this.registerTool(tool)
    })
  }

  /**
   * 注册工具
   */
  registerTool(tool: WritingTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * 注册多个工具
   */
  registerTools(tools: WritingTool[]): void {
    tools.forEach(tool => this.registerTool(tool))
  }

  /**
   * 执行工具
   */
  async executeTool(toolName: string, input: ToolInput, context?: ToolContext): Promise<ToolResult> {
    const startTime = Date.now()
    const effectiveContext = { ...this.defaultContext, ...context }
    
    try {
      const tool = this.tools.get(toolName)
      if (!tool) {
        return {
          success: false,
          error: `工具不存在: ${toolName}`,
        }
      }

      // 增强工具权限验证
      if (this.isEnhancedTool(tool) && tool.validatePermission) {
        const permissionResult = await tool.validatePermission(input, effectiveContext)
        if (!permissionResult.granted) {
          return {
            success: false,
            error: `权限验证失败: ${permissionResult.reason}`,
            warnings: permissionResult.warningMessage ? [permissionResult.warningMessage] : undefined,
          }
        }
      }

      // 执行前验证（如果工具支持）
      if (tool.validateInput) {
        const isValid = await tool.validateInput(input)
        if (!isValid) {
          return {
            success: false,
            error: '工具输入验证失败',
          }
        }
      }

      // 执行工具
      const result = await tool.execute(input)
      
      // 记录执行历史
      this.recordExecution(toolName, Date.now() - startTime, result.success)
      
      return result

    } catch (error) {
      // 记录失败执行
      this.recordExecution(toolName, Date.now() - startTime, false)
      
      return {
        success: false,
        error: `工具执行异常: ${(error as Error).message}`,
      }
    }
  }

  /**
   * 流式执行工具（支持增强工具）
   */
  async* executeToolStream(
    toolName: string, 
    input: ToolInput, 
    context?: ToolContext,
  ): AsyncGenerator<ToolResult, void, unknown> {
    const effectiveContext = { ...this.defaultContext, ...context }
    
    try {
      const tool = this.tools.get(toolName)
      if (!tool) {
        yield {
          success: false,
          error: `工具不存在: ${toolName}`,
        }
        return
      }

      // 检查是否支持流式输出
      if (!this.isEnhancedTool(tool) || !tool.executeStream) {
        // 回退到普通执行
        yield await this.executeTool(toolName, input, context)
        return
      }

      // 权限验证
      if (tool.validatePermission) {
        const permissionResult = await tool.validatePermission(input, effectiveContext)
        if (!permissionResult.granted) {
          yield {
            success: false,
            error: `权限验证失败: ${permissionResult.reason}`,
            warnings: permissionResult.warningMessage ? [permissionResult.warningMessage] : undefined,
          }
          return
        }
      }

      // 流式执行
      const startTime = Date.now()
      let success = true
      
      try {
        for await (const result of tool.executeStream(input)) {
          if (!result.success) success = false
          yield result
        }
      } finally {
        this.recordExecution(toolName, Date.now() - startTime, success)
      }

    } catch (error) {
      yield {
        success: false,
        error: `流式执行异常: ${(error as Error).message}`,
      }
    }
  }

  /**
   * 批量执行工具（并发）
   */
  async executeToolsBatch(executions: Array<{
    toolName: string
    input: ToolInput
  }>): Promise<ToolResult[]> {
    const promises = executions.map(({ toolName, input }) =>
      this.executeTool(toolName, input),
    )

    return Promise.all(promises)
  }

  /**
   * 获取工具列表
   */
  getAvailableTools(): WritingTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 获取工具信息
   */
  getToolInfo(toolName: string): WritingTool | undefined {
    return this.tools.get(toolName)
  }

  /**
   * 检查工具是否存在
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName)
  }

  /**
   * 按安全级别获取工具
   */
  getToolsBySecurityLevel(level: 'safe' | 'ai-powered' | 'restricted'): WritingTool[] {
    return this.getAvailableTools().filter(tool => tool.securityLevel === level)
  }

  /**
   * 获取工具执行统计
   */
  getExecutionStats(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageDuration: number
    toolStats: Record<string, {
      executions: number
      successRate: number
      averageDuration: number
    }>
  } {
    const total = this.executionHistory.length
    const successful = this.executionHistory.filter(h => h.success).length
    const failed = total - successful
    const avgDuration = total > 0 
      ? this.executionHistory.reduce((sum, h) => sum + h.duration, 0) / total 
      : 0

    // 按工具统计
    const toolStats: Record<string, any> = {}
    for (const history of this.executionHistory) {
      if (!toolStats[history.toolName]) {
        toolStats[history.toolName] = {
          executions: 0,
          successes: 0,
          totalDuration: 0,
        }
      }
      
      const stats = toolStats[history.toolName]
      stats.executions++
      if (history.success) stats.successes++
      stats.totalDuration += history.duration
    }

    // 计算每个工具的统计数据
    Object.keys(toolStats).forEach(toolName => {
      const stats = toolStats[toolName]
      stats.successRate = stats.executions > 0 ? stats.successes / stats.executions : 0
      stats.averageDuration = stats.executions > 0 ? stats.totalDuration / stats.executions : 0
      delete stats.successes
      delete stats.totalDuration
    })

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      averageDuration: avgDuration,
      toolStats,
    }
  }

  /**
   * 清理执行历史
   */
  clearExecutionHistory(): void {
    this.executionHistory = []
  }

  /**
   * 记录执行历史
   */
  private recordExecution(toolName: string, duration: number, success: boolean): void {
    this.executionHistory.push({
      toolName,
      timestamp: Date.now(),
      success,
      duration,
    })

    // 保持历史记录在合理范围内
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500)
    }
  }

  /**
   * 移除工具
   */
  removeTool(toolName: string): boolean {
    return this.tools.delete(toolName)
  }

  /**
   * 获取工具名称列表
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * 获取工具的专用提示词（增强工具）
   */
  async getToolPrompt(toolName: string, options?: { safeMode?: boolean }): Promise<string | null> {
    const tool = this.tools.get(toolName)
    if (!tool) return null
    
    if (this.isEnhancedTool(tool) && tool.getPrompt) {
      return await tool.getPrompt(options)
    }
    
    return null
  }

  /**
   * 获取增强工具列表
   */
  getEnhancedTools(): EnhancedWritingTool[] {
    return Array.from(this.tools.values()).filter(this.isEnhancedTool)
  }

  /**
   * 获取支持流式输出的工具列表
   */
  getStreamingTools(): EnhancedWritingTool[] {
    return this.getEnhancedTools().filter(tool => tool.executeStream != null)
  }

  /**
   * 按配置获取工具
   */
  getToolsByConfig(filter: {
    readOnly?: boolean
    concurrencySafe?: boolean
    requiresPermission?: boolean
    category?: string
  }): WritingTool[] {
    return Array.from(this.tools.values()).filter(tool => {
      if (this.isEnhancedTool(tool) && tool.config) {
        const config = tool.config
        if (filter.readOnly !== undefined && config.readOnly !== filter.readOnly) return false
        if (filter.concurrencySafe !== undefined && config.concurrencySafe !== filter.concurrencySafe) return false
        if (filter.requiresPermission !== undefined && config.requiresPermission !== filter.requiresPermission) return false
        if (filter.category !== undefined && config.category !== filter.category) return false
      }
      return true
    })
  }

  /**
   * 设置默认上下文
   */
  setDefaultContext(context: Partial<ToolContext>): void {
    this.defaultContext = { ...this.defaultContext, ...context }
  }

  /**
   * 获取默认上下文
   */
  getDefaultContext(): ToolContext {
    return { ...this.defaultContext }
  }

  /**
   * 渲染工具结果（如果工具支持）
   */
  renderToolResult(toolName: string, result: ToolResult): string {
    const tool = this.tools.get(toolName)
    if (!tool) return result.content || '工具不存在'
    
    if (this.isEnhancedTool(tool) && tool.renderResult) {
      return tool.renderResult(result)
    }
    
    return result.content || '执行完成'
  }

  /**
   * 检查是否为增强工具
   */
  private isEnhancedTool(tool: WritingTool): tool is EnhancedWritingTool {
    return 'executeStream' in tool || 'getPrompt' in tool || 'validatePermission' in tool || 'renderResult' in tool || 'config' in tool
  }
}
