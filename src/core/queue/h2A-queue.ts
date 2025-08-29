import { Message, MessageType, QueueMetrics } from '@/types/message.js'

/**
 * h2A 双缓冲异步消息队列
 * 复刻 Claude Code 的核心消息队列架构
 * 
 * 核心特性：
 * - 零延迟消息传递（直接传递给等待的读取者）
 * - 双缓冲背压处理机制
 * - 高吞吐量设计目标（>10,000 msg/sec）
 * - 优先级队列支持
 */
export class H2AAsyncMessageQueue {
  private primaryBuffer: Message[] = []
  private secondaryBuffer: Message[] = []
  private readResolve: ((value: IteratorResult<Message>) => void) | null = null
  private isProcessing = false
  private closed = false
  
  // 性能监控
  private throughputMetrics = {
    messagesPerSecond: 0,
    lastSecondCount: 0,
    currentSecond: Math.floor(Date.now() / 1000),
    totalProcessed: 0,
    latencySum: 0,
    latencyCount: 0
  }

  constructor(
    private maxBufferSize: number = 10000,
    private backpressureThreshold: number = 8000
  ) {}

  /**
   * 核心异步迭代器
   * 实现零延迟消息传递机制
   */
  async *[Symbol.asyncIterator](): AsyncIterator<Message> {
    while (!this.closed) {
      // 检查主缓冲区
      if (this.primaryBuffer.length > 0) {
        const message = this.primaryBuffer.shift()!
        this.recordThroughputAndLatency(message)
        yield message
        continue
      }

      // 检查副缓冲区
      if (this.secondaryBuffer.length > 0) {
        // 将副缓冲区内容移到主缓冲区
        this.primaryBuffer = [...this.secondaryBuffer]
        this.secondaryBuffer = []
        continue
      }

      // 等待新消息（异步阻塞）
      try {
        const message = await new Promise<Message>((resolve) => {
          this.readResolve = (result) => {
            if (!result.done && result.value) {
              resolve(result.value)
            }
          }
        })
        
        this.recordThroughputAndLatency(message)
        yield message
      } catch (error) {
        if (!this.closed) {
          throw error
        }
        break
      }
    }
  }

  /**
   * 零延迟消息入队
   * Claude Code 架构的核心优势
   */
  enqueue(message: Message): boolean {
    if (this.closed) {
      throw new Error('Queue is closed')
    }

    // 策略1: 零延迟路径 - 直接传递给等待的读取者
    if (this.readResolve && !this.isProcessing) {
      this.readResolve({ done: false, value: message })
      this.readResolve = null
      return true
    }

    // 策略2: 缓冲路径 - 检查容量
    if (this.primaryBuffer.length >= this.maxBufferSize) {
      return false // 队列满，拒绝消息
    }

    // 按优先级插入到合适位置
    this.insertByPriority(message)
    
    // 背压处理
    if (this.primaryBuffer.length > this.backpressureThreshold) {
      this.triggerBackpressure()
    }

    return true
  }

  /**
   * 按优先级插入消息
   */
  private insertByPriority(message: Message): void {
    let insertIndex = this.primaryBuffer.length
    
    // 从后往前找到正确的插入位置（高优先级在前）
    for (let i = this.primaryBuffer.length - 1; i >= 0; i--) {
      if (this.primaryBuffer[i].priority >= message.priority) {
        insertIndex = i + 1
        break
      }
      insertIndex = i
    }
    
    this.primaryBuffer.splice(insertIndex, 0, message)
  }

  /**
   * 背压处理机制
   * 当主缓冲区接近满载时，启用副缓冲区
   */
  private triggerBackpressure(): void {
    if (this.secondaryBuffer.length === 0) {
      // 将一半消息移到副缓冲区
      const moveCount = Math.floor(this.backpressureThreshold / 2)
      this.secondaryBuffer = this.primaryBuffer.splice(moveCount)
      
      console.warn(`[h2A] 背压触发: 移动 ${moveCount} 个消息到副缓冲区`)
    }
  }

  /**
   * 记录吞吐量和延迟指标
   */
  private recordThroughputAndLatency(message: Message): void {
    const currentSecond = Math.floor(Date.now() / 1000)
    const latency = Date.now() - message.timestamp
    
    // 更新延迟统计
    this.throughputMetrics.latencySum += latency
    this.throughputMetrics.latencyCount++
    
    // 更新吞吐量统计
    if (currentSecond !== this.throughputMetrics.currentSecond) {
      this.throughputMetrics.messagesPerSecond = this.throughputMetrics.lastSecondCount
      this.throughputMetrics.lastSecondCount = 1
      this.throughputMetrics.currentSecond = currentSecond
    } else {
      this.throughputMetrics.lastSecondCount++
    }
    
    this.throughputMetrics.totalProcessed++
  }

  /**
   * 获取队列性能指标
   */
  getMetrics(): QueueMetrics {
    const avgLatency = this.throughputMetrics.latencyCount > 0 
      ? this.throughputMetrics.latencySum / this.throughputMetrics.latencyCount 
      : 0

    return {
      queueSize: this.primaryBuffer.length + this.secondaryBuffer.length,
      throughput: this.throughputMetrics.messagesPerSecond,
      backpressureActive: this.primaryBuffer.length > this.backpressureThreshold,
      averageLatency: Math.round(avgLatency),
      messagesProcessed: this.throughputMetrics.totalProcessed
    }
  }

  /**
   * 创建消息的工厂方法
   */
  static createMessage(
    type: MessageType,
    payload: any,
    priority: number = 50,
    source: string = 'unknown'
  ): Message {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      priority,
      timestamp: Date.now(),
      source
    }
  }

  /**
   * 关闭队列
   */
  close(): void {
    this.closed = true
    if (this.readResolve) {
      this.readResolve({ done: true, value: undefined })
      this.readResolve = null
    }
  }

  /**
   * 检查队列健康状态
   */
  getHealthStatus(): {
    healthy: boolean
    issues: string[]
    metrics: QueueMetrics
  } {
    const metrics = this.getMetrics()
    const issues: string[] = []
    
    if (metrics.queueSize > this.maxBufferSize * 0.9) {
      issues.push('队列接近满载')
    }
    
    if (metrics.throughput < 1000) {
      issues.push('吞吐量低于预期')
    }
    
    if (metrics.averageLatency > 100) {
      issues.push('平均延迟过高')
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics
    }
  }
}