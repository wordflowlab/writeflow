/**
 * WriteFlow 性能优化器
 * 实时监控和动态优化流式渲染性能
 */

import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'
import { getResponseStateManager } from '../streaming/ResponseStateManager.js'

export interface PerformanceConfig {
  // 监控配置
  samplingInterval: number // 采样间隔 (ms)
  historySize: number // 历史数据保存数量
  
  // 性能阈值
  targetFPS: number
  maxLatency: number // ms
  maxMemoryUsage: number // MB
  
  // 优化策略
  enableAdaptiveRendering: boolean
  enableSmartCaching: boolean
  enableNetworkOptimization: boolean
  enableMemoryManagement: boolean
}

export interface PerformanceMetrics {
  // 系统性能
  cpu: {
    usage: number // 0-100
    loadAverage: number[]
  }
  memory: {
    used: number // MB
    total: number // MB
    heapUsed: number // MB
    heapTotal: number // MB
  }
  network: {
    latency: number // ms
    throughput: number // bytes/s
    packetsLost: number
  }
  
  // 渲染性能
  rendering: {
    fps: number
    frameDrops: number
    averageFrameTime: number // ms
    renderQueueSize: number
  }
  
  // 流式性能
  streaming: {
    activeStreams: number
    totalCharacters: number
    charactersPerSecond: number
    bufferUtilization: number // 0-100%
  }
}

export interface OptimizationAction {
  type: 'reduce_fps' | 'increase_buffer' | 'enable_caching' | 'reduce_quality' | 'prioritize_streams' | 'cleanup_memory'
  reason: string
  impact: 'low' | 'medium' | 'high'
  reversible: boolean
  appliedAt: number
}

export interface PerformanceAlert {
  severity: 'info' | 'warning' | 'critical'
  type: 'high_cpu' | 'low_memory' | 'network_lag' | 'frame_drops' | 'stream_overload'
  message: string
  metrics: Partial<PerformanceMetrics>
  recommendations: string[]
  timestamp: number
}

/**
 * 实时性能优化器
 */
export class PerformanceOptimizer extends EventEmitter {
  private config: PerformanceConfig
  private stateManager = getResponseStateManager()
  
  // 监控状态
  private isMonitoring = false
  private monitoringTimer?: NodeJS.Timeout
  private metricsHistory: PerformanceMetrics[] = []
  
  // 优化状态
  private appliedOptimizations: OptimizationAction[] = []
  private adaptiveSettings = {
    currentFPS: 60,
    bufferMultiplier: 1.0,
    cachingEnabled: false,
    qualityReduction: 0 // 0-100%
  }
  
  // 性能采样
  private lastCPUUsage?: NodeJS.CpuUsage
  private networkSamples: { timestamp: number; bytes: number }[] = []
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    super()
    
    this.config = {
      samplingInterval: 1000, // 每秒采样一次
      historySize: 300, // 保存5分钟历史
      targetFPS: 30,
      maxLatency: 1000,
      maxMemoryUsage: 512, // 512MB
      enableAdaptiveRendering: true,
      enableSmartCaching: true,
      enableNetworkOptimization: true,
      enableMemoryManagement: true,
      ...config
    }
    
    this.lastCPUUsage = process.cpuUsage()
  }

  /**
   * 开始性能监控
   */
  startMonitoring(): void {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    console.log('🚀 启动性能监控系统')
    
    // 立即进行一次采样
    this.collectMetrics()
    
    // 设置定时采样
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics()
    }, this.config.samplingInterval)
    
    this.emit('monitoring-started', {
      config: this.config,
      timestamp: Date.now()
    })
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return
    
    this.isMonitoring = false
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer)
      this.monitoringTimer = undefined
    }
    
    console.log('⏹️ 停止性能监控系统')
    this.emit('monitoring-stopped', {
      timestamp: Date.now(),
      appliedOptimizations: this.appliedOptimizations.length
    })
  }

  /**
   * 收集性能指标
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now()
    
    try {
      const metrics: PerformanceMetrics = {
        cpu: await this.collectCPUMetrics(),
        memory: this.collectMemoryMetrics(),
        network: await this.collectNetworkMetrics(),
        rendering: this.collectRenderingMetrics(),
        streaming: this.collectStreamingMetrics()
      }
      
      // 添加到历史记录
      this.metricsHistory.push(metrics)
      if (this.metricsHistory.length > this.config.historySize) {
        this.metricsHistory.shift()
      }
      
      // 发出指标更新事件
      this.emit('metrics-updated', metrics)
      
      // 分析性能并执行优化
      await this.analyzeAndOptimize(metrics)
      
    } catch (error) {
      console.error('性能指标收集失败:', error)
      this.emit('collection-error', error)
    }
  }

  /**
   * 收集 CPU 指标
   */
  private async collectCPUMetrics(): Promise<PerformanceMetrics['cpu']> {
    const currentUsage = process.cpuUsage(this.lastCPUUsage)
    this.lastCPUUsage = process.cpuUsage()
    
    // 计算 CPU 使用率（简化版本）
    const totalTime = currentUsage.user + currentUsage.system
    const usage = Math.min(100, (totalTime / 1000000) * 100) // 转换为百分比
    
    return {
      usage,
      loadAverage: require('os').loadavg()
    }
  }

  /**
   * 收集内存指标
   */
  private collectMemoryMetrics(): PerformanceMetrics['memory'] {
    const memUsage = process.memoryUsage()
    const totalMem = require('os').totalmem()
    const freeMem = require('os').freemem()
    const usedMem = totalMem - freeMem
    
    return {
      used: usedMem / (1024 * 1024), // MB
      total: totalMem / (1024 * 1024), // MB
      heapUsed: memUsage.heapUsed / (1024 * 1024), // MB
      heapTotal: memUsage.heapTotal / (1024 * 1024) // MB
    }
  }

  /**
   * 收集网络指标
   */
  private async collectNetworkMetrics(): Promise<PerformanceMetrics['network']> {
    // 简化的网络指标收集
    const now = Date.now()
    const streamingStats = this.stateManager.getActiveStreamingStats()
    
    // 清理旧的网络样本
    this.networkSamples = this.networkSamples.filter(
      sample => now - sample.timestamp < 5000
    )
    
    // 计算吞吐量
    const throughput = this.networkSamples.length > 1
      ? this.calculateThroughput()
      : 0
    
    return {
      latency: 0, // 需要从实际网络请求中获取
      throughput,
      packetsLost: 0 // 简化为0
    }
  }

  /**
   * 收集渲染指标
   */
  private collectRenderingMetrics(): PerformanceMetrics['rendering'] {
    // 从状态管理器获取活跃流统计
    const streamingStats = this.stateManager.getActiveStreamingStats()
    
    return {
      fps: this.adaptiveSettings.currentFPS,
      frameDrops: 0, // 需要从实际渲染中获取
      averageFrameTime: this.adaptiveSettings.currentFPS > 0 ? 1000 / this.adaptiveSettings.currentFPS : 0,
      renderQueueSize: 0 // 需要从渲染队列中获取
    }
  }

  /**
   * 收集流式指标
   */
  private collectStreamingMetrics(): PerformanceMetrics['streaming'] {
    const stats = this.stateManager.getActiveStreamingStats()
    
    return {
      activeStreams: stats.activeStreams,
      totalCharacters: stats.totalCharacters,
      charactersPerSecond: stats.averageThroughput || 0,
      bufferUtilization: Math.min(100, (stats.totalCharacters / 10000) * 100) // 假设10K为满缓冲
    }
  }

  /**
   * 计算网络吞吐量
   */
  private calculateThroughput(): number {
    if (this.networkSamples.length < 2) return 0
    
    const latest = this.networkSamples[this.networkSamples.length - 1]
    const earliest = this.networkSamples[0]
    
    const timeDiff = (latest.timestamp - earliest.timestamp) / 1000 // 秒
    const bytesDiff = latest.bytes - earliest.bytes
    
    return timeDiff > 0 ? bytesDiff / timeDiff : 0
  }

  /**
   * 分析性能并执行优化
   */
  private async analyzeAndOptimize(metrics: PerformanceMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = []
    const optimizations: OptimizationAction[] = []
    
    // 分析 CPU 性能
    if (metrics.cpu.usage > 80) {
      alerts.push({
        severity: 'warning',
        type: 'high_cpu',
        message: `CPU使用率过高: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics: { cpu: metrics.cpu },
        recommendations: ['降低渲染帧率', '减少并发流数量', '启用缓存'],
        timestamp: Date.now()
      })
      
      if (this.config.enableAdaptiveRendering) {
        optimizations.push(await this.optimizeCPUUsage(metrics))
      }
    }
    
    // 分析内存使用
    if (metrics.memory.heapUsed > this.config.maxMemoryUsage) {
      alerts.push({
        severity: 'critical',
        type: 'low_memory',
        message: `内存使用过高: ${metrics.memory.heapUsed.toFixed(1)}MB`,
        metrics: { memory: metrics.memory },
        recommendations: ['清理缓存', '减少缓冲区大小', '启用内存回收'],
        timestamp: Date.now()
      })
      
      if (this.config.enableMemoryManagement) {
        optimizations.push(await this.optimizeMemoryUsage(metrics))
      }
    }
    
    // 分析渲染性能
    if (metrics.rendering.fps < this.config.targetFPS * 0.7) {
      alerts.push({
        severity: 'warning',
        type: 'frame_drops',
        message: `帧率低于目标值: ${metrics.rendering.fps.toFixed(1)}fps`,
        metrics: { rendering: metrics.rendering },
        recommendations: ['优化渲染逻辑', '减少DOM操作', '启用虚拟化'],
        timestamp: Date.now()
      })
      
      if (this.config.enableAdaptiveRendering) {
        optimizations.push(await this.optimizeRenderingPerformance(metrics))
      }
    }
    
    // 分析流式性能
    if (metrics.streaming.bufferUtilization > 90) {
      alerts.push({
        severity: 'warning',
        type: 'stream_overload',
        message: `流式缓冲区使用率过高: ${metrics.streaming.bufferUtilization.toFixed(1)}%`,
        metrics: { streaming: metrics.streaming },
        recommendations: ['增加缓冲区大小', '优化数据传输', '启用流量控制'],
        timestamp: Date.now()
      })
      
      if (this.config.enableNetworkOptimization) {
        optimizations.push(await this.optimizeStreamingPerformance(metrics))
      }
    }
    
    // 发出警报
    alerts.forEach(alert => {
      this.emit('performance-alert', alert)
    })
    
    // 应用优化
    for (const optimization of optimizations) {
      await this.applyOptimization(optimization)
    }
  }

  /**
   * 优化 CPU 使用率
   */
  private async optimizeCPUUsage(metrics: PerformanceMetrics): Promise<OptimizationAction> {
    // 降低帧率
    if (this.adaptiveSettings.currentFPS > 15) {
      this.adaptiveSettings.currentFPS = Math.max(15, this.adaptiveSettings.currentFPS - 5)
      
      return {
        type: 'reduce_fps',
        reason: `CPU使用率过高 (${metrics.cpu.usage.toFixed(1)}%)，降低帧率到 ${this.adaptiveSettings.currentFPS}fps`,
        impact: 'medium',
        reversible: true,
        appliedAt: Date.now()
      }
    }
    
    // 启用缓存
    if (!this.adaptiveSettings.cachingEnabled) {
      this.adaptiveSettings.cachingEnabled = true
      
      return {
        type: 'enable_caching',
        reason: `CPU使用率过高，启用智能缓存`,
        impact: 'low',
        reversible: true,
        appliedAt: Date.now()
      }
    }
    
    // 降低渲染质量
    if (this.adaptiveSettings.qualityReduction < 50) {
      this.adaptiveSettings.qualityReduction = Math.min(50, this.adaptiveSettings.qualityReduction + 10)
      
      return {
        type: 'reduce_quality',
        reason: `CPU使用率过高，降低渲染质量 ${this.adaptiveSettings.qualityReduction}%`,
        impact: 'high',
        reversible: true,
        appliedAt: Date.now()
      }
    }
    
    return {
      type: 'reduce_fps',
      reason: 'CPU优化：无可用优化措施',
      impact: 'low',
      reversible: false,
      appliedAt: Date.now()
    }
  }

  /**
   * 优化内存使用
   */
  private async optimizeMemoryUsage(metrics: PerformanceMetrics): Promise<OptimizationAction> {
    // 清理内存
    if (global.gc) {
      global.gc()
    }
    
    return {
      type: 'cleanup_memory',
      reason: `内存使用过高 (${metrics.memory.heapUsed.toFixed(1)}MB)，执行垃圾回收`,
      impact: 'low',
      reversible: false,
      appliedAt: Date.now()
    }
  }

  /**
   * 优化渲染性能
   */
  private async optimizeRenderingPerformance(metrics: PerformanceMetrics): Promise<OptimizationAction> {
    // 增加缓冲区
    if (this.adaptiveSettings.bufferMultiplier < 2.0) {
      this.adaptiveSettings.bufferMultiplier = Math.min(2.0, this.adaptiveSettings.bufferMultiplier + 0.2)
      
      return {
        type: 'increase_buffer',
        reason: `渲染性能不足，增加缓冲区大小 ${(this.adaptiveSettings.bufferMultiplier * 100).toFixed(0)}%`,
        impact: 'medium',
        reversible: true,
        appliedAt: Date.now()
      }
    }
    
    return {
      type: 'reduce_fps',
      reason: '渲染优化：无可用优化措施',
      impact: 'low',
      reversible: false,
      appliedAt: Date.now()
    }
  }

  /**
   * 优化流式性能
   */
  private async optimizeStreamingPerformance(metrics: PerformanceMetrics): Promise<OptimizationAction> {
    return {
      type: 'prioritize_streams',
      reason: `流式缓冲区使用率过高 (${metrics.streaming.bufferUtilization.toFixed(1)}%)，优先处理重要流`,
      impact: 'medium',
      reversible: true,
      appliedAt: Date.now()
    }
  }

  /**
   * 应用优化措施
   */
  private async applyOptimization(optimization: OptimizationAction): Promise<void> {
    this.appliedOptimizations.push(optimization)
    
    console.log(`🔧 应用性能优化: ${optimization.reason}`)
    
    this.emit('optimization-applied', optimization)
    
    // 保持优化历史记录大小
    if (this.appliedOptimizations.length > 100) {
      this.appliedOptimizations.shift()
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null
  }

  /**
   * 获取性能历史
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  /**
   * 获取应用的优化措施
   */
  getAppliedOptimizations(): OptimizationAction[] {
    return [...this.appliedOptimizations]
  }

  /**
   * 获取自适应设置
   */
  getAdaptiveSettings() {
    return { ...this.adaptiveSettings }
  }

  /**
   * 重置所有优化
   */
  resetOptimizations(): void {
    this.adaptiveSettings = {
      currentFPS: 60,
      bufferMultiplier: 1.0,
      cachingEnabled: false,
      qualityReduction: 0
    }
    
    this.appliedOptimizations = []
    console.log('🔄 重置所有性能优化')
    
    this.emit('optimizations-reset', {
      timestamp: Date.now()
    })
  }

  /**
   * 设置性能配置
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('config-updated', this.config)
  }
}

// 全局实例
let globalPerformanceOptimizer: PerformanceOptimizer | null = null

/**
 * 获取全局性能优化器实例
 */
export function getPerformanceOptimizer(config?: Partial<PerformanceConfig>): PerformanceOptimizer {
  if (!globalPerformanceOptimizer) {
    globalPerformanceOptimizer = new PerformanceOptimizer(config)
  } else if (config) {
    globalPerformanceOptimizer.updateConfig(config)
  }
  return globalPerformanceOptimizer
}