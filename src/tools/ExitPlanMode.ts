import { z } from 'zod'
import { WritingTool, ToolInput, ToolResult } from '../types/tool.js'

/**
 * ExitPlanMode 工具输入参数
 */
export const ExitPlanModeInputSchema = z.object({
  plan: z.string().min(1).describe('The plan you came up with, that you want to run by the user for approval. Supports markdown. The plan should be pretty concise.')
})

export type ExitPlanModeInput = z.infer<typeof ExitPlanModeInputSchema>

/**
 * ExitPlanMode 工具结果
 */
export interface ExitPlanModeResult {
  plan: string
  approved: boolean
  message: string
  nextSteps?: string[]
}

/**
 * Exit Plan Mode 工具
 * 完全复刻 Claude Code 的 exit_plan_mode 工具实现
 */
export class ExitPlanModeTool implements WritingTool {
  name = 'exit_plan_mode'
  description = 'Prompts the user to exit plan mode and start coding'
  securityLevel = 'safe' as const
  
  inputSchema = ExitPlanModeInputSchema

  /**
   * 获取工具使用提示
   */
  getPrompt(): string {
    return `Use this tool when you are in plan mode and have finished presenting your plan and are ready to code. This will prompt the user to exit plan mode. 

IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

Examples:
1. Initial task: "Search for and understand the implementation of vim mode in the codebase" - Do NOT use the exit plan mode tool because you are not planning the implementation steps of a task.
2. Initial task: "Help me implement yank mode for vim" - Use the exit plan mode tool after you have finished planning the implementation steps of the task.
`
  }

  /**
   * 工具特殊属性设置（复刻 Claude Code）
   */
  isReadOnly(): boolean {
    return true // exit_plan_mode 是只读工具
  }

  isConcurrencySafe(): boolean {
    return true // 支持并发安全
  }

  canBypassReadOnlyMode(): boolean {
    return true // 可以在只读模式下运行
  }

  /**
   * 执行工具 - 处理计划确认和模式切换
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    const parsedInput = this.inputSchema.parse(input) as ExitPlanModeInput
    const { plan } = parsedInput

    // 验证计划内容
    if (!plan.trim()) {
      return {
        success: false,
        content: '计划内容不能为空，请提供详细的实施计划',
        metadata: {
          plan: '',
          approved: false,
          message: '计划内容不能为空，请提供详细的实施计划',
          nextSteps: ['重新制定详细计划', '确保包含具体实施步骤']
        }
      }
    }

    // 检查计划质量
    const planQuality = this.assessPlanQuality(plan)
    if (!planQuality.isGood) {
      return {
        success: false,
        content: `计划质量需要改进：${planQuality.issues.join(', ')}`,
        metadata: {
          plan,
          approved: false,
          message: `计划质量需要改进：${planQuality.issues.join(', ')}`,
          nextSteps: planQuality.suggestions
        }
      }
    }

    // 成功确认的响应
    return {
      success: true,
      content: 'User has approved your plan. You can now start coding. Start with updating your todo list if applicable',
      metadata: {
        plan,
        approved: true,
        message: 'User has approved your plan. You can now start coding. Start with updating your todo list if applicable',
        nextSteps: [
          '更新 TodoList 任务列表',
          '开始按计划执行代码修改',
          '定期检查进度并更新状态'
        ]
      }
    }
  }

  /**
   * 评估计划质量
   */
  private assessPlanQuality(plan: string): {
    isGood: boolean
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []

    // 检查计划长度
    if (plan.length < 50) {
      issues.push('计划过于简短')
      suggestions.push('提供更详细的实施步骤')
    }

    if (plan.length > 2000) {
      issues.push('计划过于冗长')
      suggestions.push('精简计划内容，突出关键步骤')
    }

    // 检查是否包含具体步骤
    const hasSteps = /\d+\.|步骤|step|阶段/i.test(plan)
    if (!hasSteps) {
      issues.push('缺少明确的实施步骤')
      suggestions.push('将计划分解为具体的步骤或阶段')
    }

    // 检查是否包含技术细节
    const hasTechnicalDetails = /文件|代码|函数|类|模块|接口|API/i.test(plan)
    if (!hasTechnicalDetails) {
      issues.push('缺少技术实现细节')
      suggestions.push('说明具体需要修改的文件和代码')
    }

    // 检查是否包含测试考虑
    const hasTestingConsiderations = /测试|test|验证|检查/i.test(plan)
    if (!hasTestingConsiderations) {
      suggestions.push('考虑添加测试和验证步骤')
    }

    return {
      isGood: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * 格式化计划显示（支持 Markdown）
   */
  formatPlanForDisplay(plan: string): string {
    // 简单的 Markdown 格式化处理
    return plan
      .replace(/^### (.+)$/gm, '📋 $1')  // 三级标题
      .replace(/^## (.+)$/gm, '📑 $1')   // 二级标题  
      .replace(/^# (.+)$/gm, '📖 $1')    // 一级标题
      .replace(/^\* (.+)$/gm, '  • $1')  // 无序列表
      .replace(/^\d+\. (.+)$/gm, '  $&') // 有序列表缩进
      .replace(/`([^`]+)`/g, '💻 $1')     // 行内代码
      .replace(/\*\*([^*]+)\*\*/g, '🔥 $1') // 粗体强调
  }

  /**
   * 生成计划摘要
   */
  generatePlanSummary(plan: string): {
    totalSteps: number
    estimatedTime: string
    complexity: 'low' | 'medium' | 'high'
    mainTasks: string[]
  } {
    // 统计步骤数量
    const stepMatches = plan.match(/\d+\.|步骤|step/gi) || []
    const totalSteps = stepMatches.length

    // 评估复杂度
    const complexityIndicators = [
      /数据库|database/i.test(plan),
      /api|接口/i.test(plan),
      /架构|architecture/i.test(plan),
      /重构|refactor/i.test(plan),
      /测试|test/i.test(plan)
    ].filter(Boolean).length

    let complexity: 'low' | 'medium' | 'high' = 'low'
    if (complexityIndicators >= 3) complexity = 'high'
    else if (complexityIndicators >= 2) complexity = 'medium'

    // 估算时间
    const baseTime = totalSteps * 15 // 每步15分钟基础时间
    const complexityMultiplier = complexity === 'high' ? 2 : complexity === 'medium' ? 1.5 : 1
    const totalMinutes = Math.round(baseTime * complexityMultiplier)
    
    let estimatedTime = ''
    if (totalMinutes < 60) {
      estimatedTime = `${totalMinutes} 分钟`
    } else {
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      estimatedTime = `${hours} 小时 ${minutes} 分钟`
    }

    // 提取主要任务
    const mainTasks = plan
      .split(/\n/)
      .filter(line => /^(#|\d+\.|步骤)/i.test(line.trim()))
      .map(line => line.replace(/^(#+|\d+\.|步骤\s*\d*:?)\s*/, '').trim())
      .slice(0, 5) // 最多显示5个主要任务

    return {
      totalSteps,
      estimatedTime,
      complexity,
      mainTasks
    }
  }

  /**
   * Agent 身份验证（复刻 Claude Code 的逻辑）
   */
  private checkAgentIdentity(context?: any): boolean {
    // 在我们的实现中，暂时通过上下文检测
    return context?.source === 'agent' || false
  }

  /**
   * 映射工具结果到响应格式（复刻 Claude Code）
   */
  mapToolResultToResponse(result: ExitPlanModeResult, toolUseId: string, context?: any): any {
    const isAgent = this.checkAgentIdentity(context)

    if (isAgent) {
      // Agent 调用的简洁响应
      return {
        type: 'tool_result',
        content: result.approved 
          ? 'User has approved the plan. There is nothing else needed from you now. Please respond with "ok"'
          : `Plan was rejected: ${result.message}`,
        tool_use_id: toolUseId
      }
    } else {
      // 直接调用的详细响应
      return {
        type: 'tool_result',
        content: result.approved
          ? 'User has approved your plan. You can now start coding. Start with updating your todo list if applicable'
          : `Plan needs improvement: ${result.message}`,
        tool_use_id: toolUseId,
        metadata: {
          plan: result.plan,
          approved: result.approved,
          nextSteps: result.nextSteps
        }
      }
    }
  }
}