/**
 * WriteFlow 响应状态管理器
 * 增强版状态管理，支持字符级跟踪和 UI 实时更新
 */

interface ConversationState {
  previousResponseId?: string
  lastUpdate: number
  streamingActive: boolean
  tokenCount: number
  duration: number
}

interface StreamingProgress {
  startTime: number
  tokenCount: number
  characterCount: number
  lastActivity: number
  status: 'idle' | 'streaming' | 'processing' | 'completed' | 'error'
  
  // 新增的 UI 支持字段
  renderStats: {
    fps: number
    averageRenderTime: number
    droppedFrames: number
    lastRenderTime: number
  }
  
  // 内容分析
  contentMetrics: {
    totalChunks: number
    averageChunkSize: number
    contentType: 'text' | 'markdown' | 'code' | 'mixed'
    detectedLanguages: string[]
  }
  
  // 网络性能
  networkMetrics: {
    latency: number
    throughput: number // characters per second
    reconnections: number
    errors: number
  }
}

/**
 * 响应状态管理器
 * 管理流式响应的状态跟踪、会话连续性和性能监控
 */
export class ResponseStateManager {
  private conversationStates = new Map<string, ConversationState>()
  private streamingStates = new Map<string, StreamingProgress>()
  
  // UI 性能阈值配置
  private uiThresholds: UIPerformanceThresholds | null = null
  
  // 清理间隔：1小时未活动的会话将被清理
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000
  // 流式超时：5分钟无活动则认为超时
  private readonly STREAMING_TIMEOUT = 5 * 60 * 1000
  
  constructor() {
    // 定期清理过期的会话状态
    setInterval(() => {
      this.cleanupStaleStates()
    }, this.CLEANUP_INTERVAL)
  }
  
  /**
   * 设置前一个响应ID（用于会话连续性）
   */
  setPreviousResponseId(conversationId: string, responseId: string): void {
    this.conversationStates.set(conversationId, {
      previousResponseId: responseId,
      lastUpdate: Date.now(),
      streamingActive: false,
      tokenCount: 0,
      duration: 0
    })
  }
  
  /**
   * 获取前一个响应ID
   */
  getPreviousResponseId(conversationId: string): string | undefined {
    const state = this.conversationStates.get(conversationId)
    if (state) {
      // 更新最后访问时间
      state.lastUpdate = Date.now()
      return state.previousResponseId
    }
    return undefined
  }
  
  /**
   * 开始流式响应跟踪
   */
  startStreaming(streamId: string, options?: {
    expectedContentType?: 'text' | 'markdown' | 'code' | 'mixed'
  }): void {
    this.streamingStates.set(streamId, {
      startTime: Date.now(),
      tokenCount: 0,
      characterCount: 0,
      lastActivity: Date.now(),
      status: 'streaming',
      renderStats: {
        fps: 0,
        averageRenderTime: 0,
        droppedFrames: 0,
        lastRenderTime: 0
      },
      contentMetrics: {
        totalChunks: 0,
        averageChunkSize: 0,
        contentType: options?.expectedContentType || 'text',
        detectedLanguages: []
      },
      networkMetrics: {
        latency: 0,
        throughput: 0,
        reconnections: 0,
        errors: 0
      }
    })
  }
  
  /**
   * 更新流式进度（增强版）
   */
  updateStreamingProgress(streamId: string, update: {
    tokenCount?: number
    characterCount?: number
    chunkSize?: number
    contentType?: 'text' | 'markdown' | 'code' | 'mixed'
    detectedLanguage?: string
    renderTime?: number
    fps?: number
    droppedFrames?: number
    latency?: number
  }): void {
    const state = this.streamingStates.get(streamId)
    if (!state) return

    const now = Date.now()
    
    // 更新基础进度
    if (update.tokenCount !== undefined) {
      state.tokenCount = update.tokenCount
    }
    if (update.characterCount !== undefined) {
      state.characterCount = update.characterCount
    }

    // 更新内容指标
    if (update.chunkSize !== undefined) {
      state.contentMetrics.totalChunks++
      state.contentMetrics.averageChunkSize = 
        (state.contentMetrics.averageChunkSize * (state.contentMetrics.totalChunks - 1) + update.chunkSize) 
        / state.contentMetrics.totalChunks
    }
    
    if (update.contentType) {
      state.contentMetrics.contentType = update.contentType
    }
    
    if (update.detectedLanguage && !state.contentMetrics.detectedLanguages.includes(update.detectedLanguage)) {
      state.contentMetrics.detectedLanguages.push(update.detectedLanguage)
    }

    // 更新渲染统计
    if (update.renderTime !== undefined) {
      state.renderStats.averageRenderTime = 
        (state.renderStats.averageRenderTime + update.renderTime) / 2
      state.renderStats.lastRenderTime = now
    }
    
    if (update.fps !== undefined) {
      state.renderStats.fps = update.fps
    }
    
    if (update.droppedFrames !== undefined) {
      state.renderStats.droppedFrames += update.droppedFrames
    }

    // 更新网络指标
    if (update.latency !== undefined) {
      state.networkMetrics.latency = update.latency
    }

    // 计算吞吐量
    const elapsed = (now - state.startTime) / 1000
    if (elapsed > 0 && state.characterCount > 0) {
      state.networkMetrics.throughput = state.characterCount / elapsed
    }

    state.lastActivity = now
    state.status = 'processing'
  }

  /**
   * 记录网络错误或重连
   */
  recordNetworkEvent(streamId: string, event: 'error' | 'reconnection'): void {
    const state = this.streamingStates.get(streamId)
    if (!state) return

    if (event === 'error') {
      state.networkMetrics.errors++
    } else if (event === 'reconnection') {
      state.networkMetrics.reconnections++
    }

    state.lastActivity = Date.now()
  }

  /**
   * 获取流式统计信息（增强版）
   */
  getStreamingStats(streamId: string): StreamingProgress | null {
    return this.streamingStates.get(streamId) || null
  }

  
  /**
   * 完成流式响应
   */
  completeStreaming(streamId: string, finalTokenCount: number): StreamingStats {
    const state = this.streamingStates.get(streamId)
    if (state) {
      const duration = Date.now() - state.startTime
      state.status = 'completed'
      state.tokenCount = finalTokenCount
      
      // 计算性能统计
      const stats: StreamingStats = {
        duration,
        tokenCount: finalTokenCount,
        tokensPerSecond: finalTokenCount / (duration / 1000),
        startTime: state.startTime,
        endTime: Date.now()
      }
      
      // 清理流式状态
      this.streamingStates.delete(streamId)
      return stats
    }
    
    return {
      duration: 0,
      tokenCount: 0,
      tokensPerSecond: 0,
      startTime: Date.now(),
      endTime: Date.now()
    }
  }
  
  /**
   * 标记流式响应出错
   */
  markStreamingError(streamId: string, error: string): void {
    const state = this.streamingStates.get(streamId)
    if (state) {
      state.status = 'error'
      // 保留状态一段时间用于调试
      setTimeout(() => {
        this.streamingStates.delete(streamId)
      }, 30000)
    }
  }
  
  /**
   * 获取流式响应状态
   */
  getStreamingStatus(streamId: string): StreamingProgress | undefined {
    return this.streamingStates.get(streamId)
  }
  
  /**
   * 检查是否有超时的流式响应
   */
  checkStreamingTimeouts(): string[] {
    const now = Date.now()
    const timedOutStreams: string[] = []
    
    for (const [streamId, state] of this.streamingStates.entries()) {
      if (state.status === 'streaming' && (now - state.lastActivity) > this.STREAMING_TIMEOUT) {
        timedOutStreams.push(streamId)
        this.markStreamingError(streamId, 'Streaming timeout')
      }
    }
    
    return timedOutStreams
  }
  
  /**
   * 清理过期状态
   */
  private cleanupStaleStates(): void {
    const now = Date.now()
    
    // 清理过期的会话状态
    for (const [conversationId, state] of this.conversationStates.entries()) {
      if ((now - state.lastUpdate) > this.CLEANUP_INTERVAL) {
        this.conversationStates.delete(conversationId)
      }
    }
    
    // 清理超时的流式状态
    this.checkStreamingTimeouts()
  }
  
  /**
   * 获取所有活跃流式响应的详细统计
   */
  getActiveStreamingStats(): {
    // 基础统计
    activeStreams: number
    totalTokens: number
    totalCharacters: number
    avgDurationMs: number
    oldestStreamAge: number
    
    // UI 性能统计
    averageFPS: number
    totalDroppedFrames: number
    averageRenderTime: number
    
    // 网络统计  
    networkErrors: number
    averageThroughput: number
    averageLatency: number
  } {
    const activeStreams = Array.from(this.streamingStates.values())
      .filter(state => state.status === 'streaming' || state.status === 'processing')
    
    if (activeStreams.length === 0) {
      return {
        activeStreams: 0,
        totalTokens: 0,
        totalCharacters: 0,
        avgDurationMs: 0,
        oldestStreamAge: 0,
        averageFPS: 0,
        totalDroppedFrames: 0,
        averageRenderTime: 0,
        networkErrors: 0,
        averageThroughput: 0,
        averageLatency: 0
      }
    }
    
    const totalTokens = activeStreams.reduce((sum, state) => sum + state.tokenCount, 0)
    const totalCharacters = activeStreams.reduce((sum, state) => sum + state.characterCount, 0)
    const avgDuration = activeStreams.reduce((sum, state) => sum + (Date.now() - state.startTime), 0) / activeStreams.length
    const averageFPS = activeStreams.reduce((sum, state) => sum + state.renderStats.fps, 0) / activeStreams.length
    const totalDroppedFrames = activeStreams.reduce((sum, state) => sum + state.renderStats.droppedFrames, 0)
    const averageRenderTime = activeStreams.reduce((sum, state) => sum + state.renderStats.averageRenderTime, 0) / activeStreams.length
    const networkErrors = activeStreams.reduce((sum, state) => sum + state.networkMetrics.errors, 0)
    const averageThroughput = activeStreams.reduce((sum, state) => sum + state.networkMetrics.throughput, 0) / activeStreams.length
    const averageLatency = activeStreams.reduce((sum, state) => sum + state.networkMetrics.latency, 0) / activeStreams.length
    
    return {
      activeStreams: activeStreams.length,
      totalTokens,
      totalCharacters,
      avgDurationMs: avgDuration,
      oldestStreamAge: activeStreams.length > 0 
        ? Math.max(...activeStreams.map(state => Date.now() - state.startTime))
        : 0,
      averageFPS,
      totalDroppedFrames,
      averageRenderTime,
      networkErrors,
      averageThroughput,
      averageLatency
    }
  }

  /**
   * 获取指定流的详细 UI 渲染统计
   */
  getUIRenderStats(streamId: string): UIRenderStats | null {
    const state = this.streamingStates.get(streamId)
    if (!state) return null

    const now = Date.now()
    const elapsedSeconds = (now - state.startTime) / 1000
    
    return {
      streamId,
      currentFPS: state.renderStats.fps,
      averageRenderTime: state.renderStats.averageRenderTime,
      droppedFrames: state.renderStats.droppedFrames,
      charactersRendered: state.characterCount,
      charactersPerSecond: elapsedSeconds > 0 ? state.characterCount / elapsedSeconds : 0,
      bufferSize: 0, // 将在 UI 组件中计算
      isLagging: state.renderStats.fps < 15, // 低于15fps认为卡顿
      performanceGrade: this.calculatePerformanceGrade(state.renderStats)
    }
  }

  /**
   * 批量获取多个流的 UI 统计
   */
  getBatchUIRenderStats(streamIds: string[]): Map<string, UIRenderStats> {
    const results = new Map<string, UIRenderStats>()
    
    for (const streamId of streamIds) {
      const stats = this.getUIRenderStats(streamId)
      if (stats) {
        results.set(streamId, stats)
      }
    }
    
    return results
  }

  /**
   * 获取内容解析进度（用于 Markdown 等结构化内容）
   */
  getContentParsingProgress(streamId: string): ContentParsingProgress | null {
    const state = this.streamingStates.get(streamId)
    if (!state) return null

    const progress = state.characterCount > 0 
      ? Math.min(100, (state.characterCount / Math.max(state.characterCount, 1000)) * 100)
      : 0

    return {
      streamId,
      totalCharacters: state.characterCount,
      parsedCharacters: state.characterCount, // 假设全部已解析
      progress: progress,
      detectedContentType: state.contentMetrics.contentType,
      structuralElements: {
        codeBlocks: state.contentMetrics.totalChunks, // 重用现有字段
        headings: 0, // 需要在具体解析中统计
        lists: 0,
        links: 0
      },
      parsingQuality: this.assessParsingQuality(state.contentMetrics),
      estimatedCompletionTime: this.estimateCompletionTime(state)
    }
  }

  /**
   * 设置 UI 专用的性能警告阈值
   */
  setUIPerformanceThresholds(thresholds: UIPerformanceThresholds): void {
    // 存储阈值配置（可以扩展到配置系统）
    this.uiThresholds = {
      minAcceptableFPS: 15,
      maxAcceptableRenderTime: 50, // ms
      maxAllowedDroppedFrames: 10,
      lagWarningThreshold: 2000, // ms
      ...thresholds
    }
  }

  /**
   * 检查是否有 UI 性能问题
   */
  detectUIPerformanceIssues(): UIPerformanceIssue[] {
    const issues: UIPerformanceIssue[] = []
    const thresholds = this.uiThresholds || this.getDefaultUIThresholds()
    
    for (const [streamId, state] of this.streamingStates.entries()) {
      // 检查 FPS
      if (state.renderStats.fps < thresholds.minAcceptableFPS) {
        issues.push({
          streamId,
          type: 'low_fps',
          severity: 'warning',
          message: `流 ${streamId} FPS 过低: ${state.renderStats.fps.toFixed(1)}`,
          value: state.renderStats.fps,
          threshold: thresholds.minAcceptableFPS,
          suggestions: ['减少渲染批次大小', '启用智能缓冲', '降低最大FPS限制']
        })
      }

      // 检查渲染时间
      if (state.renderStats.averageRenderTime > thresholds.maxAcceptableRenderTime) {
        issues.push({
          streamId,
          type: 'slow_render',
          severity: 'warning',
          message: `流 ${streamId} 渲染耗时过长: ${state.renderStats.averageRenderTime.toFixed(1)}ms`,
          value: state.renderStats.averageRenderTime,
          threshold: thresholds.maxAcceptableRenderTime,
          suggestions: ['优化渲染逻辑', '使用虚拟化渲染', '减少DOM操作']
        })
      }

      // 检查掉帧
      if (state.renderStats.droppedFrames > thresholds.maxAllowedDroppedFrames) {
        issues.push({
          streamId,
          type: 'dropped_frames',
          severity: 'error',
          message: `流 ${streamId} 掉帧严重: ${state.renderStats.droppedFrames}帧`,
          value: state.renderStats.droppedFrames,
          threshold: thresholds.maxAllowedDroppedFrames,
          suggestions: ['增加渲染间隔', '启用帧率限制', '检查系统资源']
        })
      }

      // 检查网络延迟
      if (state.networkMetrics.latency > thresholds.lagWarningThreshold) {
        issues.push({
          streamId,
          type: 'high_latency',
          severity: 'warning',
          message: `流 ${streamId} 网络延迟过高: ${state.networkMetrics.latency}ms`,
          value: state.networkMetrics.latency,
          threshold: thresholds.lagWarningThreshold,
          suggestions: ['启用智能缓冲', '调整重试策略', '检查网络连接']
        })
      }
    }
    
    return issues
  }

  /**
   * 获取系统级别的流式渲染健康度评分
   */
  getSystemHealthScore(): SystemHealthScore {
    const allStates = Array.from(this.streamingStates.values())
    if (allStates.length === 0) {
      return {
        overallScore: 100,
        components: {
          renderPerformance: 100,
          networkStability: 100,
          resourceUtilization: 100,
          errorRate: 100
        },
        issues: [],
        recommendations: ['系统空闲，准备处理流式请求']
      }
    }

    // 计算各组件得分
    const renderScore = this.calculateRenderPerformanceScore(allStates)
    const networkScore = this.calculateNetworkStabilityScore(allStates)
    const resourceScore = this.calculateResourceUtilizationScore(allStates)
    const errorScore = this.calculateErrorRateScore(allStates)

    const overallScore = (renderScore + networkScore + resourceScore + errorScore) / 4

    return {
      overallScore: Math.round(overallScore),
      components: {
        renderPerformance: Math.round(renderScore),
        networkStability: Math.round(networkScore),
        resourceUtilization: Math.round(resourceScore),
        errorRate: Math.round(errorScore)
      },
      issues: this.detectUIPerformanceIssues(),
      recommendations: this.generateSystemRecommendations(overallScore, allStates)
    }
  }
  
  /**
   * 清理所有状态（用于测试或重置）
   */
  clearAllStates(): void {
    this.conversationStates.clear()
    this.streamingStates.clear()
  }

  // ===================== 私有辅助方法 =====================

  /**
   * 计算性能等级
   */
  private calculatePerformanceGrade(renderStats: StreamingProgress['renderStats']): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (renderStats.fps >= 50 && renderStats.averageRenderTime <= 10 && renderStats.droppedFrames <= 2) {
      return 'A' // 优秀
    } else if (renderStats.fps >= 30 && renderStats.averageRenderTime <= 20 && renderStats.droppedFrames <= 5) {
      return 'B' // 良好
    } else if (renderStats.fps >= 20 && renderStats.averageRenderTime <= 35 && renderStats.droppedFrames <= 10) {
      return 'C' // 中等
    } else if (renderStats.fps >= 10 && renderStats.averageRenderTime <= 50 && renderStats.droppedFrames <= 20) {
      return 'D' // 较差
    } else {
      return 'F' // 不合格
    }
  }

  /**
   * 评估解析质量
   */
  private assessParsingQuality(contentMetrics: StreamingProgress['contentMetrics']): 'excellent' | 'good' | 'fair' | 'poor' {
    const chunkCount = contentMetrics.totalChunks
    const avgChunkSize = contentMetrics.averageChunkSize
    
    // 基于块数量和平均大小评估
    if (chunkCount > 0 && avgChunkSize > 100 && avgChunkSize < 500) {
      return 'excellent'
    } else if (chunkCount > 0 && avgChunkSize > 50) {
      return 'good'
    } else if (chunkCount > 0) {
      return 'fair'
    } else {
      return 'poor'
    }
  }

  /**
   * 估算完成时间
   */
  private estimateCompletionTime(state: StreamingProgress): number | undefined {
    if (state.status === 'completed') return 0
    
    const elapsedTime = Date.now() - state.startTime
    const progress = state.characterCount
    
    if (progress === 0 || elapsedTime === 0) return undefined
    
    // 基于当前速度的简单线性估算（实际中可以更复杂）
    const estimatedTotalTime = elapsedTime * 2 // 假设还需要相同时间完成
    return Math.max(0, estimatedTotalTime - elapsedTime)
  }

  /**
   * 获取默认 UI 性能阈值
   */
  private getDefaultUIThresholds(): UIPerformanceThresholds {
    return {
      minAcceptableFPS: 15,
      maxAcceptableRenderTime: 50,
      maxAllowedDroppedFrames: 10,
      lagWarningThreshold: 2000
    }
  }

  /**
   * 计算渲染性能得分
   */
  private calculateRenderPerformanceScore(states: StreamingProgress[]): number {
    if (states.length === 0) return 100
    
    const avgFPS = states.reduce((sum, s) => sum + s.renderStats.fps, 0) / states.length
    const avgRenderTime = states.reduce((sum, s) => sum + s.renderStats.averageRenderTime, 0) / states.length
    const totalDropped = states.reduce((sum, s) => sum + s.renderStats.droppedFrames, 0)
    
    // FPS 得分 (满分30fps)
    const fpsScore = Math.min(100, (avgFPS / 30) * 100)
    
    // 渲染时间得分 (目标10ms)
    const renderTimeScore = Math.max(0, 100 - (avgRenderTime - 10) * 2)
    
    // 掉帧得分
    const droppedScore = Math.max(0, 100 - totalDropped * 5)
    
    return (fpsScore + renderTimeScore + droppedScore) / 3
  }

  /**
   * 计算网络稳定性得分
   */
  private calculateNetworkStabilityScore(states: StreamingProgress[]): number {
    if (states.length === 0) return 100
    
    const avgLatency = states.reduce((sum, s) => sum + s.networkMetrics.latency, 0) / states.length
    const totalErrors = states.reduce((sum, s) => sum + s.networkMetrics.errors, 0)
    const totalReconnections = states.reduce((sum, s) => sum + s.networkMetrics.reconnections, 0)
    
    // 延迟得分 (目标100ms)
    const latencyScore = Math.max(0, 100 - (avgLatency - 100) * 0.1)
    
    // 错误得分
    const errorScore = Math.max(0, 100 - totalErrors * 10)
    
    // 重连得分
    const reconnectionScore = Math.max(0, 100 - totalReconnections * 15)
    
    return (latencyScore + errorScore + reconnectionScore) / 3
  }

  /**
   * 计算资源利用率得分
   */
  private calculateResourceUtilizationScore(states: StreamingProgress[]): number {
    // 简化的资源评估，实际中可以监控内存、CPU等
    const activeStreams = states.filter(s => s.status === 'streaming' || s.status === 'processing').length
    
    // 基于活跃流数量的简单评估
    if (activeStreams === 0) return 100
    if (activeStreams <= 5) return 90
    if (activeStreams <= 10) return 70
    if (activeStreams <= 20) return 50
    return 20
  }

  /**
   * 计算错误率得分
   */
  private calculateErrorRateScore(states: StreamingProgress[]): number {
    const totalStates = states.length
    const errorStates = states.filter(s => s.status === 'error').length
    
    if (totalStates === 0) return 100
    
    const errorRate = errorStates / totalStates
    return Math.max(0, 100 - errorRate * 100)
  }

  /**
   * 生成系统建议
   */
  private generateSystemRecommendations(overallScore: number, states: StreamingProgress[]): string[] {
    const recommendations: string[] = []
    
    if (overallScore < 50) {
      recommendations.push('系统性能严重不足，建议检查硬件资源')
      recommendations.push('考虑降低并发流数量')
    } else if (overallScore < 70) {
      recommendations.push('系统性能有待改善，建议优化渲染逻辑')
      recommendations.push('启用智能缓冲以提高稳定性')
    } else if (overallScore < 85) {
      recommendations.push('系统运行良好，可考虑提高渲染质量')
    } else {
      recommendations.push('系统运行优异，性能表现出色')
    }
    
    // 基于具体问题的建议
    const highLatencyStreams = states.filter(s => s.networkMetrics.latency > 1000).length
    if (highLatencyStreams > 0) {
      recommendations.push(`发现 ${highLatencyStreams} 个高延迟流，建议检查网络连接`)
    }
    
    const lowFPSStreams = states.filter(s => s.renderStats.fps < 15).length
    if (lowFPSStreams > 0) {
      recommendations.push(`发现 ${lowFPSStreams} 个低帧率流，建议优化渲染性能`)
    }
    
    return recommendations
  }
}

export interface StreamingStats {
  duration: number
  tokenCount: number
  tokensPerSecond: number
  startTime: number
  endTime: number
}


export interface UIRenderStats {
  streamId: string
  currentFPS: number
  averageRenderTime: number
  droppedFrames: number
  charactersRendered: number
  charactersPerSecond: number
  bufferSize: number
  isLagging: boolean
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface ContentParsingProgress {
  streamId: string
  totalCharacters: number
  parsedCharacters: number
  progress: number // 0-100
  detectedContentType: 'text' | 'markdown' | 'code' | 'mixed'
  structuralElements: {
    codeBlocks: number
    headings: number
    lists: number
    links: number
  }
  parsingQuality: 'excellent' | 'good' | 'fair' | 'poor'
  estimatedCompletionTime?: number // ms
}

export interface UIPerformanceThresholds {
  minAcceptableFPS: number
  maxAcceptableRenderTime: number // ms
  maxAllowedDroppedFrames: number
  lagWarningThreshold: number // ms
}

export interface UIPerformanceIssue {
  streamId: string
  type: 'low_fps' | 'slow_render' | 'dropped_frames' | 'high_latency' | 'memory_leak'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  value: number
  threshold: number
  suggestions: string[]
}

export interface SystemHealthScore {
  overallScore: number // 0-100
  components: {
    renderPerformance: number
    networkStability: number
    resourceUtilization: number
    errorRate: number
  }
  issues: UIPerformanceIssue[]
  recommendations: string[]
}

// 全局单例实例
let globalResponseStateManager: ResponseStateManager | null = null

/**
 * 获取全局响应状态管理器实例
 */
export function getResponseStateManager(): ResponseStateManager {
  if (!globalResponseStateManager) {
    globalResponseStateManager = new ResponseStateManager()
  }
  return globalResponseStateManager
}