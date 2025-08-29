import { describe, test, expect, beforeEach } from '@jest/globals'
import { NOMainAgentEngine } from '@/core/agent/nO-engine.js'
import { H2AAsyncMessageQueue } from '@/core/queue/h2A-queue.js'
import { MessageType, MessagePriority } from '@/types/message.js'
import { AgentState, PlanMode } from '@/types/agent.js'

describe('NOMainAgentEngine', () => {
  let agent: NOMainAgentEngine
  
  beforeEach(() => {
    agent = new NOMainAgentEngine()
  })

  test('应该正确初始化 Agent', () => {
    const context = agent.context
    
    expect(context.currentState).toBe(AgentState.Idle)
    expect(context.planMode).toBe(PlanMode.Default)
    expect(context.sessionId).toMatch(/^session-/)
    expect(context.statistics.messagesProcessed).toBe(0)
  })

  test('应该能发送消息到队列', async () => {
    const message = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'test message',
      MessagePriority.Normal,
      'test'
    )
    
    const result = await agent.sendMessage(message)
    expect(result).toBe(true)
  })

  test('应该能处理斜杠命令消息', async () => {
    const commandMessage = H2AAsyncMessageQueue.createMessage(
      MessageType.SlashCommand,
      '/outline AI技术发展',
      MessagePriority.High,
      'user'
    )
    
    await agent.sendMessage(commandMessage)
    
    const agentStream = agent.run()
    const response = await agentStream.next()
    
    expect(response.done).toBe(false)
    expect(response.value.type).toMatch(/progress|success/)
  })

  test('应该能处理一般查询消息', async () => {
    const queryMessage = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      '请帮我写一篇关于AI的文章',
      MessagePriority.Normal,
      'user'
    )
    
    await agent.sendMessage(queryMessage)
    
    const agentStream = agent.run()
    const response = await agentStream.next()
    
    expect(response.done).toBe(false)
    expect(response.value.content).toBeDefined()
  })

  test('应该正确更新统计信息', async () => {
    const message = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      'test',
      MessagePriority.Normal,
      'user'
    )
    
    await agent.sendMessage(message)
    
    const agentStream = agent.run()
    await agentStream.next()
    
    const stats = agent.context.statistics
    expect(stats.messagesProcessed).toBeGreaterThan(0)
    expect(stats.averageResponseTime).toBeGreaterThan(0)
  })

  test('应该能正确处理错误', async () => {
    // 发送一个会触发错误的消息
    const errorMessage = H2AAsyncMessageQueue.createMessage(
      MessageType.UserInput,
      null, // 无效payload
      MessagePriority.Normal,
      'user'
    )
    
    await agent.sendMessage(errorMessage)
    
    const agentStream = agent.run()
    const response = await agentStream.next()
    
    // 应该返回错误响应或处理错误
    expect(response.value).toBeDefined()
  })

  test('应该能获取健康状态', () => {
    const health = agent.getHealthStatus()
    
    expect(health.healthy).toBe(true)
    expect(health.state).toBe(AgentState.Idle)
    expect(health.queueHealth).toBeDefined()
    expect(health.statistics).toBeDefined()
  })

  test('应该能正确停止', () => {
    agent.stop()
    
    expect(agent.context.currentState).toBe(AgentState.Idle)
  })
})