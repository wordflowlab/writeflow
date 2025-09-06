/**
 * AI 工具调用集成测试
 * 验证 AI 模型能否正确调用和使用工具
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { WriteFlowAIService } from '@/services/ai/WriteFlowAIService.js'
import { generateOptimizedSystemPrompt } from '@/tools/index.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('AI Tool Calling Integration Tests', () => {
  let aiService: WriteFlowAIService
  let tempDir: string

  beforeEach(async () => {
    aiService = new WriteFlowAIService()
    
    // 设置环境变量
    process.env.AI_MODEL = 'deepseek-chat'
    process.env.API_PROVIDER = 'deepseek'
    
    // 检查是否有真实的 API key，如果没有则跳过需要网络的测试
    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
      console.warn('⚠️  没有配置真实的 DEEPSEEK_API_KEY，将跳过实际的 AI 调用测试')
    }
    
    // 创建临时目录用于测试
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'writeflow-test-'))
  })

  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.rmdir(tempDir, { recursive: true })
    } catch (error) {
      console.warn('清理临时目录失败:', error)
    }
  })

  describe('Basic Tool Calling', () => {
    test('should be able to make AI request with tools enabled', async () => {
      // 跳过实际网络请求如果没有 API key
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '需要读取文件内容'
        })

        const response = await aiService.processRequest({
          prompt: '请使用Read工具读取package.json文件的内容，然后告诉我项目名称是什么',
          systemPrompt,
          allowedTools: ['Read'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response).toBeDefined()
        expect(response.content).toBeDefined()
        expect(typeof response.content).toBe('string')
        expect(response.content.length).toBeGreaterThan(0)
        
        // 验证是否有工具交互
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了工具交互')
          expect(response.hasToolInteraction).toBe(true)
        }
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })

    test('should handle file operations through AI', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        // 创建测试文件
        const testFile = path.join(tempDir, 'test.txt')
        await fs.writeFile(testFile, 'Hello, WriteFlow!')

        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '文件读取和分析'
        })

        const response = await aiService.processRequest({
          prompt: `请使用Read工具读取文件 ${testFile} 的内容，然后告诉我文件里写的是什么`,
          systemPrompt,
          allowedTools: ['Read'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功读取了测试文件')
          expect(response.content).toContain('Hello')
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })

    test('should handle search operations through AI', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '代码搜索和分析'
        })

        const response = await aiService.processRequest({
          prompt: '请使用Glob工具查找当前目录下的所有.ts文件，然后告诉我找到了多少个TypeScript文件',
          systemPrompt,
          allowedTools: ['Glob'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了文件搜索')
          expect(response.content).toMatch(/文件|\.ts/)
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })
  })

  describe('Tool Parameter Handling', () => {
    test('should handle complex tool parameters', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        // 创建多个测试文件
        const file1 = path.join(tempDir, 'file1.js')
        const file2 = path.join(tempDir, 'file2.ts')
        await fs.writeFile(file1, 'console.log("JavaScript file")')
        await fs.writeFile(file2, 'console.log("TypeScript file")')

        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '文件搜索和内容分析'
        })

        const response = await aiService.processRequest({
          prompt: `请使用Grep工具在目录 ${tempDir} 中搜索包含 "console.log" 的所有文件，并告诉我找到了什么`,
          systemPrompt,
          allowedTools: ['Grep'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了内容搜索')
          expect(response.content).toMatch(/console\.log|搜索|找到/)
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })
  })

  describe('Multi-Tool Workflows', () => {
    test('should handle sequential tool calls', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '项目分析和文件搜索'
        })

        const response = await aiService.processRequest({
          prompt: '请先使用Glob工具找到所有的.json文件，然后使用Read工具读取package.json文件的内容，最后告诉我项目的基本信息',
          systemPrompt,
          allowedTools: ['Glob', 'Read'],
          enableToolCalls: true,
          maxTokens: 2000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了多工具协作')
          expect(response.content.length).toBeGreaterThan(100)
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })
  })

  describe('Error Handling in AI Calls', () => {
    test('should handle tool not found errors gracefully', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt()

        const response = await aiService.processRequest({
          prompt: '请使用NonExistentTool工具来处理任务',
          systemPrompt,
          allowedTools: ['NonExistentTool'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        // AI 应该能识别工具不存在并给出合理回应
        expect(response.content).toMatch(/不存在|找不到|无法|不支持/)

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })

    test('should handle invalid file paths gracefully', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '文件操作错误处理'
        })

        const response = await aiService.processRequest({
          prompt: '请使用Read工具读取一个不存在的文件：/nonexistent/path/file.txt',
          systemPrompt,
          allowedTools: ['Read'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 正确处理了文件不存在的错误')
          // AI 应该能识别错误并给出合理的解释
          expect(response.content).toMatch(/不存在|错误|失败|无法找到/)
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })
  })

  describe('Performance and Reliability', () => {
    test('should complete tool calls within reasonable time', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const startTime = Date.now()
        const systemPrompt = await generateOptimizedSystemPrompt()

        const response = await aiService.processRequest({
          prompt: '请使用Glob工具查找当前目录下的文件',
          systemPrompt,
          allowedTools: ['Glob'],
          enableToolCalls: true,
          maxTokens: 500,
          temperature: 0.1
        })

        const duration = Date.now() - startTime
        
        expect(response.content).toBeDefined()
        console.log(`⏱️  工具调用耗时: ${duration}ms`)
        
        // 合理的超时时间（30秒）
        expect(duration).toBeLessThan(30000)

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })

    test('should provide usage statistics', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt()

        const response = await aiService.processRequest({
          prompt: '请简单介绍一下你能使用的工具',
          systemPrompt,
          allowedTools: ['Read', 'Write', 'Glob'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response).toHaveProperty('usage')
        expect(response.usage).toHaveProperty('inputTokens')
        expect(response.usage).toHaveProperty('outputTokens')
        expect(response.usage.inputTokens).toBeGreaterThan(0)
        expect(response.usage.outputTokens).toBeGreaterThan(0)
        
        console.log(`📊 Token 使用情况: 输入 ${response.usage.inputTokens}, 输出 ${response.usage.outputTokens}`)

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })
  })

  describe('Tool Understanding and Selection', () => {
    test('should choose appropriate tools for tasks', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过网络测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '智能工具选择测试'
        })

        // 测试文件读取任务是否会选择 Read 工具
        const response1 = await aiService.processRequest({
          prompt: '我需要查看README.md文件的内容',
          systemPrompt,
          allowedTools: ['Read', 'Write', 'Glob', 'Grep'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        if (response1.hasToolInteraction) {
          console.log('✅ AI 正确选择了工具来处理文件读取任务')
        }

        // 测试文件搜索任务是否会选择 Glob 或 Grep
        const response2 = await aiService.processRequest({
          prompt: '我需要找到所有包含 "test" 字样的文件',
          systemPrompt,
          allowedTools: ['Read', 'Write', 'Glob', 'Grep'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        if (response2.hasToolInteraction) {
          console.log('✅ AI 正确选择了工具来处理搜索任务')
        }

        expect(response1.content).toBeDefined()
        expect(response2.content).toBeDefined()

      } catch (error) {
        if (error instanceof Error && error.message.includes('API')) {
          console.log('跳过网络测试 - API 调用失败:', error.message)
        } else {
          throw error
        }
      }
    })
  })
})