/**
 * 工具编排器 - WriteFlow 工具系统的核心调度引擎
 * 基于最佳实践的工具编排设计，提供统一的工具调用管理
 */

import { debugLog, logError, logWarn, infoLog } from '../utils/log.js'
import { z } from 'zod'
import { WriteFlowTool, ToolUseContext, PermissionResult } from '../Tool.js'
import { ToolCallEvent, ToolBase } from './ToolBase.js'
import { PermissionManager, getPermissionManager } from './PermissionManager.js'

/**
 * 工具执行状态
 */
export enum ToolExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  toolName: string
  executionId: string
  status: ToolExecutionStatus
  startTime: number
  endTime?: number
  result?: any
  error?: Error
  logs: string[]
  metrics: {
    duration?: number
    memoryUsed?: number
    tokensProcessed?: number
  }
}

/**
 * 工具执行请求
 */
export interface ToolExecutionRequest {
  toolName: string
  input: any
  context: ToolUseContext
  priority?: number // 1-10, 10 is highest
  timeout?: number
  retryCount?: number
  dependencies?: string[] // 依赖的其他工具执行结果
}

/**
 * 工具执行队列项
 */
interface QueuedExecution {
  id: string
  request: ToolExecutionRequest
  tool: WriteFlowTool
  promise?: Promise<ToolExecutionResult>
  resolve?: (result: ToolExecutionResult) => void
  reject?: (error: Error) => void
}

/**
 * 工具编排器配置
 */
export interface OrchestratorConfig {
  maxConcurrentExecutions: number
  defaultTimeout: number
  enablePermissionChecks: boolean
  enableMetrics: boolean
  enableLogging: boolean
  retryFailedTools: boolean
}

/**
 * 工具编排器 - 统一工具调用管理和执行调度
 */
export class ToolOrchestrator {
  private tools = new Map<string, WriteFlowTool>()
  private executionQueue: QueuedExecution[] = []
  private runningExecutions = new Map<string, QueuedExecution>()
  private executionResults = new Map<string, ToolExecutionResult>()
  private permissionManager: PermissionManager
  private config: OrchestratorConfig
  private nextExecutionId = 1

  constructor(config?: Partial<OrchestratorConfig>) {
    this.permissionManager = getPermissionManager()
    this.config = {
      maxConcurrentExecutions: 5,
      defaultTimeout: 120000, // 2 minutes
      enablePermissionChecks: true,
      enableMetrics: true,
      enableLogging: true,
      retryFailedTools: true,
      ...config,
    }
  }

  /**
   * 注册工具
   */
  registerTool(tool: WriteFlowTool): void {
    this.tools.set(tool.name, tool)
    
    if (this.config.enableLogging) {
      debugLog(`🔧 工具已注册: ${tool.name} (${tool.isReadOnly() ? '只读' : '可写'})`)
    }
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: WriteFlowTool[]): void {
    tools.forEach(tool => this.registerTool(tool))
  }

  /**
   * 获取已注册的工具
   */
  getTool(name: string): WriteFlowTool | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * 获取可用工具列表（考虑权限）
   */
  getAvailableTools(): WriteFlowTool[] {
    const allowedToolNames = this.permissionManager.getAllowedTools()
    const availableTools: WriteFlowTool[] = []
    
    for (const toolName of allowedToolNames) {
      const tool = this.tools.get(toolName)
      if (tool) {
        availableTools.push(tool)
      }
    }
    
    return availableTools
  }

  /**
   * 执行单个工具 - 主要的工具调用入口
   */
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const executionId = this.generateExecutionId()
    
    // 获取工具实例
    const tool = this.tools.get(request.toolName)
    if (!tool) {
      // 返回失败结果而不是抛出异常
      return {
        toolName: request.toolName,
        executionId,
        status: ToolExecutionStatus.FAILED,
        startTime: Date.now(),
        endTime: Date.now(),
        error: new Error(`工具 '${request.toolName}' 未找到`),
        logs: [`工具 '${request.toolName}' 未找到`],
        metrics: {
          duration: 0,
        },
      }
    }

    // 创建执行结果对象
    const result: ToolExecutionResult = {
      toolName: request.toolName,
      executionId,
      status: ToolExecutionStatus.PENDING,
      startTime: Date.now(),
      logs: [],
      metrics: {},
    }

    try {
      // 权限检查
      if (this.config.enablePermissionChecks) {
        const permissionResult = await this.permissionManager.checkToolPermission(
          tool, 
          request.input, 
          request.context,
        )
        
        if (!permissionResult.isAllowed) {
          result.status = ToolExecutionStatus.FAILED
          result.error = new Error(`权限被拒绝: ${permissionResult.denialReason}`)
          result.endTime = Date.now()
          this.executionResults.set(executionId, result)
          return result
        }
      }

      // 输入验证
      if (tool.validateInput) {
        const validationResult = await tool.validateInput(request.input, request.context)
        if (!validationResult.result) {
          result.status = ToolExecutionStatus.FAILED
          result.error = new Error(`输入验证失败: ${validationResult.message}`)
          result.endTime = Date.now()
          this.executionResults.set(executionId, result)
          return result
        }
      }

      // 开始执行
      result.status = ToolExecutionStatus.RUNNING
      this.logExecution(executionId, `开始执行工具 ${request.toolName}`)

      // 设置超时
      const timeout = request.timeout || this.config.defaultTimeout
      const timeoutHandle = setTimeout(() => {
        request.context.abortController.abort()
      }, timeout)

      try {
        // 执行工具
        const generator = tool.call(request.input, request.context)
        let toolResult: any

        // 处理工具执行的事件流
        for await (const event of generator) {
          if (event.type === 'progress') {
            this.logExecution(executionId, event.message || '执行中...')
          } else if (event.type === 'result') {
            toolResult = event.data
            result.result = toolResult
          } else if (event.type === 'error') {
            throw event.error || new Error(event.message || '工具执行出错')
          }
        }

        clearTimeout(timeoutHandle)
        
        // 执行成功
        result.status = ToolExecutionStatus.COMPLETED
        result.endTime = Date.now()
        result.metrics.duration = result.endTime - result.startTime
        
        this.logExecution(executionId, `工具执行完成，耗时 ${result.metrics.duration}ms`)

      } catch (executionError) {
        clearTimeout(timeoutHandle)
        
        result.status = ToolExecutionStatus.FAILED
        result.error = executionError instanceof Error ? executionError : new Error(String(executionError))
        result.endTime = Date.now()
        result.metrics.duration = result.endTime - result.startTime
        
        this.logExecution(executionId, `工具执行失败: ${result.error.message}`)
      }

    } catch (setupError) {
      result.status = ToolExecutionStatus.FAILED
      result.error = setupError instanceof Error ? setupError : new Error(String(setupError))
      result.endTime = Date.now()
      this.logExecution(executionId, `工具执行设置失败: ${result.error.message}`)
    }

    // 保存执行结果
    this.executionResults.set(executionId, result)
    
    // 更新权限管理器的统计信息
    if (this.config.enablePermissionChecks) {
      // 这里可以添加统计更新逻辑
    }

    return result
  }

  /**
   * 批量执行工具 - 支持并发和依赖管理
   */
  async executeToolsBatch(requests: ToolExecutionRequest[]): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = []
    
    // 按优先级排序
    const sortedRequests = [...requests].sort((a, b) => (b.priority || 5) - (a.priority || 5))
    
    // 处理没有依赖的工具（可以并发执行）
    const independentRequests = sortedRequests.filter(req => !req.dependencies || req.dependencies.length === 0)
    const dependentRequests = sortedRequests.filter(req => req.dependencies && req.dependencies.length > 0)
    
    // 并发执行独立工具（受最大并发数限制）
    const concurrentBatches: ToolExecutionRequest[][] = []
    for (let i = 0; i < independentRequests.length; i += this.config.maxConcurrentExecutions) {
      concurrentBatches.push(independentRequests.slice(i, i + this.config.maxConcurrentExecutions))
    }
    
    // 执行并发批次
    for (const batch of concurrentBatches) {
      const batchPromises = batch.map(request => this.executeTool(request))
      const batchResults = await Promise.allSettled(batchPromises)
      
      batchResults.forEach(settledResult => {
        if (settledResult.status === 'fulfilled') {
          results.push(settledResult.value)
        } else {
          // 创建失败结果
          const failedResult: ToolExecutionResult = {
            toolName: 'unknown',
            executionId: this.generateExecutionId(),
            status: ToolExecutionStatus.FAILED,
            startTime: Date.now(),
            endTime: Date.now(),
            error: settledResult.reason,
            logs: [],
            metrics: { duration: 0 },
          }
          results.push(failedResult)
        }
      })
    }
    
    // 处理有依赖的工具（串行执行，按依赖顺序）
    for (const request of dependentRequests) {
      // 检查依赖是否已完成
      const dependencyResults = results.filter(r => 
        request.dependencies!.includes(r.toolName) && r.status === ToolExecutionStatus.COMPLETED,
      )
      
      if (dependencyResults.length === request.dependencies!.length) {
        // 依赖已满足，可以执行
        const result = await this.executeTool(request)
        results.push(result)
      } else {
        // 依赖未满足，跳过执行
        const skippedResult: ToolExecutionResult = {
          toolName: request.toolName,
          executionId: this.generateExecutionId(),
          status: ToolExecutionStatus.FAILED,
          startTime: Date.now(),
          endTime: Date.now(),
          error: new Error(`依赖工具未成功执行: ${request.dependencies!.join(', ')}`),
          logs: [],
          metrics: { duration: 0 },
        }
        results.push(skippedResult)
      }
    }
    
    return results
  }

  /**
   * 获取工具执行结果
   */
  getExecutionResult(executionId: string): ToolExecutionResult | undefined {
    return this.executionResults.get(executionId)
  }

  /**
   * 获取工具的所有执行历史
   */
  getToolExecutionHistory(toolName: string): ToolExecutionResult[] {
    return Array.from(this.executionResults.values()).filter(result => result.toolName === toolName)
  }

  /**
   * 获取执行统计信息
   */
  getExecutionStats(): {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    toolUsageStats: Record<string, number>
  } {
    const allResults = Array.from(this.executionResults.values())
    const successful = allResults.filter(r => r.status === ToolExecutionStatus.COMPLETED)
    const failed = allResults.filter(r => r.status === ToolExecutionStatus.FAILED)
    
    const totalDuration = allResults
      .filter(r => r.metrics.duration)
      .reduce((sum, r) => sum + (r.metrics.duration || 0), 0)
    
    const toolUsageStats: Record<string, number> = {}
    allResults.forEach(result => {
      toolUsageStats[result.toolName] = (toolUsageStats[result.toolName] || 0) + 1
    })
    
    return {
      totalExecutions: allResults.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      averageExecutionTime: allResults.length > 0 ? totalDuration / allResults.length : 0,
      toolUsageStats,
    }
  }

  /**
   * 清理历史记录
   */
  clearHistory(): void {
    this.executionResults.clear()
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${this.nextExecutionId++}`
  }

  /**
   * 记录执行日志
   */
  private logExecution(executionId: string, message: string): void {
    if (!this.config.enableLogging) return
    
    const result = this.executionResults.get(executionId)
    if (result) {
      result.logs.push(`[${new Date().toISOString()}] ${message}`)
    }
    
    // 简化的控制台输出 - 不输出详细的执行ID和时间戳
    // console.log(`[${executionId}] ${message}`)  // 注释掉详细日志
  }

  /**
   * 生成工具使用报告
   */
  generateUsageReport(): string {
    const stats = this.getExecutionStats()
    const permissionStats = this.permissionManager.getPermissionStats()
    
    const report = [
      `📊 WriteFlow 工具系统使用报告`,
      ``,
      `🔧 工具执行统计:`,
      `  • 总执行次数: ${stats.totalExecutions}`,
      `  • 成功执行: ${stats.successfulExecutions}`,
      `  • 失败执行: ${stats.failedExecutions}`,
      `  • 平均执行时间: ${Math.round(stats.averageExecutionTime)}ms`,
      ``,
      `📈 热门工具排行:`,
      ...Object.entries(stats.toolUsageStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tool, count], index) => `  ${index + 1}. ${tool}: ${count} 次`),
      ``,
      `🔒 权限统计:`,
      `  • 当前模式: ${permissionStats.currentMode}`,
      `  • 允许工具数: ${permissionStats.allowedTools}`,
      `  • 禁止工具数: ${permissionStats.forbiddenTools}`,
      `  • 会话使用: ${permissionStats.sessionStats.totalUsage} 次`,
      `  • 权限拒绝: ${permissionStats.sessionStats.deniedRequests} 次`,
      ``,
      `⚡ 系统配置:`,
      `  • 最大并发数: ${this.config.maxConcurrentExecutions}`,
      `  • 默认超时: ${this.config.defaultTimeout}ms`,
      `  • 权限检查: ${this.config.enablePermissionChecks ? '启用' : '禁用'}`,
      `  • 性能指标: ${this.config.enableMetrics ? '启用' : '禁用'}`,
    ]
    
    return report.join('\n')
  }
}

// 全局工具编排器实例
let globalOrchestrator: ToolOrchestrator | null = null

/**
 * 获取全局工具编排器实例
 */
export function getToolOrchestrator(): ToolOrchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new ToolOrchestrator()
  }
  return globalOrchestrator
}

/**
 * 便捷的工具执行函数
 */
export async function executeToolQuick(
  toolName: string, 
  input: any, 
  context: ToolUseContext,
): Promise<any> {
  const orchestrator = getToolOrchestrator()
  const result = await orchestrator.executeTool({
    toolName,
    input,
    context,
  })
  
  if (result.status === ToolExecutionStatus.COMPLETED) {
    return result.result
  } else {
    throw result.error || new Error(`工具执行失败: ${result.status}`)
  }
}