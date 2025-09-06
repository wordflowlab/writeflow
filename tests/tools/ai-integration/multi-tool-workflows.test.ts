/**
 * 多工具协作场景测试
 * 验证复杂工具链和工作流的执行能力
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { WriteFlowAIService } from '@/services/ai/WriteFlowAIService.js'
import { 
  generateOptimizedSystemPrompt,
  getToolOrchestrator,
  ToolExecutionStatus
} from '@/tools/index.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('Multi-Tool Workflow Tests', () => {
  let aiService: WriteFlowAIService
  let tempDir: string
  let orchestrator: any

  beforeEach(async () => {
    aiService = new WriteFlowAIService()
    orchestrator = getToolOrchestrator()
    
    // 设置环境变量
    process.env.AI_MODEL = 'deepseek-chat'
    process.env.API_PROVIDER = 'deepseek'
    
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'writeflow-workflow-test-'))
    
    // 创建测试文件结构
    await createTestFiles()
  })

  afterEach(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true })
    } catch (error) {
      console.warn('清理临时目录失败:', error)
    }
    
    orchestrator.clearHistory()
  })

  async function createTestFiles() {
    // 创建测试项目结构
    const srcDir = path.join(tempDir, 'src')
    const testDir = path.join(tempDir, 'tests')
    
    await fs.mkdir(srcDir, { recursive: true })
    await fs.mkdir(testDir, { recursive: true })
    
    // 创建 package.json
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'A test project for WriteFlow',
      scripts: {
        test: 'jest',
        build: 'tsc'
      },
      dependencies: {
        'express': '^4.18.0',
        'lodash': '^4.17.21'
      }
    }, null, 2))
    
    // 创建 README.md
    await fs.writeFile(path.join(tempDir, 'README.md'), `# Test Project

This is a test project for WriteFlow tool system.

## Features

- Express server
- TypeScript support
- Jest testing

## Usage

\`\`\`bash
npm install
npm test
npm run build
\`\`\`
`)
    
    // 创建源代码文件
    await fs.writeFile(path.join(srcDir, 'index.ts'), `import express from 'express';
import { getUserData } from './utils';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/users/:id', async (req, res) => {
  try {
    const userData = await getUserData(req.params.id);
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`)
    
    await fs.writeFile(path.join(srcDir, 'utils.ts'), `export interface User {
  id: string;
  name: string;
  email: string;
}

export async function getUserData(userId: string): Promise<User> {
  // TODO: 实现数据库查询
  return {
    id: userId,
    name: 'Test User',
    email: 'test@example.com'
  };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
`)
    
    // 创建测试文件
    await fs.writeFile(path.join(testDir, 'utils.test.ts'), `import { validateEmail, getUserData } from '../src/utils';

describe('Utils', () => {
  test('should validate email correctly', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
  });

  test('should get user data', async () => {
    const user = await getUserData('123');
    expect(user.id).toBe('123');
    expect(user.name).toBeDefined();
  });
});
`)
  }

  describe('Project Analysis Workflows', () => {
    test('should analyze project structure', async () => {
      const requests = [
        {
          toolName: 'Glob',
          input: { pattern: '**/*.json', path: tempDir },
          context: createTestContext()
        },
        {
          toolName: 'Read',
          input: { file_path: path.join(tempDir, 'package.json') },
          context: createTestContext()
        },
        {
          toolName: 'Glob',
          input: { pattern: '**/*.ts', path: tempDir },
          context: createTestContext()
        }
      ]

      const results = await orchestrator.executeToolsBatch(requests)
      
      expect(results).toHaveLength(3)
      expect(results[0].status).toBe(ToolExecutionStatus.COMPLETED)
      expect(results[1].status).toBe(ToolExecutionStatus.COMPLETED)
      expect(results[2].status).toBe(ToolExecutionStatus.COMPLETED)
      
      // 验证结果内容
      expect(results[1].result).toContain('test-project')
      console.log('✅ 项目结构分析工具链执行成功')
    })

    test('should perform code search and analysis', async () => {
      const searchResult = await orchestrator.executeTool({
        toolName: 'Grep',
        input: { 
          pattern: 'TODO',
          path: tempDir,
          output_mode: 'content'
        },
        context: createTestContext()
      })

      expect(searchResult.status).toBe(ToolExecutionStatus.COMPLETED)
      if (searchResult.result) {
        expect(searchResult.result).toContain('TODO')
        console.log('✅ 代码搜索工具成功找到 TODO 注释')
      }
    })
  })

  describe('Documentation Generation Workflows', () => {
    test('should generate project documentation', async () => {
      // 1. 读取项目信息
      const packageResult = await orchestrator.executeTool({
        toolName: 'Read',
        input: { file_path: path.join(tempDir, 'package.json') },
        context: createTestContext()
      })

      expect(packageResult.status).toBe(ToolExecutionStatus.COMPLETED)

      // 2. 读取现有文档
      const readmeResult = await orchestrator.executeTool({
        toolName: 'Read',
        input: { file_path: path.join(tempDir, 'README.md') },
        context: createTestContext()
      })

      expect(readmeResult.status).toBe(ToolExecutionStatus.COMPLETED)

      // 3. 分析源代码文件
      const codeFilesResult = await orchestrator.executeTool({
        toolName: 'Glob',
        input: { pattern: 'src/**/*.ts', path: tempDir },
        context: createTestContext()
      })

      expect(codeFilesResult.status).toBe(ToolExecutionStatus.COMPLETED)

      console.log('✅ 文档生成工具链执行成功')
    })
  })

  describe('Code Analysis and Refactoring Workflows', () => {
    test('should analyze code quality and structure', async () => {
      // 1. 找到所有 TypeScript 文件
      const tsFilesResult = await orchestrator.executeTool({
        toolName: 'Glob',
        input: { pattern: '**/*.ts', path: tempDir },
        context: createTestContext()
      })

      expect(tsFilesResult.status).toBe(ToolExecutionStatus.COMPLETED)

      // 2. 读取主要源文件
      const mainFileResult = await orchestrator.executeTool({
        toolName: 'Read',
        input: { file_path: path.join(tempDir, 'src', 'index.ts') },
        context: createTestContext()
      })

      expect(mainFileResult.status).toBe(ToolExecutionStatus.COMPLETED)
      expect(mainFileResult.result).toContain('express')

      // 3. 搜索潜在问题（如 TODO、FIXME）
      const issuesResult = await orchestrator.executeTool({
        toolName: 'Grep',
        input: { 
          pattern: 'TODO|FIXME|HACK',
          path: tempDir,
          output_mode: 'content'
        },
        context: createTestContext()
      })

      expect(issuesResult.status).toBe(ToolExecutionStatus.COMPLETED)

      console.log('✅ 代码质量分析工具链执行成功')
    })

    test('should support batch file operations', async () => {
      // 创建批量编辑场景的测试文件
      const testFiles = [
        path.join(tempDir, 'file1.txt'),
        path.join(tempDir, 'file2.txt'),
        path.join(tempDir, 'file3.txt')
      ]

      for (let i = 0; i < testFiles.length; i++) {
        await fs.writeFile(testFiles[i], `This is test file ${i + 1}\nVersion: 1.0.0\nStatus: draft`)
      }

      // 批量读取文件
      const readRequests = testFiles.map(file => ({
        toolName: 'Read',
        input: { file_path: file },
        context: createTestContext()
      }))

      const readResults = await orchestrator.executeToolsBatch(readRequests)
      
      expect(readResults).toHaveLength(3)
      readResults.forEach((result, index) => {
        expect(result.status).toBe(ToolExecutionStatus.COMPLETED)
        expect(result.result).toContain(`test file ${index + 1}`)
      })

      console.log('✅ 批量文件操作工具链执行成功')
    })
  })

  describe('AI-Driven Workflow Orchestration', () => {
    test('should handle complex AI-driven project analysis', async () => {
      if (!hasRealApiKey()) {
        console.log('跳过 AI 测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '项目分析和结构理解'
        })

        const response = await aiService.processRequest({
          prompt: `请分析目录 ${tempDir} 中的项目：
1. 使用Glob工具找到所有的配置文件(.json)
2. 使用Read工具读取package.json了解项目信息
3. 使用Glob工具找到所有源代码文件(.ts)
4. 告诉我这个项目的基本情况和文件结构`,
          systemPrompt,
          allowedTools: ['Glob', 'Read', 'Grep'],
          enableToolCalls: true,
          maxTokens: 2000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了复杂的项目分析工作流')
          expect(response.content).toContain('test-project')
          expect(response.content.length).toBeGreaterThan(200)
        }

      } catch (error) {
        handleApiError(error)
      }
    })

    test('should handle AI-driven code search workflow', async () => {
      if (!hasRealApiKey()) {
        console.log('跳过 AI 测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '代码搜索和分析'
        })

        const response = await aiService.processRequest({
          prompt: `请在项目 ${tempDir} 中执行以下任务：
1. 使用Grep工具搜索所有包含"express"的文件
2. 使用Grep工具搜索所有TODO注释
3. 总结代码中的主要模块和待办事项`,
          systemPrompt,
          allowedTools: ['Grep', 'Read'],
          enableToolCalls: true,
          maxTokens: 2000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了代码搜索和分析工作流')
          expect(response.content.toLowerCase()).toMatch(/express|todo|搜索|分析/)
        }

      } catch (error) {
        handleApiError(error)
      }
    })

    test('should handle AI-driven documentation workflow', async () => {
      if (!hasRealApiKey()) {
        console.log('跳过 AI 测试 - 未配置真实 API key')
        return
      }

      try {
        const systemPrompt = await generateOptimizedSystemPrompt({
          taskContext: '文档生成和项目理解'
        })

        const response = await aiService.processRequest({
          prompt: `请为项目 ${tempDir} 生成一个简要的技术文档：
1. 使用Read工具读取README.md了解项目概述
2. 使用Read工具读取package.json了解依赖和脚本
3. 使用Read工具读取主要源文件了解架构
4. 基于这些信息提供项目的技术总结`,
          systemPrompt,
          allowedTools: ['Read', 'Glob'],
          enableToolCalls: true,
          maxTokens: 2000,
          temperature: 0.2
        })

        expect(response.content).toBeDefined()
        
        if (response.hasToolInteraction) {
          console.log('✅ AI 成功进行了文档生成工作流')
          expect(response.content.length).toBeGreaterThan(300)
        }

      } catch (error) {
        handleApiError(error)
      }
    })
  })

  describe('Workflow Performance and Reliability', () => {
    test('should execute workflows within performance bounds', async () => {
      const startTime = Date.now()
      
      const workflow = [
        { toolName: 'Glob', input: { pattern: '**/*', path: tempDir }, context: createTestContext() },
        { toolName: 'Read', input: { file_path: path.join(tempDir, 'package.json') }, context: createTestContext() },
        { toolName: 'Grep', input: { pattern: 'express', path: tempDir }, context: createTestContext() }
      ]

      const results = await orchestrator.executeToolsBatch(workflow)
      const duration = Date.now() - startTime

      expect(results).toHaveLength(3)
      console.log(`⏱️  工作流执行时间: ${duration}ms`)
      
      // 合理的性能期望（5秒内）
      expect(duration).toBeLessThan(5000)
      
      // 验证所有工具都成功执行
      const successfulExecutions = results.filter(r => r.status === ToolExecutionStatus.COMPLETED)
      expect(successfulExecutions.length).toBeGreaterThanOrEqual(2) // 至少成功2个
    })

    test('should provide detailed workflow statistics', async () => {
      // 执行一个简单的工作流
      await orchestrator.executeTool({
        toolName: 'Read',
        input: { file_path: path.join(tempDir, 'package.json') },
        context: createTestContext()
      })

      const stats = orchestrator.getExecutionStats()
      
      expect(stats.totalExecutions).toBeGreaterThan(0)
      expect(stats).toHaveProperty('successfulExecutions')
      expect(stats).toHaveProperty('failedExecutions')
      expect(stats).toHaveProperty('averageExecutionTime')
      expect(stats).toHaveProperty('toolUsageStats')

      console.log('📊 工作流统计信息:', {
        总执行次数: stats.totalExecutions,
        成功次数: stats.successfulExecutions,
        失败次数: stats.failedExecutions,
        平均耗时: Math.round(stats.averageExecutionTime) + 'ms'
      })
    })
  })

  // 辅助函数
  function createTestContext() {
    return {
      messageId: `test-${Date.now()}`,
      agentId: 'workflow-test',
      safeMode: false,
      abortController: new AbortController(),
      readFileTimestamps: {},
      options: {
        verbose: true,
        safeMode: false,
        messageLogName: 'workflow-test'
      }
    }
  }

  function hasRealApiKey(): boolean {
    return !!(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'test-key')
  }

  function handleApiError(error: any) {
    if (error instanceof Error && error.message.includes('API')) {
      console.log('跳过网络测试 - API 调用失败:', error.message)
    } else {
      throw error
    }
  }
})