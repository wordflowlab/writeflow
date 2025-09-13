import { debugLog, logError, logWarn, infoLog } from '../../utils/log.js'

/**


 * WriteFlow 流式输出性能优化器
 * 智能渲染频率控制和内容完整性保证
 */

export interface PerformanceMetrics {
  fps: number
  renderTime: number
  memoryUsage: number
  cpuUsage: number
  frameDrops: number
  lastRenderTime: number
}

export interface RenderControlOptions {
  targetFPS?: number
  maxRenderDelay?: number
  adaptiveRendering?: boolean
  memoryThreshold?: number
  cpuThreshold?: number
  enableFrameSkipping?: boolean
  batchUpdates?: boolean
}

export interface ContentIntegrityOptions {
  enableChecksums?: boolean
  validateChunks?: boolean
  repairCorruption?: boolean
  maxRetries?: number
  timeoutMs?: number
}

/**
 * 智能渲染频率控制器
 */
export class RenderFrequencyController {
  private targetFPS: number = 30
  private lastFrameTime: number = 0
  private frameTimes: number[] = []
  private frameDropCount: number = 0
  private renderQueue: Array<() => void> = []
  private isRenderScheduled: boolean = false
  private performanceHistory: PerformanceMetrics[] = []
  private adaptiveMode: boolean = true

  constructor(private options: RenderControlOptions = {}) {
    this.targetFPS = options.targetFPS || 30
    this.adaptiveMode = options.adaptiveRendering ?? true
    
    // 启动性能监控
    if (this.adaptiveMode) {
      this.startPerformanceMonitoring()
    }
  }

  /**
   * 请求渲染
   */
  requestRender(renderFn: () => void): void {
    this.renderQueue.push(renderFn)
    
    if (!this.isRenderScheduled) {
      this.scheduleRender()
    }
  }

  /**
   * 调度渲染
   */
  private scheduleRender(): void {
    this.isRenderScheduled = true
    
    const now = performance.now()
    const targetFrameTime = 1000 / this.targetFPS
    const timeSinceLastFrame = now - this.lastFrameTime
    
    if (timeSinceLastFrame >= targetFrameTime) {
      // 立即渲染
      this.executeRender()
    } else {
      // 延迟渲染到下一帧
      const delay = targetFrameTime - timeSinceLastFrame
      setTimeout(() => this.executeRender(), delay)
    }
  }

  /**
   * 执行渲染
   */
  private executeRender(): void {
    const startTime = performance.now()
    
    try {
      // 批量执行所有待处理的渲染
      if (this.options.batchUpdates) {
        this.executeBatchRender()
      } else {
        // 逐个执行
        while (this.renderQueue.length > 0) {
          const renderFn = this.renderQueue.shift()
          renderFn?.()
        }
      }
      
    } catch (error) {
      logWarn('渲染执行失败:', error)
    }
    
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    // 更新性能指标
    this.updatePerformanceMetrics(renderTime)
    
    this.lastFrameTime = startTime
    this.isRenderScheduled = false
    
    // 如果还有待渲染的内容，继续调度
    if (this.renderQueue.length > 0) {
      this.scheduleRender()
    }
  }

  /**
   * 批量渲染
   */
  private executeBatchRender(): void {
    const batchSize = Math.min(this.renderQueue.length, 10) // 限制批量大小
    const batch = this.renderQueue.splice(0, batchSize)
    
    // 合并渲染调用
    batch.forEach(renderFn => renderFn())
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(renderTime: number): void {
    const now = performance.now()
    
    // 记录帧时间
    this.frameTimes.push(now - this.lastFrameTime)
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift() // 保持最近60帧的记录
    }
    
    // 计算FPS
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    const currentFPS = 1000 / avgFrameTime
    
    // 检测掉帧
    const targetFrameTime = 1000 / this.targetFPS
    if (avgFrameTime > targetFrameTime * 1.5) {
      this.frameDropCount++
    }
    
    // 自适应调整
    if (this.adaptiveMode) {
      this.adaptRenderingStrategy(currentFPS, renderTime)
    }
  }

  /**
   * 自适应渲染策略
   */
  private adaptRenderingStrategy(currentFPS: number, renderTime: number): void {
    const targetFPS = this.targetFPS
    
    if (currentFPS < targetFPS * 0.8) {
      // 性能不足，降低渲染频率
      this.targetFPS = Math.max(15, this.targetFPS - 5)
      debugLog(`性能自适应: 降低目标FPS至 ${this.targetFPS}`)
    } else if (currentFPS > targetFPS * 1.2 && renderTime < 10) {
      // 性能充足，可以提高渲染频率
      this.targetFPS = Math.min(60, this.targetFPS + 5)
      debugLog(`性能自适应: 提高目标FPS至 ${this.targetFPS}`)
    }
    
    // 启用跳帧策略
    if (this.frameDropCount > 10 && this.options.enableFrameSkipping) {
      this.enableFrameSkipping()
    }
  }

  /**
   * 启用跳帧策略
   */
  private enableFrameSkipping(): void {
    // 清空部分渲染队列，保留最新的渲染请求
    if (this.renderQueue.length > 3) {
      this.renderQueue = this.renderQueue.slice(-3)
      debugLog('启用跳帧策略，跳过部分渲染帧')
    }
  }

  /**
   * 开始性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = this.getPerformanceMetrics()
      this.performanceHistory.push(metrics)
      
      // 保持最近100次的记录
      if (this.performanceHistory.length > 100) {
        this.performanceHistory.shift()
      }
      
    }, 1000) // 每秒收集一次性能数据
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const avgFrameTime = this.frameTimes.length > 0 
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length 
      : 0
    
    return {
      fps: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
      renderTime: avgFrameTime,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: 0, // 简化实现，实际项目中可以通过其他方式获取
      frameDrops: this.frameDropCount,
      lastRenderTime: this.lastFrameTime
    }
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024 // MB
    }
    return 0
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.renderQueue = []
    this.frameTimes = []
    this.performanceHistory = []
    this.isRenderScheduled = false
  }
}

/**
 * 内容完整性验证器
 */
export class ContentIntegrityValidator {
  private checksums = new Map<string, string>()
  private corruptionHistory: Array<{
    streamId: string
    timestamp: number
    errorType: string
    repaired: boolean
  }> = []

  constructor(private options: ContentIntegrityOptions = {}) {}

  /**
   * 验证内容块
   */
  validateChunk(streamId: string, chunk: string, expectedLength?: number): {
    isValid: boolean
    errorType?: string
    repaired?: boolean
  } {
    if (!this.options.validateChunks) {
      return { isValid: true }
    }

    try {
      // 长度验证
      if (expectedLength && chunk.length !== expectedLength) {
        return this.handleCorruption(streamId, 'LENGTH_MISMATCH', chunk)
      }

      // 字符编码验证
      if (this.hasEncodingIssues(chunk)) {
        return this.handleCorruption(streamId, 'ENCODING_ERROR', chunk)
      }

      // 内容完整性验证
      if (this.options.enableChecksums) {
        const checksum = this.calculateChecksum(chunk)
        const expectedChecksum = this.checksums.get(`${streamId}-chunk`)
        
        if (expectedChecksum && checksum !== expectedChecksum) {
          return this.handleCorruption(streamId, 'CHECKSUM_MISMATCH', chunk)
        }
        
        this.checksums.set(`${streamId}-chunk`, checksum)
      }

      return { isValid: true }

    } catch (error) {
      return this.handleCorruption(streamId, 'VALIDATION_ERROR', chunk)
    }
  }

  /**
   * 处理内容损坏
   */
  private handleCorruption(streamId: string, errorType: string, chunk: string): {
    isValid: boolean
    errorType: string
    repaired: boolean
  } {
    logWarn(`检测到内容损坏 [${streamId}]: ${errorType}`)
    
    // 记录损坏历史
    this.corruptionHistory.push({
      streamId,
      timestamp: Date.now(),
      errorType,
      repaired: false
    })

    // 尝试修复
    if (this.options.repairCorruption) {
      const repairedChunk = this.repairChunk(chunk, errorType)
      if (repairedChunk !== chunk) {
        debugLog(`已修复内容损坏 [${streamId}]: ${errorType}`)
        
        // 更新修复状态
        const lastEntry = this.corruptionHistory[this.corruptionHistory.length - 1]
        if (lastEntry) {
          lastEntry.repaired = true
        }
        
        return {
          isValid: true,
          errorType,
          repaired: true
        }
      }
    }

    return {
      isValid: false,
      errorType,
      repaired: false
    }
  }

  /**
   * 检测编码问题
   */
  private hasEncodingIssues(chunk: string): boolean {
    // 检测常见的编码问题
    return /[\uFFFD\uFEFF]/.test(chunk) || // 替换字符或BOM
           chunk.includes('\x00') || // 空字符
           chunk.length === 0 && chunk !== '' // 异常空内容
  }

  /**
   * 修复内容块
   */
  private repairChunk(chunk: string, errorType: string): string {
    switch (errorType) {
      case 'ENCODING_ERROR':
        return chunk
          .replace(/[\uFFFD\uFEFF]/g, '') // 移除替换字符和BOM
          .replace(/\x00/g, '') // 移除空字符

      case 'LENGTH_MISMATCH':
        // 暂时返回原内容，实际实现可能需要更复杂的修复逻辑
        return chunk.trim()

      default:
        return chunk
    }
  }

  /**
   * 计算校验和
   */
  private calculateChecksum(content: string): string {
    // 简单的校验和算法，实际项目中可能需要更强的算法
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return hash.toString(16)
  }

  /**
   * 获取损坏统计
   */
  getCorruptionStats(): {
    totalCorruptions: number
    repairedCount: number
    errorTypes: Record<string, number>
  } {
    const errorTypes: Record<string, number> = {}
    let repairedCount = 0

    for (const entry of this.corruptionHistory) {
      errorTypes[entry.errorType] = (errorTypes[entry.errorType] || 0) + 1
      if (entry.repaired) {
        repairedCount++
      }
    }

    return {
      totalCorruptions: this.corruptionHistory.length,
      repairedCount,
      errorTypes
    }
  }

  /**
   * 清理历史记录
   */
  cleanup(): void {
    this.checksums.clear()
    this.corruptionHistory = []
  }
}

/**
 * 性能优化管理器
 */
export class PerformanceOptimizer {
  private renderController: RenderFrequencyController
  private integrityValidator: ContentIntegrityValidator
  private isOptimizationEnabled: boolean = true

  constructor(
    renderOptions?: RenderControlOptions,
    integrityOptions?: ContentIntegrityOptions
  ) {
    this.renderController = new RenderFrequencyController(renderOptions)
    this.integrityValidator = new ContentIntegrityValidator(integrityOptions)
  }

  /**
   * 优化渲染请求
   */
  optimizeRender(renderFn: () => void): void {
    if (!this.isOptimizationEnabled) {
      renderFn()
      return
    }

    this.renderController.requestRender(renderFn)
  }

  /**
   * 验证并优化内容
   */
  optimizeContent(streamId: string, content: string, expectedLength?: number): {
    content: string
    isOptimized: boolean
    metrics: any
  } {
    const validationResult = this.integrityValidator.validateChunk(streamId, content, expectedLength)
    
    return {
      content: validationResult.repaired ? content : content, // 修复后的内容
      isOptimized: validationResult.repaired || false,
      metrics: {
        isValid: validationResult.isValid,
        errorType: validationResult.errorType,
        repaired: validationResult.repaired
      }
    }
  }

  /**
   * 获取综合性能报告
   */
  getPerformanceReport(): {
    rendering: PerformanceMetrics
    integrity: any
    recommendations: string[]
  } {
    const renderingMetrics = this.renderController.getPerformanceMetrics()
    const integrityStats = this.integrityValidator.getCorruptionStats()
    
    const recommendations: string[] = []
    
    // 性能建议
    if (renderingMetrics.fps < 20) {
      recommendations.push('建议降低渲染复杂度或减少渲染频率')
    }
    
    if (renderingMetrics.frameDrops > 10) {
      recommendations.push('检测到频繁掉帧，建议启用帧跳过策略')
    }
    
    if (integrityStats.totalCorruptions > 5) {
      recommendations.push('内容完整性问题较多，建议检查数据传输')
    }

    return {
      rendering: renderingMetrics,
      integrity: integrityStats,
      recommendations
    }
  }

  /**
   * 启用/禁用优化
   */
  setOptimizationEnabled(enabled: boolean): void {
    this.isOptimizationEnabled = enabled
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.renderController.cleanup()
    this.integrityValidator.cleanup()
  }
}

// 全局性能优化器实例
let globalOptimizer: PerformanceOptimizer | null = null

/**
 * 获取全局性能优化器
 */
export function getPerformanceOptimizer(
  renderOptions?: RenderControlOptions,
  integrityOptions?: ContentIntegrityOptions
): PerformanceOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new PerformanceOptimizer(renderOptions, integrityOptions)
  }
  return globalOptimizer
}