import { PlanMode } from '../types/agent.js'

/**
 * 工具权限级别定义
 */
export enum ToolPermissionLevel {
  READ_ONLY = 'read_only',        // 只读工具：搜索、读取、分析
  SAFE_WRITE = 'safe_write',      // 安全写入：日志、临时文件
  SYSTEM_MODIFY = 'system_modify', // 系统修改：编辑文件、执行命令
  DANGEROUS = 'dangerous'         // 危险操作：删除、格式化、网络请求
}

/**
 * 工具分类配置
 */
export const TOOL_PERMISSIONS: Record<string, ToolPermissionLevel> = {
  // 只读工具（Plan模式允许）
  'read_article': ToolPermissionLevel.READ_ONLY,
  'search_files': ToolPermissionLevel.READ_ONLY,
  'list_directory': ToolPermissionLevel.READ_ONLY,
  'get_status': ToolPermissionLevel.READ_ONLY,
  'anthropic_client': ToolPermissionLevel.READ_ONLY,
  'deepseek_client': ToolPermissionLevel.READ_ONLY,
  'qwen_client': ToolPermissionLevel.READ_ONLY,
  'glm_client': ToolPermissionLevel.READ_ONLY,
  'web_search': ToolPermissionLevel.READ_ONLY,
  'exit_plan_mode': ToolPermissionLevel.READ_ONLY, // 特殊：允许在Plan模式使用
  
  // 安全写入工具（Plan模式禁止）
  'write_log': ToolPermissionLevel.SAFE_WRITE,
  'save_memory_note': ToolPermissionLevel.SAFE_WRITE,
  
  // 系统修改工具（Plan模式严格禁止）
  'edit_article': ToolPermissionLevel.SYSTEM_MODIFY,
  'write_article': ToolPermissionLevel.SYSTEM_MODIFY,
  'execute_command': ToolPermissionLevel.SYSTEM_MODIFY,
  'install_package': ToolPermissionLevel.SYSTEM_MODIFY,
  'git_commit': ToolPermissionLevel.SYSTEM_MODIFY,
  'modify_config': ToolPermissionLevel.SYSTEM_MODIFY,
  
  // 危险操作工具（始终需要特别权限）
  'delete_file': ToolPermissionLevel.DANGEROUS,
  'format_disk': ToolPermissionLevel.DANGEROUS,
  'system_restart': ToolPermissionLevel.DANGEROUS
}

/**
 * 模式权限映射
 */
export const MODE_PERMISSION_MAP: Record<PlanMode, ToolPermissionLevel[]> = {
  [PlanMode.Default]: [
    ToolPermissionLevel.READ_ONLY,
    ToolPermissionLevel.SAFE_WRITE,
    ToolPermissionLevel.SYSTEM_MODIFY
  ],
  [PlanMode.Plan]: [
    ToolPermissionLevel.READ_ONLY  // Plan模式只允许只读工具
  ],
  [PlanMode.AcceptEdits]: [
    ToolPermissionLevel.READ_ONLY,
    ToolPermissionLevel.SAFE_WRITE,
    ToolPermissionLevel.SYSTEM_MODIFY
  ],
  [PlanMode.BypassPermissions]: [
    ToolPermissionLevel.READ_ONLY,
    ToolPermissionLevel.SAFE_WRITE,
    ToolPermissionLevel.SYSTEM_MODIFY,
    ToolPermissionLevel.DANGEROUS  // 绕过权限模式允许危险操作
  ]
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  suggestion?: string
  alternativeTools?: string[]
}

/**
 * 工具权限管理器
 * 基于 Claude Code 的权限控制机制
 */
export class PermissionManager {
  private currentMode: PlanMode = PlanMode.Default

  /**
   * 设置当前模式
   */
  setCurrentMode(mode: PlanMode): void {
    this.currentMode = mode
  }

  /**
   * 获取当前模式
   */
  getCurrentMode(): PlanMode {
    return this.currentMode
  }

  /**
   * 检查工具是否有执行权限
   */
  checkToolPermission(toolName: string): PermissionCheckResult {
    const toolPermissionLevel = TOOL_PERMISSIONS[toolName]
    
    // 工具未定义，默认为危险操作
    if (!toolPermissionLevel) {
      return {
        allowed: false,
        reason: `工具 "${toolName}" 未在权限表中定义`,
        suggestion: '请联系管理员添加此工具的权限配置'
      }
    }

    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    const allowed = allowedLevels.includes(toolPermissionLevel)

    if (!allowed) {
      return this.generatePermissionDeniedResult(toolName, toolPermissionLevel)
    }

    return { allowed: true }
  }

  /**
   * 生成权限拒绝结果
   */
  private generatePermissionDeniedResult(
    toolName: string, 
    toolLevel: ToolPermissionLevel
  ): PermissionCheckResult {
    const result: PermissionCheckResult = {
      allowed: false
    }

    switch (this.currentMode) {
      case PlanMode.Plan:
        result.reason = `Plan模式下禁止使用 "${toolName}" 工具（权限级别：${toolLevel}）`
        result.suggestion = this.getPlanModeSuggestion(toolName, toolLevel)
        result.alternativeTools = this.getAlternativeTools(toolName, toolLevel)
        break
        
      case PlanMode.Default:
      case PlanMode.AcceptEdits:
        if (toolLevel === ToolPermissionLevel.DANGEROUS) {
          result.reason = `工具 "${toolName}" 需要危险操作权限`
          result.suggestion = '请切换到 bypassPermissions 模式或联系管理员'
        }
        break
        
      default:
        result.reason = `当前模式 "${this.currentMode}" 不支持权限级别 "${toolLevel}" 的工具`
    }

    return result
  }

  /**
   * 获取Plan模式的建议
   */
  private getPlanModeSuggestion(toolName: string, toolLevel: ToolPermissionLevel): string {
    switch (toolLevel) {
      case ToolPermissionLevel.SAFE_WRITE:
        return '请在计划中说明需要进行的写入操作，使用 exit_plan_mode 工具获得确认后再执行'
        
      case ToolPermissionLevel.SYSTEM_MODIFY:
        return `请制定详细的修改计划，包含 "${toolName}" 的具体使用方式，然后使用 exit_plan_mode 工具退出Plan模式`
        
      case ToolPermissionLevel.DANGEROUS:
        return `"${toolName}" 是危险操作，请在计划中详细说明必要性和风险控制措施`
        
      default:
        return '请使用只读工具进行分析，制定完整计划后退出Plan模式'
    }
  }

  /**
   * 获取替代工具建议
   */
  private getAlternativeTools(toolName: string, toolLevel: ToolPermissionLevel): string[] {
    const alternatives: string[] = []
    
    // 根据工具功能提供替代建议
    if (toolName.includes('edit') || toolName.includes('write')) {
      alternatives.push('read_article', 'search_files')
    }
    
    if (toolName.includes('execute') || toolName.includes('command')) {
      alternatives.push('get_status', 'list_directory')
    }
    
    if (toolName.includes('git')) {
      alternatives.push('read_article') // 可以读取git状态文件
    }

    return alternatives.filter(alt => 
      TOOL_PERMISSIONS[alt] === ToolPermissionLevel.READ_ONLY
    )
  }

  /**
   * 获取当前模式允许的工具列表
   */
  getAllowedTools(): string[] {
    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    
    return Object.entries(TOOL_PERMISSIONS)
      .filter(([, level]) => allowedLevels.includes(level))
      .map(([toolName]) => toolName)
  }

  /**
   * 获取被禁止的工具列表
   */
  getForbiddenTools(): string[] {
    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    
    return Object.entries(TOOL_PERMISSIONS)
      .filter(([, level]) => !allowedLevels.includes(level))
      .map(([toolName]) => toolName)
  }

  /**
   * 验证模式切换权限
   */
  canSwitchToMode(targetMode: PlanMode): PermissionCheckResult {
    // 基本的模式切换权限检查
    switch (targetMode) {
      case PlanMode.BypassPermissions:
        return {
          allowed: true, // 在我们的实现中，暂时允许切换到绕过权限模式
          reason: '切换到绕过权限模式将允许执行危险操作'
        }
        
      default:
        return { allowed: true }
    }
  }

  /**
   * 获取权限统计信息
   */
  getPermissionStats(): {
    currentMode: PlanMode
    allowedTools: number
    forbiddenTools: number
    toolBreakdown: Record<ToolPermissionLevel, number>
  } {
    const allowedTools = this.getAllowedTools()
    const forbiddenTools = this.getForbiddenTools()
    
    // 统计各权限级别的工具数量
    const toolBreakdown: Record<ToolPermissionLevel, number> = {
      [ToolPermissionLevel.READ_ONLY]: 0,
      [ToolPermissionLevel.SAFE_WRITE]: 0,
      [ToolPermissionLevel.SYSTEM_MODIFY]: 0,
      [ToolPermissionLevel.DANGEROUS]: 0
    }

    Object.values(TOOL_PERMISSIONS).forEach(level => {
      toolBreakdown[level]++
    })

    return {
      currentMode: this.currentMode,
      allowedTools: allowedTools.length,
      forbiddenTools: forbiddenTools.length,
      toolBreakdown
    }
  }

  /**
   * 生成权限报告
   */
  generatePermissionReport(): string {
    const stats = this.getPermissionStats()
    const allowedTools = this.getAllowedTools()
    const forbiddenTools = this.getForbiddenTools()

    const report = [
      `📊 工具权限报告 - 当前模式: ${this.currentMode}`,
      ``,
      `✅ 允许的工具 (${stats.allowedTools}个):`,
      ...allowedTools.map(tool => `  • ${tool}`),
      ``,
      `❌ 禁止的工具 (${stats.forbiddenTools}个):`,
      ...forbiddenTools.map(tool => `  • ${tool} (${TOOL_PERMISSIONS[tool]})`),
      ``,
      `📈 权限级别分布:`,
      `  • 只读工具: ${stats.toolBreakdown[ToolPermissionLevel.READ_ONLY]}个`,
      `  • 安全写入: ${stats.toolBreakdown[ToolPermissionLevel.SAFE_WRITE]}个`,
      `  • 系统修改: ${stats.toolBreakdown[ToolPermissionLevel.SYSTEM_MODIFY]}个`,
      `  • 危险操作: ${stats.toolBreakdown[ToolPermissionLevel.DANGEROUS]}个`
    ]

    return report.join('\n')
  }
}