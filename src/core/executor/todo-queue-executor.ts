import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'
import { TodoQueueAgent } from '../agent/todo-queue-agent.js'
import { Todo, TodoStatus } from '../../types/Todo.js'
import { TodoManager } from '../../tools/TodoManager.js'
import { ToolManager } from '../../tools/tool-manager.js'

/**
 * TODO 队列执行器
 * 高层次的任务队列管理和执行协调器
 * 
 * 核心功能：
 * - 队列式任务执行管理
 * - 自动化工作流程控制
 * - 执行状态监控和报告
 * - 错误处理和重试机制
 */
export class TodoQueueExecutor {
  private agent: TodoQueueAgent
  private todoManager: TodoManager
  private toolManager: ToolManager
  private isExecuting = false
  private executionPromise: Promise<void> | null = null
  private abortController: AbortController | null = null

  // 执行配置
  private config = {
    maxRetries: 3,                    // 最大重试次数
    retryDelay: 5000,                // 重试延迟（毫秒）
    taskTimeout: 300000,             // 单个任务超时（5分钟）
    concurrentLimit: 1,              // 并发任务限制
    autoAdvanceOnFailure: false,     // 失败时是否自动推进
    generateSummary: true,           // 是否生成执行总结
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error'
  }

  // 执行统计
  private stats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    skippedTasks: 0,
    totalExecutionTime: 0,
    startTime: 0,
    endTime: 0,
    retryCount: 0
  }

  constructor(options?: {
    todoManager?: TodoManager
    toolManager?: ToolManager
    config?: Partial<typeof TodoQueueExecutor.prototype.config>
  }) {
    this.todoManager = options?.todoManager || new TodoManager()
    this.toolManager = options?.toolManager || new ToolManager()
    this.agent = new TodoQueueAgent(this.todoManager, this.toolManager)

    // 合并配置
    if (options?.config) {
      Object.assign(this.config, options.config)
    }

    // 设置 agent 的外部提示处理器
    this.agent.onPrompt = this.handleAgentPrompt.bind(this)
  }

  /**
   * 执行 TODO 队列
   * 主要入口方法，启动完整的队列执行流程
   */
  async executeTodoQueue(): Promise<{
    success: boolean
    stats: {
      totalTasks: number
      completedTasks: number
      failedTasks: number
      skippedTasks: number
      totalExecutionTime: number
      startTime: number
      endTime: number
      retryCount: number
    }
    summary: string
    errors?: string[]
  }> {
    if (this.isExecuting) {
      throw new Error('TODO 队列已在执行中')
    }

    this.log('info', '🚀 开始执行 TODO 队列')
    
    this.isExecuting = true
    this.abortController = new AbortController()
    this.resetStats()

    try {
      // 获取所有待处理任务
      const pendingTodos = await this.todoManager.getTodosByStatus(TodoStatus.PENDING)
      
      if (pendingTodos.length === 0) {
        this.log('info', '📝 没有待处理的任务')
        return {
          success: true,
          stats: this.stats,
          summary: '没有待处理的任务'
        }
      }

      this.stats.totalTasks = pendingTodos.length
      this.stats.startTime = Date.now()

      this.log('info', `📋 发现 ${pendingTodos.length} 个待处理任务`)

      // 启动 agent 的队列执行
      this.executionPromise = this.executeWithAgent(pendingTodos)
      await this.executionPromise

      this.stats.endTime = Date.now()
      this.stats.totalExecutionTime = this.stats.endTime - this.stats.startTime

      const summary = this.generateFinalSummary()
      
      this.log('info', '✅ TODO 队列执行完成')

      return {
        success: true,
        stats: this.stats,
        summary
      }

    } catch (error) {
      this.log('error', '❌ TODO 队列执行失败:', error)
      
      return {
        success: false,
        stats: this.stats,
        summary: '执行失败',
        errors: [error instanceof Error ? error.message : '未知错误']
      }
      
    } finally {
      this.isExecuting = false
      this.abortController = null
      this.executionPromise = null
    }
  }

  /**
   * 使用 agent 执行任务队列
   */
  private async executeWithAgent(_todos: Todo[]): Promise<void> {
    // 启动 agent 的队列执行
    await this.agent.startTodoQueueExecution()

    // 启动 agent 主循环
    const agentIterator = this.agent.run()

    // 处理 agent 响应
    for await (const response of agentIterator) {
      if (this.abortController?.signal.aborted) {
        break
      }

      await this.handleAgentResponse(response)
      
      // 检查是否所有任务都完成
      const remainingTodos = await this.todoManager.getTodosByStatus(TodoStatus.PENDING)
      const inProgressTodos = await this.todoManager.getTodosByStatus(TodoStatus.IN_PROGRESS)
      
      if (remainingTodos.length === 0 && inProgressTodos.length === 0) {
        this.log('info', '🎉 所有任务已完成')
        // 主动停止 agent
        this.agent.stop()
        break
      }
    }
  }

  /**
   * 处理 agent 响应
   */
  private async handleAgentResponse(response: any): Promise<void> {
    this.log('debug', `[Agent响应] ${response.type}:`, response.content?.substring(0, 100))

    switch (response.type) {
      case 'plan':
        this.log('info', '📋 任务规划已生成')
        break
        
      case 'progress':
        this.log('info', '⏳ 任务进行中:', response.metadata?.todoId)
        break
        
      case 'result':
        const { result, todoId } = response.metadata || {}
        if (result === 'success') {
          this.stats.completedTasks++
          this.log('info', `✅ 任务完成: ${todoId}`)
        } else {
          this.stats.failedTasks++
          this.log('warn', `❌ 任务失败: ${todoId}`)
        }
        break
        
      case 'error':
        this.stats.failedTasks++
        this.log('error', '💥 任务执行错误:', response.content)
        
        if (this.config.autoAdvanceOnFailure) {
          // 自动推进到下一个任务
          await this.advanceToNextTask()
        }
        break
        
      case 'summary':
        this.log('info', '📊 执行总结已生成')
        break
        
      default:
        this.log('debug', `未知响应类型: ${response.type}`)
        break
    }
  }

  /**
   * 处理 agent 的 prompt 请求
   */
  private async handleAgentPrompt(prompt: string, _allowedTools?: string[]): Promise<void> {
    this.log('debug', '[Agent Prompt]:', prompt.substring(0, 200))
    
    // 这里应该调用 AI 服务来处理 prompt
    // 由于这是一个架构示例，我们先记录日志
    
    // 模拟工具调用执行
    await this.simulateToolExecution(prompt)
  }

  /**
   * 模拟工具执行（在实际实现中会调用真正的工具）
   */
  private async simulateToolExecution(_prompt: string, _allowedTools?: string[]): Promise<void> {
    this.log('debug', '🔧 模拟工具执行')
    
    // 模拟执行延迟
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 模拟成功完成当前任务
    const currentTodo = this.agent.getExecutionStatus().currentExecutingTodo
    if (currentTodo) {
      // 直接将任务标记为完成
      await this.todoManager.updateTodoStatus(currentTodo.id, TodoStatus.COMPLETED)
      
      // 通知 agent 任务已完成
      await this.agent.completeCurrentTask('success', '任务已通过工具执行完成')
      
      this.log('info', `✅ 模拟完成任务: ${currentTodo.content}`)
    }
  }

  /**
   * 推进到下一个任务
   */
  private async advanceToNextTask(): Promise<void> {
    const currentTodo = this.agent.getExecutionStatus().currentExecutingTodo
    
    if (currentTodo) {
      // 将当前任务标记为失败
      await this.todoManager.updateTodoStatus(currentTodo.id, TodoStatus.PENDING)
      this.stats.skippedTasks++
      
      this.log('info', '⏭️ 跳过失败任务，推进到下一个')
    }
  }

  /**
   * 暂停队列执行
   */
  public pauseExecution(): void {
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort()
      this.log('info', '⏸️ 队列执行已暂停')
    }
  }

  /**
   * 获取执行状态
   */
  public getExecutionStatus() {
    return {
      isExecuting: this.isExecuting,
      stats: { ...this.stats },
      currentTask: this.agent.getExecutionStatus().currentExecutingTodo,
      agentStatus: this.agent.getExecutionStatus()
    }
  }

  /**
   * 更新执行配置
   */
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig }
    this.log('info', '⚙️ 执行配置已更新')
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      totalExecutionTime: 0,
      startTime: 0,
      endTime: 0,
      retryCount: 0
    }
  }

  /**
   * 生成最终总结
   */
  private generateFinalSummary(): string {
    const { totalTasks, completedTasks, failedTasks, skippedTasks, totalExecutionTime } = this.stats
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    const duration = Math.round(totalExecutionTime / 1000 / 60 * 10) / 10

    return `🎯 **TODO 队列执行总结**

📊 **统计数据**
• 总任务数：${totalTasks}
• 已完成：${completedTasks} ✅
• 失败：${failedTasks} ❌  
• 跳过：${skippedTasks} ⏭️
• 成功率：${successRate}%
• 总耗时：${duration} 分钟

🎉 **执行完成** - ${completedTasks}/${totalTasks} 任务已完成`
  }

  /**
   * 日志记录
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    const configLevel = levels[this.config.logLevel]
    const messageLevel = levels[level]

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString()
      const prefix = `[${timestamp}] [TodoQueueExecutor:${level.toUpperCase()}]`
      
      switch (level) {
        case 'debug':
          console.debug(prefix, message, ...args)
          break
        case 'info':
          debugLog(prefix, message, ...args)
          break
        case 'warn':
          logWarn(`${prefix} ${message}`, args.length > 0 ? args[0] : undefined)
          break
        case 'error':
          logError(`${prefix} ${message}`, args.length > 0 ? args[0] : undefined)
          break
      }
    }
  }

  /**
   * 静态工厂方法：创建并配置执行器
   */
  public static create(options?: {
    todoManager?: TodoManager
    toolManager?: ToolManager
    config?: Partial<TodoQueueExecutor['config']>
  }): TodoQueueExecutor {
    return new TodoQueueExecutor(options)
  }

  /**
   * 静态便捷方法：立即执行队列
   */
  public static async execute(options?: Parameters<typeof TodoQueueExecutor.create>[0]): Promise<ReturnType<TodoQueueExecutor['executeTodoQueue']>> {
    const executor = TodoQueueExecutor.create(options)
    return await executor.executeTodoQueue()
  }
}