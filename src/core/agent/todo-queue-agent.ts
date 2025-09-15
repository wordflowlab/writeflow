import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'
import { NOMainAgentEngine } from './nO-engine.js'
import { H2AAsyncMessageQueue } from '../queue/h2A-queue.js'
import { Message, MessageType, MessagePriority } from '../../types/message.js'
import { AgentResponse, AgentContext } from '../../types/agent.js'
import { Todo, TodoStatus, TodoPriority } from '../../types/Todo.js'
import { TodoManager } from '../../tools/TodoManager.js'
import { LegacyToolManager } from '../../tools/LegacyToolManager.js'

/**

 * TODO 队列代理
 * 基于 NOMainAgentEngine 专门处理 TODO 任务执行
 * 
 * 核心功能：
 * - 自动化任务队列执行
 * - 任务状态管理和流转
 * - 工具调用协调
 * - 执行进度跟踪
 */
export class TodoQueueAgent extends NOMainAgentEngine {
  private todoManager: TodoManager
  private toolManager: LegacyToolManager
  private currentExecutingTodo: Todo | null = null
  private executionHistory: Array<{
    todo: Todo
    startTime: number
    endTime?: number
    result?: 'success' | 'failure' | 'blocked'
    error?: string
  }> = []

  constructor(todoManager?: TodoManager, toolManager?: LegacyToolManager) {
    super()
    this.todoManager = todoManager || new TodoManager()
    this.toolManager = toolManager || new LegacyToolManager()
    
    // 设置 TODO 专用的 onPrompt 回调
    this.onPrompt = this.handleTodoPrompt.bind(this)
  }

  /**
   * 启动 TODO 队列执行
   * 自动获取所有待处理任务并排队执行
   */
  async startTodoQueueExecution(): Promise<void> {
    debugLog('[TodoQueueAgent] 启动 TODO 队列执行...')
    
    try {
      // 获取所有待处理任务
      const pendingTodos = await this.todoManager.getTodosByStatus(TodoStatus.PENDING)
      
      if (pendingTodos.length === 0) {
        debugLog('[TodoQueueAgent] 没有待处理的任务')
        return
      }

      // 按优先级排序任务
      const sortedTodos = this.prioritizeTodos(pendingTodos)
      
      debugLog(`[TodoQueueAgent] 发现 ${sortedTodos.length} 个待处理任务`)

      // 创建任务规划消息
      const planMessage: Message = this.createMessage(
        MessageType.TodoPlan,
        {
          todos: sortedTodos,
          totalCount: sortedTodos.length,
          estimatedDuration: this.estimateExecutionTime(sortedTodos)
        },
        MessagePriority.High
      )

      // 将规划消息加入队列
      await this.enqueueMessage(planMessage)

      // 只为第一个任务创建执行消息（确保顺序执行）
      if (sortedTodos.length > 0) {
        const firstTodo = sortedTodos[0]
        const executeMessage: Message = this.createMessage(
          MessageType.TodoExecute,
          { todo: firstTodo },
          this.mapTodoPriorityToMessagePriority(firstTodo.priority)
        )
        
        await this.enqueueMessage(executeMessage)
      }

    } catch (error) {
      logError('[TodoQueueAgent] 启动队列执行失败:', error)
    }
  }

  /**
   * 重写消息路由以处理 TODO 相关消息
   */
  protected async *routeMessage(message: Message, planState?: any): AsyncGenerator<AgentResponse> {
    switch (message.type) {
      case MessageType.TodoPlan:
        yield* this.handleTodoPlan(message)
        break
        
      case MessageType.TodoExecute:
        yield* this.handleTodoExecute(message)
        break
        
      case MessageType.TodoUpdate:
        yield* this.handleTodoUpdate(message)
        break
        
      case MessageType.TodoComplete:
        yield* this.handleTodoComplete(message)
        break
        
      case MessageType.TodoSummary:
        yield* this.handleTodoSummary(message)
        break
        
      default:
        // 对于非 TODO 消息，使用父类处理
        yield* super.routeMessage(message, planState)
        break
    }
  }

  /**
   * 处理任务规划消息
   */
  private async *handleTodoPlan(message: Message): AsyncGenerator<AgentResponse> {
    const { todos, totalCount, estimatedDuration } = message.payload
    
    debugLog(`[TodoQueueAgent] 开始任务规划: ${totalCount} 个任务，预计用时 ${estimatedDuration} 分钟`)
    
    yield {
      type: 'plan',
      content: `🎯 **任务队列规划**\n\n计划执行 ${totalCount} 个任务，预计用时 ${estimatedDuration} 分钟\n\n任务列表：\n${todos.map((todo: Todo, index: number) => `${index + 1}. ${todo.content} *[${todo.priority}]*`).join('\n')}`,
      metadata: {
        todos,
        totalCount,
        estimatedDuration,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 处理任务执行消息
   */
  private async *handleTodoExecute(message: Message): AsyncGenerator<AgentResponse> {
    const { todo } = message.payload
    
    debugLog(`[TodoQueueAgent] 开始执行任务: ${todo.content}`)
    
    // 记录执行开始
    this.currentExecutingTodo = todo
    const executionRecord = {
      todo,
      startTime: Date.now()
    }
    this.executionHistory.push(executionRecord)

    try {
      // 更新任务状态为进行中
      await this.todoManager.updateTodoStatus(todo.id, TodoStatus.IN_PROGRESS)
      
      // 发送状态更新消息
      const updateMessage = this.createMessage(
        MessageType.TodoUpdate,
        { 
          todoId: todo.id, 
          status: TodoStatus.IN_PROGRESS,
          message: `开始执行: ${todo.content}`
        },
        MessagePriority.Normal
      )
      await this.enqueueMessage(updateMessage)

      yield {
        type: 'progress',
        content: `🔄 正在执行: **${todo.content}**`,
        metadata: {
          todoId: todo.id,
          status: TodoStatus.IN_PROGRESS,
          startTime: executionRecord.startTime
        }
      }

      // 这里会通过 onPrompt 回调调用实际的工具执行
      // 任务的具体执行逻辑将通过 AI 的 prompt 和工具调用来完成
      
      // 生成执行提示并触发工具执行
      const prompt = `正在执行任务: ${todo.content}`
      if (this.onPrompt) {
        await this.onPrompt(prompt, ['TodoWrite'])
      }
      
    } catch (error) {
      logError(`[TodoQueueAgent] 执行任务失败: ${todo.content}`, error)
      
      // 更新执行记录
      const record = this.executionHistory.find(r => r.todo.id === todo.id)
      if (record) {
        record.endTime = Date.now()
        record.result = 'failure'
        record.error = error instanceof Error ? error.message : '未知错误'
      }

      yield {
        type: 'error',
        content: `❌ 任务执行失败: **${todo.content}**\n错误: ${error instanceof Error ? error.message : '未知错误'}`,
        metadata: {
          todoId: todo.id,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  }

  /**
   * 处理任务状态更新消息
   */
  private async *handleTodoUpdate(message: Message): AsyncGenerator<AgentResponse> {
    const { todoId, status, message: updateMessage } = message.payload
    
    yield {
      type: 'status',
      content: `📝 ${updateMessage}`,
      metadata: {
        todoId,
        status,
        timestamp: Date.now()
      }
    }
  }

  /**
   * 处理任务完成消息
   */
  private async *handleTodoComplete(message: Message): AsyncGenerator<AgentResponse> {
    const { todoId, result, summary } = message.payload
    
    try {
      // 更新任务状态为已完成
      await this.todoManager.updateTodoStatus(todoId, TodoStatus.COMPLETED)
      
      // 更新执行记录
      const record = this.executionHistory.find(r => r.todo.id === todoId)
      if (record) {
        record.endTime = Date.now()
        record.result = result
      }

      // 清除当前执行任务
      if (this.currentExecutingTodo?.id === todoId) {
        this.currentExecutingTodo = null
      }

      yield {
        type: 'result',
        content: `✅ 任务已完成: **${record?.todo.content}**${summary ? `\n\n${summary}` : ''}`,
        metadata: {
          todoId,
          result,
          executionTime: record ? record.endTime! - record.startTime : 0,
          summary
        }
      }

      // 检查是否还有待处理任务
      const remainingTodos = await this.todoManager.getTodosByStatus(TodoStatus.PENDING)
      if (remainingTodos.length === 0) {
        // 所有任务完成，生成总结
        const summaryMessage = this.createMessage(
          MessageType.TodoSummary,
          { executionHistory: this.executionHistory },
          MessagePriority.Normal
        )
        await this.enqueueMessage(summaryMessage)
      } else {
        // 还有待处理任务，启动下一个
        const nextTodo = remainingTodos[0]
        const nextExecuteMessage = this.createMessage(
          MessageType.TodoExecute,
          { todo: nextTodo },
          this.mapTodoPriorityToMessagePriority(nextTodo.priority)
        )
        await this.enqueueMessage(nextExecuteMessage)
      }
      
    } catch (error) {
      logError('[TodoQueueAgent] 处理任务完成失败:', error)
    }
  }

  /**
   * 处理任务总结消息
   */
  private async *handleTodoSummary(message: Message): AsyncGenerator<AgentResponse> {
    const { executionHistory } = message.payload
    
    const summary = this.generateExecutionSummary(executionHistory)
    
    yield {
      type: 'summary',
      content: summary,
      metadata: {
        totalTasks: executionHistory.length,
        completedTasks: executionHistory.filter((r: any) => r.result === 'success').length,
        failedTasks: executionHistory.filter((r: any) => r.result === 'failure').length,
        totalTime: this.calculateTotalExecutionTime(executionHistory)
      }
    }
  }

  /**
   * 处理 TODO 相关的 AI 提示
   */
  private async handleTodoPrompt(prompt: string, _allowedTools?: string[]): Promise<void> {
    if (this.currentExecutingTodo) {
      // 为当前执行的任务生成专门的提示
      const todoPrompt = `请执行以下任务：**${this.currentExecutingTodo.content}**

优先级：${this.currentExecutingTodo.priority}
状态：${this.currentExecutingTodo.status}

请使用适当的工具完成这个任务，完成后请调用 TodoWrite 工具更新任务状态为 completed。

${prompt}`

      // 这里应该调用外部的 AI 服务来处理提示
      debugLog('[TodoQueueAgent] 生成任务执行提示:', todoPrompt.substring(0, 100) + '...')
    }
  }

  /**
   * 按优先级排序任务
   */
  private prioritizeTodos(todos: Todo[]): Todo[] {
    const priorityOrder = { 
      [TodoPriority.HIGH]: 3, 
      [TodoPriority.MEDIUM]: 2, 
      [TodoPriority.LOW]: 1 
    }
    
    return todos.sort((a, b) => {
      // 首先按优先级排序
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      // 其次按创建时间排序（早的优先）
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  /**
   * 估算执行时间（分钟）
   */
  private estimateExecutionTime(todos: Todo[]): number {
    return todos.length * 2 // 简单估算：每个任务2分钟
  }

  /**
   * 映射 TODO 优先级到消息优先级
   */
  private mapTodoPriorityToMessagePriority(todoPriority: TodoPriority): MessagePriority {
    switch (todoPriority) {
      case TodoPriority.HIGH:
        return MessagePriority.High
      case TodoPriority.MEDIUM:
        return MessagePriority.Normal
      case TodoPriority.LOW:
        return MessagePriority.Low
      default:
        return MessagePriority.Normal
    }
  }

  /**
   * 生成执行总结
   */
  private generateExecutionSummary(executionHistory: any[]): string {
    const totalTasks = executionHistory.length
    const completedTasks = executionHistory.filter(r => r.result === 'success').length
    const failedTasks = executionHistory.filter(r => r.result === 'failure').length
    const totalTime = this.calculateTotalExecutionTime(executionHistory)

    return `📊 **任务执行总结**

总任务数：${totalTasks}
已完成：${completedTasks} ✅
失败：${failedTasks} ❌
总耗时：${Math.round(totalTime / 1000 / 60 * 10) / 10} 分钟

${executionHistory.map((record, index) => {
  const status = record.result === 'success' ? '✅' : 
                record.result === 'failure' ? '❌' : '⏸️'
  const duration = record.endTime ? 
    Math.round((record.endTime - record.startTime) / 1000) + 's' : '进行中'
  return `${index + 1}. ${status} ${record.todo.content} (${duration})`
}).join('\n')}`
  }

  /**
   * 计算总执行时间
   */
  private calculateTotalExecutionTime(executionHistory: any[]): number {
    return executionHistory.reduce((total, record) => {
      if (record.endTime) {
        return total + (record.endTime - record.startTime)
      }
      return total
    }, 0)
  }

  /**
   * 创建消息对象
   */
  private createMessage(type: MessageType, payload: any, priority: MessagePriority): Message {
    return {
      id: `todo-msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      priority,
      payload,
      timestamp: Date.now(),
      source: 'TodoQueueAgent'
    }
  }

  /**
   * 将消息加入队列（通过父类的公共接口）
   */
  private async enqueueMessage(message: Message): Promise<void> {
    // 使用父类提供的 sendMessage 方法
    const success = await this.sendMessage(message)
    if (success) {
      debugLog('[TodoQueueAgent] 消息入队成功:', message.type)
    } else {
      logWarn('[TodoQueueAgent] 消息入队失败:', message.type)
    }
  }

  /**
   * 获取当前执行状态
   */
  public getExecutionStatus() {
    return {
      currentExecutingTodo: this.currentExecutingTodo,
      executionHistory: this.executionHistory,
      queuedTasks: this.executionHistory.filter(r => !r.endTime).length
    }
  }

  /**
   * 手动完成当前任务
   */
  public async completeCurrentTask(result: 'success' | 'failure' = 'success', summary?: string): Promise<void> {
    if (!this.currentExecutingTodo) {
      logWarn('[TodoQueueAgent] 没有正在执行的任务')
      return
    }

    const completeMessage = this.createMessage(
      MessageType.TodoComplete,
      {
        todoId: this.currentExecutingTodo.id,
        result,
        summary
      },
      MessagePriority.Normal
    )

    await this.enqueueMessage(completeMessage)
  }
}