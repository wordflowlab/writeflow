/**
 * 系统提示词优化器 - 为 AI 生成工具使用指导
 * 参考 Kode 的系统提示词设计，动态生成针对可用工具的使用说明
 */

import { 
  getToolOrchestrator, 
  getPermissionManager, 
  getAvailableTools,
  recommendToolsForTask,
  type WriteFlowTool,
  type ToolInfo
} from './index.js'

/**
 * 系统提示词配置
 */
export interface SystemPromptConfig {
  includeToolList: boolean
  includeUsageExamples: boolean
  includePermissionInfo: boolean
  includePerformanceHints: boolean
  includeSecurityWarnings: boolean
  maxToolsInPrompt: number
  prioritizeReadOnlyTools: boolean
  customInstructions?: string[]
}

/**
 * 工具使用示例
 */
interface ToolUsageExample {
  toolName: string
  scenario: string
  example: string
  tips: string[]
}

/**
 * 系统提示词优化器 - 动态生成工具使用指导
 */
export class SystemPromptOptimizer {
  private config: SystemPromptConfig
  private toolOrchestrator = getToolOrchestrator()
  private permissionManager = getPermissionManager()

  constructor(config?: Partial<SystemPromptConfig>) {
    this.config = {
      includeToolList: true,
      includeUsageExamples: true,
      includePermissionInfo: true,
      includePerformanceHints: true,
      includeSecurityWarnings: true,
      maxToolsInPrompt: 20,
      prioritizeReadOnlyTools: true,
      ...config
    }
  }

  /**
   * 生成完整的系统提示词
   */
  async generateSystemPrompt(context?: {
    taskContext?: string
    safeMode?: boolean
    userPreferences?: any
  }): Promise<string> {
    const sections: string[] = []

    // 基础身份说明
    sections.push(this.generateIdentitySection())

    // 工具系统概述
    if (this.config.includeToolList) {
      sections.push(await this.generateToolSystemOverview())
    }

    // 可用工具列表和说明
    sections.push(await this.generateAvailableToolsSection())

    // 工具使用最佳实践
    sections.push(await this.generateBestPracticesSection())

    // 权限和安全说明
    if (this.config.includePermissionInfo) {
      sections.push(this.generatePermissionSection(context?.safeMode))
    }

    // 性能优化提示
    if (this.config.includePerformanceHints) {
      sections.push(this.generatePerformanceSection())
    }

    // 任务特定工具推荐
    if (context?.taskContext) {
      sections.push(await this.generateTaskSpecificGuidance(context.taskContext))
    }

    // 自定义指令
    if (this.config.customInstructions && this.config.customInstructions.length > 0) {
      sections.push(this.generateCustomInstructionsSection())
    }

    // 错误处理指导
    sections.push(this.generateErrorHandlingSection())

    return sections.join('\n\n')
  }

  /**
   * 生成身份说明部分
   */
  private generateIdentitySection(): string {
    return `你是 WriteFlow AI 写作助手，配备了增强的工具调用系统。你可以通过调用各种工具来完成复杂的写作、编辑、研究和系统操作任务。

你的核心能力：
• 智能工具选择和调用
• 多步骤任务规划和执行
• 权限感知的安全操作
• 高效的批量处理
• 实时进度反馈`
  }

  /**
   * 生成工具系统概述
   */
  private async generateToolSystemOverview(): Promise<string> {
    const stats = this.toolOrchestrator.getExecutionStats()
    const permissionStats = this.permissionManager.getPermissionStats()
    
    return `## 🛠️ 工具系统概述

WriteFlow 提供了 ${this.toolOrchestrator.getToolNames().length} 个专业工具，支持：

📁 **文件操作**: 读取、写入、编辑文件，支持多种格式
🔍 **搜索功能**: 智能文件查找和内容搜索
⚡ **系统集成**: 命令执行和系统交互
🔒 **权限控制**: 分级权限管理，确保操作安全
📊 **性能监控**: 执行统计和优化建议

当前权限模式: **${permissionStats.currentMode}**
可用工具数量: **${permissionStats.allowedTools}** 个`
  }

  /**
   * 生成可用工具列表
   */
  private async generateAvailableToolsSection(): Promise<string> {
    const availableTools = getAvailableTools()
    let tools = availableTools

    // 如果工具太多，进行筛选
    if (tools.length > this.config.maxToolsInPrompt) {
      if (this.config.prioritizeReadOnlyTools) {
        const readOnlyTools = tools.filter(t => t.isReadOnly())
        const writeTools = tools.filter(t => !t.isReadOnly())
        tools = [
          ...readOnlyTools.slice(0, Math.floor(this.config.maxToolsInPrompt * 0.6)),
          ...writeTools.slice(0, Math.floor(this.config.maxToolsInPrompt * 0.4))
        ]
      } else {
        tools = tools.slice(0, this.config.maxToolsInPrompt)
      }
    }

    const toolDescriptions = await Promise.all(
      tools.map(async (tool) => {
        const description = await tool.description()
        const safetyLabel = tool.isReadOnly() ? '🟢 只读' : '🟡 可写'
        const concurrencyLabel = tool.isConcurrencySafe() ? '⚡ 并发安全' : '⏳ 串行执行'
        
        return `### ${tool.name} ${safetyLabel} ${concurrencyLabel}
${description}

**使用场景**: ${this.getToolUsageScenarios(tool.name)}
**注意事项**: ${this.getToolPrecautions(tool)}`
      })
    )

    return `## 📋 可用工具详情

${toolDescriptions.join('\n\n')}`
  }

  /**
   * 生成最佳实践部分
   */
  private async generateBestPracticesSection(): Promise<string> {
    return `## ✨ 工具使用最佳实践

### 🎯 工具选择策略
1. **优先使用只读工具** 进行信息收集和分析
2. **确认需求** 再使用写入工具进行修改
3. **批量操作** 时考虑使用 MultiEdit 而非多次 Edit
4. **搜索优化** 使用 Glob 定位文件，用 Grep 搜索内容

### 🔄 执行流程规范
1. **读取 → 分析 → 规划 → 执行** 的标准流程
2. **验证输入** 确保参数格式正确
3. **错误处理** 遇到失败时检查权限和参数
4. **进度反馈** 长时间操作时说明执行状态

### 🧩 工具组合技巧
• **文档分析**: Read → Grep → 分析总结
• **批量编辑**: Glob → Read → MultiEdit
• **项目搜索**: Glob + Grep 组合定位
• **安全编辑**: Read → 备份 → Edit → 验证

### 📊 性能优化
• 优先使用并发安全的工具进行并行操作
• 大文件操作时使用分片处理
• 避免重复的文件读取操作`
  }

  /**
   * 生成权限说明部分
   */
  private generatePermissionSection(safeMode?: boolean): string {
    const currentMode = this.permissionManager.getCurrentMode()
    const stats = this.permissionManager.getPermissionStats()
    
    const modeDescription = {
      Default: '标准模式 - 允许大部分操作，需要确认写入',
      Plan: '计划模式 - 仅允许只读操作，用于分析和规划',
      AcceptEdits: '编辑模式 - 允许文件修改操作',
      BypassPermissions: '管理员模式 - 允许所有操作'
    }

    return `## 🔐 权限和安全说明

### 当前权限状态
- **运行模式**: ${currentMode} (${modeDescription[currentMode as unknown as keyof typeof modeDescription] || '未知模式'})
- **可用工具**: ${stats.allowedTools} 个
- **受限工具**: ${stats.forbiddenTools} 个
- **会话使用**: ${stats.sessionStats.totalUsage} 次调用

### 权限级别说明
🟢 **只读权限** - 自动允许，安全可靠
🟡 **写入权限** - 需要确认，谨慎操作  
🟠 **系统权限** - 需要明确授权
🔴 **危险权限** - 仅管理员模式

### 安全提醒
${safeMode ? `⚠️ **当前处于安全模式** - 所有写入操作都将被阻止` : ''}
• 修改文件前务必确认路径和内容正确
• 执行系统命令时注意潜在风险
• 批量操作时先小范围测试
• 重要文件操作前建议备份`
  }

  /**
   * 生成性能优化部分
   */
  private generatePerformanceSection(): string {
    const stats = this.toolOrchestrator.getExecutionStats()
    
    return `## ⚡ 性能优化指南

### 执行统计
- **总执行次数**: ${stats.totalExecutions}
- **成功率**: ${stats.totalExecutions > 0 ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100) : 0}%
- **平均执行时间**: ${Math.round(stats.averageExecutionTime)}ms

### 优化建议
🚀 **并发优化**
• 使用并发安全工具进行并行处理
• 避免对同一文件的并发写入操作
• 大批量操作时分批处理

📊 **资源优化** 
• 大文件操作使用流式处理
• 避免重复读取相同文件
• 及时释放不必要的资源

🎯 **调用优化**
• 合并相似的工具调用
• 使用 MultiEdit 替代多次 Edit
• 缓存常用的搜索结果`
  }

  /**
   * 生成任务特定指导
   */
  private async generateTaskSpecificGuidance(taskContext: string): Promise<string> {
    const recommendedTools = recommendToolsForTask(taskContext)
    
    if (recommendedTools.length === 0) {
      return `## 🎯 任务分析

基于任务描述："${taskContext.slice(0, 100)}${taskContext.length > 100 ? '...' : ''}"

建议使用通用工具组合进行处理。`
    }

    const toolDescriptions = await Promise.all(
      recommendedTools.slice(0, 5).map(async (tool) => {
        const description = await tool.description()
        return `• **${tool.name}**: ${description}`
      })
    )

    return `## 🎯 任务特定工具推荐

基于任务描述分析，推荐以下工具：

${toolDescriptions.join('\n')}

**建议执行顺序**:
1. 使用只读工具收集信息
2. 分析和规划必要的操作
3. 执行写入或修改操作
4. 验证结果并提供反馈`
  }

  /**
   * 生成自定义指令部分
   */
  private generateCustomInstructionsSection(): string {
    return `## 📝 自定义指令

${this.config.customInstructions!.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}`
  }

  /**
   * 生成错误处理部分
   */
  private generateErrorHandlingSection(): string {
    return `## 🚨 错误处理指南

### 常见错误类型
**权限错误** - 检查当前权限模式，申请必要授权
**参数错误** - 验证工具参数格式和必需字段
**文件错误** - 确认文件路径存在且有访问权限
**网络错误** - 检查网络连接和API配置

### 错误恢复策略
1. **自动重试** - 对临时性错误进行重试
2. **降级处理** - 使用替代工具或方法
3. **用户反馈** - 清楚说明错误原因和解决方案
4. **状态恢复** - 确保系统状态一致性

### 调试技巧
• 使用详细的错误日志
• 检查工具执行历史
• 验证输入参数格式
• 测试简化版本的操作`
  }

  /**
   * 获取工具使用场景
   */
  private getToolUsageScenarios(toolName: string): string {
    const scenarios: Record<string, string> = {
      Read: '查看文件内容、代码审查、文档分析',
      Write: '创建新文件、保存内容、生成报告',
      Edit: '修改现有文件、文本替换、代码更新',
      MultiEdit: '批量修改、重构代码、统一格式',
      Glob: '查找文件、模式匹配、文件筛选',
      Grep: '搜索内容、日志分析、代码定位',
      Bash: '系统操作、脚本执行、环境配置'
    }
    
    return scenarios[toolName] || '通用工具操作'
  }

  /**
   * 获取工具注意事项
   */
  private getToolPrecautions(tool: WriteFlowTool): string {
    const precautions: string[] = []
    
    if (!tool.isReadOnly()) {
      precautions.push('⚠️ 写入操作不可撤销，请谨慎使用')
    }
    
    if (!tool.isConcurrencySafe()) {
      precautions.push('⏳ 避免并发调用，等待完成后再次使用')
    }
    
    if (tool.needsPermissions()) {
      precautions.push('🔐 需要适当权限，可能要求用户确认')
    }
    
    return precautions.length > 0 ? precautions.join('；') : '无特殊注意事项'
  }

  /**
   * 生成简化的工具提示词（用于token限制场景）
   */
  async generateCompactPrompt(): Promise<string> {
    const availableTools = getAvailableTools()
    const toolList = availableTools
      .slice(0, 10) // 限制工具数量
      .map(tool => `${tool.name}${tool.isReadOnly() ? '(只读)' : '(可写)'}`)
      .join(', ')

    const currentMode = this.permissionManager.getCurrentMode()

    return `WriteFlow AI 写作助手，配备工具系统。

可用工具: ${toolList}
权限模式: ${currentMode}

使用原则:
• 优先只读工具收集信息
• 确认需求后使用写入工具
• 遇到权限问题时说明原因
• 保持操作的安全性和准确性`
  }
}

// 全局优化器实例
let globalOptimizer: SystemPromptOptimizer | null = null

/**
 * 获取全局系统提示词优化器
 */
export function getSystemPromptOptimizer(): SystemPromptOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new SystemPromptOptimizer()
  }
  return globalOptimizer
}

/**
 * 便捷函数：生成优化的系统提示词
 */
export async function generateOptimizedSystemPrompt(config?: {
  taskContext?: string
  safeMode?: boolean
  compact?: boolean
  customConfig?: Partial<SystemPromptConfig>
}): Promise<string> {
  const optimizer = config?.customConfig 
    ? new SystemPromptOptimizer(config.customConfig)
    : getSystemPromptOptimizer()

  if (config?.compact) {
    return optimizer.generateCompactPrompt()
  }

  return optimizer.generateSystemPrompt({
    taskContext: config?.taskContext,
    safeMode: config?.safeMode
  })
}