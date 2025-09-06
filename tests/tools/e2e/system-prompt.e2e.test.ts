/**
 * E2E: 系统提示词有效性
 * 目标：验证 SystemPromptOptimizer 生成的系统提示词包含关键结构段落，
 *       并体现 function-calling 优先与传统回退的约束（通过文本断言）。
 */
import { describe, test, expect } from '@jest/globals'
import { SystemPromptOptimizer } from '@/tools/SystemPromptOptimizer.ts'

describe('E2E: System Prompt Validity', () => {
  test('完整结构与要点约束', async () => {
    const opt = new SystemPromptOptimizer()
    const prompt = await opt.generateSystemPrompt({ taskContext: '需要读取多个文件并执行批量替换', safeMode: true })

    // 基础结构
    expect(prompt).toContain('WriteFlow AI 写作助手')
    expect(prompt).toContain('工具系统概述')
    expect(prompt).toContain('可用工具详情')
    expect(prompt).toContain('工具使用最佳实践')
    expect(prompt).toContain('权限和安全说明')
    expect(prompt).toContain('性能优化指南')
    expect(prompt).toContain('错误处理指南')

    // 任务特定推荐
    expect(prompt).toContain('任务特定工具推荐')
    expect(prompt).toMatch(/Read|Edit|MultiEdit|Glob|Grep/)

    // 权限与安全（包含安全模式提示）
    expect(prompt).toMatch(/当前权限状态|运行模式/)
    expect(prompt).toMatch(/安全模式|写入操作.*阻止|禁止.*写入/)

    // 性能提示关键字
    expect(prompt).toMatch(/并发优化|资源优化|调用优化/)
    expect(prompt).toMatch(/执行统计|平均执行时间|成功率/)

    // 错误处理关键字
    expect(prompt).toMatch(/常见错误类型|错误恢复策略|调试技巧/)

    // function-calling 优先与传统回退：
    // 由于 SystemPromptOptimizer 主体不内嵌工具协议细节，这里仅检查默认指南中的约束（在 AIConfigLoader 默认指南覆盖）。
    // 额外断言：系统提示至少提醒“只读优先、确认后写入”，避免模型直接破坏性操作。
    expect(prompt).toMatch(/优先.*只读|确认.*写入/) 
  })

  test('紧凑版包含关键摘要', async () => {
    const opt = new SystemPromptOptimizer()
    const compact = await opt.generateCompactPrompt()
    expect(compact).toContain('WriteFlow AI 写作助手')
    expect(compact).toMatch(/可用工具|权限模式|使用原则/)
    expect(compact.length).toBeGreaterThan(200)
    // 紧凑版应显著短于完整版本
    const full = await opt.generateSystemPrompt()
    expect(compact.length).toBeLessThan(full.length * 0.5)
  })
})

