import { describe, test, expect, beforeAll } from '@jest/globals'
import { WriteFlowApp } from '@/cli/writeflow-app.js'

/**
 * 目标：STRICT 模式下，CoreEngineAdapter 不再调用现有执行器，但 Agent 仍会产出 prompt，
 * 并通过拦截触发 exit_plan_mode（工具执行闭环的最小验证）。
 */
describe('nO Agent 严格模式（工具闭环最小验证）', () => {
  let app: WriteFlowApp
  let exitPlanEmitted = false

  beforeAll(async () => {
    process.env.WRITEFLOW_USE_QUEUE = 'true'
    process.env.WRITEFLOW_AGENT_ENABLED = 'true'
    process.env.WRITEFLOW_AGENT_STRICT = 'true'
    delete process.env.WRITEFLOW_AGENT_PROMPT_TO_AI

    app = new WriteFlowApp()
    app.on('exit-plan-mode', () => { exitPlanEmitted = true })
    await app.initialize()
  })

  test('执行 /outline 后应触发 exit_plan_mode 工具', async () => {
    await app.executeCommand('/outline 严格模式测试', {})

    const start = Date.now()
    while (Date.now() - start < 1000 && !exitPlanEmitted) {
      await new Promise(r => setTimeout(r, 50))
    }

    expect(exitPlanEmitted).toBe(true)
  })
})

