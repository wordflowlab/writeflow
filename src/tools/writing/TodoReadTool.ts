import { z } from 'zod'
import { WritingTool, ToolUseContext, ToolResult, ValidationResult } from '../../types/WritingTool.js'
import { TodoManager } from '../TodoManager.js'
import { Todo, TodoStatus } from '../../types/Todo.js'
import { getTodoReadDescription } from './todo-prompts.js'

// 定义输入 Schema - 参考 Claude Code FL6，不需要任何参数
const InputSchema = z.object({}).describe(
  '无需输入参数，留空即可。注意：不需要虚拟对象、占位符字符串或键名如"input"或"empty"。直接留空。'
)

/**
 * TodoRead 工具 - 读取当前任务列表
 * 完全复刻 Claude Code v1.0.33 的 TodoRead 工具功能
 */
export class TodoReadTool implements WritingTool<typeof InputSchema, string> {
  name = 'todo_read'
  description = getTodoReadDescription()
  inputSchema = InputSchema
  securityLevel = 'safe' as const

  private todoManager: TodoManager

  constructor(todoManager?: TodoManager) {
    this.todoManager = todoManager || new TodoManager()
  }

  // 权限控制方法
  isReadOnly(): boolean {
    return true // 只读工具
  }

  needsPermissions(): boolean {
    return false
  }

  isConcurrencySafe(): boolean {
    return true // 支持并发，因为是只读操作
  }

  async isEnabled(): Promise<boolean> {
    return true
  }

  // 验证输入（无需验证，因为没有输入）
  async validateInput(
    input: z.infer<typeof InputSchema>,
    context?: ToolUseContext
  ): Promise<ValidationResult> {
    return { result: true }
  }

  // 执行工具
  async execute(
    input: z.infer<typeof InputSchema>, _context: ToolUseContext
  ): Promise<ToolResult<string>> {
    try {
      // 获取当前任务列表
      const todos = await this.todoManager.getAllTodos()

      // 格式化任务列表
      const formattedTodos = this.formatTodos(todos)

      // 生成响应消息 - 复刻 Claude Code 的响应格式
      const responseMessage = `Remember to continue to use update and read from the todo list as you make progress. Here is the current list: ${JSON.stringify(todos)}`

      return {
        success: true,
        content: formattedTodos,
        data: formattedTodos,
        metadata: {
          todosCount: todos.length,
          hasPending: todos.some(t => t.status === TodoStatus.PENDING),
          hasInProgress: todos.some(t => t.status === TodoStatus.IN_PROGRESS),
          hasCompleted: todos.some(t => t.status === TodoStatus.COMPLETED),
          timestamp: new Date().toISOString(),
          agentId: _context.agentId || 'default'
        }
      }

    } catch (_error) {
      const errorMessage = `读取任务列表失败: ${_error instanceof Error ? _error.message : '未知错误'}`
      
      return {
        success: false,
        content: errorMessage,
        data: errorMessage,
        metadata: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
          agentId: _context.agentId || 'default'
        }
      }
    }
  }

  // 渲染工具使用消息
  renderToolUseMessage(
    input: z.infer<typeof InputSchema>,
    options: { verbose: boolean }
  ): string {
    return '正在读取任务列表...'
  }

  // 格式化任务列表 - 参考 Claude Code 的显示格式
  private formatTodos(todos: Todo[]): string {
    if (todos.length === 0) {
      return '(Todo list is empty)'
    }

    // 按状态分组
    const pendingTodos = todos.filter(t => t.status === TodoStatus.PENDING)
    const inProgressTodos = todos.filter(t => t.status === TodoStatus.IN_PROGRESS)
    const completedTodos = todos.filter(t => t.status === TodoStatus.COMPLETED)

    let output = '# 📋 当前任务列表\n\n'

    // 进行中的任务
    if (inProgressTodos.length > 0) {
      output += '## ⏳ 进行中\n'
      inProgressTodos.forEach(todo => {
        output += `- **${todo.activeForm}**\n`
        output += `  ID: ${todo.id.split('-').pop()}\n\n`
      })
    }

    // 待处理的任务
    if (pendingTodos.length > 0) {
      output += '## ⭕ 待处理\n'
      pendingTodos.forEach(todo => {
        const priorityIcon = todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟡' : '🟢'
        output += `- ${priorityIcon} ${todo.content}\n`
        output += `  ID: ${todo.id.split('-').pop()}\n\n`
      })
    }

    // 已完成的任务（只显示最近的几个）
    if (completedTodos.length > 0) {
      output += '## ✅ 已完成\n'
      const recentCompleted = completedTodos
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 3)
      
      recentCompleted.forEach(todo => {
        output += `- ~~${todo.content}~~\n`
        output += `  完成时间: ${todo.updatedAt.toLocaleDateString()}\n\n`
      })

      if (completedTodos.length > 3) {
        output += `... 还有 ${completedTodos.length - 3} 个已完成任务\n\n`
      }
    }

    // 统计信息
    const stats = {
      total: todos.length,
      pending: pendingTodos.length,
      inProgress: inProgressTodos.length,
      completed: completedTodos.length
    }

    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

    output += '---\n'
    output += `📊 **统计**: 总计 ${stats.total} | 待处理 ${stats.pending} | 进行中 ${stats.inProgress} | 已完成 ${stats.completed} | 完成率 ${completionRate}%`

    return output
  }
}

/**
 * 工厂函数 - 创建 TodoReadTool 实例
 */
export function createTodoReadTool(todoManager?: TodoManager): TodoReadTool {
  return new TodoReadTool(todoManager)
}
