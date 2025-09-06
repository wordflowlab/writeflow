import { describe, test, expect } from '@jest/globals'
import { ThinkingExtractTool } from '@/tools/system/ThinkingExtractTool.js'

describe('ThinkingExtractTool', () => {
  test('提取 <thinking> 片段', async () => {
    const tool = new ThinkingExtractTool()
    const text = 'Intro\n<thinking>这里是思维链</thinking>\n正文'
    const res = await tool.execute({ text })
    expect(res.success).toBe(true)
    expect(String(res.content || '')).toContain('思考片段')
    expect(String(res.content || '')).toContain('这里是思维链')
  })

  test('未找到时提示', async () => {
    const tool = new ThinkingExtractTool()
    const res = await tool.execute({ text: '无思维链' })
    expect(res.success).toBe(true)
    expect(String(res.content || '')).toContain('未找到')
  })
})

