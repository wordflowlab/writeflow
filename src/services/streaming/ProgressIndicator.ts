/**
 * WriteFlow 实时进度指示器
 * 基于 Claude Code 的进度显示风格，提供实时状态反馈
 */

import { getResponseStateManager } from './ResponseStateManager.js'

export interface ProgressConfig {
  showTokens: boolean
  showDuration: boolean
  showInterruptHint: boolean
  updateIntervalMs: number
  style: 'claude' | 'minimal' | 'detailed'
}

/**
 * 实时进度指示器
 */
export class ProgressIndicator {
  private isActive = false
  private intervalId: NodeJS.Timeout | null = null
  private startTime = 0
  private lastTokenCount = 0
  private config: ProgressConfig

  constructor(config: Partial<ProgressConfig> = {}) {
    this.config = {
      showTokens: true,
      showDuration: true,
      showInterruptHint: true,
      updateIntervalMs: 500, // 每500ms更新一次
      style: 'claude',
      ...config
    }
  }

  /**
   * 开始进度指示
   */
  start(): void {
    if (this.isActive) return

    this.isActive = true
    this.startTime = Date.now()
    this.lastTokenCount = 0

    // 显示初始状态
    this.updateProgress()

    // 启动定时更新
    this.intervalId = setInterval(() => {
      this.updateProgress()
    }, this.config.updateIntervalMs)

    // 监听键盘中断（Ctrl+C, ESC）
    this.setupKeyboardListeners()
  }

  /**
   * 停止进度指示
   */
  stop(): void {
    if (!this.isActive) return

    this.isActive = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    // 清除进度行并显示完成状态
    this.clearProgressLine()
    this.showCompletionStatus()
  }

  /**
   * 更新进度显示
   */
  private updateProgress(): void {
    if (!this.isActive) return

    const responseManager = getResponseStateManager()
    const activeStats = responseManager.getActiveStreamingStats()
    
    const duration = Date.now() - this.startTime
    const formattedDuration = this.formatDuration(duration)
    
    let progressText = ''

    switch (this.config.style) {
      case 'claude':
        progressText = this.buildClaudeStyleProgress(activeStats, formattedDuration)
        break
      case 'minimal':
        progressText = this.buildMinimalProgress(activeStats, formattedDuration)
        break
      case 'detailed':
        progressText = this.buildDetailedProgress(activeStats, formattedDuration)
        break
    }

    // 更新进度显示（覆盖当前行）
    this.displayProgress(progressText)
  }

  /**
   * 构建 Claude Code 风格的进度显示
   */
  private buildClaudeStyleProgress(activeStats: any, duration: string): string {
    const tokenText = this.config.showTokens && activeStats.totalTokens > 0
      ? `⚒ ${this.formatTokenCount(activeStats.totalTokens)} tokens`
      : '⚒ 处理中'

    const durationText = this.config.showDuration
      ? ` · ${duration}`
      : ''

    const interruptHint = this.config.showInterruptHint
      ? ' · esc to interrupt'
      : ''

    return `(${tokenText}${durationText}${interruptHint})`
  }

  /**
   * 构建极简进度显示
   */
  private buildMinimalProgress(activeStats: any, duration: string): string {
    return `[${activeStats.totalTokens || 0}t | ${duration}]`
  }

  /**
   * 构建详细进度显示
   */
  private buildDetailedProgress(activeStats: any, duration: string): string {
    const tokensPerSec = activeStats.totalTokens > 0 && duration
      ? Math.round(activeStats.totalTokens / (Date.now() - this.startTime) * 1000)
      : 0

    return `📝 ${activeStats.totalTokens || 0} tokens · ${duration} · ${tokensPerSec} t/s · ESC 中断`
  }

  /**
   * 显示进度文本
   */
  private displayProgress(text: string): void {
    // 使用 \r 回到行首，然后覆盖内容
    process.stderr.write(`\r${text}`)
  }

  /**
   * 清除进度行
   */
  private clearProgressLine(): void {
    // 清除当前行
    process.stderr.write('\r' + ' '.repeat(80) + '\r')
  }

  /**
   * 显示完成状态
   */
  private showCompletionStatus(): void {
    const responseManager = getResponseStateManager()
    const activeStats = responseManager.getActiveStreamingStats()
    
    const duration = Date.now() - this.startTime
    const finalTokens = activeStats.totalTokens || this.lastTokenCount
    
    if (finalTokens > 0) {
      const tokensPerSec = Math.round(finalTokens / (duration / 1000))
      const completionText = `✅ 完成 ${this.formatTokenCount(finalTokens)} tokens · ${this.formatDuration(duration)} · ${tokensPerSec} t/s\n`
      process.stderr.write(completionText)
    }
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) {
      return `${seconds}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      return `${minutes}m${remainingSeconds}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h${minutes}m`
    }
  }

  /**
   * 格式化 token 数量
   */
  private formatTokenCount(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  /**
   * 设置键盘监听器
   */
  private setupKeyboardListeners(): void {
    // 监听 Ctrl+C 和 ESC 键
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
      process.stdin.resume()
      
      const onKeyPress = (chunk: Buffer) => {
        const key = chunk[0]
        
        // ESC (27) 或 Ctrl+C (3)
        if (key === 27 || key === 3) {
          this.handleInterrupt()
        }
      }

      process.stdin.on('data', onKeyPress)

      // 清理函数
      const cleanup = () => {
        process.stdin.off('data', onKeyPress)
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false)
          process.stdin.pause()
        }
      }

      // 在进度停止时清理监听器
      const originalStop = this.stop.bind(this)
      this.stop = () => {
        cleanup()
        originalStop()
      }
    }
  }

  /**
   * 处理用户中断
   */
  private handleInterrupt(): void {
    this.clearProgressLine()
    process.stderr.write('⚠️ 用户中断，正在停止流式响应...\n')
    
    // 发出中断信号
    process.emit('SIGINT', 'SIGINT')
  }

  /**
   * 检查是否处于活跃状态
   */
  isActiveStatus(): boolean {
    return this.isActive
  }
}

// 全局进度指示器实例
let globalProgressIndicator: ProgressIndicator | null = null

/**
 * 获取全局进度指示器
 */
export function getProgressIndicator(config?: Partial<ProgressConfig>): ProgressIndicator {
  if (!globalProgressIndicator) {
    globalProgressIndicator = new ProgressIndicator(config)
  }
  return globalProgressIndicator
}

/**
 * 启动流式响应进度指示
 */
export function startStreamingProgress(config?: Partial<ProgressConfig>): void {
  const indicator = getProgressIndicator(config)
  indicator.start()
}

/**
 * 停止流式响应进度指示
 */
export function stopStreamingProgress(): void {
  if (globalProgressIndicator) {
    globalProgressIndicator.stop()
  }
}