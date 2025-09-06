/**
 * E2E: 错误恢复场景
 * 目标：模拟工具失败后，能够采取替代路径完成目标。
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import path from 'path'
import fs from 'fs/promises'
import { ToolManager } from '@/tools/tool-manager.js'

const tmpRoot = path.join(process.cwd(), 'tests', 'tmp', 'e2e-recovery')

describe('E2E: 错误恢复场景（Ls 失败→切换到正确目录）', () => {
  beforeAll(async () => {
    await fs.mkdir(tmpRoot, { recursive: true })
    await fs.writeFile(path.join(tmpRoot, 'foo.txt'), 'foo', 'utf-8')
  })

  afterAll(async () => {
    try { await fs.rm(tmpRoot, { recursive: true, force: true }) } catch {}
  })

  test('错误恢复：先失败再成功', async () => {
    const tm = new ToolManager()

    // 1) 故意传入不存在目录，预期失败
    const bad = await tm.executeTool('Ls', { dir: path.join(tmpRoot, 'not-exists') })
    expect(bad.success).toBe(false)
    expect(String(bad.error || '')).toContain('读取目录失败')

    // 2) 切换到正确目录，预期成功
    const good = await tm.executeTool('Ls', { dir: tmpRoot })
    expect(good.success).toBe(true)
    expect(String(good.content || '')).toContain('foo.txt')
  })
})

