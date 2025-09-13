import { debugLog, logError, logWarn, infoLog } from '../../utils/log.js'

/**
 * WriteFlow 网络优化器
 * 专门优化网络请求和数据传输性能
 */

import { EventEmitter } from 'events'
import { performance } from 'perf_hooks'

export interface NetworkConfig {
  // 连接配置
  maxConcurrentRequests: number
  connectionTimeout: number // ms
  requestTimeout: number // ms
  
  // 重试配置
  maxRetries: number
  retryDelayBase: number // ms
  retryDelayMultiplier: number
  
  // 缓存配置
  enableResponseCache: boolean
  cacheMaxSize: number // bytes
  cacheTTL: number // ms
  
  // 优化配置
  enableCompression: boolean
  enableKeepAlive: boolean
  enablePipelining: boolean
  enableAdaptiveBatching: boolean
}

export interface NetworkMetrics {
  // 连接统计
  activeConnections: number
  totalRequests: number
  failedRequests: number
  
  // 延迟统计
  averageLatency: number // ms
  p50Latency: number
  p95Latency: number
  p99Latency: number
  
  // 吞吐量统计
  throughput: number // bytes/s
  requestsPerSecond: number
  
  // 错误统计
  errorRate: number // 0-100%
  timeoutRate: number
  retryRate: number
  
  // 缓存统计
  cacheHitRate: number // 0-100%
  cacheSize: number // bytes
}

export interface ConnectionStats {
  id: string
  url: string
  status: 'connecting' | 'connected' | 'idle' | 'closed' | 'error'
  startTime: number
  lastActivity: number
  requestCount: number
  bytesReceived: number
  bytesSent: number
  latencies: number[]
}

export interface NetworkOptimization {
  type: 'batch_requests' | 'compress_data' | 'cache_response' | 'adjust_timeout' | 'limit_connections'
  description: string
  impact: number // 预期改善百分比
  appliedAt: number
}

/**
 * 智能网络优化器
 */
export class NetworkOptimizer extends EventEmitter {
  private config: NetworkConfig
  private connections = new Map<string, ConnectionStats>()
  private requestQueue: Array<{ id: string; priority: number; callback: () => void }> = []
  private responseCache = new Map<string, { data: any; timestamp: number }>()
  private metrics: NetworkMetrics
  private latencyHistory: number[] = []
  private throughputHistory: Array<{ timestamp: number; bytes: number }> = []
  
  // 自适应参数
  private adaptiveSettings = {
    optimalBatchSize: 1,
    optimalTimeout: 5000,
    optimalConcurrency: 3,
    compressionThreshold: 1024 // bytes
  }
  
  constructor(config: Partial<NetworkConfig> = {}) {
    super()
    
    this.config = {
      maxConcurrentRequests: 5,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      maxRetries: 3,
      retryDelayBase: 1000,
      retryDelayMultiplier: 2,
      enableResponseCache: true,
      cacheMaxSize: 10 * 1024 * 1024, // 10MB
      cacheTTL: 5 * 60 * 1000, // 5分钟
      enableCompression: true,
      enableKeepAlive: true,
      enablePipelining: true,
      enableAdaptiveBatching: true,
      ...config
    }
    
    this.metrics = {
      activeConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      timeoutRate: 0,
      retryRate: 0,
      cacheHitRate: 0,
      cacheSize: 0
    }
    
    // 定期清理缓存和统计
    setInterval(() => this.cleanupCache(), 60000) // 每分钟清理一次
    setInterval(() => this.updateMetrics(), 1000) // 每秒更新指标
  }

  /**
   * 优化的网络请求方法
   */
  async optimizedFetch(
    url: string,
    options: RequestInit & {
      priority?: number
      cacheKey?: string
      skipCache?: boolean
    } = {}
  ): Promise<Response> {
    const startTime = performance.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 检查缓存
    if (!options.skipCache && this.config.enableResponseCache && options.cacheKey) {
      const cached = this.getCachedResponse(options.cacheKey)
      if (cached) {
        this.emit('cache-hit', { requestId, cacheKey: options.cacheKey, url })
        return cached
      }
    }
    
    // 应用网络优化
    const optimizedOptions = await this.applyNetworkOptimizations(options)
    
    // 添加到请求队列（如果需要）
    if (this.shouldQueueRequest()) {
      return this.queueRequest(requestId, url, optimizedOptions, options.priority || 0)
    }
    
    // 执行请求
    return this.executeRequest(requestId, url, optimizedOptions, startTime)
  }

  /**
   * 执行实际网络请求
   */
  private async executeRequest(
    requestId: string,
    url: string,
    options: RequestInit,
    startTime: number
  ): Promise<Response> {
    const connectionId = this.getConnectionId(url)
    let connection = this.connections.get(connectionId)
    
    if (!connection) {
      connection = this.createConnection(connectionId, url)
      this.connections.set(connectionId, connection)
    }
    
    connection.status = 'connecting'
    connection.requestCount++
    this.metrics.totalRequests++
    
    try {
      // 设置超时
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.adaptiveSettings.optimalTimeout)
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      
      // 记录成功请求
      const endTime = performance.now()
      const latency = endTime - startTime
      
      this.recordRequestSuccess(connectionId, latency, response)
      
      // 缓存响应（如果适用）
      if (this.config.enableResponseCache && options.method !== 'POST') {
        await this.cacheResponse(url, response.clone())
      }
      
      return response
      
    } catch (error) {
      // 记录失败请求
      this.recordRequestFailure(connectionId, error)
      
      // 尝试重试
      if (this.shouldRetry(error, connection)) {
        return this.retryRequest(requestId, url, options, startTime, connection.requestCount)
      }
      
      throw error
    }
  }

  /**
   * 应用网络优化
   */
  private async applyNetworkOptimizations(options: RequestInit): Promise<RequestInit> {
    const optimizedOptions = { ...options }
    
    // 启用压缩
    if (this.config.enableCompression) {
      optimizedOptions.headers = {
        ...optimizedOptions.headers,
        'Accept-Encoding': 'gzip, deflate, br'
      }
    }
    
    // 启用保持连接
    if (this.config.enableKeepAlive) {
      optimizedOptions.headers = {
        ...optimizedOptions.headers,
        'Connection': 'keep-alive'
      }
    }
    
    // 自适应超时
    if (!optimizedOptions.signal) {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), this.adaptiveSettings.optimalTimeout)
      optimizedOptions.signal = controller.signal
    }
    
    return optimizedOptions
  }

  /**
   * 判断是否需要排队
   */
  private shouldQueueRequest(): boolean {
    return this.metrics.activeConnections >= this.adaptiveSettings.optimalConcurrency
  }

  /**
   * 将请求添加到队列
   */
  private async queueRequest(
    requestId: string,
    url: string,
    options: RequestInit,
    priority: number
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: requestId,
        priority,
        callback: async () => {
          try {
            const response = await this.executeRequest(requestId, url, options, performance.now())
            resolve(response)
          } catch (error) {
            reject(error)
          }
        }
      })
      
      // 按优先级排序
      this.requestQueue.sort((a, b) => b.priority - a.priority)
      
      // 处理队列
      this.processQueue()
    })
  }

  /**
   * 处理请求队列
   */
  private processQueue(): void {
    while (
      this.requestQueue.length > 0 && 
      this.metrics.activeConnections < this.adaptiveSettings.optimalConcurrency
    ) {
      const request = this.requestQueue.shift()
      if (request) {
        request.callback()
      }
    }
  }

  /**
   * 创建连接统计
   */
  private createConnection(connectionId: string, url: string): ConnectionStats {
    const connection: ConnectionStats = {
      id: connectionId,
      url,
      status: 'connecting',
      startTime: Date.now(),
      lastActivity: Date.now(),
      requestCount: 0,
      bytesReceived: 0,
      bytesSent: 0,
      latencies: []
    }
    
    this.metrics.activeConnections++
    return connection
  }

  /**
   * 记录成功请求
   */
  private recordRequestSuccess(connectionId: string, latency: number, response: Response): void {
    // 估算接收字节数
    const contentLength = parseInt(response.headers.get('content-length') || '0')
    
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.status = 'connected'
      connection.lastActivity = Date.now()
      connection.latencies.push(latency)
      connection.bytesReceived += contentLength
    }
    
    // 更新全局延迟历史
    this.latencyHistory.push(latency)
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory.shift()
    }
    
    // 更新吞吐量历史
    this.updateThroughputHistory(contentLength || 0)
    
    this.emit('request-success', { connectionId, latency, response })
  }

  /**
   * 记录失败请求
   */
  private recordRequestFailure(connectionId: string, error: any): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.status = 'error'
      connection.lastActivity = Date.now()
    }
    
    this.metrics.failedRequests++
    this.emit('request-failure', { connectionId, error })
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any, connection: ConnectionStats): boolean {
    if (connection.requestCount >= this.config.maxRetries) return false
    
    // 检查错误类型
    const retryableErrors = ['NetworkError', 'TimeoutError', 'AbortError']
    return retryableErrors.some(errorType => error.name?.includes(errorType))
  }

  /**
   * 重试请求
   */
  private async retryRequest(
    requestId: string,
    url: string,
    options: RequestInit,
    startTime: number,
    retryCount: number
  ): Promise<Response> {
    const delay = this.config.retryDelayBase * Math.pow(this.config.retryDelayMultiplier, retryCount - 1)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    
    this.emit('request-retry', { requestId, url, retryCount, delay })
    
    return this.executeRequest(requestId, url, options, startTime)
  }

  /**
   * 获取连接ID
   */
  private getConnectionId(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.host}`
    } catch {
      return url
    }
  }

  /**
   * 缓存响应
   */
  private async cacheResponse(key: string, response: Response): Promise<void> {
    if (!this.config.enableResponseCache) return
    
    // 检查缓存大小限制
    if (this.responseCache.size >= this.config.cacheMaxSize) {
      this.cleanupCache()
    }
    
    try {
      const data = await response.text()
      this.responseCache.set(key, {
        data: new Response(data, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        }),
        timestamp: Date.now()
      })
      
      this.updateCacheMetrics()
    } catch (error) {
      logWarn('缓存响应失败:', error)
    }
  }

  /**
   * 获取缓存的响应
   */
  private getCachedResponse(key: string): Response | null {
    const cached = this.responseCache.get(key)
    if (!cached) return null
    
    // 检查是否过期
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.responseCache.delete(key)
      return null
    }
    
    return cached.data.clone()
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, cached] of this.responseCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL) {
        this.responseCache.delete(key)
      }
    }
    
    this.updateCacheMetrics()
  }

  /**
   * 更新缓存指标
   */
  private updateCacheMetrics(): void {
    let totalSize = 0
    for (const cached of this.responseCache.values()) {
      totalSize += JSON.stringify(cached.data).length
    }
    this.metrics.cacheSize = totalSize
  }

  /**
   * 更新吞吐量历史
   */
  private updateThroughputHistory(bytes: number): void {
    const now = Date.now()
    this.throughputHistory.push({ timestamp: now, bytes })
    
    // 保持最近1分钟的历史
    const cutoff = now - 60000
    this.throughputHistory = this.throughputHistory.filter(entry => entry.timestamp > cutoff)
  }

  /**
   * 更新网络指标
   */
  private updateMetrics(): void {
    if (this.latencyHistory.length > 0) {
      const sorted = [...this.latencyHistory].sort((a, b) => a - b)
      this.metrics.averageLatency = sorted.reduce((a, b) => a + b) / sorted.length
      this.metrics.p50Latency = sorted[Math.floor(sorted.length * 0.5)]
      this.metrics.p95Latency = sorted[Math.floor(sorted.length * 0.95)]
      this.metrics.p99Latency = sorted[Math.floor(sorted.length * 0.99)]
    }
    
    // 计算吞吐量
    if (this.throughputHistory.length > 1) {
      const totalBytes = this.throughputHistory.reduce((sum, entry) => sum + entry.bytes, 0)
      const timeSpan = (Date.now() - this.throughputHistory[0].timestamp) / 1000
      this.metrics.throughput = timeSpan > 0 ? totalBytes / timeSpan : 0
    }
    
    // 计算错误率
    if (this.metrics.totalRequests > 0) {
      this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100
    }
    
    // 计算请求率
    const recentRequests = Array.from(this.connections.values())
      .filter(conn => Date.now() - conn.lastActivity < 1000)
    this.metrics.requestsPerSecond = recentRequests.length
    
    // 自适应优化
    this.performAdaptiveOptimizations()
    
    this.emit('metrics-updated', this.metrics)
  }

  /**
   * 执行自适应优化
   */
  private performAdaptiveOptimizations(): void {
    // 基于延迟调整超时
    if (this.metrics.averageLatency > 0) {
      const newTimeout = Math.max(5000, this.metrics.p95Latency * 2)
      if (Math.abs(newTimeout - this.adaptiveSettings.optimalTimeout) > 1000) {
        this.adaptiveSettings.optimalTimeout = newTimeout
        this.emit('adaptation', {
          type: 'timeout_adjustment',
          oldValue: this.adaptiveSettings.optimalTimeout,
          newValue: newTimeout
        })
      }
    }
    
    // 基于错误率调整并发数
    if (this.metrics.errorRate > 10 && this.adaptiveSettings.optimalConcurrency > 1) {
      this.adaptiveSettings.optimalConcurrency--
      this.emit('adaptation', {
        type: 'concurrency_reduction',
        reason: `高错误率 (${this.metrics.errorRate.toFixed(1)}%)`,
        newValue: this.adaptiveSettings.optimalConcurrency
      })
    } else if (this.metrics.errorRate < 2 && this.adaptiveSettings.optimalConcurrency < this.config.maxConcurrentRequests) {
      this.adaptiveSettings.optimalConcurrency++
      this.emit('adaptation', {
        type: 'concurrency_increase',
        reason: `低错误率 (${this.metrics.errorRate.toFixed(1)}%)`,
        newValue: this.adaptiveSettings.optimalConcurrency
      })
    }
  }

  /**
   * 获取当前网络指标
   */
  getMetrics(): NetworkMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取连接统计
   */
  getConnectionStats(): ConnectionStats[] {
    return Array.from(this.connections.values())
  }

  /**
   * 获取自适应设置
   */
  getAdaptiveSettings() {
    return { ...this.adaptiveSettings }
  }

  /**
   * 重置网络优化器
   */
  reset(): void {
    this.connections.clear()
    this.requestQueue = []
    this.responseCache.clear()
    this.latencyHistory = []
    this.throughputHistory = []
    
    this.metrics = {
      activeConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      timeoutRate: 0,
      retryRate: 0,
      cacheHitRate: 0,
      cacheSize: 0
    }
    
    this.emit('reset', { timestamp: Date.now() })
  }
}

// 全局实例
let globalNetworkOptimizer: NetworkOptimizer | null = null

/**
 * 获取全局网络优化器实例
 */
export function getNetworkOptimizer(config?: Partial<NetworkConfig>): NetworkOptimizer {
  if (!globalNetworkOptimizer) {
    globalNetworkOptimizer = new NetworkOptimizer(config)
  }
  return globalNetworkOptimizer
}