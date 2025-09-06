/**
 * E2E: 系统提示词中的调用约束（文本断言）
 * 目标：在生成的系统提示/默认指南中同时体现 function-calling 首选与传统回退 (<function_calls>) 的指导。
 * 说明：function-calling 的具体协议由各 Provider 决定；此处通过文本约束断言来保证提示内容。
 */
import { describe, test, expect } from '@jest/globals'
import { loadProjectGuide } from '@/config/AIConfigLoader.ts'
import { SystemPromptOptimizer } from '@/tools/SystemPromptOptimizer.ts'

describe('E2E: System Prompt function-calling vs fallback', () => {
  test('默认指南包含传统回退块和 thinking 约束', async () => {
    const guide = await loadProjectGuide(process.cwd())
    // 传统回退块
    expect(guide).toMatch(/<function_calls>[\s\S]*?<invoke name="TodoWrite">/)
    expect(guide).toMatch(/<function_calls>[\s\S]*?<invoke name="TodoRead">/)
    // thinking 包裹
    expect(guide).toMatch(/<thinking>[\s\S]*?<\/thinking>/)
  })

  test('优化器输出强调只读优先与确认写入（间接体现 function-calling 优先约束）', async () => {
    const opt = new SystemPromptOptimizer()
    const prompt = await opt.generateSystemPrompt()
    // 只读优先与确认写入
    expect(prompt).toMatch(/优先.*只读/)
    expect(prompt).toMatch(/确认.*写入|谨慎.*写入/)
  })
})

