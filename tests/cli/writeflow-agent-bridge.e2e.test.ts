import { describe, test, expect, beforeAll } from '@jest/globals'
import { WriteFlowApp } from '@/cli/writeflow-app.js'

/**
 * 目标：验证当启用 Agent 时，Agent 产出的 prompt 能被主循环发出事件；
 * 同时现有路径不报错；不要求真实工具执行，仅验证桥接触发链路。
 */
describe('nO Agent 桥接（最小闭环）', () => {
  let app: WriteFlowApp
  const events: any[] = []

  beforeAll(async () => {
    process.env.WRITEFLOW_USE_QUEUE = 'true'
    process.env.WRITEFLOW_AGENT_ENABLED = 'true'
    // 仅验证事件，无需把 Agent prompt 自动交给 AI，避免模型配置依赖
    delete process.env.WRITEFLOW_AGENT_PROMPT_TO_AI

    app = new WriteFlowApp()
    app.on('agent-response', (e) => events.push(e))
    app.on('agent-plan', (e) => events.push({ type: 'plan', e }))
    app.on('agent-prompt', (e) => events.push({ type: 'prompt', e }))
    await app.initialize()
  })

  test('触发斜杠命令后，应能收到 Agent 事件（plan 或 prompt）', async () => {
    await app.executeCommand('/outline 最小闭环测试', {})

    // 最多等待 1s 以接收事件
    const start = Date.now()
    while (Date.now() - start < 1000 && events.length === 0) {
      await new Promise(r => setTimeout(r, 50))
    }

    // 至少有一条 Agent 事件
    expect(events.length).toBeGreaterThan(0)
  })
})

