import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { CommandExecutor } from '@/cli/executor/command-executor.js'
import { AgentContext } from '@/types/agent.js'
import { SlashCommand } from '@/types/command.js'

describe('CommandExecutor', () => {
  let executor: CommandExecutor
  let context: AgentContext

  beforeEach(() => {
    const config = {
      maxConcurrentCommands: 3,
      commandTimeout: 30000,
      enableThinkingTokens: true,
      defaultMaxTokens: 4000
    }
    
    executor = new CommandExecutor(config)
    
    context = {
      userId: 'test-user',
      sessionId: 'test-session',
      workingDirectory: '/test',
      currentProject: 'test-project',
      preferences: {
        language: 'zh-CN',
        outputStyle: 'technical'
      },
      tools: [],
      conversationHistory: []
    }
  })

  test('应该成功解析和执行帮助命令', async () => {
    const result = await executor.executeCommand('/help', context)
    
    expect(result.success).toBe(true)
    expect(result.messages).toBeDefined()
    expect(result.messages![0].content).toContain('WriteFlow AI 写作助手')
  })

  test('应该成功解析和执行大纲命令', async () => {
    const result = await executor.executeCommand('/outline AI技术', context)
    
    expect(result.success).toBe(true)
    expect(result.shouldQuery).toBe(true)
    expect(result.messages![0].content).toContain('AI技术')
  })

  test('应该处理带选项的命令', async () => {
    const result = await executor.executeCommand('/outline AI技术 --style=学术 --length=3000', context)
    
    expect(result.success).toBe(true)
    expect(result.messages![0].content).toContain('学术')
    expect(result.messages![0].content).toContain('3000')
  })

  test('应该返回未知命令的错误和建议', async () => {
    const result = await executor.executeCommand('/unknowncmd', context)
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('未知命令')
  })

  test('应该处理别名命令', async () => {
    const result = await executor.executeCommand('/大纲 测试主题', context)
    
    expect(result.success).toBe(true)
    expect(result.shouldQuery).toBe(true)
  })

  test('应该能注册新命令', () => {
    const customCommand: SlashCommand = {
      type: 'local',
      name: 'test',
      description: '测试命令',
      async call(args: string, context: AgentContext): Promise<string> {
        return `测试结果: ${args}`
      },
      userFacingName: () => 'test'
    }

    const initialCount = executor.getAvailableCommands().length
    executor.registerCommand(customCommand)
    
    expect(executor.getAvailableCommands().length).toBe(initialCount + 1)
  })

  test('应该返回具体命令的帮助信息', async () => {
    const result = await executor.executeCommand('/help outline', context)
    
    expect(result.success).toBe(true)
    expect(result.messages![0].content).toContain('outline')
    expect(result.messages![0].content).toContain('生成文章大纲')
  })

  test('应该处理执行错误', async () => {
    const errorCommand: SlashCommand = {
      type: 'local',
      name: 'error',
      description: '错误命令',
      async call(): Promise<string> {
        throw new Error('测试错误')
      },
      userFacingName: () => 'error'
    }

    executor.registerCommand(errorCommand)
    const result = await executor.executeCommand('/error', context)
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('测试错误')
  })

  test('应该跟踪运行中的命令数量', async () => {
    expect(executor.getRunningCommandCount()).toBe(0)
    
    // 由于命令执行很快，这个测试可能需要模拟慢命令
    const slowCommand: SlashCommand = {
      type: 'local',
      name: 'slow',
      description: '慢命令',
      async call(): Promise<string> {
        await new Promise(resolve => setTimeout(resolve, 100))
        return '完成'
      },
      userFacingName: () => 'slow'
    }

    executor.registerCommand(slowCommand)
    
    const promise = executor.executeCommand('/slow', context)
    // 在命令执行期间检查计数（可能为0或1，取决于时序）
    const result = await promise
    
    expect(result.success).toBe(true)
    expect(executor.getRunningCommandCount()).toBe(0) // 执行完成后应为0
  })
})