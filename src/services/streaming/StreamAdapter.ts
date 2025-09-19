import { EventEmitter } from 'events'

/**
 * 流式数据块
 */
export interface StreamChunk {
  /** 增量文本内容 */
  content: string
  /** 是否为流结束标识 */
  done: boolean
  /** 原始响应数据 */
  raw?: any
  /** 推理内容（如 DeepSeek reasoning_content） */
  reasoning?: string
  /** 错误信息 */
  error?: string
  /** 使用统计信息 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * 流式适配器配置
 */
export interface StreamAdapterConfig {
  /** 缓冲区大小 */
  bufferSize: number
  /** 重连尝试次数 */
  reconnectAttempts: number
  /** 解析策略 */
  parseStrategy: 'incremental' | 'buffered'
  /** 超时设置（毫秒） */
  timeout: number
}

/**
 * UI 特定的流式事件
 */
export interface UIStreamChunk {
  streamId: string
  content: string
  delta: string // 本次新增内容
  timestamp: number
  characterCount: number
  renderHint: {
    contentType: 'text' | 'markdown' | 'code' | 'mixed'
    suggestedDelay: number
    priority: 'low' | 'normal' | 'high' | 'urgent'
  }
  performance: {
    networkLatency: number
    processingTime: number
    bufferSize: number
  }
}

/**
 * 流式适配器事件
 */
export interface StreamAdapterEvents {
  /** 接收到数据块 */
  chunk: (chunk: StreamChunk) => void
  /** 流结束 */
  end: () => void
  /** 发生错误 */
  error: (error: Error) => void
  /** 连接状态变化 */
  connectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void
  /** UI 优化的字符级事件 */
  uiChunk: (chunk: UIStreamChunk) => void
  /** 原始数据接收事件（用于调试） */
  rawData: (data: string) => void
}

/**
 * 统一流式适配器接口
 * 
 * 所有厂商的流式适配器都需要实现这个接口
 * 负责将各厂商的 SSE 协议统一为标准的 StreamChunk 格式
 */
export abstract class StreamAdapter extends EventEmitter {
  protected config: StreamAdapterConfig
  protected buffer: string = ''
  protected isConnected: boolean = false
  
  // UI 增强字段
  protected streamId: string = ''
  protected accumulatedContent: string = ''
  protected startTime: number = 0
  protected lastChunkTime: number = 0
  
  constructor(config: Partial<StreamAdapterConfig> = {}) {
    super()
    
    this.config = {
      bufferSize: 8192,
      reconnectAttempts: 3,
      parseStrategy: 'incremental',
      timeout: 30000,
      ...config
    }
    
    // 初始化流 ID
    this.streamId = `adapter_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    this.startTime = Date.now()
  }

  /**
   * 解析原始 SSE 数据流
   * 
   * @param data 原始数据
   */
  abstract parseStream(data: string): StreamChunk[]

  /**
   * 检查是否为流结束标识
   * 
   * @param data 原始数据
   */
  abstract isStreamEnd(data: string): boolean

  /**
   * 处理连接错误
   * 
   * @param error 错误信息
   */
  protected handleError(error: Error): void {
    this.emit('error', error)
  }

  /**
   * 处理数据块
   * 
   * @param rawData 原始数据
   */
  public processData(rawData: string): void {
    try {
      // 发出原始数据事件（用于调试）
      this.emit('rawData', rawData)
      
      this.buffer += rawData
      
      if (this.config.parseStrategy === 'incremental') {
        this.processIncremental()
      } else {
        this.processBuffered()
      }
    } catch (_error) {
      this.handleError(_error as Error)
    }
  }

  /**
   * 增量处理模式
   */
  private processIncremental(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || '' // 保留未完成的行
    
    for (const line of lines) {
      if (line.trim()) {
        if (this.isStreamEnd(line)) {
          this.emit('end')
          return
        }
        
        const chunks = this.parseStream(line)
        chunks.forEach(chunk => {
          // 发出标准块事件
          this.emit('chunk', chunk)
          
          // 发出 UI 优化事件
          this.emitUIChunk(chunk)
        })
      }
    }
  }

  /**
   * 缓冲处理模式
   */
  private processBuffered(): void {
    if (this.buffer.length > this.config.bufferSize) {
      const chunks = this.parseStream(this.buffer)
      chunks.forEach(chunk => this.emit('chunk', chunk))
      this.buffer = ''
    }
  }

  /**
   * 发出 UI 优化的块事件
   */
  private emitUIChunk(chunk: StreamChunk): void {
    if (!chunk.content) return
    
    const now = Date.now()
    const previousLength = this.accumulatedContent.length
    this.accumulatedContent += chunk.content
    
    // 计算网络延迟
    const networkLatency = this.lastChunkTime > 0 ? now - this.lastChunkTime : 0
    this.lastChunkTime = now
    
    const uiChunk: UIStreamChunk = {
      streamId: this.streamId,
      content: this.accumulatedContent,
      delta: chunk.content,
      timestamp: now,
      characterCount: this.accumulatedContent.length,
      renderHint: {
        contentType: this.detectContentType(chunk.content),
        suggestedDelay: this.calculateRenderDelay(networkLatency, chunk.content.length),
        priority: this.determinePriority(chunk.content)
      },
      performance: {
        networkLatency,
        processingTime: now - this.startTime,
        bufferSize: this.buffer.length
      }
    }
    
    this.emit('uiChunk', uiChunk)
  }

  /**
   * 检测内容类型
   */
  private detectContentType(content: string): 'text' | 'markdown' | 'code' | 'mixed' {
    if (content.includes('```') || content.includes('function') || content.includes('const ')) {
      return 'code'
    }
    if (content.includes('#') || content.includes('**') || content.includes('*') || content.includes('- ')) {
      return 'markdown'
    }
    return 'text'
  }

  /**
   * 计算渲染延迟
   */
  private calculateRenderDelay(networkLatency: number, contentLength: number): number {
    let baseDelay = 20 // 基础20ms
    
    // 根据网络延迟调整
    if (networkLatency < 100) {
      baseDelay = 10
    } else if (networkLatency > 1000) {
      baseDelay = 40
    }
    
    // 根据内容长度微调
    if (contentLength < 5) {
      baseDelay *= 0.8
    } else if (contentLength > 50) {
      baseDelay *= 1.2
    }
    
    return Math.round(baseDelay)
  }

  /**
   * 确定内容优先级
   */
  private determinePriority(content: string): 'low' | 'normal' | 'high' | 'urgent' {
    if (content.toLowerCase().includes('error') || content.toLowerCase().includes('failed')) {
      return 'urgent'
    }
    if (content.toLowerCase().includes('warning') || content.toLowerCase().includes('注意')) {
      return 'high'
    }
    if (content.length < 10) {
      return 'high' // 短内容优先显示
    }
    return 'normal'
  }

  /**
   * 重置适配器状态
   */
  public reset(): void {
    this.buffer = ''
    this.isConnected = false
    this.accumulatedContent = ''
    this.startTime = Date.now()
    this.lastChunkTime = 0
  }

  /**
   * 获取适配器状态信息
   */
  public getStatus(): {
    connected: boolean
    bufferSize: number
    config: StreamAdapterConfig
    streamId: string
    accumulatedLength: number
    duration: number
  } {
    return {
      connected: this.isConnected,
      bufferSize: this.buffer.length,
      config: this.config,
      streamId: this.streamId,
      accumulatedLength: this.accumulatedContent.length,
      duration: Date.now() - this.startTime
    }
  }

  /**
   * 获取当前流 ID
   */
  public getStreamId(): string {
    return this.streamId
  }

  /**
   * 设置流 ID（供外部服务使用）
   */
  public setStreamId(streamId: string): void {
    this.streamId = streamId
  }
}

/**
 * 厂商类型枚举
 */
export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic', 
  DEEPSEEK = 'deepseek',
  GEMINI = 'gemini',
  ZHIPU = 'zhipu',
  KIMI = 'kimi',
  QWEN = 'qwen'
}

/**
 * 适配器工厂接口
 */
export interface AdapterFactory {
  create(provider: ProviderType, config?: Partial<StreamAdapterConfig>): StreamAdapter
}