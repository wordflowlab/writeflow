import { WritingTool as LegacyWritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { WritingTool as ModernWritingTool, ToolUseContext } from '../../types/WritingTool.js'
import { TodoWriteTool } from './TodoWriteTool.js'
import { TodoReadTool } from './TodoReadTool.js'
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

  constructor(
    private modernTool: ModernWritingTool,
    private sessionId?: string
  ) {
    this.name = modernTool.name
    this.description = typeof modernTool.description === 'string' 
      ? modernTool.description 
      : '更新任务列表工具'
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

      // 转换结果格式
      return {
        success: modernResult.success,
        content: modernResult.content,
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
}

/**
 * 创建 TodoWrite 工具适配器
 */
export function createTodoWriteToolAdapter(sessionId?: string): LegacyWritingTool {
  const todoWriteTool = new TodoWriteTool()
  return new TodoToolAdapter(todoWriteTool, sessionId)
}

/**
 * 创建 TodoRead 工具适配器  
 */
export function createTodoReadToolAdapter(sessionId?: string): LegacyWritingTool {
  const todoReadTool = new TodoReadTool()
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