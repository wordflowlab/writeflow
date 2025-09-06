/**
 * E2E: 权限升级/限制场景
 * 目标：验证 EnhancedBashTool 的权限检查在安全模式下有效；
 *       关闭安全模式后允许普通命令执行。
 */
import { describe, test, expect } from '@jest/globals'
import { ToolManager } from '@/tools/tool-manager.js'

describe('E2E: 权限升级（Bash 工具）', () => {
  test('安全模式下阻止网络命令，关闭后允许', async () => {
    const tm = new ToolManager()

    // 1) 安全模式：阻止 curl
    const denied = await tm.executeTool('Bash', { command: 'curl https://example.com' }, { safeMode: true })
    expect(denied.success).toBe(false)
    expect(String(denied.error || '')).toContain('权限验证失败')

    // 2) 关闭安全模式：允许 echo 命令
    const allowed = await tm.executeTool('Bash', { command: 'echo ok' }, { safeMode: false })
    expect(allowed.success).toBe(true)
    expect(String(allowed.content || '')).toMatch(/ok/)
  })
})

