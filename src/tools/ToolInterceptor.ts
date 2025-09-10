import { WritingTool, ToolInput, ToolResult } from '../types/tool.js'
import { PermissionManager, PermissionCheckResult } from './PermissionManager.js'
import { SystemReminderInjector, SystemReminder, ToolCallContext } from './SystemReminderInjector.js'
import { PlanMode } from '../types/agent.js'

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  success: boolean
  data?: any
  error?: string
  reminder?: SystemReminder
  blocked?: boolean
  blockReason?: string
}

/**
 * 工具拦截配置
 */
export interface InterceptorConfig {
  enablePermissionCheck: boolean
  enableSystemReminders: boolean
  strictMode: boolean // 严格模式下，Plan 模式拒绝所有非只读操作
  allowedBypassTools: string[] // 允许绕过检查的工具
}

/**
 * 工具拦截器
 * 复刻 Claude Code 的工具调用拦截机制
 */
export class ToolInterceptor {
  private permissionManager: PermissionManager
  private reminderInjector: SystemReminderInjector
  private config: InterceptorConfig

  constructor(
    permissionManager: PermissionManager,
    reminderInjector: SystemReminderInjector,
    config: Partial<InterceptorConfig> = {},
  ) {
    this.permissionManager = permissionManager
    this.reminderInjector = reminderInjector

    this.config = {
      enablePermissionCheck: true,
      enableSystemReminders: true,
      strictMode: true,
      allowedBypassTools: ['exit_plan_mode', 'get_status', 'help'],
      ...config,
    }
  }

  /**
   * 拦截工具调用
   */
  async interceptToolCall(
    tool: WritingTool,
    input: ToolInput,
    context: ToolCallContext,
  ): Promise<ToolCallResult> {
    const { toolName, currentMode } = context

    try {
      // 1. 权限检查
      if (this.config.enablePermissionCheck) {
        const permissionResult = this.checkPermission(toolName, currentMode)
        if (!permissionResult.allowed) {
          return this.createBlockedResult(toolName, permissionResult)
        }
      }

      // 2. 生成系统提醒
      let reminder: SystemReminder | undefined
      if (this.config.enableSystemReminders) {
        reminder = this.reminderInjector.generateToolCallReminder(context) || undefined
      }

      // 3. 特殊工具处理
      if (toolName === 'exit_plan_mode' && currentMode === PlanMode.Plan) {
        return await this.handleExitPlanMode(tool, input, context, reminder)
      }

      // 4. 执行工具调用
      const result = await this.executeToolCall(tool, input, context)

      return {
        success: true,
        data: result,
        reminder,
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具执行失败',
        reminder: this.reminderInjector.generateToolCallReminder(context) || undefined,
      }
    }
  }

  /**
   * 检查工具权限
   */
  private checkPermission(toolName: string, currentMode: PlanMode): PermissionCheckResult {
    // 始终允许的工具
    if (this.config.allowedBypassTools.includes(toolName)) {
      return { allowed: true }
    }

    const result = this.permissionManager.checkToolPermissionByName(toolName)
    return {
      allowed: result.allowed,
      reason: result.reason,
    }
  }

  /**
   * 创建被阻止的结果
   */
  private createBlockedResult(
    toolName: string, 
    permissionResult: PermissionCheckResult,
  ): ToolCallResult {
    const currentMode = this.permissionManager.getCurrentMode()
    
    const reminder = this.reminderInjector.generateToolCallReminder({
      toolName,
      parameters: {},
      currentMode,
    })

    return {
      success: false,
      blocked: true,
      blockReason: permissionResult.reason || `工具 ${toolName} 在当前模式下被禁止`,
      reminder: reminder || undefined,
    }
  }

  /**
   * 处理 exit_plan_mode 特殊逻辑
   */
  private async handleExitPlanMode(
    tool: WritingTool,
    input: ToolInput,
    context: ToolCallContext,
    reminder?: SystemReminder,
  ): Promise<ToolCallResult> {
    try {
      // 执行 exit_plan_mode 工具
      const result = await this.executeToolCall(tool, input, context)
      
      // 如果计划被批准，生成模式切换提醒
      const exitResult = result.metadata as any
      if (exitResult?.approved) {
        const modeChangeReminder = this.reminderInjector.generateModeChangeReminder(
          PlanMode.Plan,
          PlanMode.Default,
        )
        
        return {
          success: true,
          data: result,
          reminder: modeChangeReminder,
        }
      }

      return {
        success: true,
        data: result,
        reminder,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Exit plan mode 执行失败',
        reminder,
      }
    }
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(
    tool: WritingTool,
    input: ToolInput,
    context: ToolCallContext,
  ): Promise<ToolResult> {
    return await tool.execute(input)
  }

  /**
   * 批量拦截工具调用
   */
  async interceptBatchToolCalls(
    calls: Array<{
      tool: WritingTool
      input: ToolInput
      context: ToolCallContext
    }>,
  ): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = []
    
    for (const call of calls) {
      const result = await this.interceptToolCall(call.tool, call.input, call.context)
      results.push(result)
      
      // 如果遇到被阻止的调用，是否要停止后续调用？
      // 在严格模式下停止
      if (this.config.strictMode && result.blocked) {
        break
      }
    }
    
    return results
  }

  /**
   * 更新拦截器配置
   */
  updateConfig(newConfig: Partial<InterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 获取当前配置
   */
  getConfig(): InterceptorConfig {
    return { ...this.config }
  }

  /**
   * 检查工具是否被允许
   */
  isToolAllowed(toolName: string, currentMode?: PlanMode): boolean {
    if (this.config.allowedBypassTools.includes(toolName)) {
      return true
    }

    const mode = currentMode || this.permissionManager.getCurrentMode()
    const permissionResult = this.permissionManager.checkToolPermissionByName(toolName)
    
    return permissionResult.allowed
  }

  /**
   * 获取当前模式下被禁止的工具列表
   */
  getForbiddenTools(currentMode?: PlanMode): string[] {
    const mode = currentMode || this.permissionManager.getCurrentMode()
    
    // 临时设置模式以获取正确的禁止工具列表
    const originalMode = this.permissionManager.getCurrentMode()
    if (currentMode && currentMode !== originalMode) {
      this.permissionManager.setCurrentMode(currentMode)
    }
    
    const forbiddenTools = this.permissionManager.getForbiddenTools()
    
    // 恢复原始模式
    if (currentMode && currentMode !== originalMode) {
      this.permissionManager.setCurrentMode(originalMode)
    }
    
    return forbiddenTools.filter(tool => !this.config.allowedBypassTools.includes(tool))
  }

  /**
   * 生成工具使用指南
   */
  generateToolUsageGuide(currentMode?: PlanMode): string {
    const mode = currentMode || this.permissionManager.getCurrentMode()
    const allowedTools = this.permissionManager.getAllowedTools()
    const forbiddenTools = this.getForbiddenTools(mode)
    
    const guide = [
      `📚 工具使用指南 - ${this.getModeDisplayName(mode)}`,
      '',
      `✅ 允许使用的工具 (${allowedTools.length}个)：`,
      ...allowedTools.map(tool => `  • ${tool}`),
      '',
      `❌ 禁止使用的工具 (${forbiddenTools.length}个)：`,
      ...forbiddenTools.map(tool => `  • ${tool}`),
    ]

    if (mode === PlanMode.Plan) {
      guide.push(
        '',
        '💡 Plan 模式说明：',
        '  • 当前处于计划制定模式',
        '  • 只能使用只读工具进行分析和研究',
        '  • 完成计划后使用 exit_plan_mode 退出',
        '  • 获得确认后将切换到执行模式',
      )
    }

    return guide.join('\n')
  }

  /**
   * 获取模式显示名称
   */
  private getModeDisplayName(mode: PlanMode): string {
    const modeNames: Record<PlanMode, string> = {
      [PlanMode.Default]: '默认模式',
      [PlanMode.Plan]: '计划模式',
      [PlanMode.AcceptEdits]: '自动接受编辑模式',
      [PlanMode.BypassPermissions]: '绕过权限模式',
    }
    return modeNames[mode] || '未知模式'
  }

  /**
   * 启用严格模式
   */
  enableStrictMode(): void {
    this.config.strictMode = true
  }

  /**
   * 禁用严格模式
   */
  disableStrictMode(): void {
    this.config.strictMode = false
  }

  /**
   * 添加绕过工具
   */
  addBypassTool(toolName: string): void {
    if (!this.config.allowedBypassTools.includes(toolName)) {
      this.config.allowedBypassTools.push(toolName)
    }
  }

  /**
   * 移除绕过工具
   */
  removeBypassTool(toolName: string): void {
    const index = this.config.allowedBypassTools.indexOf(toolName)
    if (index > -1) {
      this.config.allowedBypassTools.splice(index, 1)
    }
  }
}