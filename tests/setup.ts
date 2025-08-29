// Jest 测试环境设置
import { jest } from '@jest/globals'

// 模拟 Node.js 环境变量
process.env.NODE_ENV = 'test'
process.env.WRITEFLOW_HOME = '/tmp/writeflow-test'

// 模拟 Anthropic API
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'Mock AI response' }],
        usage: { output_tokens: 100 }
      })
    }
  }))
}))

// 全局测试工具
global.mockMessage = (payload: any) => ({
  id: `msg-${Date.now()}`,
  type: 'user_input',
  priority: 10,
  payload,
  timestamp: Date.now(),
  source: 'test'
})