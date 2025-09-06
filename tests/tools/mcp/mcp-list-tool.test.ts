import { describe, test, expect } from '@jest/globals'
import { MCPListTool } from '@/tools/system/MCPListTool.js'

describe('MCPListTool', () => {
  test('未配置时给出说明', async () => {
    const tool = new MCPListTool()
    const res = await tool.execute({})
    expect(res.success).toBe(true)
    expect(String(res.content || '')).toContain('未配置')
  })
})

