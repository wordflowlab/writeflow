/**
 * WriteFlow 工具系统端到端集成测试（最小可运行版）
 * - 验证核心文件/搜索类工具在真实文件系统上的协作
 * - 验证 TodoWrite 的传统调用路径（拦截→执行→彩色输出）
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import path from 'path'
import fs from 'fs/promises'

import { ToolManager } from '@/tools/tool-manager.js'
import { WriteFlowCLI } from '@/cli/writeflow-cli.js'

// 辅助：创建/清理临时目录
const tmpRoot = path.join(process.cwd(), 'tests', 'tmp', 'e2e-tools')
const fileA = path.join(tmpRoot, 'a.md')
const fileB = path.join(tmpRoot, 'b.txt')

describe('E2E: 核心工具链 + TodoWrite 传统调用', () => {
  beforeAll(async () => {
    await fs.mkdir(tmpRoot, { recursive: true })
    await fs.writeFile(fileA, '# Hello\nfoo bar baz\n', 'utf-8')
    await fs.writeFile(fileB, 'the quick brown fox\nhello world\n', 'utf-8')
  })

  afterAll(async () => {
    try { await fs.rm(tmpRoot, { recursive: true, force: true }) } catch {}
  })

  test('文件搜索→读取→编辑→写入 链路', async () => {
    const tm = new ToolManager()

    // 1) Glob 查找
    const globRes = await tm.executeTool('Glob', { pattern: path.join(tmpRoot, '*') })
    expect(globRes.success).toBe(true)
    expect(globRes.content || '').toContain('a.md')

    // 2) Grep 搜索
    const grepRes = await tm.executeTool('Grep', { pattern: 'hello', files: [fileA, fileB] })
    expect(grepRes.success).toBe(true)
    expect(grepRes.content || '').toMatch(/hello/i)

    // 3) Read 读取
    const readRes = await tm.executeTool('Read', { path: fileA })
    expect(readRes.success).toBe(true)
    expect(readRes.content || '').toContain('Hello')

    // 4) Edit 编辑（在 a.md 末尾追加一行）
    const editRes = await tm.executeTool('Edit', {
      path: fileA,
      replace: { from: '$', to: '\nE2E-EDIT\n' },
      flags: 'm'
    })
    expect(editRes.success).toBe(true)

    // 5) Write 写入新文件
    const outFile = path.join(tmpRoot, 'out.md')
    const writeRes = await tm.executeTool('Write', { path: outFile, content: 'E2E OUT' })
    expect(writeRes.success).toBe(true)
    const outText = await fs.readFile(outFile, 'utf-8')
    expect(outText).toContain('E2E OUT')
  })

  test('TodoWrite 传统函数块 → 拦截执行 → 彩色输出', async () => {
    // 初始化 CLI（主要为了复用 interceptToolCalls 与 executeToolWithEvents）
    const cli = new WriteFlowCLI()
    // @ts-expect-error - 访问私有方法
    const app = (cli as any).app as import('@/cli/writeflow-app.js').WriteFlowApp
    // @ts-expect-error - 初始化需要
    await app.initialize?.({})

    // 模拟传统回退格式的工具调用
    const fake = `<function_calls>\n  <invoke name="TodoWrite">\n    <parameter name="todos">[{"id":"1","content":"写开篇","activeForm":"正在写开篇","status":"in_progress"}]</parameter>\n  </invoke>\n</function_calls>`

    // @ts-expect-error 访问私有方法
    const intercept = await app.interceptToolCalls(fake)
    expect(intercept.shouldIntercept).toBe(true)
    expect(intercept.toolCalls?.[0].toolName).toBe('todo_write')

    // 执行拦截到的工具
    for (const call of intercept.toolCalls || []) {
      // @ts-expect-error 访问私有方法
      const result = await app.executeToolWithEvents(call.toolName, call.input)
      expect(result.success).toBe(true)
      // TodoWrite 适配器会产出彩色输出标题
      expect(String(result.content || '')).toContain('任务列表已更新')
    }
  })
})

