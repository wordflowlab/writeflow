/**

 * 流式显示组件 - 采用现代化的实时UI更新机制
 * 处理 AsyncGenerator 消息流并提供优雅的终端展示
 */

import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'
import { getStreamingFormatter, formatStreamMessage } from '../formatting/StreamingFormatter.js'
import type { StreamMessage } from '../../services/ai/streaming/AsyncStreamingManager.js'

/**
 * 显示状态管理
 */
export interface DisplayState {
  currentMessage?: StreamMessage
  messageHistory: StreamMessage[]
  activeTools: Map<string, StreamMessage>
  progressState: Map<string, number>
  isStreaming: boolean
  lastUpdateTime: number
}

/**
 * 显示选项配置
 */
export interface DisplayOptions {
  enableRealTimeUpdates?: boolean
  maxHistoryLength?: number
  showTimestamps?: boolean
  clearOnComplete?: boolean
  compactMode?: boolean
  animateProgress?: boolean
}

/**
 * 流式显示管理器 - 现代流式风格的UI更新
 */
export class StreamingDisplay {
  private state: DisplayState
  private options: Required<DisplayOptions>
  private formatter = getStreamingFormatter()
  private updateInterval?: NodeJS.Timeout

  constructor(options: DisplayOptions = {}) {
    this.options = {
      enableRealTimeUpdates: options.enableRealTimeUpdates ?? true,
      maxHistoryLength: options.maxHistoryLength ?? 50,
      showTimestamps: options.showTimestamps ?? false,
      clearOnComplete: options.clearOnComplete ?? false,
      compactMode: options.compactMode ?? true,
      animateProgress: options.animateProgress ?? true
    }

    this.state = {
      messageHistory: [],
      activeTools: new Map(),
      progressState: new Map(),
      isStreaming: false,
      lastUpdateTime: Date.now()
    }
  }

  /**
   * 处理流式消息 - 核心处理函数
   */
  async processMessage(message: StreamMessage): Promise<void> {
    this.state.currentMessage = message
    this.state.lastUpdateTime = Date.now()

    // 更新状态
    this.updateDisplayState(message)

    // 渲染消息
    this.renderMessage(message)

    // 管理历史
    this.manageHistory(message)
  }

  /**
   * 处理消息流 - AsyncGenerator 处理器
   */
  async processMessageStream(
    messageStream: AsyncGenerator<StreamMessage, void, unknown>
  ): Promise<void> {
    this.state.isStreaming = true
    
    try {
      for await (const message of messageStream) {
        await this.processMessage(message)
        
        // 检查是否需要暂停或中断
        if (this.shouldPause(message)) {
          await this.handlePause()
        }
      }
    } catch (error) {
      logError('流式处理错误:', error)
      await this.processMessage({
        type: 'error',
        message: `流式处理异常: ${error instanceof Error ? error.message : String(error)}`,
        error: error as Error
      })
    } finally {
      this.state.isStreaming = false
      this.handleStreamComplete()
    }
  }

  /**
   * 更新显示状态
   */
  private updateDisplayState(message: StreamMessage): void {
    switch (message.type) {
      case 'tool_execution':
        this.updateToolState(message)
        break
      case 'progress':
        this.updateProgressState(message)
        break
      case 'ai_response':
        this.updateResponseState(message)
        break
    }
  }

  /**
   * 更新工具执行状态
   */
  private updateToolState(message: any): void {
    const key = `${message.toolName}_${message.executionId}`
    this.state.activeTools.set(key, message)
    
    // 完成的工具从活跃列表移除
    if (message.status === 'completed' || message.status === 'failed') {
      setTimeout(() => {
        this.state.activeTools.delete(key)
      }, 2000) // 2秒后移除
    }
  }

  /**
   * 更新进度状态
   */
  private updateProgressState(message: any): void {
    if (message.progress !== undefined) {
      this.state.progressState.set(message.stage || 'default', message.progress)
    }
  }

  /**
   * 更新响应状态
   */
  private updateResponseState(message: any): void {
    // 对于AI响应，可以在这里处理特殊逻辑
    if (message.isComplete) {
      // 响应完成，可以触发后续处理
    }
  }

  /**
   * 渲染消息到终端
   */
  private renderMessage(message: StreamMessage): void {
    const formatted = formatStreamMessage(message)
    
    if (this.options.compactMode && this.isIncrementalUpdate(message)) {
      // 增量更新模式 - 现代流式的实时打字效果
      this.renderIncremental(formatted, message)
    } else {
      // 完整消息渲染
      this.renderComplete(formatted, message)
    }
  }

  /**
   * 增量渲染 - 实现打字机效果
   */
  private renderIncremental(formatted: string, message: StreamMessage): void {
    if (message.type === 'ai_response' && message.delta) {
      // 只输出新增的内容，不换行
      process.stdout.write(formatStreamMessage({
        type: 'ai_response',
        content: message.delta
      } as StreamMessage))
    }
  }

  /**
   * 完整消息渲染
   */
  private renderComplete(formatted: string, message: StreamMessage): void {
    // 对于工具执行，使用覆盖式更新（类似进度条）
    if (message.type === 'tool_execution' && this.options.enableRealTimeUpdates) {
      process.stdout.write(`\r${formatted}`)
      
      if (message.status === 'completed' || message.status === 'failed') {
        process.stdout.write('\n') // 完成后换行
      }
    } else {
      debugLog(formatted)
    }
  }

  /**
   * 判断是否为增量更新
   */
  private isIncrementalUpdate(message: StreamMessage): boolean {
    return message.type === 'ai_response' && 
           'delta' in message && 
           message.delta !== undefined
  }

  /**
   * 管理消息历史
   */
  private manageHistory(message: StreamMessage): void {
    this.state.messageHistory.push(message)
    
    // 限制历史长度
    if (this.state.messageHistory.length > this.options.maxHistoryLength) {
      this.state.messageHistory.shift()
    }
  }

  /**
   * 判断是否需要暂停
   */
  private shouldPause(message: StreamMessage): boolean {
    // 在某些关键消息处暂停，等待用户确认
    return message.type === 'tool_execution' && 
           message.status === 'starting' &&
           !this.options.compactMode
  }

  /**
   * 处理暂停逻辑
   */
  private async handlePause(): Promise<void> {
    // 实现用户确认逻辑
    // 这里可以集成 InteractiveExecutionManager 的权限确认系统
    return new Promise(resolve => {
      setTimeout(resolve, 500) // 临时延迟
    })
  }

  /**
   * 处理流完成
   */
  private handleStreamComplete(): void {
    if (this.options.clearOnComplete) {
      this.clearDisplay()
    }
    
    // 显示完成状态
    if (!this.options.compactMode) {
      debugLog('\n✨ 流式处理完成')
    }
  }

  /**
   * 清除显示内容
   */
  private clearDisplay(): void {
    process.stdout.write('\x1b[2J\x1b[0f') // 清屏
  }

  /**
   * 获取当前状态摘要
   */
  getStatusSummary(): {
    isStreaming: boolean
    activeToolCount: number
    messageCount: number
    lastActivity: string
  } {
    return {
      isStreaming: this.state.isStreaming,
      activeToolCount: this.state.activeTools.size,
      messageCount: this.state.messageHistory.length,
      lastActivity: new Date(this.state.lastUpdateTime).toLocaleTimeString()
    }
  }

  /**
   * 显示活跃工具状态
   */
  showActiveTools(): void {
    if (this.state.activeTools.size === 0) {
      debugLog('没有正在执行的工具')
      return
    }

    debugLog('\n正在执行的工具:')
    for (const [key, message] of this.state.activeTools) {
      const formatted = formatStreamMessage(message)
      debugLog(`  ${formatted}`)
    }
  }

  /**
   * 显示消息历史
   */
  showHistory(limit: number = 10): void {
    const recentMessages = this.state.messageHistory.slice(-limit)
    
    if (recentMessages.length === 0) {
      debugLog('没有历史消息')
      return
    }

    debugLog('\n消息历史:')
    for (const message of recentMessages) {
      const formatted = formatStreamMessage(message)
      debugLog(`  ${formatted}`)
    }
  }

  /**
   * 强制中断流式处理
   */
  interrupt(): void {
    this.state.isStreaming = false
    
    // 清除所有活跃状态
    this.state.activeTools.clear()
    this.state.progressState.clear()
    
    debugLog('\n⚠️ 流式处理已中断')
  }

  /**
   * 更新显示选项
   */
  updateOptions(options: Partial<DisplayOptions>): void {
    Object.assign(this.options, options)
    
    // 重新配置格式化器
    this.formatter.updateOptions({
      compactMode: this.options.compactMode,
      showTimestamps: this.options.showTimestamps
    })
  }
}

// 全局实例
let globalStreamingDisplay: StreamingDisplay | null = null

/**
 * 获取全局流式显示实例
 */
export function getStreamingDisplay(): StreamingDisplay {
  if (!globalStreamingDisplay) {
    globalStreamingDisplay = new StreamingDisplay()
  }
  return globalStreamingDisplay
}

/**
 * 便捷函数：处理消息流
 */
export async function displayMessageStream(
  messageStream: AsyncGenerator<StreamMessage, void, unknown>,
  options?: DisplayOptions
): Promise<void> {
  const display = options ? new StreamingDisplay(options) : getStreamingDisplay()
  await display.processMessageStream(messageStream)
}