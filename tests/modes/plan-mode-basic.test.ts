import { describe, test, expect } from '@jest/globals'
import { PlanModeManager } from '@/modes/PlanModeManager.js'
import { PermissionManager } from '@/tools/PermissionManager.js'
import { ExitPlanModeTool } from '@/tools/ExitPlanMode.js'
import { SystemReminderInjector } from '@/tools/SystemReminderInjector.js'
import { PlanMode } from '@/types/agent.js'

describe('Plan 模式基础测试', () => {
  test('应该能够导入 Plan 模式相关模块', () => {
    expect(PlanModeManager).toBeDefined()
    expect(PermissionManager).toBeDefined()
    expect(ExitPlanModeTool).toBeDefined()
    expect(SystemReminderInjector).toBeDefined()
    expect(PlanMode).toBeDefined()
  })

  test('应该能够创建 Plan 模式管理器实例', () => {
    const planModeManager = new PlanModeManager()
    expect(planModeManager).toBeDefined()
    expect(planModeManager.isInPlanMode()).toBe(false)
  })

  test('应该能够创建权限管理器并检查权限', () => {
    const permissionManager = new PermissionManager()
    expect(permissionManager).toBeDefined()
    
    // 测试默认模式
    const defaultResult = permissionManager.checkToolPermission('edit_article')
    expect(defaultResult.allowed).toBe(true)
    
    // 测试 Plan 模式
    permissionManager.setCurrentMode(PlanMode.Plan)
    const planResult = permissionManager.checkToolPermission('edit_article')
    expect(planResult.allowed).toBe(false)
  })

  test('应该能够执行 ExitPlanMode 工具', async () => {
    const exitPlanTool = new ExitPlanModeTool()
    expect(exitPlanTool).toBeDefined()
    expect(exitPlanTool.name).toBe('exit_plan_mode')
    
    // 测试执行（使用一个好计划）
    const goodPlan = `
# 测试计划

## 步骤 1：分析需求
- 理解用户需求
- 分析技术要求

## 步骤 2：设计方案
- 创建架构设计  
- 定义接口规范

## 步骤 3：实施开发
- 编写核心代码
- 添加单元测试

## 步骤 4：测试验证
- 执行测试用例
- 验证功能正确性
    `.trim()
    
    const result = await exitPlanTool.execute({ plan: goodPlan })
    expect(result.success).toBe(true)
    expect(result.metadata?.approved).toBe(true)
  })

  test('应该正确处理系统提醒', () => {
    const permissionManager = new PermissionManager()
    const reminderInjector = new SystemReminderInjector(permissionManager)
    
    permissionManager.setCurrentMode(PlanMode.Plan)
    
    const reminder = reminderInjector.generateToolCallReminder({
      toolName: 'edit_article',
      parameters: {},
      currentMode: PlanMode.Plan
    })
    
    expect(reminder).not.toBeNull()
    expect(reminder?.type).toBe('tool_restriction')
    expect(reminder?.priority).toBe('high')
  })

  test('应该支持完整的 Plan 模式进入和退出流程', async () => {
    const planModeManager = new PlanModeManager()
    
    // 初始状态
    expect(planModeManager.isInPlanMode()).toBe(false)
    
    // 进入 Plan 模式
    const reminders = await planModeManager.enterPlanMode()
    expect(planModeManager.isInPlanMode()).toBe(true)
    expect(reminders.length).toBeGreaterThan(0)
    
    // 制定计划并退出
    const plan = `
# WriteFlow 增强计划

## 阶段 1：需求分析
1. 分析用户反馈
2. 研究现有架构
3. 确定技术方案

## 阶段 2：实施开发
1. 实现核心功能
2. 编写测试用例
3. 集成现有模块

## 阶段 3：测试验证
1. 执行测试套件
2. 手动功能验证
3. 性能测试优化
    `.trim()
    
    const exitResult = await planModeManager.exitPlanMode(plan)
    expect(exitResult.success).toBe(true)
    expect(exitResult.approved).toBe(true)
    expect(planModeManager.isInPlanMode()).toBe(false)
    
    // 检查计划历史
    const history = planModeManager.getPlanHistory()
    expect(history.length).toBe(1)
    expect(history[0]).toBe(plan)
  })
})