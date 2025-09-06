import { promises as fs } from 'fs'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { z } from 'zod'
import { Todo, TodoStatus, TodoPriority, CreateTodoParams, UpdateTodoParams, TodoStats } from '../types/Todo.js'

// Zod Schema 验证 - 基于 Claude Code 的严格验证
const TodoStatusSchema = z.enum(['pending', 'in_progress', 'completed'])
const TodoPrioritySchema = z.enum(['high', 'medium', 'low'])

const TodoSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1, 'Content cannot be empty'),
  activeForm: z.string().min(1),
  status: TodoStatusSchema,
  priority: TodoPrioritySchema,
  createdAt: z.string().transform((str: string) => new Date(str)),
  updatedAt: z.string().transform((str: string) => new Date(str)),
})

const TodoArraySchema = z.array(TodoSchema)

export class TodoStorage {
  private todosDir: string
  private sessionFile: string
  private sessionId: string

  constructor(sessionId?: string) {
    // 优先使用全局会话ID，确保 CLI、AI 服务、UI 共用同一份 Todo 存储
    const globalSession = process.env.WRITEFLOW_SESSION_ID
    this.sessionId = sessionId || globalSession || this.generateSessionId()
    this.todosDir = this.getTodosDirectory()
    this.sessionFile = path.join(this.todosDir, `${this.sessionId}-todos.json`)
    // 确保目录同步创建
    this.ensureDirectoryExistsSync()
  }

  private getTodosDirectory(): string {
    const configDir = process.env.WRITEFLOW_CONFIG_DIR ?? path.join(os.homedir(), '.writeflow')
    return path.join(configDir, 'todos')
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.todosDir, { recursive: true })
    } catch (error) {
      console.error('创建 todos 目录失败:', error)
    }
  }

  private ensureDirectoryExistsSync(): void {
    try {
      fsSync.mkdirSync(this.todosDir, { recursive: true })
    } catch (error) {
      console.error('同步创建 todos 目录失败:', error)
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private generateTodoId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // 读取 Todo 数据 - 参考 Claude Code La0 函数
  async loadTodos(): Promise<Todo[]> {
    try {
      const exists = await fs.access(this.sessionFile).then(() => true).catch(() => false)
      if (!exists) {
        return []
      }

      const data = await fs.readFile(this.sessionFile, 'utf-8')
      const parsed = JSON.parse(data)
      
      // 使用 Schema 验证 - 参考 Claude Code 的严格验证
      const validatedData = TodoArraySchema.parse(parsed)
      
      // 转换为正确的类型
      return validatedData.map(item => ({
        ...item,
        status: item.status as TodoStatus,
        priority: item.priority as TodoPriority,
      }))
    } catch (error) {
      console.error('加载 Todo 数据失败:', error)
      return []
    }
  }

  // 保存 Todo 数据 - 参考 Claude Code Ra0 函数 
  async saveTodos(todos: Todo[]): Promise<void> {
    try {
      const data = JSON.stringify(todos, null, 2)
      // 原子写入 - 参考 Claude Code eM 函数的 flush: true 选项
      await fs.writeFile(this.sessionFile, data, { 
        encoding: 'utf-8',
        flag: 'w',  // 确保原子写入
      })
    } catch (error) {
      console.error('保存 Todo 数据失败:', error)
      throw error
    }
  }

  async addTodo(params: CreateTodoParams): Promise<Todo> {
    const todos = await this.loadTodos()
    const now = new Date()
    
    const newTodo: Todo = {
      id: this.generateTodoId(),
      content: params.content,
      activeForm: params.activeForm,
      status: TodoStatus.PENDING,
      priority: params.priority || TodoPriority.MEDIUM,
      createdAt: now,
      updatedAt: now,
    }

    todos.push(newTodo)
    await this.saveTodos(todos)
    return newTodo
  }

  async updateTodo(params: UpdateTodoParams): Promise<Todo | null> {
    const todos = await this.loadTodos()
    const index = todos.findIndex(todo => todo.id === params.id)
    
    if (index === -1) {
      return null
    }

    const todo = todos[index]
    const now = new Date()

    // 更新字段
    if (params.status !== undefined) todo.status = params.status
    if (params.content !== undefined) todo.content = params.content
    if (params.activeForm !== undefined) todo.activeForm = params.activeForm
    if (params.priority !== undefined) todo.priority = params.priority
    todo.updatedAt = now

    await this.saveTodos(todos)
    return todo
  }

  async removeTodo(id: string): Promise<boolean> {
    const todos = await this.loadTodos()
    const index = todos.findIndex(todo => todo.id === id)
    
    if (index === -1) {
      return false
    }

    todos.splice(index, 1)
    await this.saveTodos(todos)
    return true
  }

  async clearAllTodos(): Promise<void> {
    await this.saveTodos([])
  }

  async getTodoById(id: string): Promise<Todo | null> {
    const todos = await this.loadTodos()
    return todos.find(todo => todo.id === id) || null
  }

  async getStats(): Promise<TodoStats> {
    const todos = await this.loadTodos()
    
    const stats = {
      total: todos.length,
      pending: todos.filter(t => t.status === TodoStatus.PENDING).length,
      inProgress: todos.filter(t => t.status === TodoStatus.IN_PROGRESS).length,
      completed: todos.filter(t => t.status === TodoStatus.COMPLETED).length,
      completionRate: 0,
    }

    if (stats.total > 0) {
      stats.completionRate = Math.round((stats.completed / stats.total) * 100)
    }

    return stats
  }

  // 获取当前会话ID
  getSessionId(): string {
    return this.sessionId
  }

  // 获取存储文件路径
  getStoragePath(): string {
    return this.sessionFile
  }

  // 获取存储信息
  getStorageInfo(): { sessionId: string; storagePath: string } {
    return {
      sessionId: this.sessionId,
      storagePath: this.sessionFile,
    }
  }
}
