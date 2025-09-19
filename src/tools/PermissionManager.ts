import { PlanMode } from '../types/agent.js'
import { ToolUseContext, WriteFlowTool, PermissionResult } from '../Tool.js'
import { pathInWorkingDirectory, grantWritePermissionForWorkingDir } from '../utils/permissions/filesystem.js'

/**
 * 工具权限级别定义 - 采用现代化的细粒度权限控制
 */
export enum ToolPermissionLevel {
  READ_only = 'READ_only',        // 只读工具：搜索、读取、分析
  safe_write = 'safe_write',      // 安全写入：日志、临时文件、缓存
  system_modify = 'system_modify', // 系统修改：编辑文件、执行命令
  network_access = 'network_access', // 网络访问：API调用、下载
  dangerous = 'dangerous'         // 危险操作：删除、格式化、系统重启
}

/**
 * 权限授权类型
 */
export enum PermissionGrantType {
  ALWAYS_ALLOW = 'always_allow',     // 总是允许
  SESSION_GRANT = 'session_grant',   // 会话内授权
  ONE_TIME_GRANT = 'one_time_grant', // 一次性授权
  ALWAYS_DENY = 'always_deny'        // 总是拒绝
}

/**
 * 权限策略配置
 */
export interface PermissionPolicy {
  toolName: string
  permissionLevel: ToolPermissionLevel
  grantType: PermissionGrantType
  conditions?: {
    maxUsagePerSession?: number
    timeWindowMinutes?: number
    requireConfirmation?: boolean
    allowInSafeMode?: boolean
  }
}

/**
 * 默认权限策略配置 - 基于工具的实际功能分类
 */
export const DEFAULT_PERMISSION_POLICIES: PermissionPolicy[] = [
  // 只读工具（计划模式允许）
  { toolName: 'Read', permissionLevel: ToolPermissionLevel.READ_only, grantType: PermissionGrantType.ALWAYS_ALLOW },
  { toolName: 'Glob', permissionLevel: ToolPermissionLevel.READ_only, grantType: PermissionGrantType.ALWAYS_ALLOW },
  { toolName: 'Grep', permissionLevel: ToolPermissionLevel.READ_only, grantType: PermissionGrantType.ALWAYS_ALLOW },
  { toolName: 'LSTool', permissionLevel: ToolPermissionLevel.READ_only, grantType: PermissionGrantType.ALWAYS_ALLOW },
  { toolName: 'WebSearch', permissionLevel: ToolPermissionLevel.READ_only, grantType: PermissionGrantType.ALWAYS_ALLOW },
  { toolName: 'URLFetcher', permissionLevel: ToolPermissionLevel.network_access, grantType: PermissionGrantType.SESSION_GRANT },
  
  // 安全写入工具（工作目录内自动授权）
  { toolName: 'Write', permissionLevel: ToolPermissionLevel.safe_write, grantType: PermissionGrantType.SESSION_GRANT, 
    conditions: { requireConfirmation: false, maxUsagePerSession: 50 } },
  { toolName: 'MemoryWrite', permissionLevel: ToolPermissionLevel.safe_write, grantType: PermissionGrantType.SESSION_GRANT },
  { toolName: 'todo_write', permissionLevel: ToolPermissionLevel.safe_write, grantType: PermissionGrantType.ALWAYS_ALLOW },
  
  // 系统修改工具（需要明确授权）
  { toolName: 'Edit', permissionLevel: ToolPermissionLevel.system_modify, grantType: PermissionGrantType.ONE_TIME_GRANT,
    conditions: { requireConfirmation: true } },
  { toolName: 'MultiEdit', permissionLevel: ToolPermissionLevel.system_modify, grantType: PermissionGrantType.ONE_TIME_GRANT,
    conditions: { requireConfirmation: true } },
  { toolName: 'Bash', permissionLevel: ToolPermissionLevel.system_modify, grantType: PermissionGrantType.ONE_TIME_GRANT,
    conditions: { requireConfirmation: true } },
  { toolName: 'NotebookEdit', permissionLevel: ToolPermissionLevel.system_modify, grantType: PermissionGrantType.ONE_TIME_GRANT },
  
  // 网络访问工具（需要会话授权）
  { toolName: 'WebFetch', permissionLevel: ToolPermissionLevel.network_access, grantType: PermissionGrantType.SESSION_GRANT,
    conditions: { maxUsagePerSession: 20, timeWindowMinutes: 60 } },
  
  // AI 工具（特殊处理）
  { toolName: 'AskExpertModel', permissionLevel: ToolPermissionLevel.network_access, grantType: PermissionGrantType.SESSION_GRANT },
  { toolName: 'ThinkTool', permissionLevel: ToolPermissionLevel.READ_only, grantType: PermissionGrantType.ALWAYS_ALLOW },
  { toolName: 'TaskTool', permissionLevel: ToolPermissionLevel.system_modify, grantType: PermissionGrantType.ONE_TIME_GRANT },
]

/**
 * 工具使用统计
 */
export interface ToolUsageStats {
  toolName: string
  usageCount: number
  lastUsedAt: Date
  sessionUsageCount: number
  deniedCount: number
}

/**
 * 模式权限映射 - 更新枚举值
 */
export const MODE_PERMISSION_MAP: Record<PlanMode, ToolPermissionLevel[]> = {
  [PlanMode.Default]: [
    ToolPermissionLevel.READ_only,
    ToolPermissionLevel.safe_write,
    ToolPermissionLevel.system_modify,
    ToolPermissionLevel.network_access,
  ],
  [PlanMode.Plan]: [
    ToolPermissionLevel.READ_only,  // Plan模式只允许只读工具
  ],
  [PlanMode.AcceptEdits]: [
    ToolPermissionLevel.READ_only,
    ToolPermissionLevel.safe_write,
    ToolPermissionLevel.system_modify,
    ToolPermissionLevel.network_access,
  ],
  [PlanMode.BypassPermissions]: [
    ToolPermissionLevel.READ_only,
    ToolPermissionLevel.safe_write,
    ToolPermissionLevel.system_modify,
    ToolPermissionLevel.network_access,
    ToolPermissionLevel.dangerous,  // 绕过权限模式允许危险操作
  ],
}

/**
 * 权限检查结果 - 增强版
 */
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  suggestion?: string
  alternativeTools?: string[]
  needsUserConfirmation?: boolean
  grantType?: PermissionGrantType
  remainingUsage?: number
}

/**
 * 增强的工具权限管理器 - 参考 Kode 的权限架构
 * 提供细粒度权限控制、使用统计和智能授权决策
 */
export class PermissionManager {
  private currentMode: PlanMode = PlanMode.Default
  private permissionPolicies = new Map<string, PermissionPolicy>()
  private toolUsageStats = new Map<string, ToolUsageStats>()
  private sessionGrants = new Set<string>()
  private oneTimeGrants = new Set<string>()
  private sessionStartTime = Date.now()

  constructor() {
    // 初始化默认权限策略
    DEFAULT_PERMISSION_POLICIES.forEach(policy => {
      this.permissionPolicies.set(policy.toolName, policy)
    })
  }

  /**
   * 设置当前模式
   */
  setCurrentMode(mode: PlanMode): void {
    const previousMode = this.currentMode
    this.currentMode = mode
    
    // 模式切换时清理一次性授权
    if (previousMode !== mode) {
      this.oneTimeGrants.clear()
      
      // Plan 模式切换时清理会话授权（更严格）
      if (mode === PlanMode.Plan) {
        this.sessionGrants.clear()
      }
    }
  }

  /**
   * 获取当前模式
   */
  getCurrentMode(): PlanMode {
    return this.currentMode
  }

  /**
   * 检查工具权限 - 完整的权限检查逻辑
   */
  async checkToolPermission(
    tool: WriteFlowTool, 
    input: any, 
    context: ToolUseContext,
  ): Promise<PermissionResult> {
    const toolName = tool.name
    
    // 获取或创建权限策略
    const policy = this.getOrCreatePolicy(tool)
    
    // 更新使用统计
    this.updateUsageStats(toolName, 'attempt')
    
    // 检查基本权限级别
    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    if (!allowedLevels.includes(policy.permissionLevel)) {
      this.updateUsageStats(toolName, 'denied')
      return this.createDeniedResult(toolName, policy, '当前模式不允许此权限级别的工具')
    }
    
    // 检查工具是否被明确拒绝
    if (policy.grantType === PermissionGrantType.ALWAYS_DENY) {
      this.updateUsageStats(toolName, 'denied')
      return this.createDeniedResult(toolName, policy, '此工具已被管理策略禁用')
    }
    
    // 检查是否总是允许
    if (policy.grantType === PermissionGrantType.ALWAYS_ALLOW) {
      return { isAllowed: true }
    }
    
    // 检查会话限制
    if (policy.conditions?.maxUsagePerSession) {
      const usage = this.toolUsageStats.get(toolName)?.sessionUsageCount || 0
      if (usage >= policy.conditions.maxUsagePerSession) {
        this.updateUsageStats(toolName, 'denied')
        return this.createDeniedResult(toolName, policy, '已达到会话使用次数限制')
      }
    }
    
    // 检查一次性授权
    if (policy.grantType === PermissionGrantType.ONE_TIME_GRANT) {
      if (this.oneTimeGrants.has(toolName)) {
        this.oneTimeGrants.delete(toolName) // 消费授权
        return { isAllowed: true }
      }
      
      // 检查是否为自动授权模式（CLI 模式）
      if (context.options?.autoApprove === true) {
        return { isAllowed: true }
      }
      
      // 需要用户确认
      return {
        isAllowed: false,
        denialReason: '需要用户确认授权',
        behavior: 'ask',
      }
    }
    
    // 检查会话授权
    if (policy.grantType === PermissionGrantType.SESSION_GRANT) {
      if (this.sessionGrants.has(toolName)) {
        return { isAllowed: true }
      }
      
      // 特殊处理：Write 工具在工作目录内自动授权
      if (toolName === 'Write' && input && typeof input.file_path === 'string') {
        const filePath = input.file_path
        if (pathInWorkingDirectory(filePath)) {
          // 自动授权工作目录写入权限
          grantWritePermissionForWorkingDir()
          this.sessionGrants.add(toolName)
          return { isAllowed: true }
        }
      }
      
      // 需要用户确认
      return {
        isAllowed: false,
        denialReason: '需要会话授权',
        behavior: 'ask',
      }
    }
    
    return { isAllowed: true }
  }

  /**
   * 授予权限
   */
  grantPermission(toolName: string, grantType: PermissionGrantType): void {
    switch (grantType) {
      case PermissionGrantType.ONE_TIME_GRANT:
        this.oneTimeGrants.add(toolName)
        break
      case PermissionGrantType.SESSION_GRANT:
        this.sessionGrants.add(toolName)
        break
      default:
        // 其他类型不需要手动授权
        break
    }
  }

  /**
   * 获取或创建工具权限策略
   */
  private getOrCreatePolicy(tool: WriteFlowTool): PermissionPolicy {
    const existing = this.permissionPolicies.get(tool.name)
    if (existing) {
      return existing
    }
    
    // 根据工具特性自动推断权限级别
    const isReadOnly = tool.isReadOnly()
    const level = isReadOnly ? ToolPermissionLevel.READ_only : ToolPermissionLevel.system_modify
    const grantType = isReadOnly ? PermissionGrantType.ALWAYS_ALLOW : PermissionGrantType.ONE_TIME_GRANT
    
    const policy: PermissionPolicy = {
      toolName: tool.name,
      permissionLevel: level,
      grantType: grantType,
      conditions: isReadOnly ? undefined : { requireConfirmation: true },
    }
    
    this.permissionPolicies.set(tool.name, policy)
    return policy
  }

  /**
   * 创建拒绝结果
   */
  private createDeniedResult(toolName: string, policy: PermissionPolicy, reason: string): PermissionResult {
    return {
      isAllowed: false,
      denialReason: reason,
      behavior: 'deny',
    }
  }

  /**
   * 更新使用统计
   */
  private updateUsageStats(toolName: string, action: 'attempt' | 'success' | 'denied'): void {
    let stats = this.toolUsageStats.get(toolName)
    if (!stats) {
      stats = {
        toolName,
        usageCount: 0,
        sessionUsageCount: 0,
        deniedCount: 0,
        lastUsedAt: new Date(),
      }
      this.toolUsageStats.set(toolName, stats)
    }
    
    switch (action) {
      case 'attempt':
        // 记录尝试使用
        stats.lastUsedAt = new Date()
        break
      case 'success':
        stats.usageCount++
        stats.sessionUsageCount++
        stats.lastUsedAt = new Date()
        break
      case 'denied':
        stats.deniedCount++
        break
    }
  }

  /**
   * 获取当前模式允许的工具列表
   */
  getAllowedTools(): string[] {
    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    const allowedTools: string[] = []
    
    for (const [toolName, policy] of this.permissionPolicies) {
      if (allowedLevels.includes(policy.permissionLevel)) {
        allowedTools.push(toolName)
      }
    }
    
    return allowedTools
  }

  /**
   * 获取被禁止的工具列表
   */
  getForbiddenTools(): string[] {
    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    const forbiddenTools: string[] = []
    
    for (const [toolName, policy] of this.permissionPolicies) {
      if (!allowedLevels.includes(policy.permissionLevel)) {
        forbiddenTools.push(toolName)
      }
    }
    
    return forbiddenTools
  }

  /**
   * 获取工具使用统计
   */
  getToolStats(toolName?: string): ToolUsageStats[] {
    if (toolName) {
      const stats = this.toolUsageStats.get(toolName)
      return stats ? [stats] : []
    }
    
    return Array.from(this.toolUsageStats.values())
  }

  /**
   * 清理会话数据
   */
  clearSession(): void {
    this.sessionGrants.clear()
    this.oneTimeGrants.clear()
    this.sessionStartTime = Date.now()
    
    // 重置会话使用计数
    for (const stats of this.toolUsageStats.values()) {
      stats.sessionUsageCount = 0
    }
  }

  /**
   * 添加或更新权限策略
   */
  setPermissionPolicy(policy: PermissionPolicy): void {
    this.permissionPolicies.set(policy.toolName, policy)
  }

  /**
   * 获取权限统计信息
   */
  getPermissionStats(): {
    currentMode: PlanMode
    allowedTools: number
    forbiddenTools: number
    toolBreakdown: Record<ToolPermissionLevel, number>
    sessionStats: {
      totalUsage: number
      grantedPermissions: number
      deniedRequests: number
    }
  } {
    const allowedTools = this.getAllowedTools()
    const forbiddenTools = this.getForbiddenTools()
    
    // 统计各权限级别的工具数量
    const toolBreakdown: Record<ToolPermissionLevel, number> = {
      [ToolPermissionLevel.READ_only]: 0,
      [ToolPermissionLevel.safe_write]: 0,
      [ToolPermissionLevel.system_modify]: 0,
      [ToolPermissionLevel.network_access]: 0,
      [ToolPermissionLevel.dangerous]: 0,
    }

    Array.from(this.permissionPolicies.values()).forEach(policy => {
      toolBreakdown[policy.permissionLevel]++
    })

    // 会话统计
    const sessionStats = {
      totalUsage: Array.from(this.toolUsageStats.values()).reduce((sum, stats) => sum + stats.sessionUsageCount, 0),
      grantedPermissions: this.sessionGrants.size + this.oneTimeGrants.size,
      deniedRequests: Array.from(this.toolUsageStats.values()).reduce((sum, stats) => sum + stats.deniedCount, 0),
    }

    return {
      currentMode: this.currentMode,
      allowedTools: allowedTools.length,
      forbiddenTools: forbiddenTools.length,
      toolBreakdown,
      sessionStats,
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
      ...allowedTools.slice(0, 10).map(tool => `  • ${tool}`),
      ...(allowedTools.length > 10 ? [`  ... 和其他 ${allowedTools.length - 10} 个工具`] : []),
      ``,
      `❌ 禁止的工具 (${stats.forbiddenTools}个):`,
      ...forbiddenTools.slice(0, 10).map(tool => {
        const policy = this.permissionPolicies.get(tool)
        return `  • ${tool} (${policy?.permissionLevel || 'unknown'})`
      }),
      ...(forbiddenTools.length > 10 ? [`  ... 和其他 ${forbiddenTools.length - 10} 个工具`] : []),
      ``,
      `📈 权限级别分布:`,
      `  • 只读工具: ${stats.toolBreakdown[ToolPermissionLevel.READ_only]}个`,
      `  • 安全写入: ${stats.toolBreakdown[ToolPermissionLevel.safe_write]}个`,
      `  • 系统修改: ${stats.toolBreakdown[ToolPermissionLevel.system_modify]}个`,
      `  • 网络访问: ${stats.toolBreakdown[ToolPermissionLevel.network_access]}个`,
      `  • 危险操作: ${stats.toolBreakdown[ToolPermissionLevel.dangerous]}个`,
      ``,
      `📊 会话统计:`,
      `  • 工具使用次数: ${stats.sessionStats.totalUsage}`,
      `  • 已授予权限: ${stats.sessionStats.grantedPermissions}`,
      `  • 拒绝请求数: ${stats.sessionStats.deniedRequests}`,
    ]

    return report.join('\n')
  }

  /**
   * 简化的工具权限检查 - 只基于工具名称和当前模式
   * 用于系统提醒等场景，不需要完整的工具对象和上下文
   */
  checkToolPermissionByName(toolName: string): { allowed: boolean; reason?: string } {
    // 获取基础策略
    const defaultPolicy = DEFAULT_PERMISSION_POLICIES.find(p => p.toolName === toolName)
    if (!defaultPolicy) {
      // 未知工具，按照默认策略处理
      return { allowed: false, reason: '未知工具' }
    }

    // 检查当前模式是否允许该权限级别
    const allowedLevels = MODE_PERMISSION_MAP[this.currentMode]
    if (!allowedLevels.includes(defaultPolicy.permissionLevel)) {
      return { allowed: false, reason: '当前模式不允许此权限级别的工具' }
    }

    // 检查是否总是拒绝
    if (defaultPolicy.grantType === PermissionGrantType.ALWAYS_DENY) {
      return { allowed: false, reason: '工具被明确拒绝' }
    }

    // 总是允许的工具
    if (defaultPolicy.grantType === PermissionGrantType.ALWAYS_ALLOW) {
      return { allowed: true }
    }

    // 其他情况需要进一步确认，在这里简化为允许
    return { allowed: true }
  }
}

// 全局权限管理器实例
let globalPermissionManager: PermissionManager | null = null

/**
 * 获取全局权限管理器实例
 */
export function getPermissionManager(): PermissionManager {
  if (!globalPermissionManager) {
    globalPermissionManager = new PermissionManager()
  }
  return globalPermissionManager
}
