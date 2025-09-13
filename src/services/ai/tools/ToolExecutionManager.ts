/**
 * 工具执行管理器
 * 负责管理AI请求中的工具调用逻辑
 */

import { 
  getTool, 
  getToolOrchestrator, 
  getPermissionManager,
  getAvailableTools,
  executeToolQuick,
  ToolExecutionStatus,
  type ToolExecutionResult,
  type WriteFlowTool
} from '../../../tools/index.js'
import { type ToolUseContext } from '../../../Tool.js'
import { 
  getProgressManager,
  startToolProgress,
  updateToolProgress,
  logToolProgress,
  finishToolProgress
} from './ProgressManager.js'

export interface ToolExecutionOptions {
  maxConcurrentTools?: number
  timeout?: number
  retryOnFailure?: boolean
  maxRetries?: number
}

export interface ToolExecutionContext {
  requestId?: string
  userId?: string
  sessionId?: string
  permissions?: string[]
}

export interface ToolAnalysisResult {
  needsTools: boolean
  suggestedTools: string[]
  confidence: number
  reasoning: string
}

export class ToolExecutionManager {
  private toolOrchestrator = getToolOrchestrator()
  private permissionManager = getPermissionManager()
  private activeExecutions = new Map<string, ToolExecutionResult>()

  /**
   * 分析提示词是否需要工具调用
   */
  analyzeToolNeed(prompt: string): ToolAnalysisResult {
    const needsSmartAnalysis = this.detectSmartAnalysisNeed(prompt)
    const suggestedTools = this.suggestToolsForPrompt(prompt)
    
    const confidence = this.calculateToolNeedConfidence(prompt, suggestedTools)
    
    let reasoning = '基于提示词内容分析:'
    if (needsSmartAnalysis) {
      reasoning += ' 检测到需要智能分析功能'
    }
    if (suggestedTools.length > 0) {
      reasoning += ` 建议使用工具: ${suggestedTools.join(', ')}`
    }

    return {
      needsTools: needsSmartAnalysis || suggestedTools.length > 0,
      suggestedTools,
      confidence,
      reasoning
    }
  }

  /**
   * 检测是否需要智能分析
   */
  private detectSmartAnalysisNeed(prompt: string): boolean {
    const analysisKeywords = [
      '分析', '项目', '总结', '理解', '查看', '检查', '搜索', '探索',
      'analyze', 'project', 'summary', 'understand', 'explore', 'search'
    ]
    
    const lowerPrompt = prompt.toLowerCase()
    return analysisKeywords.some(keyword => 
      lowerPrompt.includes(keyword) || 
      lowerPrompt.includes(keyword.toLowerCase())
    )
  }

  /**
   * 为提示词推荐工具
   */
  private suggestToolsForPrompt(prompt: string): string[] {
    const tools: string[] = []
    const lowerPrompt = prompt.toLowerCase()

    // 文件操作相关
    if (lowerPrompt.includes('文件') || lowerPrompt.includes('file') ||
        lowerPrompt.includes('读取') || lowerPrompt.includes('read')) {
      tools.push('Read')
    }

    // 搜索相关
    if (lowerPrompt.includes('搜索') || lowerPrompt.includes('查找') ||
        lowerPrompt.includes('search') || lowerPrompt.includes('find') ||
        lowerPrompt.includes('grep')) {
      tools.push('Grep', 'Glob')
    }

    // 执行相关
    if (lowerPrompt.includes('运行') || lowerPrompt.includes('执行') ||
        lowerPrompt.includes('run') || lowerPrompt.includes('execute') ||
        lowerPrompt.includes('命令') || lowerPrompt.includes('command')) {
      tools.push('Bash')
    }

    // 待办事项相关 - 更广泛的触发条件
    if (lowerPrompt.includes('待办') || lowerPrompt.includes('任务') ||
        lowerPrompt.includes('todo') || lowerPrompt.includes('task') ||
        // 写作项目相关
        lowerPrompt.includes('写作') || lowerPrompt.includes('文章') || lowerPrompt.includes('write') ||
        lowerPrompt.includes('create') || lowerPrompt.includes('implement') ||
        // 计划和步骤相关  
        lowerPrompt.includes('计划') || lowerPrompt.includes('步骤') || lowerPrompt.includes('plan') ||
        lowerPrompt.includes('步') || lowerPrompt.includes('phase') ||
        // 多步骤工作指示
        lowerPrompt.includes('首先') || lowerPrompt.includes('然后') || lowerPrompt.includes('接下来') ||
        lowerPrompt.includes('最后') || lowerPrompt.includes('finally') || lowerPrompt.includes('first') ||
        // 复杂任务指示
        prompt.split(/[，。！？；,;!?\n]/).length > 3) { // 复杂句子结构
      tools.push('todo_write', 'todo_read')
    }

    return [...new Set(tools)] // 去重
  }

  /**
   * 计算工具需求置信度
   */
  private calculateToolNeedConfidence(prompt: string, suggestedTools: string[]): number {
    let confidence = 0

    // 基础置信度
    if (suggestedTools.length > 0) {
      confidence += 0.3
    }

    // 关键词匹配度
    const keywords = ['分析', '查看', '搜索', '执行', '运行', 'analyze', 'search', 'run']
    const matchCount = keywords.filter(keyword => 
      prompt.toLowerCase().includes(keyword.toLowerCase())
    ).length
    
    confidence += Math.min(0.5, matchCount * 0.1)

    // 提示词长度和复杂度
    if (prompt.length > 100) {
      confidence += 0.1
    }
    if (prompt.split(' ').length > 20) {
      confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }

  /**
   * 从任务上下文提取任务类型
   */
  extractTaskContext(prompt: string): string {
    if (prompt.includes('项目') || prompt.includes('project')) {
      return '项目分析和结构理解'
    }
    if (prompt.includes('代码') || prompt.includes('code')) {
      return '代码分析和理解'
    }
    if (prompt.includes('文件') || prompt.includes('file')) {
      return '文件分析和处理'
    }
    return '智能分析任务'
  }

  /**
   * 设置工具调用环境
   */
  setupToolEnvironment(request: {
    prompt: string
    enableToolCalls?: boolean
    allowedTools?: string[]
    enableSmartAnalysis?: boolean
  }) {
    const analysis = this.analyzeToolNeed(request.prompt)
    
    if (analysis.needsTools || request.enableSmartAnalysis) {
      return {
        ...request,
        enableToolCalls: true,
        allowedTools: request.allowedTools || analysis.suggestedTools.length > 0 
          ? analysis.suggestedTools 
          : ['Read', 'Grep', 'Glob', 'Bash', 'todo_write', 'todo_read'],
        taskContext: request.enableSmartAnalysis 
          ? this.extractTaskContext(request.prompt)
          : undefined
      }
    }

    return request
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(
    toolName: string,
    parameters: any,
    context?: ToolExecutionContext,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const executionId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // 开始进度跟踪 - 实时交互式的渐进式展示
      startToolProgress(toolName, executionId)
      
      // 检查权限
      if (context?.permissions && !this.checkToolPermission(toolName, context.permissions)) {
        const error = new Error(`没有执行工具 ${toolName} 的权限`)
        logToolProgress(executionId, '权限检查失败', 'error')
        
        const failedResult: ToolExecutionResult = {
          toolName,
          status: ToolExecutionStatus.FAILED,
          startTime: Date.now(),
          endTime: Date.now(),
          executionId,
          result: null,
          error,
          logs: ['权限检查失败'],
          metrics: { duration: 0 }
        }
        
        finishToolProgress(executionId, failedResult)
        return failedResult
      }

      // 记录执行状态
      this.activeExecutions.set(executionId, {
        toolName,
        status: ToolExecutionStatus.RUNNING,
        startTime: Date.now(),
        executionId,
        result: null,
        logs: [],
        metrics: {}
      })

      // 创建工具使用上下文
      const toolContext: ToolUseContext = {
        messageId: `tool-exec-${executionId}`,
        agentId: 'ai-service',
        safeMode: false,
        abortController: new AbortController(),
        readFileTimestamps: {},
        options: {
          verbose: false
        }
      }

      // 更新进度：开始执行
      updateToolProgress(executionId, {
        status: ToolExecutionStatus.RUNNING,
        currentStep: '正在执行工具...'
      })
      logToolProgress(executionId, '开始执行工具', 'info')

      // 执行工具
      const result = await executeToolQuick(toolName, parameters, toolContext)

      // 更新进度：执行完成
      const endTime = Date.now()
      const duration = endTime - Date.now()
      
      updateToolProgress(executionId, {
        status: result.success ? ToolExecutionStatus.COMPLETED : ToolExecutionStatus.FAILED,
        progress: 100,
        currentStep: result.success ? '执行成功' : '执行失败'
      })

      // 记录执行结果日志
      if (result.success) {
        logToolProgress(executionId, '工具执行成功', 'success', { 
          resultLength: result.result?.length || 0 
        })
      } else {
        logToolProgress(executionId, `工具执行失败: ${result.error || '未知错误'}`, 'error')
      }

      // 更新执行结果
      const finalResult: ToolExecutionResult = {
        toolName,
        status: result.success ? ToolExecutionStatus.COMPLETED : ToolExecutionStatus.FAILED,
        startTime: Date.now(),
        endTime,
        executionId,
        result: result.result,
        error: result.success ? undefined : (result.error instanceof Error ? result.error : new Error(String(result.error))),
        logs: [`执行${result.success ? '成功' : '失败'}`],
        metrics: { duration }
      }

      // 完成进度跟踪
      finishToolProgress(executionId, finalResult)
      
      this.activeExecutions.set(executionId, finalResult)
      return finalResult

    } catch (error) {
      // 记录异常错误
      logToolProgress(executionId, `执行异常: ${error instanceof Error ? error.message : String(error)}`, 'error')
      
      const errorResult: ToolExecutionResult = {
        toolName,
        status: ToolExecutionStatus.FAILED,
        startTime: Date.now(),
        endTime: Date.now(),
        executionId,
        result: null,
        error: error instanceof Error ? error : new Error(String(error)),
        logs: ['执行异常'],
        metrics: { duration: 0 }
      }

      // 完成进度跟踪
      finishToolProgress(executionId, errorResult)
      
      this.activeExecutions.set(executionId, errorResult)
      return errorResult
    }
  }

  /**
   * 检查工具权限
   */
  private checkToolPermission(toolName: string, permissions: string[]): boolean {
    // 简化的权限检查
    const publicTools = ['Read', 'Grep', 'Glob', 'todo_read']
    const adminTools = ['Bash', 'todo_write']

    if (publicTools.includes(toolName)) {
      return true
    }

    if (adminTools.includes(toolName)) {
      return permissions.includes('admin') || permissions.includes('tool_execution')
    }

    return false
  }

  /**
   * 批量执行工具
   */
  async executeBatchTools(
    toolCalls: Array<{
      toolName: string
      parameters: any
    }>,
    context?: ToolExecutionContext,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult[]> {
    const maxConcurrent = options?.maxConcurrentTools || 3
    const results: ToolExecutionResult[] = []

    // 分批执行
    for (let i = 0; i < toolCalls.length; i += maxConcurrent) {
      const batch = toolCalls.slice(i, i + maxConcurrent)
      const batchPromises = batch.map(call => 
        this.executeToolCall(call.toolName, call.parameters, context, options)
      )
      
      const batchResults = await Promise.allSettled(batchPromises)
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          toolName: 'unknown',
          status: ToolExecutionStatus.FAILED,
          startTime: Date.now(),
          endTime: Date.now(),
          executionId: `error_${Date.now()}`,
          result: null,
          error: result.status === 'rejected' ? new Error(String(result.reason)) : new Error('Unknown error'),
          logs: [],
          metrics: {}
        }
      ))
    }

    return results
  }

  /**
   * 获取执行状态
   */
  getExecutionStatus(executionId: string): ToolExecutionResult | null {
    return this.activeExecutions.get(executionId) || null
  }

  /**
   * 清理执行历史
   */
  cleanupExecutions(maxAge: number = 300000): void { // 5分钟
    const now = Date.now()
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (now - execution.startTime > maxAge) {
        this.activeExecutions.delete(id)
      }
    }
  }

  /**
   * 获取可用工具列表
   */
  getAvailableToolsList(): string[] {
    try {
      return getAvailableTools().map(tool => tool.name)
    } catch (error) {
      console.warn('获取可用工具列表失败:', error)
      return ['Read', 'Grep', 'Glob', 'Bash', 'todo_write', 'todo_read']
    }
  }

  /**
   * 获取工具信息
   */
  getToolInfo(toolName: string): WriteFlowTool | null {
    try {
      const tool = getTool(toolName)
      return tool || null
    } catch (error) {
      console.warn(`获取工具 ${toolName} 信息失败:`, error)
      return null
    }
  }
}

// 全局实例
let globalToolExecutionManager: ToolExecutionManager | null = null

/**
 * 获取全局工具执行管理器实例
 */
export function getToolExecutionManager(): ToolExecutionManager {
  if (!globalToolExecutionManager) {
    globalToolExecutionManager = new ToolExecutionManager()
  }
  return globalToolExecutionManager
}

/**
 * 便捷函数：分析工具需求
 */
export function analyzeToolNeed(prompt: string): ToolAnalysisResult {
  return getToolExecutionManager().analyzeToolNeed(prompt)
}

/**
 * 便捷函数：设置工具环境
 */
export function setupToolEnvironment(request: {
  prompt: string
  enableToolCalls?: boolean
  allowedTools?: string[]
  enableSmartAnalysis?: boolean
}) {
  return getToolExecutionManager().setupToolEnvironment(request)
}