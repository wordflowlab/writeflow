import { UIMode } from '../types/index.js'
import { PlanModeManager, PlanModeState, PlanModeEvents } from '../../modes/PlanModeManager.js'
import { SystemReminder } from '../../tools/SystemReminderInjector.js'
import { PlanMode } from '../../types/agent.js'

import { debugLog } from './../../utils/log.js'

export interface ModeState {
  currentMode: UIMode
  planText?: string
  autoAcceptEnabled: boolean
  bypassPermissions: boolean
  modeHistory: UIMode[]
  planModeState?: PlanModeState
  systemReminders: SystemReminder[]
}

export class ModeManager {
  private state: ModeState = {
    currentMode: UIMode.Default,
    autoAcceptEnabled: false,
    bypassPermissions: false,
    modeHistory: [UIMode.Default],
    systemReminders: []
  }

  private planModeManager: PlanModeManager

  private modeOrder: UIMode[] = [
    UIMode.Default,
    UIMode.AcceptEdits,
    UIMode.Plan,
    UIMode.BypassPermissions
  ]

  private listeners: Array<(state: ModeState) => void> = []

  constructor() {
    // 初始化 Plan 模式管理器
    const planModeEvents: PlanModeEvents = {
      onModeEnter: (previousMode) => {
        debugLog(`📋 Plan 模式激活，从 ${previousMode} 模式切换`)
        this.syncPlanModeState()
      },
      onModeExit: (nextMode, approved) => {
        debugLog(`📋 Plan 模式退出，切换到 ${nextMode} 模式，计划${approved ? '已批准' : '被拒绝'}`)
        this.syncPlanModeState()
      },
      onPlanUpdate: (plan) => {
        this.state.planText = plan
        this.notify()
      },
      onPlanApproval: (approved, reason) => {
        debugLog(`📋 计划${approved ? '批准' : '拒绝'}${reason ? `: ${reason}` : ''}`)
        this.syncPlanModeState()
      },
      onSystemReminder: (reminder) => {
        this.addSystemReminder(reminder)
      }
    }

    this.planModeManager = new PlanModeManager({
      autoInjectReminders: true,
      strictPermissionCheck: true,
      planQualityCheck: true,
      maxPlanHistory: 10,
      reminderDisplayDuration: 300000 // 5分钟
    }, planModeEvents)
  }

  /**
   * 订阅模式状态变化
   */
  subscribe(listener: (state: ModeState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 通知所有订阅者
   */
  private notify(): void {
    this.listeners.forEach(listener => listener({ ...this.state }))
  }

  /**
   * 切换到下一个模式 (Shift+Tab)
   */
  switchToNextMode(): void {
    const currentIndex = this.modeOrder.indexOf(this.state.currentMode)
    const nextIndex = (currentIndex + 1) % this.modeOrder.length
    const nextMode = this.modeOrder[nextIndex]
    
    this.setMode(nextMode)
  }

  /**
   * 设置特定模式
   */
  async setMode(mode: UIMode): Promise<void> {
    if (mode !== this.state.currentMode) {
      this.state.modeHistory.push(this.state.currentMode)
      this.state.currentMode = mode
      
      // 模式特定的初始化
      await this.initializeModeSpecific(mode)
      
      this.notify()
    }
  }

  /**
   * 获取当前状态
   */
  getState(): ModeState {
    return { ...this.state }
  }

  /**
   * 模式特定的初始化
   */
  private async initializeModeSpecific(mode: UIMode): Promise<void> {
    const previousMode = this.state.modeHistory[this.state.modeHistory.length - 1] || UIMode.Default
    
    switch (mode) {
      case UIMode.Plan:
        // 进入计划模式时的设置
        const planModeToAgentMode = this.mapUIModeToPlanMode(previousMode)
        const reminders = await this.planModeManager.enterPlanMode(planModeToAgentMode)
        this.state.systemReminders.push(...reminders)
        this.syncPlanModeState()
        debugLog('🚀 进入计划模式 - 只读分析')
        break
        
      case UIMode.AcceptEdits:
        // 进入自动接受模式时的设置
        this.state.autoAcceptEnabled = true
        debugLog('✅ 进入自动接受编辑模式')
        break
        
      case UIMode.BypassPermissions:
        // 进入绕过权限模式时的设置
        this.state.bypassPermissions = true
        debugLog('🔓 进入绕过权限模式 - 谨慎使用')
        break
        
      case UIMode.Default:
        // 回到默认模式时重置状态
        this.state.autoAcceptEnabled = false
        this.state.bypassPermissions = false
        
        // 如果从 Plan 模式退出但计划未批准，保持计划文本
        if (previousMode !== UIMode.Plan || this.planModeManager.getState().planApproved) {
          this.state.planText = undefined
        }
        
        debugLog('🎯 回到默认模式')
        break
    }
  }

  /**
   * 设置计划文本
   */
  setPlanText(plan: string): void {
    this.state.planText = plan
    this.notify()
  }

  /**
   * 切换自动接受状态
   */
  toggleAutoAccept(): void {
    this.state.autoAcceptEnabled = !this.state.autoAcceptEnabled
    this.notify()
  }

  /**
   * 获取允许的工具列表（基于当前模式）
   */
  getAllowedTools(): string[] {
    switch (this.state.currentMode) {
      case UIMode.Plan:
        return [
          'read', 'search', 'grep', 'glob', 'ls', 
          'web_search', 'context7_resolve', 'context7_get_docs'
        ]
        
      case UIMode.BypassPermissions:
        return [] // 允许所有工具
        
      default:
        return [] // 允许所有工具
    }
  }

  /**
   * 检查工具是否被允许
   */
  isToolAllowed(toolName: string): boolean {
    const allowedTools = this.getAllowedTools()
    return allowedTools.length === 0 || allowedTools.includes(toolName)
  }

  /**
   * 获取模式显示名称
   */
  getModeDisplayName(mode: UIMode = this.state.currentMode): string {
    switch (mode) {
      case UIMode.Plan:
        return 'PLAN'
      case UIMode.AcceptEdits:
        return 'ACCEPT'
      case UIMode.BypassPermissions:
        return 'BYPASS'
      default:
        return 'DEFAULT'
    }
  }

  /**
   * 获取模式颜色
   */
  getModeColor(mode: UIMode = this.state.currentMode): string {
    switch (mode) {
      case UIMode.Plan:
        return 'yellow'
      case UIMode.AcceptEdits:
        return 'green'
      case UIMode.BypassPermissions:
        return 'red'
      default:
        return 'cyan'
    }
  }

  /**
   * 同步 Plan 模式状态
   */
  private syncPlanModeState(): void {
    this.state.planModeState = this.planModeManager.getState()
    this.state.systemReminders = this.planModeManager.getActiveReminders()
  }

  /**
   * 映射 UI 模式到 Agent Plan 模式
   */
  private mapUIModeToPlanMode(uiMode: UIMode): PlanMode {
    switch (uiMode) {
      case UIMode.Plan:
        return PlanMode.Plan
      case UIMode.AcceptEdits:
        return PlanMode.AcceptEdits
      case UIMode.BypassPermissions:
        return PlanMode.BypassPermissions
      default:
        return PlanMode.Default
    }
  }

  /**
   * 添加系统提醒
   */
  private addSystemReminder(reminder: SystemReminder): void {
    this.state.systemReminders.push(reminder)
    this.notify()
  }

  /**
   * 清除系统提醒
   */
  clearSystemReminders(): void {
    this.state.systemReminders = []
    this.planModeManager.clearReminders()
    this.notify()
  }

  /**
   * 获取 Plan 模式管理器
   */
  getPlanModeManager(): PlanModeManager {
    return this.planModeManager
  }

  /**
   * 尝试退出 Plan 模式
   */
  async exitPlanMode(plan: string, nextMode: UIMode = UIMode.Default): Promise<{
    success: boolean
    approved: boolean
    message?: string
  }> {
    if (this.state.currentMode !== UIMode.Plan) {
      return { success: false, approved: false, message: '当前不在 Plan 模式' }
    }

    const nextPlanMode = this.mapUIModeToPlanMode(nextMode)
    const result = await this.planModeManager.exitPlanMode(plan, nextPlanMode)

    if (result.approved) {
      // 计划被批准，切换模式
      await this.setMode(nextMode)
    } else {
      // 计划被拒绝，保持在 Plan 模式
      this.state.systemReminders.push(...result.reminders)
      this.syncPlanModeState()
      this.notify()
    }

    return {
      success: result.success,
      approved: result.approved,
      message: result.result?.message
    }
  }

  /**
   * 检查工具权限（集成 Plan 模式）
   */
  async checkToolPermission(toolName: string, parameters: any = {}): Promise<{
    allowed: boolean
    reminder?: SystemReminder
    reason?: string
  }> {
    if (this.state.currentMode === UIMode.Plan) {
      return await this.planModeManager.checkToolPermission(toolName, parameters)
    }

    // 其他模式的权限检查
    return { allowed: this.isToolAllowed(toolName) }
  }

  /**
   * 生成模式状态报告
   */
  generateStatusReport(): string {
    const reports = [
      `📊 模式管理器状态报告`,
      ``,
      `🔹 当前模式：${this.getModeDisplayName()} (${this.state.currentMode})`,
      `🔹 自动接受：${this.state.autoAcceptEnabled ? '启用' : '禁用'}`,
      `🔹 绕过权限：${this.state.bypassPermissions ? '启用' : '禁用'}`,
      `🔹 系统提醒：${this.state.systemReminders.length} 个`,
    ]

    if (this.state.planText) {
      reports.push(`🔹 当前计划：已制定`)
    }

    if (this.state.currentMode === UIMode.Plan) {
      reports.push(``)
      reports.push(`📋 Plan 模式详情：`)
      reports.push(this.planModeManager.generateStatusReport())
    }

    return reports.join('\n')
  }
}