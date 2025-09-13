/**
 * 进度管理器 - 参考 Kode 的渐进式工具执行展示
 * 提供实时的工具执行状态和进度反馈
 */

import { ToolExecutionResult, ToolExecutionStatus } from '../../../tools/ToolOrchestrator.js'
import { format } from '../../../utils/colorScheme.js'
import { getMessageLogger, MessageType } from '../messaging/MessageManager.js'

export interface ToolProgressState {
  toolName: string
  executionId: string
  status: ToolExecutionStatus
  startTime: number
  progress?: number
  currentStep?: string
  estimatedDuration?: number
  logs: ProgressLogEntry[]
}

export interface ProgressLogEntry {
  timestamp: number
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  data?: any
}

export interface ProgressDisplayOptions {
  showProgress?: boolean
  showLogs?: boolean
  maxLogEntries?: number
  updateInterval?: number
  enableColors?: boolean
}

/**
 * 进度管理器 - 借鉴 Kode 的分步骤执行展示
 */
export class ProgressManager {
  private activeProgresses = new Map<string, ToolProgressState>()
  private displayOptions: Required<ProgressDisplayOptions>
  private updateCallbacks = new Map<string, (state: ToolProgressState) => void>()
  private messageLogger = getMessageLogger()

  constructor(options: ProgressDisplayOptions = {}) {
    this.displayOptions = {
      showProgress: options.showProgress ?? true,
      showLogs: options.showLogs ?? false,
      maxLogEntries: options.maxLogEntries ?? 10,
      updateInterval: options.updateInterval ?? 500,
      enableColors: options.enableColors ?? true
    }
  }

  /**
   * 开始跟踪工具执行进度
   */
  startProgress(
    toolName: string, 
    executionId: string,
    onUpdate?: (state: ToolProgressState) => void
  ): void {
    const progressState: ToolProgressState = {
      toolName,
      executionId,
      status: ToolExecutionStatus.RUNNING,
      startTime: Date.now(),
      logs: []
    }

    this.activeProgresses.set(executionId, progressState)
    
    if (onUpdate) {
      this.updateCallbacks.set(executionId, onUpdate)
    }

    // 显示开始状态
    this.displayToolStart(progressState)
  }

  /**
   * 更新工具执行进度
   */
  updateProgress(
    executionId: string,
    updates: Partial<{
      progress: number
      currentStep: string
      estimatedDuration: number
      status: ToolExecutionStatus
    }>
  ): void {
    const state = this.activeProgresses.get(executionId)
    if (!state) return

    Object.assign(state, updates)

    const callback = this.updateCallbacks.get(executionId)
    if (callback) {
      callback(state)
    }

    // 显示进度更新
    if (this.displayOptions.showProgress) {
      this.displayProgressUpdate(state)
    }
  }

  /**
   * 记录执行日志
   */
  log(
    executionId: string,
    message: string,
    type: ProgressLogEntry['type'] = 'info',
    data?: any
  ): void {
    const state = this.activeProgresses.get(executionId)
    if (!state) return

    const logEntry: ProgressLogEntry = {
      timestamp: Date.now(),
      message,
      type,
      data
    }

    state.logs.push(logEntry)

    // 限制日志数量
    if (state.logs.length > this.displayOptions.maxLogEntries) {
      state.logs.shift()
    }

    // 显示日志（如果启用）
    if (this.displayOptions.showLogs && type !== 'info') {
      this.displayLogEntry(state, logEntry)
    }
  }

  /**
   * 完成工具执行
   */
  finishProgress(
    executionId: string,
    result: ToolExecutionResult
  ): void {
    const state = this.activeProgresses.get(executionId)
    if (!state) return

    state.status = result.status
    
    // 显示完成状态
    this.displayToolComplete(state, result)

    // 清理
    this.activeProgresses.delete(executionId)
    this.updateCallbacks.delete(executionId)
  }

  /**
   * 获取当前活跃的进度状态
   */
  getActiveProgresses(): ToolProgressState[] {
    return Array.from(this.activeProgresses.values())
  }

  /**
   * 显示工具开始执行 - Kode 风格
   */
  private displayToolStart(state: ToolProgressState): void {
    const { toolName, executionId } = state
    this.messageLogger.toolStart(
      `${toolName} 开始执行`,
      toolName,
      executionId
    )
  }

  /**
   * 显示进度更新 - 实时反馈
   */
  private displayProgressUpdate(state: ToolProgressState): void {
    const { toolName, progress, currentStep, status } = state
    
    let statusText = this.getStatusText(status)
    let progressText = ''
    
    if (progress !== undefined && progress >= 0) {
      const progressBar = this.createProgressBar(progress)
      progressText = `${progressBar} ${Math.round(progress)}%`
    }
    
    if (currentStep) {
      statusText = currentStep
    }

    // 使用 \r 实现同一行更新，借鉴 Kode 的方式
    const line = `   ${progressText} ${statusText}`
    
    if (this.displayOptions.enableColors) {
      process.stdout.write(`\r${format.dim(line)}`)
    } else {
      process.stdout.write(`\r${line}`)
    }
  }

  /**
   * 显示工具执行完成
   */
  private displayToolComplete(state: ToolProgressState, result: ToolExecutionResult): void {
    const { toolName, executionId } = state
    const duration = Date.now() - state.startTime
    const success = result.status === ToolExecutionStatus.COMPLETED

    // 清除进度行并显示最终结果
    process.stdout.write('\r' + ' '.repeat(80) + '\r')

    if (success) {
      this.messageLogger.toolSuccess(
        `${toolName} 执行成功`,
        toolName,
        duration,
        executionId
      )
    } else {
      const errorMsg = result.error instanceof Error 
        ? result.error.message 
        : String(result.error || '未知错误')
      
      this.messageLogger.toolError(
        `${toolName} 执行失败: ${errorMsg}`,
        toolName,
        executionId
      )
    }

    // 显示结果概要（对于成功的工具）
    if (success && result.result && typeof result.result === 'string') {
      const lines = result.result.split('\\n').length
      const preview = result.result.slice(0, 60) + (result.result.length > 60 ? '...' : '')
      
      this.messageLogger.debug(
        `工具结果: ${preview} (${lines} lines)`,
        { toolName, executionId, category: 'result' }
      )
    }
  }

  /**
   * 显示日志条目
   */
  private displayLogEntry(state: ToolProgressState, entry: ProgressLogEntry): void {
    const { type, message } = entry
    const prefix = this.getLogTypePrefix(type)
    
    if (this.displayOptions.enableColors) {
      const coloredMessage = this.colorizeLogMessage(message, type)
      console.log(`   ${prefix} ${coloredMessage}`)
    } else {
      console.log(`   ${prefix} ${message}`)
    }
  }

  /**
   * 创建进度条 - ASCII art
   */
  private createProgressBar(progress: number, width: number = 10): string {
    const filled = Math.round((progress / 100) * width)
    const empty = width - filled
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`
  }

  /**
   * 获取工具图标
   */
  private getToolIcon(toolName: string): string {
    const iconMap: Record<string, string> = {
      'Read': '📖',
      'Write': '✍️',
      'Edit': '✏️',
      'Bash': '⚡',
      'Grep': '🔍',
      'Glob': '📁',
      'MultiEdit': '✂️',
      'WebFetch': '🌐',
      'Task': '🎯'
    }
    return iconMap[toolName] || '🔧'
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: ToolExecutionStatus): string {
    const statusMap: Record<ToolExecutionStatus, string> = {
      [ToolExecutionStatus.PENDING]: '等待中',
      [ToolExecutionStatus.RUNNING]: '执行中',
      [ToolExecutionStatus.COMPLETED]: '已完成',
      [ToolExecutionStatus.FAILED]: '失败',
      [ToolExecutionStatus.CANCELLED]: '已取消'
    }
    return statusMap[status] || '未知'
  }

  /**
   * 获取日志类型前缀
   */
  private getLogTypePrefix(type: ProgressLogEntry['type']): string {
    const prefixMap: Record<ProgressLogEntry['type'], string> = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'error': '❌',
      'success': '✅'
    }
    return prefixMap[type]
  }

  /**
   * 根据日志类型着色消息
   */
  private colorizeLogMessage(message: string, type: ProgressLogEntry['type']): string {
    switch (type) {
      case 'error': return format.error(message)
      case 'warning': return format.warning(message)
      case 'success': return format.success(message)
      case 'info':
      default: return format.dim(message)
    }
  }
}

// 全局实例
let globalProgressManager: ProgressManager | null = null

/**
 * 获取全局进度管理器实例
 */
export function getProgressManager(): ProgressManager {
  if (!globalProgressManager) {
    globalProgressManager = new ProgressManager()
  }
  return globalProgressManager
}

/**
 * 便捷函数：开始进度跟踪
 */
export function startToolProgress(
  toolName: string,
  executionId: string,
  onUpdate?: (state: ToolProgressState) => void
): void {
  getProgressManager().startProgress(toolName, executionId, onUpdate)
}

/**
 * 便捷函数：更新进度
 */
export function updateToolProgress(
  executionId: string,
  updates: Parameters<ProgressManager['updateProgress']>[1]
): void {
  getProgressManager().updateProgress(executionId, updates)
}

/**
 * 便捷函数：记录日志
 */
export function logToolProgress(
  executionId: string,
  message: string,
  type?: ProgressLogEntry['type'],
  data?: any
): void {
  getProgressManager().log(executionId, message, type, data)
}

/**
 * 便捷函数：完成进度
 */
export function finishToolProgress(
  executionId: string,
  result: ToolExecutionResult
): void {
  getProgressManager().finishProgress(executionId, result)
}