import { PlanMode } from '../types/agent.js'
import { PermissionManager } from './PermissionManager.js'

/**
 * 系统提醒类型定义
 */
export interface SystemReminder {
  type: 'tool_restriction' | 'mode_notification' | 'permission_warning'
  content: string
  priority: 'high' | 'medium' | 'low'
  persistent: boolean // 是否持续显示
}

/**
 * 工具调用上下文
 */
export interface ToolCallContext {
  toolName: string
  parameters: any
  currentMode: PlanMode
  userId?: string
  sessionId?: string
}

/**
 * 系统提醒注入器
 * 复刻 Claude Code 的系统限制机制
 */
export class SystemReminderInjector {
  private permissionManager: PermissionManager
  private activeReminders: Map<string, SystemReminder> = new Map()

  constructor(permissionManager: PermissionManager) {
    this.permissionManager = permissionManager
  }

  /**
   * 为工具调用生成系统提醒
   */
  generateToolCallReminder(context: ToolCallContext): SystemReminder | null {
    const { toolName, currentMode } = context
    
    // 检查工具权限
    const permissionResult = this.permissionManager.checkToolPermissionByName(toolName)
    
    if (!permissionResult.allowed) {
      return {
        type: 'tool_restriction',
        content: this.formatToolRestrictionReminder(toolName, currentMode, permissionResult.reason || ''),
        priority: 'high',
        persistent: true,
      }
    }

    // Plan 模式的特殊提醒
    if (currentMode === PlanMode.Plan && toolName !== 'exit_plan_mode') {
      return {
        type: 'mode_notification',
        content: this.formatPlanModeReminder(toolName),
        priority: 'medium',
        persistent: false,
      }
    }

    return null
  }

  /**
   * 生成模式切换提醒
   */
  generateModeChangeReminder(fromMode: PlanMode, toMode: PlanMode): SystemReminder {
    return {
      type: 'mode_notification',
      content: this.formatModeChangeReminder(fromMode, toMode),
      priority: 'medium',
      persistent: false,
    }
  }

  /**
   * 格式化工具限制提醒（完全复刻 Claude Code）
   */
  private formatToolRestrictionReminder(
    toolName: string, 
    currentMode: PlanMode, 
    reason: string,
  ): string {
    const reminders = [
      `🚫 工具调用被拒绝：${toolName}`,
      `📋 当前模式：${this.getModeDisplayName(currentMode)}`,
      `❌ 拒绝原因：${reason}`,
    ]

    // 添加具体的解决建议
    if (currentMode === PlanMode.Plan) {
      reminders.push('')
      reminders.push('💡 解决方案：')
      
      if (toolName === 'exit_plan_mode') {
        // 这种情况理论上不会发生，因为 exit_plan_mode 在 Plan 模式是允许的
        reminders.push('  • exit_plan_mode 应该在 Plan 模式下可用，这可能是配置错误')
      } else {
        reminders.push('  • 完成当前计划制定')
        reminders.push('  • 使用 exit_plan_mode 工具退出计划模式')
        reminders.push('  • 获得用户确认后再执行修改操作')
      }
      
      reminders.push('')
      reminders.push('📖 Plan 模式说明：')
      reminders.push('  • 只允许只读分析和研究工具')
      reminders.push('  • 禁止文件修改、命令执行等操作')
      reminders.push('  • 确保在执行前制定完整计划')
    }

    return reminders.join('\n')
  }

  /**
   * 格式化 Plan 模式提醒
   */
  private formatPlanModeReminder(toolName: string): string {
    return [
      `📋 Plan 模式提醒：使用工具 "${toolName}"`,
      '✓ 此工具在计划模式下可用',
      '💡 请记住：当前处于只读分析模式，完成计划后使用 exit_plan_mode 退出',
    ].join('\n')
  }

  /**
   * 格式化模式切换提醒
   */
  private formatModeChangeReminder(fromMode: PlanMode, toMode: PlanMode): string {
    const fromName = this.getModeDisplayName(fromMode)
    const toName = this.getModeDisplayName(toMode)
    
    // Claude Code 风格：简洁的状态切换信息，无详细说明
    return `模式切换: ${fromName} → ${toName}`
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
   * 注入系统提醒到消息流
   */
  injectReminder(reminder: SystemReminder): string {
    const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    if (reminder.persistent) {
      this.activeReminders.set(reminderId, reminder)
    }

    return this.formatSystemReminderMessage(reminder)
  }

  /**
   * 格式化系统提醒消息（复刻 Claude Code 格式）
   */
  private formatSystemReminderMessage(reminder: SystemReminder): string {
    // Claude Code 风格：简洁的系统消息，无复杂格式
    return reminder.content
  }

  /**
   * 清除过期的持续提醒
   */
  clearExpiredReminders(): void {
    // 在我们的实现中，可以根据时间戳清除过期提醒
    const now = Date.now()
    const expireTime = 5 * 60 * 1000 // 5分钟过期

    for (const [id, reminder] of this.activeReminders) {
      const timestamp = parseInt(id.split('_')[1])
      if (now - timestamp > expireTime) {
        this.activeReminders.delete(id)
      }
    }
  }

  /**
   * 获取当前活跃的提醒
   */
  getActiveReminders(): SystemReminder[] {
    this.clearExpiredReminders()
    return Array.from(this.activeReminders.values())
  }

  /**
   * 清除所有提醒
   */
  clearAllReminders(): void {
    this.activeReminders.clear()
  }

  /**
   * 生成 Plan 模式进入时的系统提醒
   */
  generatePlanModeEntryReminder(): SystemReminder {
    return {
      type: 'mode_notification',
      content: [
        '📋 已进入计划模式',
        '',
        '🔍 在此模式下，我将：',
        '  • 分析现有代码和需求',
        '  • 制定详细的实施计划',
        '  • 只使用只读工具进行研究',
        '',
        '🚫 以下操作被禁止：',
        '  • 修改文件',
        '  • 执行系统命令',
        '  • 安装依赖',
        '  • 其他可能造成更改的操作',
        '',
        '✅ 计划完成后，我会使用 exit_plan_mode 工具请求您的确认',
        '获得批准后将切换到执行模式进行实际的代码修改。',
        '',
        '这种方式确保了安全性，避免了意外的系统更改。',
      ].join('\n'),
      priority: 'medium',
      persistent: false,
    }
  }

  /**
   * 生成危险操作警告提醒
   */
  generateDangerousOperationWarning(toolName: string, operation: string): SystemReminder {
    return {
      type: 'permission_warning',
      content: [
        `⚠️ 危险操作警告：${toolName}`,
        '',
        `🔥 即将执行：${operation}`,
        '',
        '⚡ 风险提示：',
        '  • 此操作可能不可逆',
        '  • 可能影响系统稳定性',
        '  • 建议在测试环境中验证',
        '',
        '🛡️ 安全建议：',
        '  • 确认操作的必要性',
        '  • 备份重要数据',
        '  • 仔细检查参数',
      ].join('\n'),
      priority: 'high',
      persistent: true,
    }
  }

  /**
   * 检查工具调用是否需要生成提醒
   */
  shouldGenerateReminder(context: ToolCallContext): boolean {
    const { toolName, currentMode } = context

    // Plan 模式下总是需要检查
    if (currentMode === PlanMode.Plan) {
      return true
    }

    // 危险操作总是需要警告
    const permissionResult = this.permissionManager.checkToolPermissionByName(toolName)
    if (!permissionResult.allowed) {
      return true
    }

    return false
  }

  /**
   * 批量生成提醒（用于模式切换时）
   */
  generateBatchReminders(contexts: ToolCallContext[]): SystemReminder[] {
    const reminders: SystemReminder[] = []
    
    for (const context of contexts) {
      const reminder = this.generateToolCallReminder(context)
      if (reminder) {
        reminders.push(reminder)
      }
    }

    return reminders
  }
}