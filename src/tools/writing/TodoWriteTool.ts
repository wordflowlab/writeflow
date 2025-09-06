import React from 'react'
import { Box, Text } from 'ink'
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

      // 生成成功消息 - 复刻 Claude Code 的标准响应
      const successMessage = 'Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable'

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

  // 渲染工具结果消息 - 借鉴 Kode 的实现
  renderToolResultMessage(): React.ReactElement {
    // 使用缓存的 todos 数据
    const currentTodos = this.cachedTodos

    if (currentTodos.length === 0) {
      return (
        <Box flexDirection="column" width="100%">
          <Box flexDirection="row">
            <Text color="#6B7280">&nbsp;&nbsp;⎿ &nbsp;</Text>
            <Text color="#9CA3AF">暂无任务</Text>
          </Box>
        </Box>
      )
    }

    // 排序: [completed, in_progress, pending] - 与 Kode 相同的逻辑
    const sortedTodos = [...currentTodos].sort((a, b) => {
      const order = ['completed', 'in_progress', 'pending']
      return (
        order.indexOf(a.status) - order.indexOf(b.status) ||
        a.content.localeCompare(b.content)
      )
    })

    // 找到下一个待处理任务（排序后的第一个 pending 任务）
    const nextPendingIndex = sortedTodos.findIndex(todo => todo.status === TodoStatus.PENDING)

    return (
      <Box flexDirection="column" width="100%">
        {sortedTodos.map((todo: Todo, index: number) => {
          // 确定复选框符号和颜色 - 借鉴 Kode 的精确配色
          let checkbox: string
          let textColor: string
          let isBold = false
          let isStrikethrough = false

          if (todo.status === TodoStatus.COMPLETED) {
            checkbox = '☒'
            textColor = '#6B7280' // 完成任务使用专业灰色
            isStrikethrough = true
          } else if (todo.status === TodoStatus.IN_PROGRESS) {
            checkbox = '☐'
            textColor = '#10B981' // 进行中任务使用专业绿色
            isBold = true
          } else if (todo.status === TodoStatus.PENDING) {
            checkbox = '☐'
            // 只有第一个待处理任务获得紫色高亮
            if (index === nextPendingIndex) {
              textColor = '#8B5CF6' // 下一个待处理任务使用专业紫色
              isBold = true
            } else {
              textColor = '#9CA3AF' // 其他待处理任务使用柔和灰色
            }
          } else {
            checkbox = '☐'
            textColor = '#9CA3AF'
          }

          return (
            <Box key={todo.id || index} flexDirection="row" marginBottom={0}>
              <Text color="#6B7280">&nbsp;&nbsp;⎿ &nbsp;</Text>
              <Box flexDirection="row" flexGrow={1}>
                <Text color={textColor} bold={isBold} strikethrough={isStrikethrough}>
                  {checkbox}
                </Text>
                <Text> </Text>
                <Text color={textColor} bold={isBold} strikethrough={isStrikethrough}>
                  {todo.content}
                </Text>
              </Box>
            </Box>
          )
        })}
      </Box>
    )
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
}

/**
 * 工厂函数 - 创建 TodoWriteTool 实例
 */
export function createTodoWriteTool(todoManager?: TodoManager): TodoWriteTool {
  return new TodoWriteTool(todoManager)
}
