/**
 * E2E: MultiEdit 复杂链路
 * 目标：在真实文件上执行多个替换操作，并用 Read 校验结果
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import path from 'path'
import fs from 'fs/promises'
import { ToolManager } from '@/tools/tool-manager.js'

const tmpRoot = path.join(process.cwd(), 'tests', 'tmp', 'e2e-multiedit')
const target = path.join(tmpRoot, 'doc.txt')

describe('E2E: MultiEdit 复杂链路', () => {
  beforeAll(async () => {
    await fs.mkdir(tmpRoot, { recursive: true })
    await fs.writeFile(target, 'alpha\nbeta\ngamma\nalpha beta gamma\n', 'utf-8')
  })

  afterAll(async () => {
    try { await fs.rm(tmpRoot, { recursive: true, force: true }) } catch {}
  })

  test('多次替换 + 读取校验', async () => {
    const tm = new ToolManager()

    // 1) 先读取，确保文件存在
    const before = await tm.executeTool('Read', { file_path: target })
    expect(before.success).toBe(true)
    expect(String(before.content || '')).toMatch(/alpha/)

    // 2) 执行 MultiEdit
    const edits = [
      { old_string: 'alpha', new_string: 'ALPHA', replace_all: true },
      { old_string: 'beta', new_string: 'BETA', replace_all: false },
      { old_string: 'gamma', new_string: 'GAMMA', replace_all: true },
    ]
    const editRes = await tm.executeTool('MultiEdit', { file_path: target, edits })
    expect(editRes.success).toBe(true)
    expect(String(editRes.content || '')).toContain('成功执行')

    // 3) 再读取，检查结果
    const after = await tm.executeTool('Read', { file_path: target })
    expect(after.success).toBe(true)
    const text = String(after.content || '')
    expect(text).toMatch(/ALPHA/)
    expect(text).toMatch(/BETA/) // 只替换一次，但末行应包含 BETA
    expect(text).toMatch(/GAMMA/)
  })
})

