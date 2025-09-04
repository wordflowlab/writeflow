import { PlanMode } from '../types/agent.js'
import { PermissionManager } from '../tools/PermissionManager.js'
import { SystemReminderInjector, SystemReminder } from '../tools/SystemReminderInjector.js'
import { ToolInterceptor, InterceptorConfig } from '../tools/ToolInterceptor.js'
import { ExitPlanModeTool, ExitPlanModeResult } from '../tools/ExitPlanMode.js'
import { WritingTool } from '../types/WritingTool.js'

/**
 * Plan 模式状态
 */
export interface PlanModeState {
  isActive: boolean
  currentPlan?: string
  planApproved: boolean
  entryTime: number
  planHistory: string[]
  systemReminders: SystemReminder[]
  // 新增：用户确认选项
  confirmationOption?: 'auto_approve' | 'manual_approve' | 'keep_planning'
}

/**
 * Plan 模式配置
 */
export interface PlanModeConfig {
  autoInjectReminders: boolean
  strictPermissionCheck: boolean
  planQualityCheck: boolean
  maxPlanHistory: number
  reminderDisplayDuration: number // 毫秒
}

/**
 * Plan 模式事件
 */
export interface PlanModeEvents {
  onModeEnter?: (previousMode: PlanMode) => void
  onModeExit?: (nextMode: PlanMode, approved: boolean) => void
  onPlanUpdate?: (plan: string) => void
  onPlanApproval?: (approved: boolean, reason?: string) => void
  onSystemReminder?: (reminder: SystemReminder) => void
}

/**
 * Plan 模式管理器
 * 完全复刻 Claude Code 的 Plan 模式机制
 */
export class PlanModeManager {
  private permissionManager: PermissionManager
  private reminderInjector: SystemReminderInjector
  private toolInterceptor: ToolInterceptor
  private exitPlanTool: ExitPlanModeTool

  private state: PlanModeState
  private config: PlanModeConfig
  private events: PlanModeEvents

  // 工具权限配置
  private toolPermissions = {
    // Plan 模式下允许的只读工具
    readOnly: [
      'read_article',
      'search_files', 
      'list_directory',
      'grep',
      'glob',
      'get_status',
      'help',
      'exit_plan_mode',
    ],
    // Plan 模式下禁止的修改工具
    restricted: [
      'write_article',
      'edit_article', 
      'bash',
      'git',
      'npm',
      'install',
      'execute',
    ],
  }

  constructor(
    config: Partial<PlanModeConfig> = {},
    events: PlanModeEvents = {},
  ) {
    // 初始化核心组件
    this.permissionManager = new PermissionManager()
    this.reminderInjector = new SystemReminderInjector(this.permissionManager)
    
    const interceptorConfig: InterceptorConfig = {
      enablePermissionCheck: true,
      enableSystemReminders: true,
      strictMode: true,
      allowedBypassTools: ['exit_plan_mode', 'get_status', 'help', 'read_article', 'search_files', 'list_directory'],
    }
    this.toolInterceptor = new ToolInterceptor(
      this.permissionManager,
      this.reminderInjector,
      interceptorConfig,
    )

    this.exitPlanTool = new ExitPlanModeTool()

    // 初始化状态
    this.state = {
      isActive: false,
      planApproved: false,
      entryTime: 0,
      planHistory: [],
      systemReminders: [],
    }

    // 初始化配置
    this.config = {
      autoInjectReminders: true,
      strictPermissionCheck: true,
      planQualityCheck: true,
      maxPlanHistory: 10,
      reminderDisplayDuration: 300000, // 5分钟
      ...config,
    }

    this.events = events
  }

  /**
   * 进入 Plan 模式
   */
  async enterPlanMode(previousMode: PlanMode = PlanMode.Default): Promise<SystemReminder[]> {
    console.log('🔄 正在进入 Plan 模式...')
    
    // 更新权限管理器模式
    this.permissionManager.setCurrentMode(PlanMode.Plan)

    // 更新状态
    this.state = {
      isActive: true,
      planApproved: false,
      entryTime: Date.now(),
      planHistory: [],
      systemReminders: [],
    }

    // 触发事件
    if (this.events.onModeEnter) {
      this.events.onModeEnter(previousMode)
    }

    console.log('✅ 已成功进入 Plan 模式')
    // 返回空数组，不生成任何系统提醒以保持界面简洁
    return []
  }

  /**
   * 退出 Plan 模式
   */
  async exitPlanMode(plan: string, nextMode: PlanMode = PlanMode.Default): Promise<{
    success: boolean
    approved: boolean
    result?: ExitPlanModeResult
    reminders: SystemReminder[]
  }> {
    console.log('🔄 正在尝试退出 Plan 模式...')
    
    if (!this.state.isActive) {
      return {
        success: false,
        approved: false,
        reminders: [],
      }
    }

    try {
      // 使用 ExitPlanMode 工具验证计划
      const toolResult = await this.exitPlanTool.execute({ plan })
      const exitResult = toolResult.metadata as ExitPlanModeResult
      
      const reminders: SystemReminder[] = []
      
      if (exitResult.approved) {
        // 计划被批准，退出 Plan 模式
        this.permissionManager.setCurrentMode(nextMode)
        
        this.state.isActive = false
        this.state.planApproved = true
        this.state.currentPlan = plan
        this.state.planHistory.push(plan)
        
        // 限制历史记录长度
        if (this.state.planHistory.length > this.config.maxPlanHistory) {
          this.state.planHistory = this.state.planHistory.slice(-this.config.maxPlanHistory)
        }

        // 生成成功退出提醒
        if (this.config.autoInjectReminders) {
          const successReminder = this.reminderInjector.generateModeChangeReminder(PlanMode.Plan, nextMode)
          reminders.push(successReminder)
        }

        // 触发事件
        if (this.events.onModeExit) {
          this.events.onModeExit(nextMode, true)
        }
        if (this.events.onPlanApproval) {
          this.events.onPlanApproval(true)
        }

        console.log('✅ Plan 模式退出成功，计划已批准')
      } else {
        // 计划被拒绝，保持 Plan 模式
        this.state.currentPlan = plan
        
        // 生成拒绝提醒
        const rejectionReminder: SystemReminder = {
          type: 'mode_notification',
          content: [
            '❌ 计划需要改进',
            '',
            `📝 反馈：${exitResult.message}`,
            '',
            '💡 建议的后续步骤：',
            ...(exitResult.nextSteps || []).map(step => `  • ${step}`),
          ].join('\n'),
          priority: 'medium',
          persistent: true,
        }
        reminders.push(rejectionReminder)

        // 触发事件
        if (this.events.onPlanApproval) {
          this.events.onPlanApproval(false, exitResult.message)
        }

        console.log('⚠️ 计划需要改进，请根据反馈调整')
      }

      return {
        success: true,
        approved: exitResult.approved,
        result: exitResult,
        reminders,
      }

    } catch (error) {
      console.error('❌ 退出 Plan 模式时出错:', error)
      
      const errorReminder: SystemReminder = {
        type: 'permission_warning',
        content: [
          '❌ 退出 Plan 模式失败',
          '',
          `错误信息：${error instanceof Error ? error.message : '未知错误'}`,
          '',
          '请重新制定计划并再次尝试',
        ].join('\n'),
        priority: 'high',
        persistent: true,
      }

      return {
        success: false,
        approved: false,
        reminders: [errorReminder],
      }
    }
  }

  /**
   * 更新当前计划
   */
  updateCurrentPlan(plan: string): void {
    if (this.state.isActive) {
      this.state.currentPlan = plan
      
      if (this.events.onPlanUpdate) {
        this.events.onPlanUpdate(plan)
      }
    }
  }

  /**
   * 检查工具调用权限
   */
  async checkToolPermission(toolName: string, parameters: any = {}): Promise<{
    allowed: boolean
    reminder?: SystemReminder
    reason?: string
  }> {
    if (!this.state.isActive) {
      return { allowed: true }
    }

    const context = {
      toolName,
      parameters,
      currentMode: PlanMode.Plan,
    }

    // 使用工具拦截器检查权限
    const isAllowed = this.toolInterceptor.isToolAllowed(toolName, PlanMode.Plan)
    
    if (!isAllowed) {
      const reminder = this.reminderInjector.generateToolCallReminder(context)
      return {
        allowed: false,
        reminder: reminder || undefined,
        reason: `工具 "${toolName}" 在 Plan 模式下被禁止`,
      }
    }

    // 生成使用提醒（非阻止性）
    if (this.config.autoInjectReminders && toolName !== 'exit_plan_mode') {
      const reminder = this.reminderInjector.generateToolCallReminder(context)
      return {
        allowed: true,
        reminder: reminder || undefined,
      }
    }

    return { allowed: true }
  }

  /**
   * 获取当前状态
   */
  getState(): PlanModeState {
    return { ...this.state }
  }

  /**
   * 获取配置
   */
  getConfig(): PlanModeConfig {
    return { ...this.config }
  }

  /**
   * 是否处于 Plan 模式
   */
  isInPlanMode(): boolean {
    return this.state.isActive && this.permissionManager.getCurrentMode() === PlanMode.Plan
  }

  /**
   * 获取当前计划
   */
  getCurrentPlan(): string | undefined {
    return this.state.currentPlan
  }

  /**
   * 获取计划历史
   */
  getPlanHistory(): string[] {
    return [...this.state.planHistory]
  }

  /**
   * 获取活跃的系统提醒
   */
  getActiveReminders(): SystemReminder[] {
    return this.reminderInjector.getActiveReminders()
  }

  /**
   * 清除系统提醒
   */
  clearReminders(): void {
    this.reminderInjector.clearAllReminders()
    this.state.systemReminders = []
  }

  /**
   * 生成 Plan 模式状态报告
   */
  generateStatusReport(): string {
    const report = [
      '📋 Plan 模式状态报告',
      '',
      `🔹 状态：${this.state.isActive ? '激活' : '未激活'}`,
      `🔹 当前模式：${this.permissionManager.getCurrentMode()}`,
    ]

    if (this.state.isActive) {
      const duration = Date.now() - this.state.entryTime
      const minutes = Math.floor(duration / 60000)
      const seconds = Math.floor((duration % 60000) / 1000)
      
      report.push(
        `🔹 激活时长：${minutes}分${seconds}秒`,
        `🔹 当前计划：${this.state.currentPlan ? '已制定' : '未制定'}`,
        `🔹 计划历史：${this.state.planHistory.length} 个`,
      )

      if (this.state.currentPlan) {
        report.push(
          '',
          '📝 当前计划摘要：',
          ...this.state.currentPlan.split('\n').slice(0, 3).map(line => `  ${line}`),
        )
        
        if (this.state.currentPlan.split('\n').length > 3) {
          report.push('  ...')
        }
      }
    }

    const activeReminders = this.getActiveReminders()
    if (activeReminders.length > 0) {
      report.push(
        '',
        `⚠️ 活跃提醒：${activeReminders.length} 个`,
        ...activeReminders.map(reminder => `  • ${reminder.type}: ${reminder.content.split('\n')[0]}`),
      )
    }

    return report.join('\n')
  }

  /**
   * 检查工具是否可以在 Plan 模式下使用
   */
  canUseTool(toolName: string): boolean {
    if (!this.state.isActive) {
      return true // 非 Plan 模式下允许所有工具
    }
    
    return this.toolPermissions.readOnly.includes(toolName)
  }

  /**
   * 检查工具是否被限制
   */
  isToolRestricted(toolName: string): boolean {
    if (!this.state.isActive) {
      return false
    }
    
    return this.toolPermissions.restricted.includes(toolName)
  }

  /**
   * 获取允许的工具列表
   */
  getAllowedTools(): string[] {
    if (!this.state.isActive) {
      return [] // 非 Plan 模式返回空数组，表示不限制
    }
    
    return [...this.toolPermissions.readOnly]
  }

  /**
   * 获取禁止的工具列表
   */
  getForbiddenTools(): string[] {
    if (!this.state.isActive) {
      return []
    }
    
    return [...this.toolPermissions.restricted]
  }

  /**
   * 处理用户确认选项
   */
  async handleUserConfirmation(option: 'auto_approve' | 'manual_approve' | 'keep_planning'): Promise<void> {
    this.state.confirmationOption = option
    
    switch (option) {
      case 'auto_approve':
        // 退出 Plan 模式并启用自动批准
        await this.exitPlanMode(this.state.currentPlan || '', PlanMode.AcceptEdits)
        break
        
      case 'manual_approve':
        // 退出 Plan 模式但保持手动确认
        await this.exitPlanMode(this.state.currentPlan || '', PlanMode.Default)
        break
        
      case 'keep_planning':
        // 保持 Plan 模式，不做任何操作
        console.log('用户选择继续计划模式')
        break
    }
  }

  /**
   * 生成系统提醒
   */
  generateSystemReminder(): SystemReminder {
    return {
      type: 'mode_notification',
      content: `<system-reminder>
Plan mode is active. The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received (for example, to make edits). Instead, you should:

1. Answer the user's query comprehensively
2. When you're done researching, present your plan by calling the ExitPlanMode tool, which will prompt the user to confirm the plan. Do NOT make any file changes or run any tools that modify the system state in any way until the user has confirmed the plan.
</system-reminder>`,
      priority: 'high',
      persistent: true,
    }
  }

  /**
   * 注入系统提醒到消息流
   */
  injectSystemReminder(): SystemReminder | null {
    if (!this.state.isActive) {
      return null
    }
    
    const reminder = this.generateSystemReminder()
    this.state.systemReminders.push(reminder)
    
    if (this.events.onSystemReminder) {
      this.events.onSystemReminder(reminder)
    }
    
    return reminder
  }

  /**
   * 处理 ExitPlanModeTool 调用结果
   */
  async handleExitPlanModeTool(plan: string): Promise<void> {
    // 更新当前计划
    this.state.currentPlan = plan
    
    // 触发计划更新事件
    if (this.events.onPlanUpdate) {
      this.events.onPlanUpdate(plan)
    }
    
    // 生成系统提醒
    const reminder: SystemReminder = {
      type: 'mode_notification',
      content: [
        '📋 Plan 模式计划已制定',
        '',
        '计划内容已准备就绪，请选择执行方式：',
        '• 自动批准编辑 - 退出计划模式并自动执行所有修改',
        '• 手动确认编辑 - 退出计划模式但需手动确认每个修改', 
        '• 继续计划 - 保持计划模式继续完善计划',
      ].join('\n'),
      priority: 'high',
      persistent: true,
    }
    
    this.state.systemReminders.push(reminder)
  }

  /**
   * 重置 Plan 模式管理器
   */
  reset(): void {
    this.permissionManager.setCurrentMode(PlanMode.Default)
    this.state = {
      isActive: false,
      planApproved: false,
      entryTime: 0,
      planHistory: [],
      systemReminders: [],
    }
    this.clearReminders()
  }

  /**
   * 获取工具使用指南
   */
  getToolUsageGuide(): string {
    return this.toolInterceptor.generateToolUsageGuide(PlanMode.Plan)
  }
}