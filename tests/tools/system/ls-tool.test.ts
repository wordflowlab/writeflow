import { describe, test, expect } from '@jest/globals'
import { LsTool } from '@/tools/system/LsTool.js'
import fs from 'fs/promises'
import path from 'path'

describe('LsTool', () => {
  test('列出目录内容', async () => {
    const tool = new LsTool()
    const dir = path.join(process.cwd(), 'tests', 'tmp', 'ls')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'x.txt'), 'x', 'utf-8')

    const res = await tool.execute({ dir })
    expect(res.success).toBe(true)
    expect(String(res.content || '')).toContain('x.txt')
  })
})

