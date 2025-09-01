import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ShortTermMemory, TokenCalculator } from '@/tools/memory/ShortTermMemory.js'
import { Message, CompressionThreshold } from '@/types/Memory.js'

describe('ShortTermMemory 短期记忆测试', () => {
  let shortTermMemory: ShortTermMemory
  let testSessionId: string
  let testMemoryDir: string

  beforeEach(() => {
    testSessionId = `test-memory-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    shortTermMemory = new ShortTermMemory(testSessionId)
    
    process.env.WRITEFLOW_CONFIG_DIR = path.join(os.tmpdir(), 'writeflow-test')
    testMemoryDir = path.join(os.tmpdir(), 'writeflow-test', 'memory', 'short-term')
  })

  afterEach(async () => {
    try {
      const stats = shortTermMemory.getStats()
      if (fs.existsSync(stats.storagePath)) {
        fs.unlinkSync(stats.storagePath)
      }
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('TokenCalculator Token计算工具测试', () => {
    test('应该正确估算英文Token', () => {
      const englishText = 'Hello world, this is a test message'
      const tokens = TokenCalculator.estimateTokens(englishText)
      
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(20) // 大约8-10个tokens
    })

    test('应该正确估算中文Token', () => {
      const chineseText = '你好世界，这是一个测试消息'
      const tokens = TokenCalculator.estimateTokens(chineseText)
      
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeGreaterThan(TokenCalculator.estimateTokens('Hello world')) // 中文占用更多
    })

    test('应该正确获取上下文限制和压缩阈值', () => {
      const contextLimit = TokenCalculator.getContextLimit()
      const compressionThreshold = TokenCalculator.getCompressionThreshold()
      
      expect(contextLimit).toBe(200000)
      expect(compressionThreshold).toBe(Math.floor(200000 * 0.9))
    })
  })

  describe('ShortTermMemory 基础存储功能测试', () => {
    test('应该正确创建存储目录', () => {
      expect(fs.existsSync(testMemoryDir)).toBe(true)
      
      const stats = shortTermMemory.getStats()
      expect(stats.sessionId).toBe(testSessionId)
      expect(stats.storagePath).toMatch(new RegExp(`${testSessionId}-messages\\.json$`))
    })

    test('应该正确加载空的消息列表', async () => {
      const messages = await shortTermMemory.loadMessages()
      
      expect(Array.isArray(messages)).toBe(true)
      expect(messages.length).toBe(0)
    })

    test('应该正确添加和保存消息', async () => {
      const message = await shortTermMemory.addMessage('user', '测试消息')
      
      expect(message.role).toBe('user')
      expect(message.content).toBe('测试消息')
      expect(message.id).toMatch(/^msg-\d+-\w+$/)
      expect(message.tokens).toBeGreaterThan(0)
      expect(message.timestamp).toBeInstanceOf(Date)
    })

    test('应该正确添加带元数据的消息', async () => {
      const metadata = { source: 'test', priority: 'high' }
      const message = await shortTermMemory.addMessage('assistant', 'AI响应', metadata)
      
      expect(message.metadata).toEqual(metadata)
    })
  })

  describe('ShortTermMemory 消息管理测试', () => {
    beforeEach(async () => {
      // 添加测试数据
      await shortTermMemory.addMessage('user', '第一条用户消息')
      await shortTermMemory.addMessage('assistant', '第一条AI响应')
      await shortTermMemory.addMessage('user', '第二条用户消息')
      await shortTermMemory.addMessage('system', '系统消息')
    })

    test('应该正确获取最近的消息', async () => {
      const recentMessages = await shortTermMemory.getRecentMessages(2)
      
      expect(recentMessages.length).toBe(2)
      expect(recentMessages[0].content).toBe('第二条用户消息')
      expect(recentMessages[1].content).toBe('系统消息')
    })

    test('应该正确计算总Token数', async () => {
      const totalTokens = await shortTermMemory.getTotalTokens()
      
      expect(totalTokens).toBeGreaterThan(0)
    })

    test('应该正确根据ID获取消息', async () => {
      const allMessages = await shortTermMemory.getRecentMessages()
      const firstMessage = allMessages[0]
      
      const foundMessage = await shortTermMemory.getMessageById(firstMessage.id)
      
      expect(foundMessage).not.toBeNull()
      expect(foundMessage!.id).toBe(firstMessage.id)
      expect(foundMessage!.content).toBe(firstMessage.content)
    })

    test('应该正确根据角色过滤消息', async () => {
      const userMessages = await shortTermMemory.getMessagesByRole('user')
      const assistantMessages = await shortTermMemory.getMessagesByRole('assistant')
      const systemMessages = await shortTermMemory.getMessagesByRole('system')
      
      expect(userMessages.length).toBe(2)
      expect(assistantMessages.length).toBe(1)
      expect(systemMessages.length).toBe(1)
      
      userMessages.forEach(msg => expect(msg.role).toBe('user'))
      assistantMessages.forEach(msg => expect(msg.role).toBe('assistant'))
      systemMessages.forEach(msg => expect(msg.role).toBe('system'))
    })

    test('应该正确根据时间范围过滤消息', async () => {
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
      const oneMinuteLater = new Date(now.getTime() + 60 * 1000)
      
      const messagesInRange = await shortTermMemory.getMessagesByTimeRange(oneMinuteAgo, oneMinuteLater)
      
      expect(messagesInRange.length).toBe(4) // 所有消息都在时间范围内
    })
  })

  describe('ShortTermMemory 压缩检查测试', () => {
    test('应该正确检查压缩需求 - Token阈值', async () => {
      // 添加大量消息模拟超出Token限制
      const longMessage = 'a'.repeat(50000) // 创建长消息
      for (let i = 0; i < 5; i++) {
        await shortTermMemory.addMessage('user', longMessage)
      }
      
      const compressionCheck = await shortTermMemory.checkCompressionNeeded()
      
      expect(compressionCheck.currentTokens).toBeGreaterThan(1000)
      expect(compressionCheck.threshold).toBe(TokenCalculator.getCompressionThreshold())
      expect(typeof compressionCheck.needed).toBe('boolean')
    })

    test('应该正确获取最旧的消息', async () => {
      await shortTermMemory.addMessage('user', '最旧消息')
      await new Promise(resolve => setTimeout(resolve, 10)) // 确保时间差
      await shortTermMemory.addMessage('user', '较新消息')
      
      const oldestMessages = await shortTermMemory.getOldestMessages(1)
      
      expect(oldestMessages.length).toBe(1)
      expect(oldestMessages[0].content).toBe('最旧消息')
    })

    test('应该正确删除指定消息', async () => {
      const message1 = await shortTermMemory.addMessage('user', '消息1')
      const message2 = await shortTermMemory.addMessage('user', '消息2')
      
      await shortTermMemory.removeMessages([message1.id])
      
      const remainingMessages = await shortTermMemory.getRecentMessages()
      expect(remainingMessages.length).toBe(1)
      expect(remainingMessages[0].id).toBe(message2.id)
    })
  })

  describe('ShortTermMemory 数据持久化测试', () => {
    test('应该正确清空所有消息', async () => {
      await shortTermMemory.addMessage('user', '测试消息1')
      await shortTermMemory.addMessage('user', '测试消息2')
      
      await shortTermMemory.clearAllMessages()
      
      const messages = await shortTermMemory.getRecentMessages()
      expect(messages.length).toBe(0)
    })

    test('应该在重新创建实例后保持数据', async () => {
      await shortTermMemory.addMessage('user', '持久化测试消息')
      
      // 创建新实例（相同会话ID）
      const newInstance = new ShortTermMemory(testSessionId)
      const messages = await newInstance.getRecentMessages()
      
      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('持久化测试消息')
    })

    test('应该正确隔离不同会话的数据', async () => {
      await shortTermMemory.addMessage('user', '会话1消息')
      
      // 创建不同会话的实例
      const differentSessionId = `different-${testSessionId}`
      const differentSession = new ShortTermMemory(differentSessionId)
      
      const session1Messages = await shortTermMemory.getRecentMessages()
      const session2Messages = await differentSession.getRecentMessages()
      
      expect(session1Messages.length).toBe(1)
      expect(session2Messages.length).toBe(0)
      
      // 在第二个会话添加消息
      await differentSession.addMessage('user', '会话2消息')
      
      const updatedSession1Messages = await shortTermMemory.getRecentMessages()
      const updatedSession2Messages = await differentSession.getRecentMessages()
      
      expect(updatedSession1Messages.length).toBe(1)
      expect(updatedSession2Messages.length).toBe(1)
      expect(updatedSession1Messages[0].content).toBe('会话1消息')
      expect(updatedSession2Messages[0].content).toBe('会话2消息')
    })
  })

  describe('ShortTermMemory 错误处理测试', () => {
    test('应该正确处理不存在的消息ID', async () => {
      const foundMessage = await shortTermMemory.getMessageById('non-existent-id')
      expect(foundMessage).toBeNull()
    })

    test('应该正确处理空时间范围查询', async () => {
      const now = new Date()
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 明天
      const farFuture = new Date(now.getTime() + 48 * 60 * 60 * 1000) // 后天
      
      const messagesInRange = await shortTermMemory.getMessagesByTimeRange(future, farFuture)
      expect(messagesInRange.length).toBe(0)
    })

    test('应该正确处理无效的消息删除', async () => {
      // 删除不存在的消息ID不应该抛出错误
      await shortTermMemory.removeMessages(['non-existent-1', 'non-existent-2'])
      
      const messages = await shortTermMemory.getRecentMessages()
      expect(Array.isArray(messages)).toBe(true)
    })
  })

  describe('ShortTermMemory 统计信息测试', () => {
    test('应该正确返回统计信息', async () => {
      await shortTermMemory.addMessage('user', '统计测试消息')
      
      const stats = shortTermMemory.getStats()
      
      expect(stats.sessionId).toBe(testSessionId)
      expect(stats.storagePath).toContain(testSessionId)
      expect(typeof stats.messageCount).toBe('number')
      expect(typeof stats.totalTokens).toBe('number')
    })
  })
})