// Jest 测试环境设置
import { jest } from '@jest/globals'

// 模拟 Node.js 环境变量
process.env.NODE_ENV = 'test'
process.env.WRITEFLOW_HOME = '/tmp/writeflow-test'

// 声明全局测试工具类型
declare global {
  var mockMessage: (payload: any) => {
    id: string
    type: string
    priority: number
    payload: any
    timestamp: number
    source: string
  }
}

// 全局测试工具
(globalThis as any).mockMessage = (payload: any) => ({
  id: `msg-${Date.now()}`,
  type: 'user_input',
  priority: 10,
  payload,
  timestamp: Date.now(),
  source: 'test'
})