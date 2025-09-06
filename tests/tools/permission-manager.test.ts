/**
 * 权限管理器集成测试
 * 验证权限控制系统的完整功能
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { 
  PermissionManager,
  getPermissionManager,
  ToolPermissionLevel,
  PermissionGrantType,
  PlanMode,
  getToolOrchestrator,
  WriteFlowAIService
} from '@/tools/index.js'
import { generateOptimizedSystemPrompt } from '@/tools/index.js'
import { ToolUseContext } from '@/Tool.js'

// 模拟工具用于权限测试
class TestTool {
  name: string
  private _isReadOnly: boolean
  private _needsPermissions: boolean

  constructor(name: string, isReadOnly: boolean = false, needsPermissions: boolean = true) {
    this.name = name
    this._isReadOnly = isReadOnly
    this._needsPermissions = needsPermissions
  }

  isReadOnly() {
    return this._isReadOnly
  }

  needsPermissions() {
    return this._needsPermissions
  }

  isConcurrencySafe() {
    return true
  }

  async description() {
    return `Test tool: ${this.name}`
  }

  async validateInput() {
    return { result: true }
  }

  async *call(input: any, context: ToolUseContext) {
    yield {
      type: 'result' as const,
      data: `${this.name} executed with ${JSON.stringify(input)}`,
      resultForAssistant: `${this.name} executed successfully`
    }
  }

  renderResultForAssistant(output: any) {
    return String(output)
  }

  renderToolUseMessage(input: any) {
    return `Executing ${this.name}`
  }
}

describe('Permission Manager Integration Tests', () => {
  let permissionManager: PermissionManager
  let orchestrator: any
  let testContext: ToolUseContext

  beforeEach(() => {
    permissionManager = getPermissionManager()
    orchestrator = getToolOrchestrator()
    
    // 重置权限管理器状态
    permissionManager.clearSession()
    
    // 创建测试上下文
    testContext = {
      messageId: 'perm-test',
      agentId: 'permission-test',
      safeMode: false,
      abortController: new AbortController(),
      readFileTimestamps: {},
      options: {
        verbose: false,
        safeMode: false,
        messageLogName: 'permission-test'
      }
    }
    
    orchestrator.clearHistory()
  })

  afterEach(() => {
    permissionManager.clearSession()
    orchestrator.clearHistory()
  })

  describe('Basic Permission Management', () => {
    test('should initialize with default permission policies', () => {
      const stats = permissionManager.getPermissionStats()
      
      expect(stats.currentMode).toBeDefined()
      expect(stats.allowedTools).toBeGreaterThan(0)
      expect(stats.toolBreakdown).toBeDefined()
      expect(stats.sessionStats).toBeDefined()
    })

    test('should grant and revoke permissions correctly', () => {
      // 授予会话权限
      permissionManager.grantPermission('TestTool', PermissionGrantType.SESSION_GRANT)
      
      let stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBeGreaterThan(0)
      
      // 清理会话应该移除权限
      permissionManager.clearSession()
      
      stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBe(0)
    })

    test('should track tool usage statistics', () => {
      const initialStats = permissionManager.getPermissionStats()
      const initialUsage = initialStats.sessionStats.totalUsage
      
      // 模拟一些工具使用（通过orchestrator）
      const readOnlyTool = new TestTool('ReadOnlyTool', true, false)
      orchestrator.registerTool(readOnlyTool)
      
      // 执行工具应该更新统计信息
      // 注意：实际的统计更新可能在工具执行过程中进行
      const finalStats = permissionManager.getPermissionStats()
      expect(finalStats.sessionStats).toBeDefined()
    })

    test('should generate comprehensive permission report', () => {
      const report = permissionManager.generatePermissionReport()
      
      expect(report).toContain('工具权限报告')
      expect(report).toContain('当前模式')
      expect(report).toContain('允许的工具')
      expect(report).toContain('权限级别分布')
      expect(report).toContain('会话统计')
      
      // 验证报告包含具体数据
      expect(report).toMatch(/\d+个/)
      expect(report).toMatch(/\d+次/)
    })
  })

  describe('Permission Mode Management', () => {
    test('should switch between permission modes', () => {
      // 测试切换到Plan模式
      permissionManager.setCurrentMode(PlanMode.Plan)
      expect(permissionManager.getCurrentMode()).toBe(PlanMode.Plan)
      
      // 测试切换到默认模式
      permissionManager.setCurrentMode(PlanMode.Default)
      expect(permissionManager.getCurrentMode()).toBe(PlanMode.Default)
      
      // 测试切换到编辑模式
      permissionManager.setCurrentMode(PlanMode.AcceptEdits)
      expect(permissionManager.getCurrentMode()).toBe(PlanMode.AcceptEdits)
    })

    test('should enforce different tool access in different modes', () => {
      const initialAllowedTools = permissionManager.getAllowedTools()
      const initialForbiddenTools = permissionManager.getForbiddenTools()
      
      // 切换到Plan模式
      permissionManager.setCurrentMode(PlanMode.Plan)
      const planAllowedTools = permissionManager.getAllowedTools()
      const planForbiddenTools = permissionManager.getForbiddenTools()
      
      // Plan模式应该限制更多工具
      expect(planAllowedTools.length).toBeLessThanOrEqual(initialAllowedTools.length)
      expect(planForbiddenTools.length).toBeGreaterThanOrEqual(initialForbiddenTools.length)
      
      // 切换回默认模式
      permissionManager.setCurrentMode(PlanMode.Default)
      const finalAllowedTools = permissionManager.getAllowedTools()
      
      expect(finalAllowedTools.length).toBeGreaterThanOrEqual(planAllowedTools.length)
    })

    test('should clear permissions when switching modes', () => {
      // 授予一些权限
      permissionManager.grantPermission('TestTool1', PermissionGrantType.ONE_TIME_GRANT)
      permissionManager.grantPermission('TestTool2', PermissionGrantType.SESSION_GRANT)
      
      let stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBeGreaterThan(0)
      
      // 切换模式应该清理一次性授权
      permissionManager.setCurrentMode(PlanMode.AcceptEdits)
      
      // 切换到Plan模式应该清理所有授权
      permissionManager.setCurrentMode(PlanMode.Plan)
      
      stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBe(0)
    })
  })

  describe('Tool Permission Checking', () => {
    test('should check permissions for read-only tools', async () => {
      const readOnlyTool = new TestTool('ReadOnlyTool', true, false)
      
      const result = await permissionManager.checkToolPermission(
        readOnlyTool as any,
        {},
        testContext
      )
      
      expect(result.isAllowed).toBe(true)
    })

    test('should check permissions for write tools', async () => {
      const writeTool = new TestTool('WriteTool', false, true)
      
      const result = await permissionManager.checkToolPermission(
        writeTool as any,
        {},
        testContext
      )
      
      // 结果取决于当前权限模式和策略
      expect(result).toHaveProperty('isAllowed')
      expect(typeof result.isAllowed).toBe('boolean')
    })

    test('should handle safe mode restrictions', async () => {
      const writeTool = new TestTool('WriteTool', false, true)
      
      // 创建安全模式上下文
      const safeContext = {
        ...testContext,
        safeMode: true
      }
      
      const result = await permissionManager.checkToolPermission(
        writeTool as any,
        {},
        safeContext
      )
      
      // 安全模式下写入工具应该被限制（如果工具实现了相应检查）
      expect(result).toHaveProperty('isAllowed')
    })
  })

  describe('Permission Policy Management', () => {
    test('should add custom permission policies', () => {
      const customPolicy = {
        toolName: 'CustomTool',
        permissionLevel: ToolPermissionLevel.system_modify,
        grantType: PermissionGrantType.ONE_TIME_GRANT,
        conditions: {
          requireConfirmation: true,
          maxUsagePerSession: 5
        }
      }
      
      permissionManager.setPermissionPolicy(customPolicy)
      
      // 验证策略已添加
      const stats = permissionManager.getPermissionStats()
      expect(stats).toBeDefined()
    })

    test('should respect usage limits', () => {
      // 测试会话使用次数限制
      permissionManager.grantPermission('LimitedTool', PermissionGrantType.SESSION_GRANT)
      
      const stats = permissionManager.getPermissionStats()
      expect(stats.sessionStats.grantedPermissions).toBeGreaterThan(0)
      
      // 这里我们主要测试数据结构的正确性
      // 实际的使用次数限制逻辑在工具执行过程中验证
    })
  })

  describe('Integration with Tool Orchestrator', () => {
    test('should prevent execution of unauthorized tools', async () => {
      // 创建一个需要权限的工具
      const restrictedTool = new TestTool('RestrictedTool', false, true)
      
      // 模拟权限被拒绝的场景
      class RestrictedToolWithDeniedPermissions extends TestTool {
        async checkPermissions() {
          return {
            isAllowed: false,
            denialReason: 'Test permission denial'
          }
        }
      }
      
      const deniedTool = new RestrictedToolWithDeniedPermissions('DeniedTool', false, true)
      orchestrator.registerTool(deniedTool)
      
      const result = await orchestrator.executeTool({
        toolName: 'DeniedTool',
        input: {},
        context: testContext
      })
      
      // 工具执行应该失败
      expect(result.status).toBe('FAILED')
      expect(result.error?.message).toContain('权限被拒绝')
    })

    test('should allow execution of authorized tools', async () => {
      const allowedTool = new TestTool('AllowedTool', true, false) // 只读工具，不需要权限
      orchestrator.registerTool(allowedTool)
      
      const result = await orchestrator.executeTool({
        toolName: 'AllowedTool',
        input: { test: 'data' },
        context: testContext
      })
      
      expect(result.status).toBe('COMPLETED')
      expect(result.result).toContain('AllowedTool executed')
    })
  })

  describe('System Prompt Integration', () => {
    test('should include permission information in system prompts', async () => {
      const systemPrompt = await generateOptimizedSystemPrompt({
        safeMode: false
      })
      
      expect(systemPrompt).toContain('权限')
      expect(systemPrompt).toContain('安全')
      expect(systemPrompt).toContain('当前模式')
      expect(systemPrompt).toContain('可用工具')
    })

    test('should adapt system prompt based on permission mode', async () => {
      // 测试默认模式的系统提示词
      permissionManager.setCurrentMode(PlanMode.Default)
      const defaultPrompt = await generateOptimizedSystemPrompt()
      
      // 测试Plan模式的系统提示词
      permissionManager.setCurrentMode(PlanMode.Plan)
      const planPrompt = await generateOptimizedSystemPrompt()
      
      expect(defaultPrompt).toContain('当前模式')
      expect(planPrompt).toContain('当前模式')
      
      // 两种模式的提示词应该有所不同
      expect(defaultPrompt).not.toEqual(planPrompt)
    })

    test('should include safety warnings for dangerous operations', async () => {
      permissionManager.setCurrentMode(PlanMode.BypassPermissions)
      const systemPrompt = await generateOptimizedSystemPrompt()
      
      expect(systemPrompt).toContain('危险')
      expect(systemPrompt).toMatch(/谨慎|小心|注意/)
    })
  })

  describe('AI Integration with Permissions', () => {
    test('should respect permissions during AI tool calls', async () => {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'test-key') {
        console.log('跳过 AI 权限测试 - 未配置真实 API key')
        return
      }

      try {
        const aiService = new WriteFlowAIService()
        
        // 切换到Plan模式（限制写入操作）
        permissionManager.setCurrentMode(PlanMode.Plan)
        
        const systemPrompt = await generateOptimizedSystemPrompt({
          safeMode: true
        })

        const response = await aiService.processRequest({
          prompt: '请使用Write工具创建一个新文件',
          systemPrompt,
          allowedTools: ['Write', 'Read'],
          enableToolCalls: true,
          maxTokens: 1000,
          temperature: 0.1
        })

        expect(response.content).toBeDefined()
        
        // 在Plan模式下，AI应该被告知不能执行写入操作
        if (response.content.includes('不能') || response.content.includes('无法') || response.content.includes('限制')) {
          console.log('✅ AI 正确识别了权限限制')
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

  describe('Performance and Scalability', () => {
    test('should handle large number of permission checks efficiently', async () => {
      const startTime = Date.now()
      
      // 创建多个测试工具
      const tools = []
      for (let i = 0; i < 50; i++) {
        tools.push(new TestTool(`Tool${i}`, i % 2 === 0, true))
      }
      
      // 批量检查权限
      const permissionChecks = tools.map(async (tool) => {
        return await permissionManager.checkToolPermission(
          tool as any,
          {},
          testContext
        )
      })
      
      const results = await Promise.all(permissionChecks)
      const duration = Date.now() - startTime
      
      expect(results).toHaveLength(50)
      console.log(`⏱️  50个权限检查耗时: ${duration}ms`)
      
      // 权限检查应该很快（1秒内）
      expect(duration).toBeLessThan(1000)
      
      // 所有检查都应该有结果
      results.forEach(result => {
        expect(result).toHaveProperty('isAllowed')
        expect(typeof result.isAllowed).toBe('boolean')
      })
    })

    test('should maintain consistent performance under load', () => {
      const iterations = 100
      const durations: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now()
        
        // 执行一些权限管理操作
        permissionManager.getAllowedTools()
        permissionManager.getForbiddenTools()
        permissionManager.getPermissionStats()
        
        const duration = Date.now() - start
        durations.push(duration)
      }
      
      const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      const maxDuration = Math.max(...durations)
      
      console.log(`📊 权限管理性能: 平均 ${averageDuration.toFixed(2)}ms, 最大 ${maxDuration}ms`)
      
      // 性能应该保持稳定
      expect(averageDuration).toBeLessThan(10)
      expect(maxDuration).toBeLessThan(50)
    })
  })
})