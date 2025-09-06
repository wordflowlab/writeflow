/**
 * E2E: 并发工具执行
 * 目标：验证简单工具在并发场景下能稳定执行。
 */
import { describe, test, expect } from '@jest/globals'
import { ToolManager } from '@/tools/tool-manager.js'

describe('E2E: 并发工具执行', () => {
  test('MemoryWrite 并发写入 + MemoryRead 读取', async () => {
    const tm = new ToolManager()
    const N = 8
    const payloads = Array.from({ length: N }, (_, i) => ({ role: 'assistant', content: `msg-${i}` }))

    // 并发写入
    const writes = await Promise.all(payloads.map(p => tm.executeTool('MemoryWrite', p)))
    expect(writes.every(r => r.success)).toBe(true)

    // 读取
    const read = await tm.executeTool('MemoryRead', {})
    expect(read.success).toBe(true)
    // 不强依赖实现细节，只要包含至少一条写入内容的痕迹
    expect(String(read.content || '')).toMatch(/msg-/)
  })
})

