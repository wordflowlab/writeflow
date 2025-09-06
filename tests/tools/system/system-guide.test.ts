import { describe, test, expect } from '@jest/globals'
import { loadProjectGuide } from '@/config/AIConfigLoader.ts'

describe('Default System Guide', () => {
  test('should include tool-first guidance and fallback markup', async () => {
    const guide = await loadProjectGuide(process.cwd())
    // 基本身份与章节
    expect(guide).toContain('WriteFlow AI 助手指导')
    expect(guide).toContain('工具优先')
    // 函数调用与传统回退
    expect(guide).toMatch(/<function_calls>[\s\S]*?<invoke name="TodoWrite">/)
    expect(guide).toMatch(/<function_calls>[\s\S]*?<invoke name="TodoRead">/)
    // 提示 thinking 约束
    expect(guide).toMatch(/<thinking>.*<\/thinking>/)
    // MCP 提示
    expect(guide).toMatch(/mcpServers|MCP/)
  })
})

