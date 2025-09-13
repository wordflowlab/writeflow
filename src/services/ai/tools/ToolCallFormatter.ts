/**
 * 工具调用格式化器
 * 负责格式化工具调用结果和输出美化
 */

import { 
  toolFormatter,
  formatContent 
} from '../../../utils/SmartFormatter.js'
import { format } from '../../../utils/colorScheme.js'
import type { 
  ToolExecutionResult 
} from '../../../tools/index.js'

export interface ToolCallFormatOptions {
  includeTimestamp?: boolean
  includeExecutionTime?: boolean
  colorScheme?: 'auto' | 'dark' | 'light' | 'none'
  compact?: boolean
  showSuccessOnly?: boolean
}

export interface FormattedToolCall {
  toolName: string
  callId: string
  result: string
  success: boolean
  error?: string
  formatted: string
  timestamp?: string
  executionTime?: number
}

export class ToolCallFormatter {

  /**
   * 格式化单个工具调用结果
   */
  formatToolCall(
    toolCall: ToolExecutionResult,
    options: ToolCallFormatOptions = {}
  ): FormattedToolCall {
    const {
      includeTimestamp = false,
      includeExecutionTime = true,
      colorScheme = 'auto',
      compact = false,
      showSuccessOnly = false
    } = options

    const success = toolCall.error === undefined
    const executionTime = toolCall.endTime ? (toolCall.endTime - toolCall.startTime) : undefined

    // 如果只显示成功结果且当前调用失败，返回简化格式
    if (showSuccessOnly && !success) {
      return {
        toolName: toolCall.toolName,
        callId: toolCall.executionId,
        result: '',
        success: false,
        error: toolCall.error instanceof Error ? toolCall.error.message : String(toolCall.error || ''),
        formatted: ''
      }
    }

    let formatted = ''

    if (!compact) {
      // 完整格式
      formatted += this.formatToolHeader(toolCall, includeTimestamp, executionTime)
      formatted += this.formatToolResult(toolCall, success)
      
      if (!success && toolCall.error) {
        formatted += this.formatToolError(toolCall.error instanceof Error ? toolCall.error.message : String(toolCall.error), colorScheme)
      }
    } else {
      // 紧凑格式
      formatted = this.formatCompactToolCall(toolCall, success)
    }

    return {
      toolName: toolCall.toolName,
      callId: toolCall.executionId,
      result: String(toolCall.result || ''),
      success,
      error: toolCall.error instanceof Error ? toolCall.error.message : String(toolCall.error || ''),
      formatted,
      timestamp: includeTimestamp ? new Date(toolCall.startTime).toISOString() : undefined,
      executionTime
    }
  }

  /**
   * 格式化工具头部
   */
  private formatToolHeader(
    toolCall: ToolExecutionResult,
    includeTimestamp: boolean,
    executionTime?: number
  ): string {
    let header = `🔧 ${toolCall.toolName}`
    
    if (executionTime !== undefined) {
      header += ` (${executionTime}ms)`
    }

    if (includeTimestamp) {
      const timestamp = new Date(toolCall.startTime).toLocaleTimeString()
      header += ` - ${timestamp}`
    }

    return header + '\n' + '─'.repeat(40) + '\n'
  }

  /**
   * 格式化工具结果
   */
  private formatToolResult(toolCall: ToolExecutionResult, success: boolean): string {
    if (!toolCall.result) {
      return success ? '✅ 执行成功 (无输出)\n' : '❌ 执行失败\n'
    }

    let result = String(toolCall.result)

    // 使用基本格式化
    return `${success ? '✅' : '❌'} 结果:\n${result}\n`
  }

  /**
   * 格式化工具错误
   */
  private formatToolError(error: string, colorScheme: string): string {
    const errorText = `❌ 错误: ${error}`
    
    if (colorScheme === 'none') {
      return errorText + '\n'
    }

    try {
      return format.error(errorText) + '\n'
    } catch {
      return errorText + '\n'
    }
  }

  /**
   * 格式化紧凑工具调用
   */
  private formatCompactToolCall(toolCall: ToolExecutionResult, success: boolean): string {
    const icon = success ? '✅' : '❌'
    const result = toolCall.result ? String(toolCall.result).slice(0, 100) : '无输出'
    const truncated = String(toolCall.result || '').length > 100 ? '...' : ''
    
    return `${icon} ${toolCall.toolName}: ${result}${truncated}`
  }

  /**
   * 批量格式化工具调用
   */
  formatBatchToolCalls(
    toolCalls: ToolExecutionResult[],
    options: ToolCallFormatOptions = {}
  ): FormattedToolCall[] {
    return toolCalls.map(call => this.formatToolCall(call, options))
  }

  /**
   * 生成工具调用摘要
   */
  generateToolCallSummary(toolCalls: ToolExecutionResult[]): string {
    if (toolCalls.length === 0) {
      return '无工具调用'
    }

    const successful = toolCalls.filter(call => !call.error).length
    const failed = toolCalls.length - successful
    const totalTime = toolCalls.reduce((sum, call) => {
      const time = call.endTime ? (call.endTime - call.startTime) : 0
      return sum + time
    }, 0)

    let summary = `📊 工具调用摘要: 总计 ${toolCalls.length} 个工具`
    if (successful > 0) {
      summary += `, 成功 ${successful} 个`
    }
    if (failed > 0) {
      summary += `, 失败 ${failed} 个`
    }
    summary += `, 耗时 ${totalTime}ms`

    // 添加工具类型统计
    const toolTypes = new Map<string, number>()
    toolCalls.forEach(call => {
      toolTypes.set(call.toolName, (toolTypes.get(call.toolName) || 0) + 1)
    })

    if (toolTypes.size > 0) {
      const typeList = Array.from(toolTypes.entries())
        .map(([name, count]) => count > 1 ? `${name}(${count})` : name)
        .join(', ')
      summary += `\n使用工具: ${typeList}`
    }

    return summary
  }

  /**
   * 格式化工具调用日志
   */
  formatToolCallLog(
    toolCalls: ToolExecutionResult[],
    options: ToolCallFormatOptions = {}
  ): string {
    if (toolCalls.length === 0) {
      return '无工具调用记录'
    }

    let log = this.generateToolCallSummary(toolCalls) + '\n\n'
    
    const formattedCalls = this.formatBatchToolCalls(toolCalls, {
      ...options,
      compact: true
    })

    formattedCalls.forEach((call, index) => {
      if (call.formatted) {
        log += `${index + 1}. ${call.formatted}\n`
      }
    })

    return log.trim()
  }

  /**
   * 创建工具调用报告
   */
  createToolCallReport(toolCalls: ToolExecutionResult[]): {
    summary: string
    details: FormattedToolCall[]
    statistics: {
      total: number
      successful: number
      failed: number
      totalTime: number
      averageTime: number
      toolTypes: Record<string, number>
    }
  } {
    const details = this.formatBatchToolCalls(toolCalls, {
      includeTimestamp: true,
      includeExecutionTime: true
    })

    const successful = toolCalls.filter(call => !call.error).length
    const failed = toolCalls.length - successful
    const totalTime = toolCalls.reduce((sum, call) => {
      const time = call.endTime ? (call.endTime - call.startTime) : 0
      return sum + time
    }, 0)

    const toolTypes: Record<string, number> = {}
    toolCalls.forEach(call => {
      toolTypes[call.toolName] = (toolTypes[call.toolName] || 0) + 1
    })

    const statistics = {
      total: toolCalls.length,
      successful,
      failed,
      totalTime,
      averageTime: toolCalls.length > 0 ? Math.round(totalTime / toolCalls.length) : 0,
      toolTypes
    }

    return {
      summary: this.generateToolCallSummary(toolCalls),
      details,
      statistics
    }
  }
}

// 全局实例
let globalToolCallFormatter: ToolCallFormatter | null = null

/**
 * 获取全局工具调用格式化器实例
 */
export function getToolCallFormatter(): ToolCallFormatter {
  if (!globalToolCallFormatter) {
    globalToolCallFormatter = new ToolCallFormatter()
  }
  return globalToolCallFormatter
}

/**
 * 便捷函数：格式化工具调用
 */
export function formatToolCall(
  toolCall: ToolExecutionResult,
  options?: ToolCallFormatOptions
): FormattedToolCall {
  return getToolCallFormatter().formatToolCall(toolCall, options)
}

/**
 * 便捷函数：格式化工具调用摘要
 */
export function generateToolCallSummary(toolCalls: ToolExecutionResult[]): string {
  return getToolCallFormatter().generateToolCallSummary(toolCalls)
}