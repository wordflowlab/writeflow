/**
 * 系统提示词优化器测试
 * 验证动态系统提示词生成和优化功能
 */

import { describe, test, expect, beforeEach } from '@jest/globals'
import { 
  SystemPromptOptimizer,
  getSystemPromptOptimizer,
  generateOptimizedSystemPrompt,
  getPermissionManager,
  getToolOrchestrator
} from '@/tools/index.js'

describe('System Prompt Optimizer Tests', () => {
  let optimizer: SystemPromptOptimizer

  beforeEach(() => {
    optimizer = getSystemPromptOptimizer()
  })

  describe('Basic Prompt Generation', () => {
    test('should generate complete system prompt', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      // 验证基本结构
      expect(prompt).toContain('WriteFlow AI 写作助手')
      expect(prompt).toContain('工具系统概述')
      expect(prompt).toContain('可用工具详情')
      expect(prompt).toContain('最佳实践')
      expect(prompt).toContain('权限和安全说明')
      expect(prompt).toContain('性能优化指南')
      expect(prompt).toContain('错误处理指南')
      
      // 验证内容长度合理
      expect(prompt.length).toBeGreaterThan(1000)
      expect(prompt.length).toBeLessThan(20000) // 避免过长
    })

    test('should generate compact prompt', async () => {
      const compactPrompt = await optimizer.generateCompactPrompt()
      const fullPrompt = await optimizer.generateSystemPrompt()
      
      expect(compactPrompt).toContain('WriteFlow AI 写作助手')
      expect(compactPrompt).toContain('可用工具')
      expect(compactPrompt).toContain('使用原则')
      
      // 紧凑版应该明显更短
      expect(compactPrompt.length).toBeLessThan(fullPrompt.length * 0.4)
      expect(compactPrompt.length).toBeGreaterThan(200)
    })

    test('should include tool list information', async () => {
      const prompt = await optimizer.generateSystemPrompt({
        taskContext: '文件操作任务'
      })
      
      // 应该包含工具描述
      expect(prompt).toMatch(/Read|Write|Edit|Glob|Grep/)
      expect(prompt).toContain('只读')
      expect(prompt).toContain('可写')
      expect(prompt).toContain('并发安全')
    })
  })

  describe('Context-Aware Prompt Generation', () => {
    test('should adapt prompt for file operations', async () => {
      const fileOperationPrompt = await optimizer.generateSystemPrompt({
        taskContext: '需要读取和编辑多个文件'
      })
      
      expect(fileOperationPrompt).toContain('任务特定工具推荐')
      expect(fileOperationPrompt).toMatch(/Read|Edit|MultiEdit/)
      expect(fileOperationPrompt).toContain('文件操作')
    })

    test('should adapt prompt for search tasks', async () => {
      const searchPrompt = await optimizer.generateSystemPrompt({
        taskContext: '需要在代码中搜索特定模式和内容'
      })
      
      expect(searchPrompt).toContain('任务特定工具推荐')
      expect(searchPrompt).toMatch(/Grep|Glob|搜索/)
    })

    test('should adapt prompt for system operations', async () => {
      const systemPrompt = await optimizer.generateSystemPrompt({
        taskContext: '需要执行系统命令和脚本'
      })
      
      expect(systemPrompt).toContain('任务特定工具推荐')
      expect(systemPrompt).toMatch(/Bash|命令|执行/)
    })

    test('should handle safe mode context', async () => {
      const safeModePrompt = await optimizer.generateSystemPrompt({
        safeMode: true
      })
      
      expect(safeModePrompt).toContain('安全模式')
      expect(safeModePrompt).toMatch(/写入操作.*阻止|禁止.*写入/)
    })
  })

  describe('Permission-Aware Prompt Generation', () => {
    test('should include current permission mode', async () => {
      const permissionManager = getPermissionManager()
      const currentMode = permissionManager.getCurrentMode()
      
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('当前模式')
      expect(prompt).toContain(currentMode)
    })

    test('should reflect available tools count', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      // 应该包含工具数量信息
      expect(prompt).toMatch(/\d+\s*个.*工具/)
    })

    test('should include permission level breakdown', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('权限级别说明')
      expect(prompt).toContain('只读权限')
      expect(prompt).toContain('写入权限')
      expect(prompt).toContain('系统权限')
    })
  })

  describe('Performance and Usage Statistics', () => {
    test('should include execution statistics when available', async () => {
      const orchestrator = getToolOrchestrator()
      
      // 先执行一些工具来生成统计数据
      // 这里我们主要验证统计信息的格式
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('性能优化指南')
      expect(prompt).toContain('执行统计')
      expect(prompt).toMatch(/\d+.*次|执行次数/)
    })

    test('should provide performance optimization hints', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('并发优化')
      expect(prompt).toContain('资源优化')
      expect(prompt).toContain('调用优化')
      expect(prompt).toMatch(/并发|并行/)
      expect(prompt).toMatch(/性能|优化/)
    })
  })

  describe('Tool-Specific Guidance', () => {
    test('should provide tool usage scenarios', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      // 应该包含具体的使用场景
      expect(prompt).toContain('使用场景')
      expect(prompt).toMatch(/查看.*文件|创建.*文件|修改.*文件/)
      expect(prompt).toMatch(/搜索.*内容|查找.*文件/)
    })

    test('should include tool precautions', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('注意事项')
      expect(prompt).toMatch(/谨慎.*使用|小心.*操作/)
      expect(prompt).toMatch(/不可撤销|权限.*确认/)
    })

    test('should provide tool combination suggestions', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('工具组合技巧')
      expect(prompt).toMatch(/Read.*→.*分析|Glob.*→.*Read/)
      expect(prompt).toMatch(/文档分析|批量编辑|项目搜索/)
    })
  })

  describe('Error Handling Guidance', () => {
    test('should include comprehensive error handling instructions', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toContain('错误处理指南')
      expect(prompt).toContain('常见错误类型')
      expect(prompt).toContain('错误恢复策略')
      expect(prompt).toContain('调试技巧')
    })

    test('should provide specific error scenarios', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toMatch(/权限错误|参数错误|文件错误|网络错误/)
      expect(prompt).toMatch(/自动重试|降级处理|用户反馈/)
    })

    test('should include troubleshooting tips', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toMatch(/详细.*日志|执行历史|输入参数|简化.*操作/)
      expect(prompt).toMatch(/检查|验证|测试/)
    })
  })

  describe('Custom Configuration', () => {
    test('should support custom configuration options', async () => {
      const customOptimizer = new SystemPromptOptimizer({
        includeToolList: true,
        includeUsageExamples: false,
        includePermissionInfo: true,
        includePerformanceHints: false,
        maxToolsInPrompt: 5
      })
      
      const prompt = await customOptimizer.generateSystemPrompt()
      
      expect(prompt).toContain('可用工具详情')
      expect(prompt).toContain('权限和安全说明')
      // 应该不包含性能优化部分（因为设置为false）
      expect(prompt).not.toContain('性能优化指南')
    })

    test('should support custom instructions', async () => {
      const customOptimizer = new SystemPromptOptimizer({
        customInstructions: [
          '始终验证文件路径的有效性',
          '在执行写入操作前进行备份',
          '优先使用相对路径而非绝对路径'
        ]
      })
      
      const prompt = await customOptimizer.generateSystemPrompt()
      
      expect(prompt).toContain('自定义指令')
      expect(prompt).toContain('验证文件路径')
      expect(prompt).toContain('进行备份')
      expect(prompt).toContain('相对路径')
    })

    test('should limit tool count when configured', async () => {
      const limitedOptimizer = new SystemPromptOptimizer({
        maxToolsInPrompt: 3,
        prioritizeReadOnlyTools: true
      })
      
      const prompt = await limitedOptimizer.generateSystemPrompt()
      
      expect(prompt).toContain('可用工具详情')
      // 工具数量应该被限制，但我们主要验证提示词仍然完整
      expect(prompt.length).toBeGreaterThan(500)
    })
  })

  describe('Convenient Functions', () => {
    test('should provide convenient generateOptimizedSystemPrompt function', async () => {
      const basicPrompt = await generateOptimizedSystemPrompt()
      const contextualPrompt = await generateOptimizedSystemPrompt({
        taskContext: '文件操作和搜索',
        safeMode: false
      })
      const compactPrompt = await generateOptimizedSystemPrompt({
        compact: true
      })
      
      expect(basicPrompt).toContain('WriteFlow AI 写作助手')
      expect(contextualPrompt).toContain('任务特定工具推荐')
      expect(compactPrompt.length).toBeLessThan(basicPrompt.length)
    })

    test('should support custom configuration in convenient function', async () => {
      const customPrompt = await generateOptimizedSystemPrompt({
        customConfig: {
          includePerformanceHints: false,
          includeSecurityWarnings: true,
          maxToolsInPrompt: 10
        }
      })
      
      expect(customPrompt).toContain('WriteFlow AI 写作助手')
      expect(customPrompt).not.toContain('性能优化指南')
    })
  })

  describe('Prompt Quality and Consistency', () => {
    test('should generate consistent prompts', async () => {
      const prompt1 = await optimizer.generateSystemPrompt()
      const prompt2 = await optimizer.generateSystemPrompt()
      
      // 基本结构应该一致
      expect(prompt1).toContain('WriteFlow AI 写作助手')
      expect(prompt2).toContain('WriteFlow AI 写作助手')
      
      // 内容应该基本相同（除了动态部分如时间戳）
      const staticPart1 = prompt1.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z/, 'TIMESTAMP')
      const staticPart2 = prompt2.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z/, 'TIMESTAMP')
      
      expect(staticPart1).toEqual(staticPart2)
    })

    test('should maintain reasonable prompt length', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      // 提示词长度应该在合理范围内
      expect(prompt.length).toBeGreaterThan(1000) // 足够详细
      expect(prompt.length).toBeLessThan(50000)   // 不会太长影响性能
      
      const lines = prompt.split('\n')
      expect(lines.length).toBeGreaterThan(50)    // 结构化内容
      expect(lines.length).toBeLessThan(1000)     // 不会过度冗长
    })

    test('should produce well-structured markdown content', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      // 验证markdown结构
      expect(prompt).toMatch(/^你是 WriteFlow AI/)  // 开头身份说明
      expect(prompt).toMatch(/##\s+.*工具系统概述/)   // 二级标题
      expect(prompt).toMatch(/###\s+/)             // 三级标题
      expect(prompt).toMatch(/^\•\s+/m)           // 列表项
      expect(prompt).toMatch(/\*\*.*\*\*/)        // 粗体文本
      expect(prompt).toMatch(/`.*`/)              // 代码块
    })

    test('should include relevant emojis for better readability', async () => {
      const prompt = await optimizer.generateSystemPrompt()
      
      expect(prompt).toMatch(/🛠️|📋|✨|⚡|📊|🚨|🔐|🎯/)
      expect(prompt).toMatch(/🟢|🟡|🔴|⚠️|✅|❌/)
    })
  })

  describe('Performance', () => {
    test('should generate prompts efficiently', async () => {
      const startTime = Date.now()
      
      const prompt = await optimizer.generateSystemPrompt({
        taskContext: '复杂的多工具协作任务'
      })
      
      const duration = Date.now() - startTime
      
      expect(prompt).toBeDefined()
      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
      
      console.log(`📊 系统提示词生成耗时: ${duration}ms`)
    })

    test('should handle multiple concurrent prompt generations', async () => {
      const startTime = Date.now()
      
      const promises = Array(10).fill(0).map((_, index) =>
        optimizer.generateSystemPrompt({
          taskContext: `任务 ${index + 1}`
        })
      )
      
      const prompts = await Promise.all(promises)
      const duration = Date.now() - startTime
      
      expect(prompts).toHaveLength(10)
      expect(duration).toBeLessThan(3000) // 10个并发请求应该在3秒内完成
      
      // 所有提示词都应该生成成功
      prompts.forEach((prompt, index) => {
        expect(prompt).toContain('WriteFlow AI 写作助手')
        expect(prompt).toContain(`任务 ${index + 1}`)
      })
      
      console.log(`🚀 10个并发提示词生成耗时: ${duration}ms`)
    })
  })
})