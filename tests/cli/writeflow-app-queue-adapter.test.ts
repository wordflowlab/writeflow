import { describe, test, expect, beforeAll } from '@jest/globals'
import { WriteFlowApp } from '@/cli/writeflow-app.js'

// 验证 WRITEFLOW_USE_QUEUE 开启后，h2aQueue 指标会推进

describe('WriteFlowApp 队列适配器（CoreEngineAdapter）', () => {
  let app: WriteFlowApp

  beforeAll(async () => {
    process.env.WRITEFLOW_USE_QUEUE = 'true'
    app = new WriteFlowApp()
    await app.initialize()
  })

  test('执行命令后，h2aQueue 指标应出现处理量', async () => {
    const before = await app.getSystemStatus()

    // 执行简单命令，推入 SlashCommand
    await app.executeCommand('/write 队列检查', {})

    // 轮询等待指标推进（最长期待 1s）
    const start = Date.now()
    let processed = 0
    while (Date.now() - start < 1000) {
      const st = await app.getSystemStatus()
      processed = st.h2aQueue?.messagesProcessed || 0
      if (processed > (before.h2aQueue?.messagesProcessed || 0)) break
      await new Promise(r => setTimeout(r, 50))
    }

    expect(processed).toBeGreaterThan((before.h2aQueue?.messagesProcessed || 0))
  })
})

