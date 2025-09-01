import { WritingTool, ToolInput, ToolResult } from '../types/tool.js'
import { ReadArticleTool, WriteArticleTool, EditArticleTool } from './base/index.js'
import { ExitPlanModeTool } from './ExitPlanMode.js'

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

  constructor() {
    this.registerBaseTools()
  }

  /**
   * 注册基础工具
   */
  private registerBaseTools(): void {
    const baseTools = [
      new ReadArticleTool(),
      new WriteArticleTool(),
      new EditArticleTool(),
      new ExitPlanModeTool()
    ]

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
  async executeTool(toolName: string, input: ToolInput): Promise<ToolResult> {
    const startTime = Date.now()
    
    try {
      const tool = this.tools.get(toolName)
      if (!tool) {
        return {
          success: false,
          error: `工具不存在: ${toolName}`
        }
      }

      // 执行前验证（如果工具支持）
      if (tool.validateInput) {
        const isValid = await tool.validateInput(input)
        if (!isValid) {
          return {
            success: false,
            error: '工具输入验证失败'
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
        error: `工具执行异常: ${(error as Error).message}`
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
      this.executeTool(toolName, input)
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
          totalDuration: 0
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
      toolStats
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
      duration
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
}