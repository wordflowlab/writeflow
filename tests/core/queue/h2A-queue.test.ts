import { describe, test, expect, beforeEach } from '@jest/globals'
import { H2AAsyncMessageQueue } from '@/core/queue/h2A-queue.js'
import { MessageType, MessagePriority } from '@/types/message.js'

describe('H2AAsyncMessageQueue', () => {
  let queue: H2AAsyncMessageQueue
  
  beforeEach(() => {
    queue = new H2AAsyncMessageQueue(1000, 800)
  })

  test('应该能创建消息', () => {
    const message = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'test payload',
      MessagePriority.Normal,
      'test'
    )
    
    expect(message.id).toMatch(/^msg-/)
    expect(message.type).toBe(MessageType.UserInput)
    expect(message.payload).toBe('test payload')
    expect(message.priority).toBe(MessagePriority.Normal)
    expect(message.source).toBe('test')
  })

  test('应该能入队和出队消息', async () => {
    const message = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'test content'
    )
    
    const enqueued = queue.enqueue(message)
    expect(enqueued).toBe(true)
    
    const iterator = queue[Symbol.asyncIterator]()
    const result = await iterator.next()
    
    expect(result.done).toBe(false)
    expect(result.value.payload).toBe('test content')
  })

  test('应该按优先级排序消息', async () => {
    const lowPriorityMsg = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'low priority',
      MessagePriority.Low
    )
    
    const highPriorityMsg = H2AAsyncMessageQueue.createMessage(
      MessageType.SystemNotification,
      'high priority', 
      MessagePriority.High
    )
    
    // 先入队低优先级消息
    queue.enqueue(lowPriorityMsg)
    queue.enqueue(highPriorityMsg)
    
    const iterator = queue[Symbol.asyncIterator]()
    
    // 高优先级消息应该先出队
    const firstResult = await iterator.next()
    expect(firstResult.value.payload).toBe('high priority')
    
    const secondResult = await iterator.next() 
    expect(secondResult.value.payload).toBe('low priority')
  })

  test('应该正确处理背压', () => {
    // 填充队列直到触发背压
    for (let i = 0; i < 850; i++) {
      const message = H2AAsyncMessageQueue.createMessage(
        MessageType.UserInput,
        `message ${i}`
      )
      queue.enqueue(message)
    }
    
    const metrics = queue.getMetrics()
    expect(metrics.backpressureActive).toBe(true)
    expect(metrics.queueSize).toBeGreaterThan(800)
  })

  test('应该拒绝超过容量的消息', () => {
    // 填满队列
    for (let i = 0; i < 1000; i++) {
      const message = H2AAsyncMessageQueue.createMessage(
        MessageType.UserInput,
        `message ${i}`
      )
      queue.enqueue(message)
    }
    
    // 尝试添加更多消息应该失败
    const overflowMessage = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'overflow message'
    )
    
    const result = queue.enqueue(overflowMessage)
    expect(result).toBe(false)
  })

  test('应该记录性能指标', async () => {
    const message = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'test'
    )
    
    queue.enqueue(message)
    
    const iterator = queue[Symbol.asyncIterator]()
    await iterator.next()
    
    const metrics = queue.getMetrics()
    expect(metrics.messagesProcessed).toBeGreaterThan(0)
    expect(metrics.averageLatency).toBeGreaterThanOrEqual(0)
  })

  test('应该正确关闭队列', () => {
    queue.close()
    
    expect(() => {
      queue.enqueue(H2AAsyncMessageQueue.createMessage(
        MessageType.UserInput,
        'test'
      ))
    }).toThrow('Queue is closed')
  })

  test('健康状态检查应该工作', () => {
    // 先处理一些消息来提高吞吐量指标
    for (let i = 0; i < 10; i++) {
      const message = H2AAsyncMessageQueue.createMessage(
        MessageType.UserInput,
        `test message ${i}`
      )
      queue.enqueue(message)
    }
    
    const health = queue.getHealthStatus()
    console.log('Health check result:', health) // 添加调试信息
    expect(health.healthy).toBe(true)
    expect(health.issues).toHaveLength(0)
    expect(health.metrics).toBeDefined()
  })
})