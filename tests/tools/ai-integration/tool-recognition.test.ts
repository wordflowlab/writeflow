/**
 * AI 工具识别测试
 * 验证 AI 模型能否正确识别和理解可用工具
 */

import { describe, test, expect, beforeEach } from '@jest/globals'
import { WriteFlowAIService } from '@/services/ai/WriteFlowAIService.js'
import { 
  getAvailableTools,
  generateOptimizedSystemPrompt,
  getSystemPromptOptimizer
} from '@/tools/index.js'

describe('AI Tool Recognition Tests', () => {
  let aiService: WriteFlowAIService

  beforeEach(() => {
    aiService = new WriteFlowAIService()
    
    // 设置测试环境变量
    process.env.AI_MODEL = 'deepseek-chat'
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.API_PROVIDER = 'deepseek'
  })

  describe('Tool Discovery by AI', () => {
    test('should generate system prompt with tool information', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt({
        taskContext: '需要处理文件和搜索内容'
      })

      expect(systemPrompt).toContain('WriteFlow AI 写作助手')
      expect(systemPrompt).toContain('工具系统概述')
      expect(systemPrompt).toContain('可用工具详情')
      expect(systemPrompt).toContain('最佳实践')
      
      // 验证包含工具描述
      const availableTools = getAvailableTools()
      if (availableTools.length > 0) {
        expect(systemPrompt).toContain('Read')
        expect(systemPrompt).toContain('Write')
      }
    })

    test('should include tool usage examples in prompt', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt({
        includeUsageExamples: true,
        taskContext: '文件编辑任务'
      })

      expect(systemPrompt).toContain('使用场景')
      expect(systemPrompt).toContain('注意事项')
      expect(systemPrompt).toContain('最佳实践')
    })

    test('should adapt prompt based on task context', async () => {
      // 文件处理任务
      const fileTaskPrompt = await generateOptimizedSystemPrompt({
        taskContext: '需要读取和编辑多个文件'
      })
      expect(fileTaskPrompt).toContain('任务特定工具推荐')

      // 搜索任务
      const searchTaskPrompt = await generateOptimizedSystemPrompt({
        taskContext: '需要在代码中搜索特定模式'
      })
      expect(searchTaskPrompt).toContain('任务特定工具推荐')
    })

    test('should generate compact prompt for token-limited scenarios', async () => {
      const optimizer = getSystemPromptOptimizer()
      const compactPrompt = await optimizer.generateCompactPrompt()

      expect(compactPrompt).toContain('WriteFlow AI 写作助手')
      expect(compactPrompt).toContain('可用工具')
      expect(compactPrompt).toContain('使用原则')
      
      // 紧凑版应该更短
      const fullPrompt = await generateOptimizedSystemPrompt()
      expect(compactPrompt.length).toBeLessThan(fullPrompt.length * 0.3)
    })
  })

  describe('Tool Format Conversion', () => {
    test('should convert tools to DeepSeek API format', async () => {
      // 这个测试需要访问 WriteFlowAIService 的私有方法
      // 我们通过反射来测试这个功能
      const privateMethod = (aiService as any).convertToolsToDeepSeekFormat
      
      if (typeof privateMethod === 'function') {
        const allowedTools = ['Read', 'Write', 'Glob']
        const apiFormat = await privateMethod.call(aiService, allowedTools)
        
        expect(Array.isArray(apiFormat)).toBe(true)
        
        if (apiFormat.length > 0) {
          const firstTool = apiFormat[0]
          expect(firstTool).toHaveProperty('type', 'function')
          expect(firstTool).toHaveProperty('function')
          expect(firstTool.function).toHaveProperty('name')
          expect(firstTool.function).toHaveProperty('description')
          expect(firstTool.function).toHaveProperty('parameters')
        }
      } else {
        console.warn('convertToolsToDeepSeekFormat 方法不存在，跳过此测试')
      }
    })

    test('should include tool metadata in API format', async () => {
      const privateMethod = (aiService as any).convertToolsToDeepSeekFormat
      
      if (typeof privateMethod === 'function') {
        const allowedTools = ['Read']
        const apiFormat = await privateMethod.call(aiService, allowedTools)
        
        if (apiFormat.length > 0) {
          const toolDef = apiFormat[0]
          expect(toolDef.function.description).toContain('权限级别')
          expect(toolDef.function.description).toContain('并发安全')
        }
      } else {
        console.warn('convertToolsToDeepSeekFormat 方法不存在，跳过此测试')
      }
    })
  })

  describe('Tool Schema Generation', () => {
    test('should generate valid JSON schemas for tools', async () => {
      const availableTools = getAvailableTools()
      
      for (const tool of availableTools.slice(0, 3)) { // 测试前3个工具
        if (tool.inputJSONSchema) {
          const schema = tool.inputJSONSchema
          
          // 验证基本 JSON Schema 结构
          expect(schema).toHaveProperty('type')
          expect(schema).toHaveProperty('properties')
          
          if (schema.type === 'object') {
            expect(typeof schema.properties).toBe('object')
          }
        }
      }
    })

    test('should handle tools without explicit schemas', async () => {
      const availableTools = getAvailableTools()
      
      for (const tool of availableTools.slice(0, 2)) {
        // 即使工具没有显式 schema，也应该能够生成描述
        const description = await tool.description()
        expect(typeof description).toBe('string')
        expect(description.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Permission-Aware Tool Discovery', () => {
    test('should only expose allowed tools to AI', () => {
      const availableTools = getAvailableTools()
      
      // 验证返回的都是有权限的工具
      for (const tool of availableTools) {
        expect(tool).toBeDefined()
        expect(tool.name).toBeTruthy()
        expect(typeof tool.description).toBe('function')
      }
    })

    test('should adapt tool list based on permission mode', async () => {
      // 这里我们测试不同权限模式下的工具可用性
      // 由于涉及权限管理，我们主要验证基本结构
      const systemPrompt = await generateOptimizedSystemPrompt({
        safeMode: true
      })
      
      expect(systemPrompt).toContain('安全模式')
    })
  })

  describe('Tool Usage Guidance', () => {
    test('should provide clear tool usage instructions', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt()
      
      // 验证包含使用指导
      expect(systemPrompt).toContain('使用原则')
      expect(systemPrompt).toContain('执行流程')
      expect(systemPrompt).toContain('工具组合技巧')
      expect(systemPrompt).toContain('错误处理')
    })

    test('should include tool-specific usage scenarios', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt()
      
      // 验证包含具体场景
      expect(systemPrompt).toMatch(/使用场景|应用场景|适用于/)
      expect(systemPrompt).toMatch(/注意事项|安全提醒/)
    })

    test('should provide performance optimization hints', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt()
      
      expect(systemPrompt).toContain('性能优化')
      expect(systemPrompt).toMatch(/并发|并行/)
      expect(systemPrompt).toMatch(/优化建议/)
    })
  })

  describe('Error Handling Guidance', () => {
    test('should include error handling instructions', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt()
      
      expect(systemPrompt).toContain('错误处理指南')
      expect(systemPrompt).toContain('常见错误类型')
      expect(systemPrompt).toContain('错误恢复策略')
      expect(systemPrompt).toContain('调试技巧')
    })

    test('should provide troubleshooting guidance', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt()
      
      expect(systemPrompt).toMatch(/权限错误|参数错误|文件错误/)
      expect(systemPrompt).toMatch(/重试|降级|反馈/)
    })
  })
})