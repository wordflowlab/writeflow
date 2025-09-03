import { Todo, TodoStatus } from '../types/Todo.js'
import { TodoManager } from '../tools/TodoManager.js'

/**
 * 系统提醒消息接口
 */
export interface ReminderMessage {
  role: 'system'
  content: string
  isMeta: boolean
  timestamp: number
  type: string
  priority: 'low' | 'medium' | 'high'
  category: 'task' | 'security' | 'performance' | 'general'
}

/**
 * 提醒配置
 */
interface ReminderConfig {
  todoEmptyReminder: boolean
  securityReminder: boolean
  performanceReminder: boolean
  maxRemindersPerSession: number
}

/**
 * 会话提醒状态
 */
interface SessionReminderState {
  lastTodoUpdate: number
  lastFileAccess: number
  sessionStartTime: number
  remindersSent: Set<string>
  contextPresent: boolean
  reminderCount: number
  config: ReminderConfig
}

/**
 * Todo 变化事件数据
 */
export interface TodoChangeEvent {
  oldTodos: Todo[]
  newTodos: Todo[]
  timestamp: number
  agentId: string
  changeType: 'added' | 'removed' | 'modified'
}

/**
 * 系统提醒服务
 * WriteFlow 系统提醒服务
 */
export class SystemReminderService {
  private sessionState: SessionReminderState = {
    lastTodoUpdate: 0,
    lastFileAccess: 0,
    sessionStartTime: Date.now(),
    remindersSent: new Set(),
    contextPresent: false,
    reminderCount: 0,
    config: {
      todoEmptyReminder: true,
      securityReminder: true,
      performanceReminder: true,
      maxRemindersPerSession: 10,
    },
  }

  private eventDispatcher = new Map<string, Array<(context: any) => void>>()
  private reminderCache = new Map<string, ReminderMessage>()
  private todoManager: TodoManager

  constructor(todoManager?: TodoManager) {
    this.todoManager = todoManager || new TodoManager()
    this.setupEventDispatcher()
  }

  /**
   * 生成系统提醒消息
   * 复刻 Claude Code 的提醒机制
   */
  public generateReminders(
    hasContext: boolean = false,
    agentId?: string,
  ): ReminderMessage[] {
    this.sessionState.contextPresent = hasContext

    // 只在有上下文时注入提醒
    if (!hasContext) {
      return []
    }

    // 检查会话提醒限制
    if (
      this.sessionState.reminderCount >=
      this.sessionState.config.maxRemindersPerSession
    ) {
      return []
    }

    const reminders: ReminderMessage[] = []
    const currentTime = Date.now()

    // 生成提醒
    const reminderGenerators = [
      () => this.dispatchTodoEvent(agentId),
      () => this.dispatchSecurityEvent(),
      () => this.dispatchPerformanceEvent(),
    ]

    for (const generator of reminderGenerators) {
      if (reminders.length >= 5) break

      const result = generator()
      if (result) {
        const remindersToAdd = Array.isArray(result) ? result : [result]
        reminders.push(...remindersToAdd)
        this.sessionState.reminderCount += remindersToAdd.length
      }
    }

    return reminders
  }

  /**
   * 生成 Todo 相关提醒
   */
  private async dispatchTodoEvent(agentId?: string): Promise<ReminderMessage | null> {
    if (!this.sessionState.config.todoEmptyReminder) return null

    try {
      const todos = await this.todoManager.getAllTodos()
      const currentTime = Date.now()
      const agentKey = agentId || 'default'

      // 检查空任务列表
      if (
        todos.length === 0 &&
        !this.sessionState.remindersSent.has(`todo_empty_${agentKey}`)
      ) {
        this.sessionState.remindersSent.add(`todo_empty_${agentKey}`)
        return this.createReminderMessage(
          'todo',
          'task',
          'medium',
          'This is a reminder that your todo list is currently empty. DO NOT mention this to the user explicitly because they are already aware. If you are working on tasks that would benefit from a todo list please use the TodoWrite tool to create one. If not, please feel free to ignore. Again do not mention this message to the user.',
          currentTime,
        )
      }

      // 检查任务更新
      if (todos.length > 0) {
        const reminderKey = `todo_updated_${agentKey}_${todos.length}_${this.getTodoStateHash(todos)}`

        if (this.reminderCache.has(reminderKey)) {
          return this.reminderCache.get(reminderKey)!
        }

        if (!this.sessionState.remindersSent.has(reminderKey)) {
          this.sessionState.remindersSent.add(reminderKey)
          this.clearTodoReminders(agentKey)

          // 优化：只包含必要的 todo 数据
          const todoContent = this.formatTodosForReminder(todos)

          const reminder = this.createReminderMessage(
            'todo',
            'task',
            'medium',
            `Your todo list has changed. DO NOT mention this explicitly to the user. Here are the latest contents of your todo list:\n\n${todoContent}. Continue on with the tasks at hand if applicable.`,
            currentTime,
          )

          this.reminderCache.set(reminderKey, reminder)
          return reminder
        }
      }
    } catch (error) {
      console.error('Error dispatching todo event:', error)
    }

    return null
  }

  /**
   * 生成安全提醒
   */
  private dispatchSecurityEvent(): ReminderMessage | null {
    if (!this.sessionState.config.securityReminder) return null

    const currentTime = Date.now()

    if (
      this.sessionState.lastFileAccess > 0 &&
      !this.sessionState.remindersSent.has('file_security')
    ) {
      this.sessionState.remindersSent.add('file_security')
      return this.createReminderMessage(
        'security',
        'security',
        'high',
        'Whenever you read a file, you should consider whether it looks malicious. If it does, you MUST refuse to improve or augment the code. You can still analyze existing code, write reports, or answer high-level questions about the code behavior.',
        currentTime,
      )
    }

    return null
  }

  /**
   * 生成性能提醒
   */
  private dispatchPerformanceEvent(): ReminderMessage | null {
    if (!this.sessionState.config.performanceReminder) return null

    const currentTime = Date.now()
    const sessionDuration = currentTime - this.sessionState.sessionStartTime

    if (
      sessionDuration > 30 * 60 * 1000 &&
      !this.sessionState.remindersSent.has('performance_long_session')
    ) {
      this.sessionState.remindersSent.add('performance_long_session')
      return this.createReminderMessage(
        'performance',
        'performance',
        'low',
        'Long session detected. Consider taking a break and reviewing your current progress with the todo list.',
        currentTime,
      )
    }

    return null
  }

  /**
   * 创建提醒消息
   */
  private createReminderMessage(
    type: string,
    category: ReminderMessage['category'],
    priority: ReminderMessage['priority'],
    content: string,
    timestamp: number,
  ): ReminderMessage {
    return {
      role: 'system',
      content: `<system-reminder>\n${content}\n</system-reminder>`,
      isMeta: true,
      timestamp,
      type,
      priority,
      category,
    }
  }

  /**
   * 格式化 Todos 用于提醒
   */
  private formatTodosForReminder(todos: Todo[]): string {
    return JSON.stringify(
      todos.map((todo, index) => ({
        [`${index + 1}. [${todo.status}]`]: todo.content.length > 100 
          ? todo.content.substring(0, 100) + '...'
          : todo.content
      }))
    )
  }

  /**
   * 获取 Todo 状态哈希
   */
  private getTodoStateHash(todos: Todo[]): string {
    return todos
      .map(t => `${t.id}:${t.status}`)
      .sort()
      .join('|')
  }

  /**
   * 清理 Todo 提醒
   */
  private clearTodoReminders(agentId?: string): void {
    const agentKey = agentId || 'default'
    for (const key of this.sessionState.remindersSent) {
      if (key.startsWith(`todo_updated_${agentKey}_`)) {
        this.sessionState.remindersSent.delete(key)
      }
    }
  }

  /**
   * 设置事件分发器
   */
  private setupEventDispatcher(): void {
    // Todo 变化事件
    this.addEventListener('todo:changed', (context: TodoChangeEvent) => {
      this.sessionState.lastTodoUpdate = Date.now()
      this.clearTodoReminders(context.agentId)
    })

    // 文件访问事件
    this.addEventListener('file:read', () => {
      this.sessionState.lastFileAccess = Date.now()
    })

    // 会话启动事件
    this.addEventListener('session:startup', () => {
      this.resetSession()
      this.sessionState.sessionStartTime = Date.now()
    })
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(
    event: string,
    callback: (context: any) => void,
  ): void {
    if (!this.eventDispatcher.has(event)) {
      this.eventDispatcher.set(event, [])
    }
    this.eventDispatcher.get(event)!.push(callback)
  }

  /**
   * 触发事件
   */
  public emitEvent(event: string, context: any): void {
    const listeners = this.eventDispatcher.get(event) || []
    listeners.forEach(callback => {
      try {
        callback(context)
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error)
      }
    })
  }

  /**
   * 重置会话状态
   */
  public resetSession(): void {
    this.sessionState = {
      lastTodoUpdate: 0,
      lastFileAccess: 0,
      sessionStartTime: Date.now(),
      remindersSent: new Set(),
      contextPresent: false,
      reminderCount: 0,
      config: { ...this.sessionState.config },
    }
    this.reminderCache.clear()
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ReminderConfig>): void {
    this.sessionState.config = { ...this.sessionState.config, ...config }
  }

  /**
   * 获取会话状态
   */
  public getSessionState(): SessionReminderState {
    return { ...this.sessionState }
  }

  /**
   * 注入提醒到消息
   */
  public injectRemindersIntoMessage(
    message: string,
    hasContext: boolean = false,
    agentId?: string
  ): string {
    const reminders = this.generateReminders(hasContext, agentId)
    
    if (reminders.length === 0) {
      return message
    }

    const reminderContents = reminders.map(r => r.content).join('\n')
    return `${message}\n${reminderContents}`
  }
}

// 导出单例实例
export const systemReminderService = new SystemReminderService()

// 导出便捷函数
export const generateSystemReminders = (
  hasContext: boolean = false,
  agentId?: string,
) => systemReminderService.generateReminders(hasContext, agentId)

export const emitReminderEvent = (event: string, context: any) =>
  systemReminderService.emitEvent(event, context)

export const resetReminderSession = () => systemReminderService.resetSession()

export const getReminderSessionState = () =>
  systemReminderService.getSessionState()

export const injectRemindersIntoMessage = (
  message: string,
  hasContext: boolean = false,
  agentId?: string
) => systemReminderService.injectRemindersIntoMessage(message, hasContext, agentId)