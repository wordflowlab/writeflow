/**
 * 交互式执行管理器 - 基于最佳实践的分步骤可中断响应
 * 提供用户可控的、分阶段的工具执行体验
 */

import { getMessageLogger } from '../messaging/MessageManager.js'
import { ToolExecutionResult, ToolExecutionStatus } from '../../../tools/ToolOrchestrator.js'
import { debugLog } from '../../../utils/log.js'

export enum ExecutionStage {
  PLANNING = 'planning',           // 计划阶段 - 分析需要执行的工具
  CONFIRMING = 'confirming',       // 确认阶段 - 等待用户确认
  EXECUTING = 'executing',         // 执行阶段 - 正在执行工具
  REVIEWING = 'reviewing',         // 审查阶段 - 查看执行结果
  COMPLETED = 'completed',         // 完成阶段 - 所有操作完成
  CANCELLED = 'cancelled'          // 取消阶段 - 用户取消执行
}

export enum UserChoice {
  CONTINUE = 'continue',           // 继续执行
  PAUSE = 'pause',                 // 暂停执行
  CANCEL = 'cancel',               // 取消执行
  SKIP = 'skip',                   // 跳过当前工具
  RETRY = 'retry',                 // 重试失败的工具
  PREVIEW = 'preview',             // 预览将要执行的操作
  MODIFY = 'modify'                // 修改执行参数
}

export interface ExecutionPlan {
  id: string
  title: string
  description: string
  tools: PlannedTool[]
  estimatedTime: number
  riskLevel: 'low' | 'medium' | 'high'
  reversible: boolean
}

export interface PlannedTool {
  toolName: string
  parameters: any
  description: string
  estimatedTime: number
  riskLevel: 'low' | 'medium' | 'high'
  dependencies: string[]
  previewAvailable: boolean
}

export interface ExecutionSession {
  id: string
  plan: ExecutionPlan
  currentStage: ExecutionStage
  currentToolIndex: number
  results: ToolExecutionResult[]
  userChoices: UserChoice[]
  startTime: number
  pausedTime?: number
  completedTime?: number
}

export interface InteractionOptions {
  requireConfirmation?: boolean     // 是否需要用户确认
  allowInterruption?: boolean       // 是否允许中断
  showPreview?: boolean            // 是否显示预览
  batchMode?: boolean              // 批量模式（减少交互）
  timeout?: number                 // 操作超时时间
  onToolUpdate?: (toolName: string, status: string, message?: string) => void  // UI更新回调
}

/**
 * 交互式执行管理器 - 现代流式的分步骤控制
 */
export class InteractiveExecutionManager {
  private sessions = new Map<string, ExecutionSession>()
  private messageLogger = getMessageLogger()
  private sessionCounter = 0

  /**
   * 创建执行计划 - 分析工具调用并生成可预览的执行计划
   */
  createExecutionPlan(
    title: string,
    toolCalls: Array<{ toolName: string; parameters: any }>,
    options: InteractionOptions = {}
  ): ExecutionPlan {
    const planId = `plan_${++this.sessionCounter}_${Date.now()}`
    
    const tools: PlannedTool[] = toolCalls.map(call => ({
      toolName: call.toolName,
      parameters: call.parameters,
      description: this.generateToolDescription(call.toolName, call.parameters),
      estimatedTime: this.estimateToolTime(call.toolName),
      riskLevel: this.assessRiskLevel(call.toolName, call.parameters),
      dependencies: this.findDependencies(call.toolName, toolCalls),
      previewAvailable: this.isPreviewAvailable(call.toolName)
    }))

    const totalTime = tools.reduce((sum, tool) => sum + tool.estimatedTime, 0)
    const maxRisk = this.getMaxRiskLevel(tools.map(t => t.riskLevel))
    const reversible = tools.every(t => this.isReversible(t.toolName))

    return {
      id: planId,
      title,
      description: this.generatePlanDescription(tools),
      tools,
      estimatedTime: totalTime,
      riskLevel: maxRisk,
      reversible
    }
  }

  /**
   * 开始交互式执行 - 实时交互式的分步骤控制
   */
  async startInteractiveExecution(
    plan: ExecutionPlan,
    options: InteractionOptions = {}
  ): Promise<ExecutionSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
    
    const session: ExecutionSession = {
      id: sessionId,
      plan,
      currentStage: ExecutionStage.PLANNING,
      currentToolIndex: 0,
      results: [],
      userChoices: [],
      startTime: Date.now()
    }

    this.sessions.set(sessionId, session)
    
    // 显示执行计划
    this.displayExecutionPlan(plan)
    
    // 如果需要确认，等待用户确认
    if (options.requireConfirmation !== false) {
      session.currentStage = ExecutionStage.CONFIRMING
      this.displayConfirmationPrompt(plan)
      
      // 在实际实现中，这里会等待用户输入
      // 现在模拟用户确认
      session.userChoices.push(UserChoice.CONTINUE)
    }

    // 开始执行阶段
    session.currentStage = ExecutionStage.EXECUTING
    await this.executeWithInteraction(session, options)

    return session
  }

  /**
   * 带交互的执行过程
   */
  private async executeWithInteraction(
    session: ExecutionSession,
    options: InteractionOptions
  ): Promise<void> {
    const { plan } = session
    
    this.messageLogger.systemInfo(`开始执行计划: ${plan.title}`, {
      category: 'execution-start',
      tags: ['interactive']
    })

    for (let i = 0; i < plan.tools.length; i++) {
      const tool = plan.tools[i]
      session.currentToolIndex = i

      // 显示当前执行的工具
      this.displayCurrentTool(tool, i + 1, plan.tools.length, options)

      // 如果允许中断，检查是否有用户输入
      if (options.allowInterruption) {
        const userChoice = await this.checkUserInterruption()
        if (userChoice) {
          await this.handleUserChoice(userChoice, session, tool)
          if (userChoice === UserChoice.CANCEL) {
            session.currentStage = ExecutionStage.CANCELLED
            return
          }
        }
      }

      // 执行工具
      try {
        this.messageLogger.systemInfo(`正在执行: ${tool.toolName}`, {
          toolName: tool.toolName,
          category: 'tool-execution'
        })

        // 通知UI工具开始执行
        if (options.onToolUpdate) {
          options.onToolUpdate(tool.toolName, 'running', `正在执行 ${tool.toolName}`)
        }

        // 模拟工具执行 - 在实际实现中会调用真实的工具
        const result = await this.simulateToolExecution(tool)
        session.results.push(result)

        // 显示执行结果
        this.displayToolResult(result, tool, options)

        // 如果执行失败且允许交互，询问用户是否重试
        if (result.status === ToolExecutionStatus.FAILED && options.allowInterruption) {
          const choice = await this.promptForFailureAction(tool, result)
          if (choice === UserChoice.RETRY) {
            i-- // 重试当前工具
            continue
          } else if (choice === UserChoice.CANCEL) {
            session.currentStage = ExecutionStage.CANCELLED
            return
          }
        }

      } catch (_error) {
        this.messageLogger.systemError(`工具执行异常: ${error}`, {
          toolName: tool.toolName,
          category: 'execution-error'
        })
        
        if (options.allowInterruption) {
          const choice = await this.promptForErrorAction(tool, error)
          if (choice === UserChoice.CANCEL) {
            session.currentStage = ExecutionStage.CANCELLED
            return
          }
        }
      }
    }

    // 执行完成
    session.currentStage = ExecutionStage.COMPLETED
    session.completedTime = Date.now()
    
    this.displayExecutionSummary(session)
  }

  /**
   * 显示执行计划 - 现代流式的预览
   */
  private displayExecutionPlan(plan: ExecutionPlan): void {
    this.messageLogger.systemInfo('📋 执行计划预览', {
      category: 'plan-preview'
    })

    debugLog(`\n📊 计划概览:`)
    debugLog(`  标题: ${plan.title}`)
    debugLog(`  工具数量: ${plan.tools.length}`)
    debugLog(`  预计耗时: ${plan.estimatedTime}ms`)
    debugLog(`  风险级别: ${this.getRiskIcon(plan.riskLevel)} ${plan.riskLevel}`)
    debugLog(`  可撤销: ${plan.reversible ? '✅' : '❌'}`)

    debugLog(`\n🔧 将要执行的工具:`)
    plan.tools.forEach((tool, index) => {
      const riskIcon = this.getRiskIcon(tool.riskLevel)
      debugLog(`  ${index + 1}. ${tool.toolName} ${riskIcon}`)
      debugLog(`     ${tool.description}`)
      if (tool.previewAvailable) {
        debugLog(`     👁️  预览可用`)
      }
    })
  }

  /**
   * 显示确认提示
   */
  private displayConfirmationPrompt(plan: ExecutionPlan): void {
    debugLog(`\n❓ 确认执行`)
    debugLog(`即将执行 ${plan.tools.length} 个工具，预计耗时 ${plan.estimatedTime}ms`)
    debugLog(`风险级别: ${this.getRiskIcon(plan.riskLevel)} ${plan.riskLevel}`)
    debugLog(`\n选项:`)
    debugLog(`  [Y] 继续执行`)
    debugLog(`  [P] 预览详情`) 
    debugLog(`  [M] 修改计划`)
    debugLog(`  [N] 取消执行`)
    debugLog(`\n请选择 (默认: Y): `)
  }

  /**
   * 显示当前工具
   */
  private displayCurrentTool(tool: PlannedTool, current: number, total: number, options: InteractionOptions): void {
    debugLog(`\n[${current}/${total}] 🔧 ${tool.toolName}`)
    debugLog(`描述: ${tool.description}`)
    debugLog(`风险级别: ${this.getRiskIcon(tool.riskLevel)} ${tool.riskLevel}`)
    debugLog(`预计耗时: ${tool.estimatedTime}ms`)
    
    // 通知UI更新工具状态
    if (options.onToolUpdate) {
      options.onToolUpdate(tool.toolName, 'running', `正在执行 ${tool.toolName}`)
    }
  }

  /**
   * 显示工具执行结果
   */
  private displayToolResult(result: ToolExecutionResult, tool: PlannedTool, options: InteractionOptions): void {
    const success = result.status === ToolExecutionStatus.COMPLETED
    const icon = success ? '✅' : '❌'
    const duration = result.endTime ? result.endTime - result.startTime : 0
    
    debugLog(`${icon} ${tool.toolName} - ${success ? '成功' : '失败'} (${duration}ms)`)
    
    if (!success && result.error) {
      debugLog(`   错误: ${result.error instanceof Error ? result.error.message : result.error}`)
    }
    
    if (success && result.result) {
      const preview = String(result.result).slice(0, 100)
      debugLog(`   结果: ${preview}${String(result.result).length > 100 ? '...' : ''}`)
    }
    
    // 通知UI更新工具状态
    if (options.onToolUpdate) {
      const status = success ? 'completed' : 'failed'
      const message = success ? `${tool.toolName} 执行完成` : `${tool.toolName} 执行失败`
      options.onToolUpdate(tool.toolName, status, message)
    }
  }

  /**
   * 显示执行摘要
   */
  private displayExecutionSummary(session: ExecutionSession): void {
    const { plan, results, startTime, completedTime } = session
    const duration = (completedTime || Date.now()) - startTime
    const successCount = results.filter(r => r.status === ToolExecutionStatus.COMPLETED).length
    const failCount = results.length - successCount

    debugLog(`\n📊 执行摘要`)
    debugLog(`计划: ${plan.title}`)
    debugLog(`总耗时: ${duration}ms`)
    debugLog(`成功: ${successCount}/${results.length}`)
    if (failCount > 0) {
      debugLog(`失败: ${failCount}`)
    }
    
    this.messageLogger.systemInfo('执行计划完成', {
      category: 'execution-complete',
      tags: ['summary'],
      duration
    })
  }

  /**
   * 检查用户中断（模拟实现）
   */
  private async checkUserInterruption(): Promise<UserChoice | null> {
    // 在实际实现中，这里会检查标准输入或其他中断信号
    // 现在返回 null 表示没有中断
    return null
  }

  /**
   * 处理用户选择
   */
  private async handleUserChoice(choice: UserChoice, session: ExecutionSession, tool: PlannedTool): Promise<void> {
    session.userChoices.push(choice)
    
    switch (choice) {
      case UserChoice.PAUSE:
        session.pausedTime = Date.now()
        this.messageLogger.systemInfo('执行已暂停', { category: 'user-action' })
        // 等待用户输入继续
        break
      
      case UserChoice.CANCEL:
        this.messageLogger.systemWarning('用户取消执行', { category: 'user-action' })
        break
      
      case UserChoice.PREVIEW:
        this.displayToolPreview(tool)
        break
      
      case UserChoice.SKIP:
        this.messageLogger.systemInfo(`跳过工具: ${tool.toolName}`, { 
          toolName: tool.toolName,
          category: 'user-action' 
        })
        break
    }
  }

  /**
   * 显示工具预览
   */
  private displayToolPreview(tool: PlannedTool): void {
    debugLog(`\n👁️  工具预览: ${tool.toolName}`)
    debugLog(`描述: ${tool.description}`)
    debugLog(`参数: ${JSON.stringify(tool.parameters, null, 2)}`)
    debugLog(`风险级别: ${this.getRiskIcon(tool.riskLevel)} ${tool.riskLevel}`)
    debugLog(`预计耗时: ${tool.estimatedTime}ms`)
  }

  /**
   * 失败时的操作提示
   */
  private async promptForFailureAction(tool: PlannedTool, result: ToolExecutionResult): Promise<UserChoice> {
    debugLog(`\n❌ ${tool.toolName} 执行失败`)
    debugLog(`错误: ${result.error instanceof Error ? result.error.message : result.error}`)
    debugLog(`\n选项:`)
    debugLog(`  [R] 重试`)
    debugLog(`  [S] 跳过`)
    debugLog(`  [C] 取消执行`)
    
    // 模拟用户选择 - 在实际实现中会等待用户输入
    return UserChoice.SKIP
  }

  /**
   * 异常时的操作提示
   */
  private async promptForErrorAction(tool: PlannedTool, error: any): Promise<UserChoice> {
    debugLog(`\n💥 ${tool.toolName} 发生异常`)
    debugLog(`异常: ${error instanceof Error ? error.message : String(error)}`)
    debugLog(`\n选项:`)
    debugLog(`  [R] 重试`)
    debugLog(`  [S] 跳过`)  
    debugLog(`  [C] 取消执行`)
    
    // 模拟用户选择
    return UserChoice.SKIP
  }

  /**
   * 模拟工具执行
   */
  private async simulateToolExecution(tool: PlannedTool): Promise<ToolExecutionResult> {
    const startTime = Date.now()
    
    // 模拟执行时间
    await new Promise(resolve => setTimeout(resolve, Math.min(tool.estimatedTime, 100)))
    
    const endTime = Date.now()
    
    // 模拟成功/失败（90%成功率）
    const success = Math.random() > 0.1
    
    if (success) {
      return {
        toolName: tool.toolName,
        executionId: `sim_${Date.now()}`,
        status: ToolExecutionStatus.COMPLETED,
        startTime,
        endTime,
        result: `模拟执行成功: ${tool.toolName}`,
        logs: [`${tool.toolName} 执行成功`],
        metrics: { duration: endTime - startTime }
      }
    } else {
      return {
        toolName: tool.toolName,
        executionId: `sim_${Date.now()}`,
        status: ToolExecutionStatus.FAILED,
        startTime,
        endTime,
        result: null,
        error: new Error(`模拟执行失败: 随机失败`),
        logs: [`${tool.toolName} 执行失败`],
        metrics: { duration: endTime - startTime }
      }
    }
  }

  // 辅助方法
  
  private generateToolDescription(toolName: string, parameters: any): string {
    const descriptions: Record<string, string> = {
      'Read': `读取文件: ${parameters.file_path || parameters.path || '未指定'}`,
      'Write': `写入文件: ${parameters.file_path || parameters.path || '未指定'}`,
      'Edit': `编辑文件: ${parameters.file_path || parameters.path || '未指定'}`,
      'Grep': `搜索内容: ${parameters.pattern || '未指定'}`,
      'Bash': `执行命令: ${parameters.command || '未指定'}`,
      'Glob': `匹配文件: ${parameters.pattern || '未指定'}`
    }
    return descriptions[toolName] || `执行 ${toolName} 工具`
  }

  private estimateToolTime(toolName: string): number {
    const estimates: Record<string, number> = {
      'Read': 50,
      'Write': 100, 
      'Edit': 80,
      'Grep': 200,
      'Bash': 500,
      'Glob': 150
    }
    return estimates[toolName] || 100
  }

  private assessRiskLevel(toolName: string, parameters: any): 'low' | 'medium' | 'high' {
    const riskLevels: Record<string, 'low' | 'medium' | 'high'> = {
      'Read': 'low',
      'Grep': 'low',
      'Glob': 'low',
      'Write': 'medium',
      'Edit': 'medium',
      'Bash': 'high'
    }
    return riskLevels[toolName] || 'medium'
  }

  private findDependencies(toolName: string, allTools: Array<{ toolName: string; parameters: any }>): string[] {
    // 简化的依赖分析
    if (toolName === 'Edit' || toolName === 'Write') {
      // 编辑和写入可能依赖于读取
      return allTools
        .filter(t => t.toolName === 'Read')
        .map(t => t.toolName)
    }
    return []
  }

  private isPreviewAvailable(toolName: string): boolean {
    return ['Read', 'Grep', 'Glob'].includes(toolName)
  }

  private getMaxRiskLevel(risks: Array<'low' | 'medium' | 'high'>): 'low' | 'medium' | 'high' {
    if (risks.includes('high')) return 'high'
    if (risks.includes('medium')) return 'medium'
    return 'low'
  }

  private isReversible(toolName: string): boolean {
    return !['Write', 'Edit', 'Bash'].includes(toolName)
  }

  private generatePlanDescription(tools: PlannedTool[]): string {
    const actions = tools.map(t => t.toolName).join(', ')
    return `执行工具: ${actions}`
  }

  private getRiskIcon(level: 'low' | 'medium' | 'high'): string {
    const icons = {
      'low': '🟢',
      'medium': '🟡', 
      'high': '🔴'
    }
    return icons[level]
  }

  /**
   * 获取执行会话
   */
  getSession(sessionId: string): ExecutionSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 取消执行会话
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.currentStage = ExecutionStage.CANCELLED
      this.messageLogger.systemWarning(`执行会话已取消: ${sessionId}`, {
        category: 'session-cancelled'
      })
      return true
    }
    return false
  }

  /**
   * 清理完成的会话
   */
  cleanupSessions(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24小时前
    
    for (const [id, session] of this.sessions.entries()) {
      if (session.startTime < cutoff) {
        this.sessions.delete(id)
      }
    }
  }
}

// 全局实例
let globalInteractiveManager: InteractiveExecutionManager | null = null

/**
 * 获取全局交互式执行管理器实例
 */
export function getInteractiveExecutionManager(): InteractiveExecutionManager {
  if (!globalInteractiveManager) {
    globalInteractiveManager = new InteractiveExecutionManager()
  }
  return globalInteractiveManager
}