/**
 * 流式处理统一管理器
 * 整合现有 StreamingService，提供统一的流式处理接口
 */

import { 
  getStreamingService,
  type StreamingService,
  type StreamingRequest,
  type StreamingResponse,
  type StreamingConfig,
  type UIStreamingChunk,
  type RenderUpdateEvent,
  type PerformanceWarningEvent,
  type ParsingProgressEvent
} from '../../streaming/StreamingService.js'
import { getResponseStateManager } from '../../streaming/ResponseStateManager.js'
import { startStreamingProgress, stopStreamingProgress } from '../../streaming/ProgressIndicator.js'

export interface StreamingManagerOptions {
  enableProgressIndicator?: boolean
  enablePerformanceMonitoring?: boolean
  bufferSize?: number
  timeout?: number
  maxRetries?: number
}

export interface StreamingContext {
  requestId?: string
  sessionId?: string
  userAgent?: string
  enableRealTimeFormatting?: boolean
}

export interface StreamingMetrics {
  totalChunks: number
  averageChunkSize: number
  totalDuration: number
  tokensPerSecond: number
  bufferUtilization: number
  droppedFrames: number
}

export class StreamingManager {
  private streamingService: StreamingService
  private responseStateManager = getResponseStateManager()
  private activeStreams = new Map<string, any>()
  private streamingMetrics = new Map<string, StreamingMetrics>()

  constructor(config?: StreamingConfig) {
    this.streamingService = getStreamingService(config)
    this.setupEventListeners()
  }

  /**
   * 开始流式请求
   */
  async startStreamingRequest(
    request: StreamingRequest,
    context?: StreamingContext,
    options?: StreamingManagerOptions
  ): Promise<{
    streamId: string
    promise: Promise<StreamingResponse>
  }> {
    const streamId = this.generateStreamId()
    
    // 启用进度指示器
    if (options?.enableProgressIndicator !== false) {
      startStreamingProgress({ style: 'claude', showTokens: true, showDuration: true, showInterruptHint: true })
    }

    // 记录流状态
    this.activeStreams.set(streamId, {
      request,
      context,
      options,
      startTime: Date.now(),
      status: 'active'
    })

    // 初始化指标
    this.streamingMetrics.set(streamId, {
      totalChunks: 0,
      averageChunkSize: 0,
      totalDuration: 0,
      tokensPerSecond: 0,
      bufferUtilization: 0,
      droppedFrames: 0
    })

    const promise = this.executeStreamingRequest(streamId, request, options)

    return { streamId, promise }
  }

  /**
   * 执行流式请求
   */
  private async executeStreamingRequest(
    streamId: string,
    request: StreamingRequest,
    options?: StreamingManagerOptions
  ): Promise<StreamingResponse> {
    return new Promise((resolve, reject) => {
      let finalResponse: StreamingResponse | null = null
      let chunkCount = 0
      let totalContent = ''

      // 设置事件监听器
      this.streamingService.on('chunk', (response: StreamingResponse) => {
        chunkCount++
        totalContent += response.content
        
        // 更新指标
        this.updateStreamingMetrics(streamId, response, chunkCount)

        // 处理实时格式化
        if (this.activeStreams.get(streamId)?.context?.enableRealTimeFormatting) {
          // TODO: 实现实时格式化逻辑
        }
      })

      this.streamingService.on('complete', (response: StreamingResponse) => {
        finalResponse = response
        this.finalizeStream(streamId, response, chunkCount)
        resolve(response)
      })

      this.streamingService.on('error', (error: Error) => {
        this.handleStreamingError(streamId, error)
        reject(error)
      })

      // 开始流式请求
      this.streamingService.startStream(request).catch(reject)
    })
  }

  /**
   * 更新流式指标
   */
  private updateStreamingMetrics(
    streamId: string,
    response: StreamingResponse,
    chunkCount: number
  ): void {
    const metrics = this.streamingMetrics.get(streamId)
    if (!metrics) return

    const stream = this.activeStreams.get(streamId)
    if (!stream) return

    const elapsed = Date.now() - stream.startTime
    const contentLength = response.content.length
    const avgChunkSize = contentLength / chunkCount

    metrics.totalChunks = chunkCount
    metrics.averageChunkSize = Math.round(avgChunkSize)
    metrics.totalDuration = elapsed
    
    if (response.usage?.outputTokens && elapsed > 0) {
      metrics.tokensPerSecond = Math.round((response.usage.outputTokens / elapsed) * 1000)
    }

    this.streamingMetrics.set(streamId, metrics)
  }

  /**
   * 完成流处理
   */
  private finalizeStream(
    streamId: string,
    response: StreamingResponse,
    chunkCount: number
  ): void {
    const stream = this.activeStreams.get(streamId)
    if (stream) {
      stream.status = 'completed'
      stream.endTime = Date.now()
      stream.finalResponse = response
    }

    // 停止进度指示器
    if (stream?.options?.enableProgressIndicator !== false) {
      stopStreamingProgress()
    }

    // 清理旧的流记录（保留最近的10个）
    if (this.activeStreams.size > 10) {
      const oldestEntries = Array.from(this.activeStreams.entries())
        .sort(([,a], [,b]) => a.startTime - b.startTime)
        .slice(0, -10)

      oldestEntries.forEach(([id]) => {
        this.activeStreams.delete(id)
        this.streamingMetrics.delete(id)
      })
    }
  }

  /**
   * 处理流式错误
   */
  private handleStreamingError(streamId: string, error: Error): void {
    const stream = this.activeStreams.get(streamId)
    if (stream) {
      stream.status = 'error'
      stream.error = error.message
      stream.endTime = Date.now()
    }

    // 停止进度指示器
    if (stream?.options?.enableProgressIndicator !== false) {
      stopStreamingProgress()
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // UI 块事件处理
    this.streamingService.on('uiChunk', (chunk: UIStreamingChunk) => {
      this.handleUIChunk(chunk)
    })

    // 渲染更新事件处理
    this.streamingService.on('renderUpdate', (update: RenderUpdateEvent) => {
      this.handleRenderUpdate(update)
    })

    // 性能警告事件处理
    this.streamingService.on('performanceWarning', (warning: PerformanceWarningEvent) => {
      this.handlePerformanceWarning(warning)
    })

    // 解析进度事件处理
    this.streamingService.on('parsingProgress', (progress: ParsingProgressEvent) => {
      this.handleParsingProgress(progress)
    })
  }

  /**
   * 处理 UI 块事件
   */
  private handleUIChunk(chunk: UIStreamingChunk): void {
    // 更新响应状态管理器
    this.responseStateManager.updateStreamingProgress(chunk.streamId, {
      tokenCount: Math.ceil(chunk.content.length / 4),
      characterCount: chunk.content.length,
      chunkSize: chunk.delta.length,
      contentType: 'text'
    })
  }

  /**
   * 处理渲染更新事件
   */
  private handleRenderUpdate(update: RenderUpdateEvent): void {
    const metrics = this.streamingMetrics.get(update.streamId)
    if (metrics) {
      metrics.droppedFrames = update.renderStats.droppedFrames
      metrics.bufferUtilization = update.bufferStats.utilizationPercent
    }
  }

  /**
   * 处理性能警告事件
   */
  private handlePerformanceWarning(warning: PerformanceWarningEvent): void {
    console.warn(`流式性能警告 [${warning.streamId}]:`, warning.message)
    
    // 可以在这里实现自动优化措施
    if (warning.type === 'buffer_overflow' && warning.autoActions?.length) {
      console.info('自动执行优化措施:', warning.autoActions)
    }
  }

  /**
   * 处理解析进度事件
   */
  private handleParsingProgress(progress: ParsingProgressEvent): void {
    // 更新进度指示器
    if (progress.progress > 0) {
      const message = `解析中... ${Math.round(progress.progress)}%`
      // TODO: 更新进度指示器文本
    }
  }

  /**
   * 停止流式请求
   */
  stopStreamingRequest(streamId: string): void {
    const stream = this.activeStreams.get(streamId)
    if (stream && stream.status === 'active') {
      this.streamingService.stopStream()
      stream.status = 'stopped'
      stream.endTime = Date.now()
      
      // 停止进度指示器
      if (stream.options?.enableProgressIndicator !== false) {
        stopStreamingProgress()
      }
    }
  }

  /**
   * 获取流状态
   */
  getStreamStatus(streamId: string): {
    status: string
    startTime: number
    endTime?: number
    duration?: number
    metrics?: StreamingMetrics
  } | null {
    const stream = this.activeStreams.get(streamId)
    const metrics = this.streamingMetrics.get(streamId)
    
    if (!stream) return null

    return {
      status: stream.status,
      startTime: stream.startTime,
      endTime: stream.endTime,
      duration: stream.endTime ? stream.endTime - stream.startTime : Date.now() - stream.startTime,
      metrics
    }
  }

  /**
   * 获取所有活跃流
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.entries())
      .filter(([, stream]) => stream.status === 'active')
      .map(([id]) => id)
  }

  /**
   * 获取流式统计信息
   */
  getStreamingStats(): {
    totalStreams: number
    activeStreams: number
    completedStreams: number
    failedStreams: number
    averageDuration: number
  } {
    const streams = Array.from(this.activeStreams.values())
    const active = streams.filter(s => s.status === 'active').length
    const completed = streams.filter(s => s.status === 'completed').length
    const failed = streams.filter(s => s.status === 'error').length
    
    const completedStreams = streams.filter(s => s.status === 'completed' && s.endTime)
    const avgDuration = completedStreams.length > 0
      ? Math.round(completedStreams.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / completedStreams.length)
      : 0

    return {
      totalStreams: streams.length,
      activeStreams: active,
      completedStreams: completed,
      failedStreams: failed,
      averageDuration: avgDuration
    }
  }

  /**
   * 清理流历史
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5分钟

    for (const [id, stream] of this.activeStreams.entries()) {
      if (stream.status !== 'active' && (now - stream.startTime) > maxAge) {
        this.activeStreams.delete(id)
        this.streamingMetrics.delete(id)
      }
    }
  }

  /**
   * 生成流ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 更新流式配置
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    this.streamingService.updateConfig(config)
  }

  /**
   * 获取当前流式服务状态
   */
  getServiceStatus() {
    return this.streamingService.getStreamingStatus()
  }
}

// 全局实例
let globalStreamingManager: StreamingManager | null = null

/**
 * 获取全局流式管理器实例
 */
export function getStreamingManager(config?: StreamingConfig): StreamingManager {
  if (!globalStreamingManager) {
    globalStreamingManager = new StreamingManager(config)
  }
  return globalStreamingManager
}

/**
 * 便捷函数：开始流式请求
 */
export async function startStreamingRequest(
  request: StreamingRequest,
  context?: StreamingContext,
  options?: StreamingManagerOptions
) {
  return getStreamingManager().startStreamingRequest(request, context, options)
}