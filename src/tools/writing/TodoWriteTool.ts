// JSX 渲染交由适配器处理，此处工具逻辑保持纯文本
import React from 'react'
import { z } from 'zod'
import { WritingTool, ToolUseContext, ToolResult, ValidationResult } from '../../types/WritingTool.js'
import { TodoManager } from '../TodoManager.js'
import { Todo, TodoStatus, TodoPriority } from '../../types/Todo.js'
import { emitReminderEvent, TodoChangeEvent } from '../../services/SystemReminderService.js'
import { getTodoWriteDescription, getTodoWritePrompt } from './todo-prompts.js'

// 定义输入 Schema - 完全复刻 Claude Code 的结构
const TodoItemSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
  content: z.string().min(1, '任务内容不能为空'),
  activeForm: z.string().min(1, '进行时描述不能为空'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  createdAt: z.string().transform(str => new Date(str)).optional(),
  updatedAt: z.string().transform(str => new Date(str)).optional()
})

const InputSchema = z.object({
  todos: z.array(TodoItemSchema).describe('更新后的任务列表')
})

/**
 * TodoWrite 工具 - AI 任务管理核心工具
 * 完全复刻 Claude Code v1.0.33 的 TodoWrite 工具功能
 */
export class TodoWriteTool implements WritingTool<typeof InputSchema, string> {
  name = 'todo_write'
  description = getTodoWriteDescription()
  inputSchema = InputSchema
  securityLevel = 'safe' as const

  private todoManager: TodoManager
  private cachedTodos: Todo[] = [] // 缓存最新的 todos 数据用于渲染

  constructor(todoManager?: TodoManager) {
    this.todoManager = todoManager || new TodoManager()
  }

  // 权限控制方法
  isReadOnly(): boolean {
    return false
  }

  needsPermissions(): boolean {
    return false
  }

  isConcurrencySafe(): boolean {
    return false // 不支持并发，参考 Claude Code 设计
  }

  async isEnabled(): Promise<boolean> {
    return true
  }

  // 验证输入
  async validateInput(
    input: z.infer<typeof InputSchema>,
    context?: ToolUseContext
  ): Promise<ValidationResult> {
    try {
      const { todos } = input

      // 验证 todos 数组
      const validation = this.todoManager.validateTodos(todos as Todo[])
      if (!validation.isValid) {
        return {
          result: false,
          message: validation.error,
          errorCode: 1
        }
      }

      return { result: true }
    } catch (error) {
      return {
        result: false,
        message: error instanceof Error ? error.message : '验证失败',
        errorCode: 500
      }
    }
  }

  // 执行工具
  async execute(
    input: z.infer<typeof InputSchema>,
    context: ToolUseContext
  ): Promise<ToolResult<string>> {
    try {
      const { todos } = input

      // 获取旧的任务列表
      const oldTodos = await this.todoManager.getAllTodos()

      // 转换输入数据为 Todo 类型
      const todoList: Todo[] = todos.map(todo => ({
        id: todo.id,
        content: todo.content,
        activeForm: todo.activeForm,
        status: todo.status as TodoStatus,
        priority: (todo.priority as TodoPriority) || TodoPriority.MEDIUM,
        createdAt: todo.createdAt || new Date(),
        updatedAt: todo.updatedAt || new Date()
      }))

      // 保存新的任务列表
      await this.todoManager.saveTodos(todoList)
      
      // 缓存最新数据供渲染使用
      this.cachedTodos = todoList

      // 生成格式化的任务列表输出 - 参考 TodoToolsAdapter 实现
      const formattedTodos = this.renderFormattedTodos(todoList)
      const successMessage = `Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable\n\n${formattedTodos}`

      // 触发系统提醒事件
      this.emitTodoChangedEvent(oldTodos, todoList, context)

      return {
        success: true,
        content: successMessage,
        data: successMessage,
        metadata: {
          oldTodosCount: oldTodos.length,
          newTodosCount: todoList.length,
          timestamp: new Date().toISOString(),
          agentId: context.agentId || 'default'
        }
      }

    } catch (error) {
      const errorMessage = `更新任务列表失败: ${error instanceof Error ? error.message : '未知错误'}`
      
      return {
        success: false,
        content: errorMessage,
        data: errorMessage,
        metadata: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
          agentId: context.agentId || 'default'
        }
      }
    }
  }

  // 渲染工具使用消息
  renderToolUseMessage(
    input: z.infer<typeof InputSchema>,
    options: { verbose: boolean }
  ): string {
    const { todos } = input
    
    if (options.verbose) {
      const stats = this.calculateStats(todos)
      return `正在更新任务列表 (${stats.total} 个任务: ${stats.pending} 待处理, ${stats.inProgress} 进行中, ${stats.completed} 已完成)`
    }
    
    return `正在更新任务列表 (${todos.length} 个任务)`
  }

  // 生成格式化的任务列表文本输出 - 参考 TodoToolsAdapter 实现
  private renderFormattedTodos(todos: Todo[]): string {
    const formatted = TodoWriteTool.formatTodosAsMarkdown(todos)
    return formatted.replace('🎯 **任务列表**', '🎯 **任务列表已更新**')
  }

  // 私有辅助方法
  private calculateStats(todos: any[]) {
    return {
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      inProgress: todos.filter(t => t.status === 'in_progress').length,
      completed: todos.filter(t => t.status === 'completed').length
    }
  }

  // 触发 Todo 变化事件
  private emitTodoChangedEvent(
    oldTodos: Todo[],
    newTodos: Todo[],
    context: ToolUseContext
  ): void {
    // 判断变化类型
    let changeType: 'added' | 'removed' | 'modified' = 'modified'
    if (newTodos.length > oldTodos.length) {
      changeType = 'added'
    } else if (newTodos.length < oldTodos.length) {
      changeType = 'removed'
    }

    const eventData: TodoChangeEvent = {
      oldTodos,
      newTodos,
      timestamp: Date.now(),
      agentId: context.agentId || 'default',
      changeType
    }

    // 触发 todo:changed 事件
    emitReminderEvent('todo:changed', eventData)
  }

  /**
   * 静态方法：渲染 TODO JSON 为格式化文本
   * 用于检测和转换 AI 直接输出的 JSON 格式 todos
   */
  static renderTodoJSON(jsonContent: string): string | null {
    try {
      console.log('🔍 尝试解析 TODO JSON...')
      // 尝试解析 JSON
      let data: any
      try {
        data = JSON.parse(jsonContent)
        console.log('✅ JSON 解析成功')
      } catch (e) {
        console.log('❌ JSON 解析失败:', (e as Error)?.message)
        return null
      }

      // 检测是否为 todo 格式
      let todos: Todo[] = []
      console.log('📋 检测 TODO 格式，数据类型:', typeof data, Array.isArray(data) ? '(数组)' : '')
      
      if (Array.isArray(data)) {
        console.log(`📋 检测到数组，长度: ${data.length}`)
        // 直接的 todo 数组
        // 检查每个项目的字段
        const isValidTodo = data.every((item, index) => {
          const hasContent = item && typeof item === 'object' && 'content' in item
          const hasStatus = item && 'status' in item
          const validStatus = ['pending', 'in_progress', 'completed'].includes(item.status)
          
          if (!hasContent || !hasStatus || !validStatus) {
            console.log(`❌ 项目 ${index} 验证失败:`, {
              hasContent,
              hasStatus,
              validStatus,
              status: item?.status,
              content: item?.content?.substring(0, 50)
            })
          }
          
          return hasContent && hasStatus && validStatus
        })
        
        if (isValidTodo) {
          todos = data as Todo[]
          console.log(`✅ 识别为有效的 TODO 数组，包含 ${todos.length} 个任务`)
        } else {
          console.log('❌ 数组不符合 TODO 格式要求')
        }
      } else if (data && typeof data === 'object' && data.todos && Array.isArray(data.todos)) {
        console.log(`📋 检测到包装格式，todos 长度: ${data.todos.length}`)
        // 包装的 { todos: [...] } 格式
        if (data.todos.every((item: any) => 
          item && 
          typeof item === 'object' && 
          'content' in item && 
          'status' in item &&
          ['pending', 'in_progress', 'completed'].includes(item.status)
        )) {
          todos = data.todos as Todo[]
          console.log(`✅ 识别为有效的包装 TODO 格式，包含 ${todos.length} 个任务`)
        } else {
          console.log('❌ 包装格式不符合 TODO 要求')
        }
      } else {
        console.log('❌ 数据结构不是预期的 TODO 格式')
      }

      if (todos.length === 0) {
        console.log('❌ 没有找到有效的 TODO 项')
        return null // 不是有效的 todo JSON
      }

      // 使用相同的渲染逻辑
      console.log('🎨 开始格式化 TODO 列表...')
      const result = TodoWriteTool.formatTodosAsMarkdown(todos)
      console.log(`📋 格式化完成，结果长度: ${result.length}`)
      return result

    } catch (error) {
      return null
    }
  }

  /**
   * 静态方法：格式化 todos 为 Markdown
   */
  static formatTodosAsMarkdown(todos: Todo[]): string {
    if (!todos || todos.length === 0) {
      return '🎯 **任务列表**\n\n    ⎿  暂无任务'
    }

    // 排序: [completed, in_progress, pending] - 采用最佳实践的逻辑
    const sortedTodos = [...todos].sort((a, b) => {
      const order = ['completed', 'in_progress', 'pending']
      return (
        order.indexOf(a.status) - order.indexOf(b.status) ||
        a.content.localeCompare(b.content)
      )
    })

    // 找到下一个待处理任务（排序后的第一个 pending 任务）
    const nextPendingIndex = sortedTodos.findIndex(todo => todo.status === TodoStatus.PENDING)

    let output = '🎯 **任务列表**\n\n'
    
    sortedTodos.forEach((todo, index) => {
      // 确定复选框符号和显示样式
      let checkbox: string
      let statusLabel: string
      let emphasis = ''
      
      if (todo.status === TodoStatus.COMPLETED) {
        checkbox = '☒'
        statusLabel = '已完成'
        emphasis = '~~' // 删除线效果
      } else if (todo.status === TodoStatus.IN_PROGRESS) {
        checkbox = '☐'
        statusLabel = '进行中'
        emphasis = '**' // 加粗效果
      } else if (todo.status === TodoStatus.PENDING) {
        checkbox = '☐'
        // 只有第一个待处理任务获得特殊标记
        if (index === nextPendingIndex) {
          statusLabel = '下一个'
          emphasis = '**' // 加粗效果，表示优先级
        } else {
          statusLabel = '待处理'
          emphasis = ''
        }
      } else {
        checkbox = '☐'
        statusLabel = '待处理'
        emphasis = ''
      }

      const content = emphasis ? `${emphasis}${todo.content}${emphasis}` : todo.content
      output += `    ⎿  ${checkbox} ${content} *[${statusLabel}]*\n`
    })
    
    return output
  }
}

/**
 * 工厂函数 - 创建 TodoWriteTool 实例
 */
export function createTodoWriteTool(todoManager?: TodoManager): TodoWriteTool {
  return new TodoWriteTool(todoManager)
}
