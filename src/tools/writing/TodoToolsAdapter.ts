import { WritingTool as LegacyWritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { WritingTool as ModernWritingTool, ToolUseContext } from '../../types/WritingTool.js'
import { TodoWriteTool } from './TodoWriteTool.js'
import { TodoReadTool } from './TodoReadTool.js'
import { TodoManager } from '../TodoManager.js'
import { Todo, TodoStatus } from '../../types/Todo.js'
import { z } from 'zod'

/**
 * TodoTools 适配器
 * 将现代的 WritingTool 接口适配到传统的 WritingTool 接口
 * 这样可以让新的 TodoWriteTool 和 TodoReadTool 与现有系统集成
 */

class TodoToolAdapter implements LegacyWritingTool {
  name: string
  description: string
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'
  // 暴露底层 TodoManager（供 UI 获取 todos 数据）
  public todoManager?: any

  constructor(
    private modernTool: ModernWritingTool,
    private sessionId?: string
  ) {
    this.name = modernTool.name
    this.description = typeof modernTool.description === 'string' 
      ? modernTool.description 
      : '更新任务列表工具'

    // 若为 TodoWriteTool，则暴露其内部 todoManager，便于 UI 获取/保存任务
    if (modernTool instanceof TodoWriteTool) {
      // 访问私有字段（运行时存在）
      this.todoManager = (modernTool as any).todoManager
    }
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      // 创建模拟的上下文
      const context: ToolUseContext = {
        agentId: 'default',
        abortController: new AbortController(),
        options: {
          verbose: false,
          safeMode: true
        }
      }

      // 验证输入（如果工具支持）
      if (this.modernTool.validateInput) {
        const validation = await this.modernTool.validateInput(input, context)
        if (!validation.result) {
          return {
            success: false,
            error: validation.message || '输入验证失败'
          }
        }
      }

      // 执行现代工具
      const modernResult = await this.modernTool.execute(input, context)

      // 如果是 TodoWriteTool，生成彩色渲染结果
      let displayContent = modernResult.content
      if (modernResult.success && this.modernTool instanceof TodoWriteTool) {
        displayContent = this.renderColorfulTodos(this.modernTool as TodoWriteTool)
      }

      // 转换结果格式
      return {
        success: modernResult.success,
        content: displayContent,
        metadata: modernResult.metadata,
        error: modernResult.success ? undefined : modernResult.content
      }

    } catch (error) {
      return {
        success: false,
        error: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    try {
      if (!this.modernTool.validateInput) return true

      const context: ToolUseContext = {
        agentId: 'default',
        abortController: new AbortController()
      }

      const validation = await this.modernTool.validateInput(input, context)
      return validation.result
    } catch (error) {
      console.error('输入验证失败:', error)
      return false
    }
  }

  // 生成彩色的 Todos 文本输出 - 采用现代化的视觉效果
  private renderColorfulTodos(todoTool: TodoWriteTool): string {
    const todos = (todoTool as any).cachedTodos as Todo[]
    
    if (!todos || todos.length === 0) {
      return '\n🎯 **任务列表已更新**\n\n    ⎿  暂无任务\n'
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

    let output = '\n🎯 **任务列表已更新**\n\n'
    
    sortedTodos.forEach((todo, index) => {
      // 确定复选框符号和显示样式 - 采用最佳实践的精确配色
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
    
    output += '\n'
    return output
  }
}

/**
 * 创建 TodoWrite 工具适配器
 */
export function createTodoWriteToolAdapter(sessionId?: string): LegacyWritingTool {
  const manager = new TodoManager(sessionId || process.env.WRITEFLOW_SESSION_ID)
  const todoWriteTool = new TodoWriteTool(manager)
  return new TodoToolAdapter(todoWriteTool, sessionId)
}

/**
 * 创建 TodoRead 工具适配器  
 */
export function createTodoReadToolAdapter(sessionId?: string): LegacyWritingTool {
  const manager = new TodoManager(sessionId || process.env.WRITEFLOW_SESSION_ID)
  const todoReadTool = new TodoReadTool(manager)
  return new TodoToolAdapter(todoReadTool, sessionId)
}

/**
 * 批量创建 Todo 工具适配器
 */
export function createTodoToolAdapters(sessionId?: string): LegacyWritingTool[] {
  return [
    createTodoWriteToolAdapter(sessionId),
    createTodoReadToolAdapter(sessionId)
  ]
}
