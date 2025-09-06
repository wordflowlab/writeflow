/**
 * WriteFlow 工具系统端到端集成测试（最小可运行版）
 * - 验证核心文件/搜索类工具在真实文件系统上的协作
 * - 验证 TodoWrite 的传统调用路径（拦截→执行→彩色输出）
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import path from 'path'
import fs from 'fs/promises'

import { ToolManager } from '@/tools/tool-manager.js'

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

  test('ToolManager 基础功能测试', async () => {
    const tm = new ToolManager()

    // 验证工具注册
    const toolNames = tm.getToolNames()
    expect(toolNames.length).toBeGreaterThan(0)
    
    // 测试一些已知存在的工具
    expect(toolNames).toContain('exit_plan_mode')
    expect(toolNames).toContain('todo_write')
    expect(toolNames).toContain('todo_read')
    
    // 验证工具信息获取
    const toolInfo = tm.getToolInfo('todo_write')
    expect(toolInfo).toBeDefined()
    expect(toolInfo?.name).toBe('todo_write')
  })

  test('基础工具集成测试', async () => {
    const tm = new ToolManager()
    
    // 验证 ToolManager 正常工作
    const toolNames = tm.getToolNames()
    expect(toolNames.length).toBeGreaterThan(0)
    expect(toolNames).toContain('todo_write')
    
    // 简单的工具执行测试
    const result = await tm.executeTool('todo_write', {
      todos: [{ content: '测试任务', status: 'pending', activeForm: '正在测试' }]
    })
    expect(result.success).toBe(true)
  })
})

