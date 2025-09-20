import { Todo, TodoStatus, TodoPriority, CreateTodoParams, UpdateTodoParams, TodoStats, STATUS_PRIORITIES, TASK_PRIORITIES } from '../types/Todo.js'
import { TodoStorage } from './TodoStorage.js'

import { logError } from './../utils/log.js'

export class TodoManager {
  private storage: TodoStorage

  constructor(sessionId?: string) {
    this.storage = new TodoStorage(sessionId)
  }

  // 验证只能有一个 in_progress 任务 - 复刻 Claude Code 验证逻辑
  private validateSingleInProgress(todos: Todo[]): void {
    const inProgressTodos = todos.filter(todo => todo.status === TodoStatus.IN_PROGRESS)
    if (inProgressTodos.length > 1) {
      throw new Error('只能有一个任务处于进行中状态。请先完成当前任务再开始新任务。')
    }
  }

  // 自动生成 activeForm - 将命令式描述转换为进行时
  public generateActiveForm(content: string): string {
    // 简单的规则：如果不以"正在"开头，则添加
    if (content.startsWith('正在')) {
      return content
    }
    
    // 常见的动词转换规则
    const verbMappings: Record<string, string> = {
      '实现': '正在实现',
      '创建': '正在创建', 
      '添加': '正在添加',
      '修改': '正在修改',
      '删除': '正在删除',
      '编写': '正在编写',
      '设计': '正在设计',
      '测试': '正在测试',
      '部署': '正在部署',
      '优化': '正在优化',
      '调试': '正在调试',
      '分析': '正在分析',
      '研究': '正在研究',
      '学习': '正在学习',
      '配置': '正在配置',
      '安装': '正在安装',
    }

    // 查找匹配的动词
    for (const [verb, activeVerb] of Object.entries(verbMappings)) {
      if (content.startsWith(verb)) {
        return content.replace(verb, activeVerb)
      }
    }

    // 如果没有匹配的动词，则简单添加"正在"前缀
    return `正在${content}`
  }

  // 双重排序算法 - 完全复刻 Claude Code 的 YJ1 函数
  private sortTodos(todoA: Todo, todoB: Todo): number {
    // 先按状态排序
    const statusDiff = STATUS_PRIORITIES[todoA.status] - STATUS_PRIORITIES[todoB.status]
    if (statusDiff !== 0) {
      return statusDiff
    }
    
    // 状态相同时，按任务优先级排序
    return TASK_PRIORITIES[todoA.priority] - TASK_PRIORITIES[todoB.priority]
  }

  async addTodo(content: string, activeForm?: string, priority?: TodoPriority): Promise<Todo> {
    const params: CreateTodoParams = {
      content,
      activeForm: activeForm || this.generateActiveForm(content),
      priority: priority || TodoPriority.MEDIUM,
    }
    
    return this.storage.addTodo(params)
  }

  async updateTodoStatus(id: string, status: TodoStatus): Promise<Todo | null> {
    return this.storage.updateTodo({ id, status })
  }

  async updateTodo(params: UpdateTodoParams): Promise<Todo | null> {
    return this.storage.updateTodo(params)
  }

  async removeTodo(id: string): Promise<boolean> {
    return this.storage.removeTodo(id)
  }

  async getAllTodos(): Promise<Todo[]> {
    const todos = await this.storage.loadTodos()
    return todos.sort(this.sortTodos)
  }

  async getTodoById(id: string): Promise<Todo | null> {
    return this.storage.getTodoById(id)
  }

  async clearAllTodos(): Promise<void> {
    await this.storage.clearAllTodos()
  }

  async getStats(): Promise<TodoStats> {
    return this.storage.getStats()
  }

  // 获取特定状态的 Todos
  async getTodosByStatus(status: TodoStatus): Promise<Todo[]> {
    const todos = await this.getAllTodos()
    return todos.filter(todo => todo.status === status)
  }

  // 获取当前正在进行的任务
  async getCurrentTask(): Promise<Todo | null> {
    const inProgressTodos = await this.getTodosByStatus(TodoStatus.IN_PROGRESS)
    return inProgressTodos.length > 0 ? inProgressTodos[0] : null
  }

  // 开始任务 - 将状态从 pending 改为 in_progress
  async startTask(id: string): Promise<Todo | null> {
    const todo = await this.getTodoById(id)
    if (!todo || todo.status !== TodoStatus.PENDING) {
      return null
    }

    return this.updateTodoStatus(id, TodoStatus.IN_PROGRESS)
  }

  // 完成任务 - 将状态改为 completed
  async completeTask(id: string): Promise<Todo | null> {
    const todo = await this.getTodoById(id)
    if (!todo || todo.status === TodoStatus.COMPLETED) {
      return null
    }

    return this.updateTodoStatus(id, TodoStatus.COMPLETED)
  }

  // 重置任务状态为 pending
  async resetTask(id: string): Promise<Todo | null> {
    return this.updateTodoStatus(id, TodoStatus.PENDING)
  }

  // 查找任务 - 支持模糊搜索
  async searchTodos(query: string): Promise<Todo[]> {
    const todos = await this.getAllTodos()
    const lowerQuery = query.toLowerCase()
    
    return todos.filter(todo => 
      todo.content.toLowerCase().includes(lowerQuery) ||
      todo.activeForm.toLowerCase().includes(lowerQuery),
    )
  }

  // 获取进度报告
  async getProgressReport(): Promise<{
    stats: TodoStats
    currentTask: Todo | null
    nextTasks: Todo[]
    recentCompleted: Todo[]
  }> {
    const [stats, currentTask, allTodos] = await Promise.all([
      this.getStats(),
      this.getCurrentTask(), 
      this.getAllTodos(),
    ])

    // 获取接下来的待处理任务
    const nextTasks = allTodos
      .filter(todo => todo.status === TodoStatus.PENDING)
      .slice(0, 3)

    // 获取最近完成的任务
    const recentCompleted = allTodos
      .filter(todo => todo.status === TodoStatus.COMPLETED)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 3)

    return {
      stats,
      currentTask,
      nextTasks, 
      recentCompleted,
    }
  }

  // 批量操作
  async batchUpdateStatus(ids: string[], status: TodoStatus): Promise<Todo[]> {
    const results = await Promise.all(
      ids.map(id => this.updateTodoStatus(id, status)),
    )
    return results.filter(todo => todo !== null) as Todo[]
  }

  // 导出数据
  async exportTodos(): Promise<string> {
    const todos = await this.getAllTodos()
    return JSON.stringify(todos, null, 2)
  }

  // 导入数据 
  async importTodos(jsonData: string): Promise<boolean> {
    try {
      const todos = JSON.parse(jsonData) as Todo[]
      await this.storage.saveTodos(todos)
      return true
    } catch (_error) {
      logError('导入 Todo 数据失败:', _error)
      return false
    }
  }

  // 批量保存 Todos（用于 AI 工具）
  async saveTodos(todos: Todo[]): Promise<void> {
    // 验证只能有一个 in_progress
    this.validateSingleInProgress(todos)
    
    // 保存到存储
    await this.storage.saveTodos(todos)
  }

  // 验证 Todo 数组的完整性
  validateTodos(todos: Todo[]): { isValid: boolean; error?: string } {
    try {
      // 检查重复 ID
      const ids = todos.map(todo => todo.id)
      const uniqueIds = new Set(ids)
      if (ids.length !== uniqueIds.size) {
        return { isValid: false, error: '发现重复的任务 ID' }
      }

      // 检查单一 in_progress
      this.validateSingleInProgress(todos)

      // 检查必需字段
      for (const todo of todos) {
        if (!todo.content?.trim()) {
          return { isValid: false, error: `任务 "${todo.id}" 缺少内容` }
        }
        if (!todo.activeForm?.trim()) {
          return { isValid: false, error: `任务 "${todo.id}" 缺少 activeForm` }
        }
      }

      return { isValid: true }
    } catch (_error) {
      return { 
        isValid: false, 
        error: _error instanceof Error ? _error.message : '验证失败', 
      }
    }
  }

  // 获取存储信息
  getStorageInfo(): { sessionId: string; storagePath: string } {
    return {
      sessionId: this.storage.getSessionId(),
      storagePath: this.storage.getStoragePath(),
    }
  }

  // ========== 队列执行支持 ==========

  /**
   * 获取下一个待执行任务
   * 按优先级和创建时间排序
   */
  async getNextPendingTask(): Promise<Todo | null> {
    const pendingTodos = await this.getTodosByStatus(TodoStatus.PENDING)
    return pendingTodos.length > 0 ? pendingTodos[0] : null
  }

  /**
   * 自动推进到下一个任务
   * 将当前进行中的任务设为 pending，并开始下一个任务
   */
  async advanceToNextTask(): Promise<{
    previousTask: Todo | null
    nextTask: Todo | null
    success: boolean
  }> {
    const currentTask = await this.getCurrentTask()
    const nextTask = await this.getNextPendingTask()

    // 如果当前任务存在，将其重置为 pending
    if (currentTask) {
      await this.updateTodoStatus(currentTask.id, TodoStatus.PENDING)
    }

    // 开始下一个任务
    let startedTask: Todo | null = null
    if (nextTask) {
      startedTask = await this.startTask(nextTask.id)
    }

    return {
      previousTask: currentTask,
      nextTask: startedTask,
      success: !nextTask || !!startedTask,
    }
  }

  /**
   * 队列执行统计
   */
  async getQueueStats(): Promise<{
    totalTasks: number
    pendingTasks: number
    inProgressTasks: number
    completedTasks: number
    completionRate: number
    estimatedTimeRemaining: number // 分钟
  }> {
    const stats = await this.getStats()
    const pendingTasks = stats.pending
    const inProgressTasks = stats.inProgress
    const completedTasks = stats.completed
    const totalTasks = pendingTasks + inProgressTasks + completedTasks

    return {
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      estimatedTimeRemaining: pendingTasks * 2, // 简单估算：每任务 2 分钟
    }
  }

  /**
   * 检查是否所有任务都已完成
   */
  async isQueueComplete(): Promise<boolean> {
    const pendingTodos = await this.getTodosByStatus(TodoStatus.PENDING)
    const inProgressTodos = await this.getTodosByStatus(TodoStatus.IN_PROGRESS)
    return pendingTodos.length === 0 && inProgressTodos.length === 0
  }

  /**
   * 为队列执行准备任务（按优先级排序）
   */
  async prepareTaskQueue(): Promise<Todo[]> {
    const pendingTodos = await this.getTodosByStatus(TodoStatus.PENDING)
    
    // 按优先级和创建时间排序
    return pendingTodos.sort((a, b) => {
      // 先按优先级
      const priorityOrder = { 
        [TodoPriority.HIGH]: 3, 
        [TodoPriority.MEDIUM]: 2, 
        [TodoPriority.LOW]: 1, 
      }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      // 再按创建时间（早的优先）
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  /**
   * 开始队列执行模式
   * 确保只有一个任务处于进行中状态
   */
  async startQueueExecution(): Promise<{
    success: boolean
    startedTask: Todo | null
    message: string
  }> {
    try {
      // 检查当前是否有进行中的任务
      const currentTask = await this.getCurrentTask()
      if (currentTask) {
        return {
          success: true,
          startedTask: currentTask,
          message: `队列执行继续，当前任务: ${currentTask.content}`,
        }
      }

      // 获取下一个待处理任务
      const nextTask = await this.getNextPendingTask()
      if (!nextTask) {
        return {
          success: false,
          startedTask: null,
          message: '没有待处理的任务',
        }
      }

      // 开始执行第一个任务
      const startedTask = await this.startTask(nextTask.id)
      return {
        success: !!startedTask,
        startedTask,
        message: startedTask 
          ? `开始执行任务: ${startedTask.content}`
          : '启动任务失败',
      }
    } catch (_error) {
      return {
        success: false,
        startedTask: null,
        message: `启动队列执行失败: ${_error instanceof Error ? _error.message : '未知错误'}`,
      }
    }
  }
}