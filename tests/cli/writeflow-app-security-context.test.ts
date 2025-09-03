import { describe, test, expect, beforeAll } from '@jest/globals'
import { WriteFlowApp } from '@/cli/writeflow-app.js'

// 该测试聚焦：
// 1) 工具执行前的安全门禁能拦截危险工具名
// 2) 执行一次会话后 getSystemStatus 能返回 context 指标

describe('WriteFlowApp 安全门禁与上下文指标（集成冒烟）', () => {
  let app: WriteFlowApp

  beforeAll(async () => {
    app = new WriteFlowApp()
    // 使用默认配置初始化
    await app.initialize()
  })

  test('工具安全门禁：应拦截危险工具调用', async () => {
    // 伪造一个高风险工具名（在安全层中被标记为危险或需要沙箱）
    const result = await app.executeToolWithEvents('system_exec', { cmd: 'rm -rf /' })
    expect(result.success).toBe(false)
    expect(String(result.error || '').length).toBeGreaterThan(0)
  })

  test('上下文指标：getSystemStatus 应包含 context 指标', async () => {
    // 执行一个简单命令，促使 processAIQuery 路径运行并记录用户消息
    const output = await app.executeCommand('/write 测试上下文指标', {})
    expect(typeof output).toBe('string')

    const status = await app.getSystemStatus()
    // 新增的 context 指标应存在（可能为 null，但在完成一次交互后应可用）
    expect(status).toHaveProperty('context')
    // 当 context 存在时，校验其基本结构
    if (status.context) {
      expect(typeof status.context.currentTokens).toBe('number')
      expect(typeof status.context.utilizationRatio).toBe('number')
      // 可选：压缩统计存在
      expect(status.context).toHaveProperty('compressionStats')
    }
  })
})

