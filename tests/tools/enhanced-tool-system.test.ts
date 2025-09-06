/**
 * 增强工具系统基础功能测试
 * 验证新工具系统的核心组件是否正常工作
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { 
  getToolOrchestrator,
  getPermissionManager,
  getAvailableTools,
  getTool,
  recommendToolsForTask,
  generateSystemReport,
  ToolOrchestrator,
  PermissionManager,
  ToolPermissionLevel,
  PermissionGrantType,
  ToolExecutionStatus
} from '@/tools/index.js'
import { ToolUseContext } from '@/Tool.js'

// 模拟工具用于测试
class MockTestTool {
  name = 'MockTool'
  category = 'test' as const
  version = '1.0.0'
  tags = ['test', 'mock']

  async description() {
    return '用于测试的模拟工具'
  }

  isReadOnly() {
    return true
  }

  isConcurrencySafe() {
    return true
  }

  needsPermissions() {
    return false
  }

  async isEnabled() {
    return true
  }

  estimateResourceUsage() {
    return {
      cpu: 'low' as const,
      memory: 'low' as const,
      io: 'none' as const,
      network: false,
      duration: 'fast' as const
    }
  }

  async checkPermissions() {
    return { isAllowed: true }
  }

  async validateInput(input: any) {
    return { result: true }
  }

  async *call(input: any, context: ToolUseContext) {
    yield {
      type: 'result' as const,
      data: `Mock tool executed with: ${JSON.stringify(input)}`,
      resultForAssistant: `Mock tool executed successfully`
    }
  }

  renderResultForAssistant(output: any) {
    return String(output)
  }

  renderToolUseMessage(input: any, options: { verbose: boolean }) {
    return `Executing mock tool with ${JSON.stringify(input)}`
  }

  userFacingName() {
    return this.name
  }

  async prompt() {
    return await this.description()
  }
}

describe('Enhanced Tool System - Basic Functionality', () => {
  let orchestrator: ToolOrchestrator
  let permissionManager: PermissionManager
  let mockTool: MockTestTool
  let testContext: ToolUseContext

  beforeEach(() => {
    // 重置工具系统状态
    orchestrator = getToolOrchestrator()
    permissionManager = getPermissionManager()
    mockTool = new MockTestTool()
    
    // 创建测试上下文
    testContext = {
      messageId: 'test-msg',
      agentId: 'test-agent',
      safeMode: false,
      abortController: new AbortController(),
      readFileTimestamps: {},
      options: {
        verbose: true,
        safeMode: false,
        messageLogName: 'test'
      }
    }

    // 清理之前的测试数据
    orchestrator.clearHistory()
  })

  afterEach(() => {
    // 清理测试数据
    orchestrator.clearHistory()
  })

  describe('Tool Orchestrator', () => {
    test('should register tools successfully', () => {
      // 注册模拟工具
      orchestrator.registerTool(mockTool as any)
      
      // 验证工具已注册
      const registeredTool = orchestrator.getTool('MockTool')
      expect(registeredTool).toBeDefined()
      expect(registeredTool?.name).toBe('MockTool')
    })

    test('should execute tool successfully', async () => {
      // 注册并执行工具
      orchestrator.registerTool(mockTool as any)
      
      const result = await orchestrator.executeTool({
        toolName: 'MockTool',
        input: { test: 'data' },
        context: testContext
      })

      expect(result.status).toBe(ToolExecutionStatus.COMPLETED)
      expect(result.result).toContain('Mock tool executed')
      expect(result.toolName).toBe('MockTool')
    })

    test('should handle non-existent tool', async () => {
      const result = await orchestrator.executeTool({
        toolName: 'NonExistentTool',
        input: {},
        context: testContext
      })

      expect(result.status).toBe(ToolExecutionStatus.FAILED)
      expect(result.error?.message).toContain('未找到')
    })

    test('should batch execute tools', async () => {
      // 注册多个模拟工具
      orchestrator.registerTool(mockTool as any)
      
      const tool2 = new MockTestTool()
      tool2.name = 'MockTool2'
      orchestrator.registerTool(tool2 as any)

      // 批量执行
      const results = await orchestrator.executeToolsBatch([
        { toolName: 'MockTool', input: { data: 1 }, context: testContext },
        { toolName: 'MockTool2', input: { data: 2 }, context: testContext }
      ])

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe(ToolExecutionStatus.COMPLETED)
      expect(results[1].status).toBe(ToolExecutionStatus.COMPLETED)
    })

    test('should collect execution statistics', async () => {
      orchestrator.registerTool(mockTool as any)

      // 执行几次工具
      await orchestrator.executeTool({
        toolName: 'MockTool',
        input: { test: 1 },
        context: testContext
      })
      
      await orchestrator.executeTool({
        toolName: 'MockTool',
        input: { test: 2 },
        context: testContext
      })

      const stats = orchestrator.getExecutionStats()
      expect(stats.totalExecutions).toBe(2)
      expect(stats.successfulExecutions).toBe(2)
      expect(stats.toolUsageStats['MockTool']).toBe(2)
    })

    test('should generate usage report', () => {
      const report = orchestrator.generateUsageReport()
      expect(report).toContain('WriteFlow 工具系统使用报告')
      expect(report).toContain('工具执行统计')
      expect(report).toContain('系统配置')
    })
  })

  describe('Permission Manager', () => {
    test('should have default permission policies', () => {
      const stats = permissionManager.getPermissionStats()
      expect(stats.allowedTools).toBeGreaterThan(0)
      expect(stats.currentMode).toBeDefined()
    })

    test('should check tool permissions', async () => {
      const mockWriteTool = new MockTestTool()
      mockWriteTool.name = 'WriteTestTool'
      mockWriteTool.isReadOnly = () => false // 可写工具

      const result = await permissionManager.checkToolPermission(
        mockWriteTool as any,
        {},
        testContext
      )

      expect(result).toHaveProperty('isAllowed')
    })

    test('should grant and track permissions', () => {
      permissionManager.grantPermission('TestTool', PermissionGrantType.SESSION_GRANT)
      
      // 验证权限已授予
      const stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBeGreaterThanOrEqual(1)
    })

    test('should generate permission report', () => {
      const report = permissionManager.generatePermissionReport()
      expect(report).toContain('工具权限报告')
      expect(report).toContain('当前模式')
      expect(report).toContain('权限级别分布')
    })

    test('should clear session data', () => {
      permissionManager.grantPermission('TestTool', PermissionGrantType.SESSION_GRANT)
      permissionManager.clearSession()
      
      const stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBe(0)
    })
  })

  describe('Tool Discovery and Registration', () => {
    test('should get available tools', () => {
      const availableTools = getAvailableTools()
      expect(Array.isArray(availableTools)).toBe(true)
      expect(availableTools.length).toBeGreaterThan(0)
      
      // 验证工具有基本属性
      const firstTool = availableTools[0]
      expect(firstTool).toHaveProperty('name')
      expect(firstTool).toHaveProperty('description')
      expect(typeof firstTool.isReadOnly).toBe('function')
    })

    test('should get specific tool by name', () => {
      // 测试获取已知工具
      const readTool = getTool('Read')
      expect(readTool).toBeDefined()
      expect(readTool?.name).toBe('Read')

      // 测试获取不存在的工具
      const nonExistentTool = getTool('NonExistentTool')
      expect(nonExistentTool).toBeUndefined()
    })

    test('should recommend tools for tasks', () => {
      // 测试文件相关任务推荐
      const fileTaskRecommendations = recommendToolsForTask('需要读取和修改文件')
      expect(Array.isArray(fileTaskRecommendations)).toBe(true)
      
      if (fileTaskRecommendations.length > 0) {
        const toolNames = fileTaskRecommendations.map(tool => tool.name)
        expect(toolNames.some(name => name.includes('Read') || name.includes('Edit'))).toBe(true)
      }

      // 测试搜索相关任务推荐
      const searchTaskRecommendations = recommendToolsForTask('需要搜索和查找内容')
      if (searchTaskRecommendations.length > 0) {
        const toolNames = searchTaskRecommendations.map(tool => tool.name)
        expect(toolNames.some(name => name.includes('Grep') || name.includes('Glob'))).toBe(true)
      }
    })

    test('should generate system report', () => {
      const report = generateSystemReport()
      expect(report).toContain('WriteFlow 工具系统状态报告')
      expect(report).toContain('生成时间')
      expect(report).toContain('工具执行统计')
      expect(report).toContain('工具权限报告')
    })
  })

  describe('Tool Integration', () => {
    test('should work with existing core tools', () => {
      // 验证核心工具是否正确集成
      const coreToolNames = ['Read', 'Write', 'Edit', 'Glob', 'Grep']
      
      for (const toolName of coreToolNames) {
        const tool = getTool(toolName)
        if (tool) { // 工具存在时才进行测试
          expect(tool.name).toBe(toolName)
          expect(typeof tool.description).toBe('function')
          expect(typeof tool.isReadOnly).toBe('function')
          expect(typeof tool.call).toBe('function')
        }
      }
    })

    test('should handle tool metadata correctly', async () => {
      const readTool = getTool('Read')
      if (readTool) {
        const description = await readTool.description()
        expect(typeof description).toBe('string')
        expect(description.length).toBeGreaterThan(0)

        expect(typeof readTool.isReadOnly()).toBe('boolean')
        expect(typeof readTool.isConcurrencySafe()).toBe('boolean')
        expect(typeof readTool.needsPermissions()).toBe('boolean')
      }
    })

    test('should support tool categorization', () => {
      const availableTools = getAvailableTools()
      
      // 验证工具有分类信息
      for (const tool of availableTools.slice(0, 3)) { // 只检查前3个工具
        if ('category' in tool) {
          expect(typeof (tool as any).category).toBe('string')
        }
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle tool execution errors gracefully', async () => {
      // 创建一个会抛错的工具
      class ErrorTool extends MockTestTool {
        name = 'ErrorTool'
        
        async *call() {
          throw new Error('Test error')
        }
      }

      const errorTool = new ErrorTool()
      orchestrator.registerTool(errorTool as any)

      const result = await orchestrator.executeTool({
        toolName: 'ErrorTool',
        input: {},
        context: testContext
      })

      expect(result.status).toBe(ToolExecutionStatus.FAILED)
      expect(result.error?.message).toContain('Test error')
    })

    test('should handle permission denied scenarios', async () => {
      // 创建一个权限被拒绝的工具
      class RestrictedTool extends MockTestTool {
        name = 'RestrictedTool'
        
        isReadOnly() {
          return false
        }
        
        needsPermissions() {
          return true
        }
        
        async checkPermissions() {
          return {
            isAllowed: false,
            denialReason: 'Test permission denial'
          }
        }
      }

      const restrictedTool = new RestrictedTool()
      orchestrator.registerTool(restrictedTool as any)

      const result = await orchestrator.executeTool({
        toolName: 'RestrictedTool',
        input: {},
        context: testContext
      })

      expect(result.status).toBe(ToolExecutionStatus.FAILED)
      expect(result.error?.message).toContain('权限被拒绝')
    })

    test('should handle invalid input gracefully', async () => {
      class ValidatingTool extends MockTestTool {
        name = 'ValidatingTool'
        
        async validateInput(input: any) {
          if (!input || !input.required) {
            return {
              result: false,
              message: 'Missing required field'
            }
          }
          return { result: true }
        }
      }

      const validatingTool = new ValidatingTool()
      orchestrator.registerTool(validatingTool as any)

      const result = await orchestrator.executeTool({
        toolName: 'ValidatingTool',
        input: {}, // 缺少必需字段
        context: testContext
      })

      expect(result.status).toBe(ToolExecutionStatus.FAILED)
      expect(result.error?.message).toContain('输入验证失败')
    })
  })
})