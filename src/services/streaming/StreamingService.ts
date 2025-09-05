/**
 * WriteFlow 统一流式服务
 * 集成流式适配器与模型管理的统一接口
 */

import EventEmitter from 'events'
import { getModelCapabilities } from '../models/modelCapabilities.js'
import { getModelManager } from '../models/ModelManager.js'
import { logError } from '../../utils/log.js'
import { createStreamAdapterFromModel, StreamChunk, StreamAdapter } from './index.js'

export interface StreamingConfig {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  bufferSize?: number
  enableReconnect?: boolean
}

export interface StreamingRequest {
  prompt: string
  systemPrompt?: string
  model?: string
  maxTokens?: number
  temperature?: number
  allowedTools?: string[]
  enableToolCalls?: boolean
}

export interface StreamingResponse {
  content: string
  reasoning?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens?: number
  }
  cost?: number
  duration?: number
  model: string
  done: boolean
  error?: string
  toolCalls?: any[]
}

/**
 * UI 优化的流式块事件
 */
export interface UIStreamingChunk {
  streamId: string
  content: string
  delta: string // 新增内容
  timestamp: number
  characterCount: number
  renderHint: {
    contentType: 'text' | 'markdown' | 'code' | 'mixed'
    suggestedDelay: number // 建议的渲染延迟
    priority: 'low' | 'normal' | 'high' | 'urgent'
  }
  performance: {
    networkLatency: number
    processingTime: number
    bufferSize: number
  }
}

/**
 * 渲染更新事件
 */
export interface RenderUpdateEvent {
  streamId: string
  renderStats: {
    fps: number
    averageFrameTime: number
    droppedFrames: number
    totalFramesRendered: number
  }
  bufferStats: {
    size: number
    utilizationPercent: number
    isOverflowing: boolean
  }
  recommendations?: string[]
}

/**
 * 性能警告事件
 */
export interface PerformanceWarningEvent {
  streamId: string
  type: 'fps_drop' | 'high_latency' | 'buffer_overflow' | 'memory_pressure' | 'render_lag'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  metrics: {
    currentValue: number
    threshold: number
    trend: 'improving' | 'stable' | 'degrading'
  }
  timestamp: number
  autoActions?: string[] // 系统自动采取的措施
}

/**
 * 内容解析进度事件
 */
export interface ParsingProgressEvent {
  streamId: string
  totalCharacters: number
  parsedCharacters: number
  progress: number // 0-100
  detectedElements: {
    headings: number
    codeBlocks: number
    lists: number
    links: number
    tables: number
  }
  parsingQuality: 'excellent' | 'good' | 'fair' | 'poor'
  estimatedTimeRemaining?: number
}

/**
 * UI 性能阈值配置
 */
export interface UIPerformanceThresholds {
  maxLatency: number // 最大可接受延迟 (ms)
  minFPS: number // 最小可接受帧率
  maxBufferSize: number // 最大缓冲区大小 (bytes)
  warningLatency: number // 延迟警告阈值 (ms)
}

/**
 * 性能监控器
 */
export interface RenderStats {
  fps: number
  averageFrameTime: number
  droppedFrames: number
  timestamp: number
}

export class PerformanceMonitor {
  private frameTimeHistory: number[] = []
  private lastFrameTime = 0
  private droppedFrames = 0
  private renderCallbacks: ((stats: RenderStats) => void)[] = []
  
  recordFrame(timestamp: number): void {
    if (this.lastFrameTime > 0) {
      const frameTime = timestamp - this.lastFrameTime
      this.frameTimeHistory.push(frameTime)
      
      // 保持最近 60 帧的历史
      if (this.frameTimeHistory.length > 60) {
        this.frameTimeHistory.shift()
      }
      
      // 检测掉帧（假设目标是60fps，16.67ms per frame）
      if (frameTime > 33) { // 超过2帧时间认为掉帧
        this.droppedFrames++
      }
    }
    this.lastFrameTime = timestamp
    
    // 通知监听器
    const stats = this.getCurrentStats(timestamp)
    this.renderCallbacks.forEach(callback => callback(stats))
  }
  
  getCurrentStats(timestamp: number): RenderStats {
    const avgFrameTime = this.frameTimeHistory.length > 0 
      ? this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length
      : 0
    
    return {
      fps: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
      averageFrameTime: avgFrameTime,
      droppedFrames: this.droppedFrames,
      timestamp
    }
  }
  
  onRender(callback: (stats: RenderStats) => void): void {
    this.renderCallbacks.push(callback)
  }
  
  reset(): void {
    this.frameTimeHistory = []
    this.lastFrameTime = 0
    this.droppedFrames = 0
  }
}

/**
 * 流式服务事件
 */
export interface StreamingServiceEvents {
  chunk: [StreamingResponse]
  complete: [StreamingResponse]
  error: [Error]
  
  // UI 专用事件
  uiChunk: [UIStreamingChunk] // 专门为 UI 优化的块事件
  renderUpdate: [RenderUpdateEvent] // 渲染更新事件
  performanceWarning: [PerformanceWarningEvent] // 性能警告事件
  parsingProgress: [ParsingProgressEvent] // 内容解析进度事件
}

/**
 * WriteFlow 流式服务
 */
export class StreamingService extends EventEmitter {
  private modelManager = getModelManager()
  private currentAdapter?: StreamAdapter
  private config: StreamingConfig
  private retryCount = 0
  private isStreaming = false
  
  // UI 增强相关字段
  private currentStreamId?: string
  private streamStartTime = 0
  private lastChunkTime = 0
  private accumulatedContent = ''
  private performanceMonitor: PerformanceMonitor
  private uiThresholds: UIPerformanceThresholds
  
  constructor(config: StreamingConfig = {}) {
    super()
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 60000,
      bufferSize: 8192,
      enableReconnect: true,
      ...config
    }
    
    // 初始化 UI 增强功能
    this.performanceMonitor = new PerformanceMonitor()
    this.uiThresholds = {
      maxLatency: 2000,
      minFPS: 15,
      maxBufferSize: 64 * 1024, // 64KB
      warningLatency: 1000
    }
    
    // 设置性能监控回调
    this.performanceMonitor.onRender((stats) => {
      this.handlePerformanceUpdate(stats)
    })
  }
  
  /**
   * 开始流式请求
   */
  async startStream(request: StreamingRequest): Promise<void> {
    if (this.isStreaming) {
      throw new Error('已有流式请求正在进行中，请先停止当前请求')
    }
    
    this.isStreaming = true
    this.retryCount = 0
    
    // 初始化流式会话
    this.initializeStreamingSession()
    
    await this.attemptStream(request)
  }

  /**
   * 初始化流式会话
   */
  private initializeStreamingSession(): void {
    this.currentStreamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.streamStartTime = Date.now()
    this.lastChunkTime = 0
    this.accumulatedContent = ''
    this.performanceMonitor.reset()
  }

  /**
   * 处理性能更新
   */
  private handlePerformanceUpdate(stats: RenderStats): void {
    if (!this.currentStreamId) return
    
    // 发出渲染更新事件
    const renderUpdate: RenderUpdateEvent = {
      streamId: this.currentStreamId,
      renderStats: {
        fps: stats.fps,
        averageFrameTime: stats.averageFrameTime,
        droppedFrames: stats.droppedFrames,
        totalFramesRendered: 0 // 需要在具体实现中计算
      },
      bufferStats: {
        size: this.accumulatedContent.length,
        utilizationPercent: Math.min(100, (this.accumulatedContent.length / this.uiThresholds.maxBufferSize) * 100),
        isOverflowing: this.accumulatedContent.length > this.uiThresholds.maxBufferSize
      }
    }
    
    this.emit('renderUpdate', renderUpdate)
    
    // 检查性能警告
    this.checkPerformanceWarnings(stats)
  }

  /**
   * 检查性能警告
   */
  private checkPerformanceWarnings(stats: RenderStats): void {
    if (!this.currentStreamId) return
    
    const now = Date.now()
    
    // FPS 过低警告
    if (stats.fps < this.uiThresholds.minFPS) {
      const warning: PerformanceWarningEvent = {
        streamId: this.currentStreamId,
        type: 'fps_drop',
        severity: stats.fps < 10 ? 'critical' : 'warning',
        message: `帧率过低: ${stats.fps.toFixed(1)}fps (目标: ${this.uiThresholds.minFPS}fps)`,
        metrics: {
          currentValue: stats.fps,
          threshold: this.uiThresholds.minFPS,
          trend: this.analyzeTrend(stats.fps, 'fps')
        },
        timestamp: now,
        autoActions: ['降低渲染质量', '增加渲染间隔']
      }
      this.emit('performanceWarning', warning)
    }
    
    // 缓冲区溢出警告
    if (this.accumulatedContent.length > this.uiThresholds.maxBufferSize) {
      const warning: PerformanceWarningEvent = {
        streamId: this.currentStreamId,
        type: 'buffer_overflow',
        severity: 'error',
        message: `缓冲区溢出: ${this.accumulatedContent.length} bytes (最大: ${this.uiThresholds.maxBufferSize})`,
        metrics: {
          currentValue: this.accumulatedContent.length,
          threshold: this.uiThresholds.maxBufferSize,
          trend: 'degrading'
        },
        timestamp: now,
        autoActions: ['清理旧数据', '增加缓冲区大小']
      }
      this.emit('performanceWarning', warning)
    }
  }

  /**
   * 分析趋势
   */
  private analyzeTrend(currentValue: number, metricType: string): 'improving' | 'stable' | 'degrading' {
    // 简化的趋势分析，实际中可以维护历史数据进行更复杂的分析
    return 'stable' // 默认返回稳定
  }
  
  /**
   * 尝试流式请求（支持重试）
   */
  private async attemptStream(request: StreamingRequest): Promise<void> {
    const startTime = Date.now()
    
    try {
      // 获取模型配置
      const modelName = request.model || this.modelManager.getMainAgentModel()
      if (!modelName) {
        throw new Error('没有可用的模型配置')
      }
      
      const capabilities = getModelCapabilities(modelName)
      
      // 检查模型是否支持流式
      if (!capabilities.supportsStreaming || !capabilities.streamingProtocol) {
        throw new Error(`模型 ${modelName} 不支持流式响应`)
      }
      
      // 创建流式适配器
      this.currentAdapter = createStreamAdapterFromModel(modelName, {
        bufferSize: this.config.bufferSize,
        parseStrategy: 'incremental',
        timeout: this.config.timeout
      })
      
      // 设置适配器的流 ID，确保事件关联正确
      if (this.currentAdapter && this.currentStreamId) {
        this.currentAdapter.setStreamId(this.currentStreamId)
      }
      
      // 设置适配器事件监听
      this.setupAdapterListeners(startTime, modelName, request)
      
      // 根据模型能力构建请求
      const apiRequest = await this.buildAPIRequest(request, capabilities)
      
      // 发起 API 请求
      await this.makeStreamingRequest(apiRequest)
      
    } catch (error) {
      await this.handleStreamError(error, request)
    }
  }
  
  /**
   * 处理流式错误
   */
  private async handleStreamError(error: any, request: StreamingRequest): Promise<void> {
    logError('流式请求错误', error)
    
    // 检查是否可以重试
    if (this.config.enableReconnect && 
        this.retryCount < (this.config.maxRetries || 3) && 
        this.isRetryableError(error)) {
      
      this.retryCount++
      const delay = (this.config.retryDelay || 1000) * Math.pow(2, this.retryCount - 1) // 指数退避
      
      console.log(`🔄 流式请求失败，${delay}ms 后进行第 ${this.retryCount} 次重试`)
      
      // 清理当前适配器
      this.cleanup()
      
      // 延时重试
      setTimeout(() => {
        if (this.isStreaming) {
          this.attemptStream(request).catch(() => {
            this.emitFinalError(error)
          })
        }
      }, delay)
      
    } else {
      this.emitFinalError(error)
    }
  }
  
  /**
   * 判断是否为可重试的错误
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || ''
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'socket',
      'econnreset',
      'enotfound',
      'econnrefused',
      '502',
      '503',
      '504'
    ]
    
    return retryableErrors.some(pattern => errorMessage.includes(pattern))
  }
  
  /**
   * 发出最终错误
   */
  private emitFinalError(error: any): void {
    this.isStreaming = false
    this.cleanup()
    this.emit('error', error instanceof Error ? error : new Error(String(error)))
  }
  
  /**
   * 停止当前流式请求
   */
  stopStream(): void {
    this.isStreaming = false
    this.cleanup()
  }
  
  /**
   * 设置适配器事件监听
   */
  private setupAdapterListeners(startTime: number, modelName: string, request: StreamingRequest): void {
    if (!this.currentAdapter) return
    
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let finalUsage: any = null
    
    this.currentAdapter.on('chunk', (chunk: StreamChunk) => {
      const chunkTime = Date.now()
      const previousLength = accumulatedContent.length
      
      accumulatedContent += chunk.content
      accumulatedReasoning += chunk.reasoning || ''
      
      // 更新内部状态
      this.accumulatedContent = accumulatedContent
      
      if (chunk.usage) {
        finalUsage = chunk.usage
      }
      
      // 计算网络延迟
      const networkLatency = this.lastChunkTime > 0 ? chunkTime - this.lastChunkTime : 0
      this.lastChunkTime = chunkTime
      
      // 记录渲染帧（用于性能监控）
      this.performanceMonitor.recordFrame(chunkTime)
      
      if (chunk.error) {
        const response: StreamingResponse = {
          content: accumulatedContent,
          reasoning: accumulatedReasoning || undefined,
          usage: finalUsage || undefined,
          model: modelName,
          done: chunk.done,
          error: chunk.error
        }
        this.handleStreamError(new Error(chunk.error), request)
        return
      }
      
      // 字符级增量发射 - 关键改进：为每个新字符发出 UI 事件
      const newContent = chunk.content
      if (newContent && newContent.length > 0) {
        // 为新增内容的每个字符发出独立的 UI 事件
        this.emitCharacterLevelEvents(
          newContent, 
          accumulatedContent,
          previousLength,
          chunkTime,
          startTime,
          networkLatency
        )
      }
      
      // 创建标准响应（保持兼容性）
      const response: StreamingResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        usage: finalUsage || undefined,
        model: modelName,
        done: chunk.done
      }
      
      // 发出标准块事件（较低频率）
      this.emit('chunk', response)
      
      // 检查是否需要发出解析进度事件
      if (accumulatedContent.length > previousLength + 50) { // 降低到50字符，提高频率
        this.emitParsingProgress(accumulatedContent)
      }
      
      if (chunk.done) {
        response.duration = Date.now() - startTime
        response.cost = this.calculateCost(finalUsage, modelName)
        this.isStreaming = false
        
        // 最终解析进度
        this.emitParsingProgress(accumulatedContent, true)
        
        this.emit('complete', response)
        this.cleanup()
      }
    })
    
    this.currentAdapter.on('error', (error: Error) => {
      this.handleStreamError(error, request)
    })
  }

  /**
   * 检测内容类型
   */
  private detectContentType(content: string): 'text' | 'markdown' | 'code' | 'mixed' {
    if (content.includes('```')) return 'code'
    if (content.includes('#') || content.includes('*') || content.includes('- ')) return 'markdown'
    return 'text'
  }

  /**
   * 计算建议的渲染延迟
   */
  private calculateSuggestedDelay(networkLatency: number): number {
    // 基于网络延迟调整渲染速度
    if (networkLatency < 100) return 10
    if (networkLatency < 500) return 15
    if (networkLatency < 1000) return 25
    return 50
  }

  /**
   * 确定优先级
   */
  private determinePriority(content: string, totalLength: number): 'low' | 'normal' | 'high' | 'urgent' {
    if (content.includes('error') || content.includes('ERROR')) return 'urgent'
    if (content.includes('warning') || content.includes('WARNING')) return 'high'
    if (totalLength < 100) return 'high' // 开始时优先级高
    return 'normal'
  }

  /**
   * 发出解析进度事件
   */
  private emitParsingProgress(content: string, isComplete = false): void {
    if (!this.currentStreamId) return
    
    // 简单的结构化元素计数
    const headings = (content.match(/#{1,6}\s/g) || []).length
    const codeBlocks = (content.match(/```/g) || []).length / 2
    const lists = (content.match(/^[\s]*[-*+]\s/gm) || []).length
    const links = (content.match(/\[.*\]\(.*\)/g) || []).length
    const tables = (content.match(/\|.*\|/g) || []).length
    
    const progress = isComplete ? 100 : Math.min(95, (content.length / 2000) * 100) // 假设2000字符为完整内容
    
    const parsingEvent: ParsingProgressEvent = {
      streamId: this.currentStreamId,
      totalCharacters: content.length,
      parsedCharacters: content.length,
      progress,
      detectedElements: {
        headings,
        codeBlocks: Math.floor(codeBlocks),
        lists,
        links,
        tables
      },
      parsingQuality: this.assessParsingQuality(headings, codeBlocks, lists),
      estimatedTimeRemaining: isComplete ? 0 : this.estimateRemainingTime(progress)
    }
    
    this.emit('parsingProgress', parsingEvent)
  }

  /**
   * 评估解析质量
   */
  private assessParsingQuality(headings: number, codeBlocks: number, lists: number): 'excellent' | 'good' | 'fair' | 'poor' {
    const totalElements = headings + codeBlocks + lists
    if (totalElements >= 10) return 'excellent'
    if (totalElements >= 5) return 'good'
    if (totalElements >= 2) return 'fair'
    return 'poor'
  }

  /**
   * 估算剩余时间
   */
  private estimateRemainingTime(progress: number): number | undefined {
    if (progress <= 0) return undefined
    
    const elapsed = Date.now() - this.streamStartTime
    const estimatedTotal = elapsed / (progress / 100)
    return Math.max(0, estimatedTotal - elapsed)
  }

  /**
   * 发出字符级 UI 事件 - 实现真正的流式渲染
   */
  private emitCharacterLevelEvents(
    newContent: string,
    fullContent: string,
    previousLength: number,
    chunkTime: number,
    startTime: number,
    networkLatency: number
  ): void {
    if (!this.currentStreamId || newContent.length === 0) return

    // 字符级发射策略：
    // 1. 对于短内容（< 10字符），每个字符单独发出
    // 2. 对于中等内容（10-50字符），按2-3个字符为组发出  
    // 3. 对于长内容（> 50字符），按5-8个字符为组发出
    
    let chunkSize = 1 // 默认单字符
    if (newContent.length > 50) {
      chunkSize = Math.min(8, Math.max(5, Math.ceil(newContent.length / 10)))
    } else if (newContent.length > 10) {
      chunkSize = Math.min(3, Math.max(2, Math.ceil(newContent.length / 5)))
    }

    // 分批发出字符级事件
    for (let i = 0; i < newContent.length; i += chunkSize) {
      const characterBatch = newContent.slice(i, i + chunkSize)
      const currentPosition = previousLength + i + characterBatch.length

      // 模拟渐进式时间戳（让UI有时间渲染）
      const syntheticTimestamp = chunkTime + (i / newContent.length) * 10 // 分散在10ms内

      const uiChunk: UIStreamingChunk = {
        streamId: this.currentStreamId,
        content: fullContent.slice(0, currentPosition), // 当前完整内容
        delta: characterBatch, // 本次新增的字符
        timestamp: syntheticTimestamp,
        characterCount: currentPosition,
        renderHint: {
          contentType: this.detectContentType(characterBatch),
          suggestedDelay: this.calculateCharacterDelay(networkLatency, i, newContent.length),
          priority: this.determinePriority(characterBatch, currentPosition)
        },
        performance: {
          networkLatency,
          processingTime: syntheticTimestamp - startTime,
          bufferSize: currentPosition
        }
      }

      // 立即发出 UI 事件
      this.emit('uiChunk', uiChunk)
    }
  }

  /**
   * 计算字符级渲染延迟
   */
  private calculateCharacterDelay(networkLatency: number, characterIndex: number, totalCharacters: number): number {
    // 基础延迟根据网络状况调整
    let baseDelay = 15 // 默认15ms

    if (networkLatency < 100) {
      baseDelay = 8  // 网络快时更快渲染
    } else if (networkLatency < 500) {
      baseDelay = 12
    } else if (networkLatency > 1000) {
      baseDelay = 25 // 网络慢时稍微慢一点
    }

    // 在批次中间的字符渲染更快（模拟打字效果）
    const positionFactor = characterIndex < totalCharacters / 2 ? 0.8 : 1.0
    
    return Math.round(baseDelay * positionFactor)
  }
  
  /**
   * 构建 API 请求参数
   */
  private async buildAPIRequest(request: StreamingRequest, capabilities: any): Promise<any> {
    const modelProfile = this.findModelProfile(request.model)
    if (!modelProfile) {
      throw new Error(`找不到模型配置: ${request.model}`)
    }
    
    const messages = []
    if (request.systemPrompt && capabilities.supportsSystemMessages) {
      if (capabilities.streamingProtocol.format === 'anthropic') {
        // Anthropic 使用单独的 system 字段
        return {
          model: modelProfile.modelName,
          max_tokens: request.maxTokens || modelProfile.maxTokens || 4096,
          temperature: request.temperature || 0.3,
          messages: [{ role: 'user', content: request.prompt }],
          system: request.systemPrompt,
          stream: true
        }
      } else {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
    }
    
    messages.push({ role: 'user', content: request.prompt })
    
    const baseRequest = {
      model: modelProfile.modelName,
      messages,
      max_tokens: request.maxTokens || modelProfile.maxTokens || 4096,
      temperature: request.temperature || 0.3,
      stream: true
    }
    
    // 添加工具调用支持
    if (request.enableToolCalls && request.allowedTools && capabilities.supportsFunctionCalling) {
      // TODO: 实现工具定义转换
      // baseRequest.tools = await this.convertToolsToAPIFormat(request.allowedTools, capabilities.streamingProtocol.format)
    }
    
    return baseRequest
  }
  
  /**
   * 发起流式 API 请求
   */
  private async makeStreamingRequest(apiRequest: any): Promise<void> {
    const modelProfile = this.findModelProfile(apiRequest.model)
    if (!modelProfile) {
      throw new Error(`找不到模型配置: ${apiRequest.model}`)
    }
    
    const apiKey = this.getAPIKey(modelProfile)
    if (!apiKey) {
      throw new Error(`缺少 ${modelProfile.provider} API 密钥`)
    }
    
    const url = this.getAPIURL(modelProfile)
    const headers = this.getAPIHeaders(modelProfile, apiKey)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(apiRequest)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 错误: ${response.status} - ${errorText}`)
      }
      
      if (!response.body) {
        throw new Error('响应体为空')
      }
      
      // 处理流式响应
      await this.processStreamResponse(response.body)
      
    } catch (error) {
      logError('流式请求失败', error)
      throw error
    }
  }
  
  /**
   * 处理流式响应
   */
  private async processStreamResponse(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        
        // 使用适配器处理数据块
        if (this.currentAdapter) {
          this.currentAdapter.processData(chunk)
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
  
  /**
   * 获取 API URL
   */
  private getAPIURL(modelProfile: any): string {
    switch (modelProfile.provider) {
      case 'anthropic':
      case 'bigdream':
        return modelProfile.baseURL || 'https://api.anthropic.com/v1/messages'
      case 'deepseek':
        return modelProfile.baseURL || 'https://api.deepseek.com/chat/completions'
      case 'openai':
        return modelProfile.baseURL || 'https://api.openai.com/v1/chat/completions'
      case 'kimi':
        return modelProfile.baseURL || 'https://api.moonshot.cn/v1/chat/completions'
      default:
        throw new Error(`不支持的提供商: ${modelProfile.provider}`)
    }
  }
  
  /**
   * 获取 API 请求头
   */
  private getAPIHeaders(modelProfile: any, apiKey: string): Record<string, string> {
    const commonHeaders = { 'Content-Type': 'application/json' }
    
    switch (modelProfile.provider) {
      case 'anthropic':
      case 'bigdream':
        return {
          ...commonHeaders,
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      case 'deepseek':
      case 'openai':
      case 'kimi':
        return {
          ...commonHeaders,
          'Authorization': `Bearer ${apiKey}`
        }
      default:
        return commonHeaders
    }
  }
  
  /**
   * 获取 API 密钥
   */
  private getAPIKey(modelProfile: any): string | undefined {
    if (modelProfile.apiKey) {
      return modelProfile.apiKey
    }
    
    const envKeys = {
      anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      bigdream: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      deepseek: ['DEEPSEEK_API_KEY'],
      openai: ['OPENAI_API_KEY'],
      kimi: ['KIMI_API_KEY', 'MOONSHOT_API_KEY']
    }
    
    const keys = envKeys[modelProfile.provider as keyof typeof envKeys] || []
    return keys.map(key => process.env[key]).find(Boolean)
  }
  
  /**
   * 查找模型配置
   */
  private findModelProfile(modelName?: string): any {
    if (!modelName) return null
    
    const profiles = this.modelManager.getAllProfiles()
    return profiles.find(p => p.modelName === modelName || p.name === modelName) || null
  }
  
  /**
   * 计算成本
   */
  private calculateCost(usage: any, modelName: string): number {
    if (!usage) return 0
    
    const capabilities = getModelCapabilities(modelName)
    if (!capabilities.pricing) return 0
    
    const inputTokens = usage.promptTokens || usage.inputTokens || 0
    const outputTokens = usage.completionTokens || usage.outputTokens || 0
    
    return inputTokens * capabilities.pricing.inputCostPerToken + 
           outputTokens * capabilities.pricing.outputCostPerToken
  }
  
  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.currentAdapter) {
      this.currentAdapter.removeAllListeners()
      this.currentAdapter.reset()
      this.currentAdapter = undefined
    }
  }
  
  /**
   * 获取当前流式状态
   */
  getStreamingStatus(): {
    isStreaming: boolean
    retryCount: number
    config: StreamingConfig
  } {
    return {
      isStreaming: this.isStreaming,
      retryCount: this.retryCount,
      config: { ...this.config }
    }
  }
  
  /**
   * 更新流式配置
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前流的 ID
   */
  getCurrentStreamId(): string | undefined {
    return this.currentStreamId
  }

  /**
   * 设置 UI 性能阈值
   */
  setUIThresholds(thresholds: Partial<UIPerformanceThresholds>): void {
    this.uiThresholds = { ...this.uiThresholds, ...thresholds }
  }

  /**
   * 获取当前性能统计
   */
  getCurrentPerformanceStats(): RenderStats | null {
    if (!this.isStreaming) return null
    return this.performanceMonitor.getCurrentStats(Date.now())
  }

  /**
   * 获取流式会话信息
   */
  getSessionInfo(): {
    streamId?: string
    isStreaming: boolean
    startTime: number
    duration: number
    accumulatedLength: number
  } {
    return {
      streamId: this.currentStreamId,
      isStreaming: this.isStreaming,
      startTime: this.streamStartTime,
      duration: this.streamStartTime > 0 ? Date.now() - this.streamStartTime : 0,
      accumulatedLength: this.accumulatedContent.length
    }
  }

  /**
   * 手动触发性能检查
   */
  triggerPerformanceCheck(): void {
    if (this.isStreaming) {
      const stats = this.performanceMonitor.getCurrentStats(Date.now())
      this.checkPerformanceWarnings(stats)
    }
  }
}

// 全局服务实例
let globalStreamingService: StreamingService | null = null

/**
 * 获取全局流式服务实例
 */
export function getStreamingService(config?: StreamingConfig): StreamingService {
  if (!globalStreamingService) {
    globalStreamingService = new StreamingService(config)
  } else if (config) {
    globalStreamingService.updateConfig(config)
  }
  return globalStreamingService
}

/**
 * 快速流式请求函数
 */
export async function streamAI(
  prompt: string, 
  options?: Partial<StreamingRequest>
): Promise<StreamingService> {
  const service = getStreamingService()
  
  await service.startStream({
    prompt,
    ...options
  })
  
  return service
}