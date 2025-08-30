import { UIMode } from '../types/index.js'

export interface ModeState {
  currentMode: UIMode
  planText?: string
  autoAcceptEnabled: boolean
  bypassPermissions: boolean
  modeHistory: UIMode[]
}

export class ModeManager {
  private state: ModeState = {
    currentMode: UIMode.Default,
    autoAcceptEnabled: false,
    bypassPermissions: false,
    modeHistory: [UIMode.Default]
  }

  private modeOrder: UIMode[] = [
    UIMode.Default,
    UIMode.AcceptEdits,
    UIMode.Plan,
    UIMode.BypassPermissions
  ]

  private listeners: Array<(state: ModeState) => void> = []

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
  setMode(mode: UIMode): void {
    if (mode !== this.state.currentMode) {
      this.state.modeHistory.push(this.state.currentMode)
      this.state.currentMode = mode
      
      // 模式特定的初始化
      this.initializeModeSpecific(mode)
      
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
  private initializeModeSpecific(mode: UIMode): void {
    switch (mode) {
      case UIMode.Plan:
        // 进入计划模式时的设置
        console.log('🚀 进入计划模式 - 只读分析')
        break
        
      case UIMode.AcceptEdits:
        // 进入自动接受模式时的设置
        this.state.autoAcceptEnabled = true
        console.log('✅ 进入自动接受编辑模式')
        break
        
      case UIMode.BypassPermissions:
        // 进入绕过权限模式时的设置
        this.state.bypassPermissions = true
        console.log('🔓 进入绕过权限模式 - 谨慎使用')
        break
        
      case UIMode.Default:
        // 回到默认模式时重置状态
        this.state.autoAcceptEnabled = false
        this.state.bypassPermissions = false
        this.state.planText = undefined
        console.log('🎯 回到默认模式')
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
}