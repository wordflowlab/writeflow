import { describe, test, expect, beforeEach } from '@jest/globals'
import { ToolManager } from '@/tools/tool-manager.js'
import { WritingTool, ToolInput, ToolResult } from '@/types/tool.js'

// 模拟工具
class MockTool implements WritingTool {
  name: string
  description: string
  securityLevel: 'safe' | 'ai-powered' | 'restricted'
  private shouldSucceed: boolean

  constructor(name: string, securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe', shouldSucceed = true) {
    this.name = name
    this.description = `模拟工具: ${name}`
    this.securityLevel = securityLevel
    this.shouldSucceed = shouldSucceed
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, 10))
    
    if (this.shouldSucceed) {
      return {
        success: true,
        content: `工具 ${this.name} 执行成功`,
        metadata: { input }
      }
    } else {
      return {
        success: false,
        error: `工具 ${this.name} 执行失败`
      }
    }
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    return input && typeof input === 'object'
  }
}

describe('ToolManager', () => {
  let toolManager: ToolManager

  beforeEach(() => {
    toolManager = new ToolManager()
  })

  test('应该注册基础工具', () => {
    const tools = toolManager.getAvailableTools()
    const toolNames = toolManager.getToolNames()
    
    expect(tools.length).toBeGreaterThanOrEqual(3)
    expect(toolNames).toContain('exit_plan_mode')
    expect(toolNames).toContain('todo_write')
    expect(toolNames).toContain('todo_read')
  })

  test('应该能注册和使用自定义工具', async () => {
    const customTool = new MockTool('custom_test')
    toolManager.registerTool(customTool)
    
    expect(toolManager.hasTool('custom_test')).toBe(true)
    
    const result = await toolManager.executeTool('custom_test', { test: 'data' })
    expect(result.success).toBe(true)
    expect(result.content).toContain('custom_test 执行成功')
  })

  test('应该能批量注册工具', () => {
    const tools = [
      new MockTool('batch_1'),
      new MockTool('batch_2'),
      new MockTool('batch_3')
    ]
    
    toolManager.registerTools(tools)
    
    expect(toolManager.hasTool('batch_1')).toBe(true)
    expect(toolManager.hasTool('batch_2')).toBe(true)
    expect(toolManager.hasTool('batch_3')).toBe(true)
  })

  test('应该处理不存在的工具', async () => {
    const result = await toolManager.executeTool('nonexistent_tool', {})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('工具不存在')
  })

  test('应该执行输入验证', async () => {
    const tool = new MockTool('validation_tool')
    toolManager.registerTool(tool)
    
    // 有效输入
    const validResult = await toolManager.executeTool('validation_tool', { valid: true })
    expect(validResult.success).toBe(true)
    
    // 无效输入（null）
    const invalidResult = await toolManager.executeTool('validation_tool', null as any)
    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error).toContain('输入验证失败')
  })

  test('应该支持批量执行工具', async () => {
    const tool1 = new MockTool('batch_exec_1')
    const tool2 = new MockTool('batch_exec_2')
    
    toolManager.registerTools([tool1, tool2])
    
    const results = await toolManager.executeToolsBatch([
      { toolName: 'batch_exec_1', input: { data: 'test1' } },
      { toolName: 'batch_exec_2', input: { data: 'test2' } }
    ])
    
    expect(results.length).toBe(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
  })

  test('应该按安全级别筛选工具', () => {
    const safeTools = [
      new MockTool('safe_1', 'safe'),
      new MockTool('safe_2', 'safe')
    ]
    const aiPoweredTools = [
      new MockTool('ai_1', 'ai-powered'),
      new MockTool('ai_2', 'ai-powered')
    ]
    const restrictedTools = [
      new MockTool('restricted_1', 'restricted')
    ]
    
    toolManager.registerTools([...safeTools, ...aiPoweredTools, ...restrictedTools])
    
    expect(toolManager.getToolsBySecurityLevel('safe').length).toBeGreaterThanOrEqual(2)
    expect(toolManager.getToolsBySecurityLevel('ai-powered').length).toBeGreaterThanOrEqual(1)
    expect(toolManager.getToolsBySecurityLevel('restricted').length).toBeGreaterThanOrEqual(1)
  })

  test('应该收集执行统计数据', async () => {
    const successTool = new MockTool('success_tool', 'safe', true)
    const failTool = new MockTool('fail_tool', 'safe', false)
    
    toolManager.registerTools([successTool, failTool])
    
    // 执行一些工具
    await toolManager.executeTool('success_tool', {})
    await toolManager.executeTool('success_tool', {})
    await toolManager.executeTool('fail_tool', {})
    
    const stats = toolManager.getExecutionStats()
    
    expect(stats.totalExecutions).toBe(3)
    expect(stats.successfulExecutions).toBe(2)
    expect(stats.failedExecutions).toBe(1)
    expect(stats.averageDuration).toBeGreaterThan(0)
    
    expect(stats.toolStats['success_tool'].executions).toBe(2)
    expect(stats.toolStats['success_tool'].successRate).toBe(1.0)
    expect(stats.toolStats['fail_tool'].executions).toBe(1)
    expect(stats.toolStats['fail_tool'].successRate).toBe(0.0)
  })

  test('应该能获取工具信息', () => {
    const customTool = new MockTool('info_tool')
    toolManager.registerTool(customTool)
    
    const toolInfo = toolManager.getToolInfo('info_tool')
    expect(toolInfo).toBeDefined()
    expect(toolInfo?.name).toBe('info_tool')
    expect(toolInfo?.securityLevel).toBe('safe')
    
    expect(toolManager.getToolInfo('nonexistent')).toBeUndefined()
  })

  test('应该能移除工具', () => {
    const removeTool = new MockTool('remove_tool')
    toolManager.registerTool(removeTool)
    
    expect(toolManager.hasTool('remove_tool')).toBe(true)
    
    const removed = toolManager.removeTool('remove_tool')
    expect(removed).toBe(true)
    expect(toolManager.hasTool('remove_tool')).toBe(false)
    
    // 移除不存在的工具
    const notRemoved = toolManager.removeTool('nonexistent')
    expect(notRemoved).toBe(false)
  })

  test('应该能清理执行历史', async () => {
    const testTool = new MockTool('history_tool')
    toolManager.registerTool(testTool)
    
    // 执行一些工具
    await toolManager.executeTool('history_tool', {})
    await toolManager.executeTool('history_tool', {})
    
    let stats = toolManager.getExecutionStats()
    expect(stats.totalExecutions).toBe(2)
    
    toolManager.clearExecutionHistory()
    
    stats = toolManager.getExecutionStats()
    expect(stats.totalExecutions).toBe(0)
  })

  test('应该处理工具执行异常', async () => {
    class ErrorTool implements WritingTool {
      name = 'error_tool'
      description = '会抛异常的工具'
      securityLevel = 'safe' as const
      
      async execute(): Promise<ToolResult> {
        throw new Error('预期的测试错误')
      }
    }
    
    const errorTool = new ErrorTool()
    toolManager.registerTool(errorTool)
    
    const result = await toolManager.executeTool('error_tool', {})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('工具执行异常')
    expect(result.error).toContain('预期的测试错误')
  })
})