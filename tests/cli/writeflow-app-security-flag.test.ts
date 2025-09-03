import { describe, test, expect, beforeAll } from '@jest/globals'
import { WriteFlowApp } from '@/cli/writeflow-app.js'

// 验证安全门禁开关 WRITEFLOW_SECURITY_ENABLED 的行为

describe('WriteFlowApp 安全开关（WRITEFLOW_SECURITY_ENABLED）', () => {
  let app: WriteFlowApp

  beforeAll(async () => {
    process.env.WRITEFLOW_SECURITY_ENABLED = 'false'
    app = new WriteFlowApp()
    await app.initialize()
  })

  test('关闭安全开关时，不应拦截（返回值由具体工具决定，这里验证不被安全层拦截）', async () => {
    const res = await app.executeToolWithEvents('system_exec', { cmd: 'echo 1' })
    // 安全层未介入，可能报错也可能成功，这里只断言没有“安全策略拒绝”的固定错误
    expect(String(res.error || '')).not.toMatch(/安全校验未通过|安全策略拒绝/)
  })
})

