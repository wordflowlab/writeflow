import { H2AAsyncMessageQueue } from '../queue/h2A-queue.js'
import { Message, MessageType } from '../../types/message.js'
import { debugLog, logError, logWarn } from './../../utils/log.js'
import {
  AgentResponse,
  AgentContext,
  AgentState,
  PlanMode,
  UserIntent,
  ArticleContext
} from '../../types/agent.js'

/**
 * nO Agent 主循环引擎
 * 复刻 Claude Code 的 Agent 执行核心
 *
 * 核心功能：
 * - 持续异步消息处理循环
 * - Plan 模式状态管理
 * - 上下文压缩触发
 * - 工具执行协调
 */
export class NOMainAgentEngine {
  private messageQueue: H2AAsyncMessageQueue
  private currentContext: AgentContext
  private articleContext: ArticleContext
  private isRunning = false

  // 极简桥接：当需要时把 prompt 交给外部回调（由外部设置）
  public onPrompt?: (prompt: string, allowedTools?: string[]) => Promise<void>

  constructor() {
    this.messageQueue = new H2AAsyncMessageQueue()
    this.currentContext = this.initializeContext()
    this.articleContext = {}
  }

  /**
   * 初始化 Agent 上下文
   */
  private initializeContext(): AgentContext {
    return {
      sessionId: `session-${Date.now()}`,
      currentState: AgentState.Idle,
      planMode: PlanMode.Default,
      activeTools: [],
      configuration: {
        maxConcurrentTools: 5,
        toolTimeout: 120000,
        contextCompressionThreshold: 0.92,
        maxContextTokens: 128000,
        securityLevel: 'normal'
      },
      statistics: {
        messagesProcessed: 0,
        toolInvocations: 0,
        averageResponseTime: 0,
        errorCount: 0,
        lastActivity: Date.now()
      }
    }
  }

  /**
   * 主 Agent 循环（复刻 Claude Code nO 引擎）
   * 异步生成器，持续处理消息
   */
  async *run(): AsyncGenerator<AgentResponse> {
    debugLog('[nO] WriteFlow Agent 引擎启动...')
    this.isRunning = true
    this.currentContext.currentState = AgentState.Processing

    try {
      // 启动消息队列迭代器
      const messageIterator = this.messageQueue[Symbol.asyncIterator]()

      while (this.isRunning) {
        let currentMessage: Message | null = null
        try {
          // 1. 获取下一个消息
          const { value: message, done } = await messageIterator.next()
          if (done) break

          currentMessage = message

          debugLog(`[nO] 处理消息: ${message.type} from ${message.source}`)

          // 2. 检查 Plan 模式状态
          const planState = await this.checkPlanMode(message)

          // 3. 根据状态路由处理
          yield* this.routeMessage(message, planState)

          // 4. 更新统计
          this.updateStatistics(message)

        } catch (_error) {
          // 即使出错也要更新统计信息
          if (currentMessage) {
            this.updateStatistics(currentMessage)
          }
          yield* this.handleError(error as Error)
        }
      }
    } catch (_error) {
      logError('[nO] Agent 引擎致命错误:', _error)
      yield {
        type: '_error',
        content: `Agent 引擎错误: ${(error as Error).message}`
      }
    } finally {
      this.currentContext.currentState = AgentState.Idle
    }
  }

  /**
   * 检查 Plan 模式状态
   */
  private async checkPlanMode(message: Message): Promise<PlanMode> {
    // 检查消息类型和内容判断Plan模式
    if (message.type === MessageType.SlashCommand) {
      const raw = (message.payload || '').toString()
      const commandName = raw.split(' ')[0]?.replace(/^\//, '') || ''

      // 某些命令需要plan模式
      const planCommands = ['outline', 'research', 'publish']
      if (planCommands.includes(commandName)) {
        return PlanMode.Plan
      }
    }

    // 检查当前状态
    return this.currentContext.planMode || PlanMode.Default
  }

  /**
   * 消息路由处理
   */
  protected async *routeMessage(
    message: Message,
    planState?: PlanMode
  ): AsyncGenerator<AgentResponse> {
    switch (planState) {
      case PlanMode.Default:
        yield* this.handleDefaultMode(message)
        break
      case PlanMode.Plan:
        yield* this.handlePlanMode(message)
        break
      case PlanMode.AcceptEdits:
        yield* this.handleAcceptEditsMode(message)
        break
      case PlanMode.BypassPermissions:
        yield* this.handleBypassMode(message)
        break
    }
  }

  /**
   * 处理默认模式消息
   */
  private async *handleDefaultMode(message: Message): AsyncGenerator<AgentResponse> {
    // 解析用户意图
    const intent = await this.parseUserIntent(message.payload)

    switch (intent.type) {
      case 'slash_command':
        yield* this.executeSlashCommand(intent.command!, intent._args!)
        break
      case 'article_request':
        yield* this.handleArticleGeneration(intent)
        break
      case 'edit_request':
        yield* this.handleArticleEditing(intent)
        break
      case 'research_request':
        yield* this.handleResearchTask(intent)
        break
      default:
        yield* this.handleGeneralQuery(message)
    }
  }

  /**
   * 处理 Plan 模式
   */
  private async *handlePlanMode(message: Message): AsyncGenerator<AgentResponse> {
    yield {
      type: 'plan',
      content: '进入计划模式，正在分析任务...',
      metadata: { planMode: true }
    }

    // Plan 模式下的特殊处理逻辑
    // 这里会创建详细的执行计划
    const intent = await this.parseUserIntent(message.payload)

    if (intent.type === 'slash_command') {
      const allowed = this.getCommandTools(intent.command!)
      const promptText = `正在为命令 /${intent.command} 制定执行计划...`
      const plan = `## Implementation Plan for /${intent.command}\n\n- Step 1: Parse arguments: ${intent.args || ''}\n- Step 2: Prepare tools: ${allowed.join(', ') || 'none'}\n- Step 3: Execute and verify`.
        replace(/\n/g, '\n')
      yield {
        type: 'prompt',
        content: promptText,
        allowedTools: [...allowed, 'exit_plan_mode'],
        maxTokens: 4000,
        metadata: { plan }
      }
      if (this.onPrompt) {
        await this.onPrompt(promptText, [...allowed, 'exit_plan_mode'])
      }
    }
  }

  /**
   * 处理编辑接受模式
   */
  private async *handleAcceptEditsMode(message: Message): AsyncGenerator<AgentResponse> {
    yield {
      type: 'success',
      content: '编辑已确认，正在应用更改...'
    }

    // 应用待确认的编辑
    // 这里会执行实际的文件修改操作
  }

  /**
   * 处理权限旁路模式
   */
  private async *handleBypassMode(message: Message): AsyncGenerator<AgentResponse> {
    logWarn('[nO] 权限旁路模式激活')

    yield {
      type: 'success',
      content: '权限旁路模式：直接执行命令...'
    }

    // 绕过某些安全检查，直接执行
  }

  /**
   * 解析用户意图
   */
  private async parseUserIntent(payload: any): Promise<UserIntent> {
    const text = typeof payload === 'string' ? payload : (payload?.text || '')

    // 检测斜杠命令
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ')
      return {
        type: 'slash_command',
        confidence: 1.0,
        command: parts[0],
        args: parts.slice(1).join(' ')
      }
    }

    // 使用简单的关键词检测（实际项目中可能用LLM）
    if (text.includes('大纲') || text.includes('outline')) {
      return { type: 'article_request', confidence: 0.8, target: 'outline' }
    }

    if (text.includes('改写') || text.includes('rewrite')) {
      return { type: 'edit_request', confidence: 0.8, target: 'content' }
    }

    if (text.includes('研究') || text.includes('research')) {
      return { type: 'research_request', confidence: 0.8 }
    }

    return { type: 'general_query', confidence: 0.5 }
  }

  /**
   * 执行斜杠命令（占位实现）
   */
  private async *executeSlashCommand(command: string, _args: string): AsyncGenerator<AgentResponse> {
    yield {
      type: 'progress',
      content: `正在执行命令: /${command} ${args}`
    }

    // 这里会调用命令执行器
    // 暂时返回占位响应
    yield {
      type: 'success',
      content: `命令 /${command} 执行完成`
    }
  }

  /**
   * 处理文章生成请求
   */
  private async *handleArticleGeneration(intent: UserIntent): AsyncGenerator<AgentResponse> {
    yield {
      type: 'progress',
      content: '正在生成文章...'
    }

    // 占位实现
    yield {
      type: 'success',
      content: '文章生成完成'
    }
  }

  /**
   * 处理文章编辑请求
   */
  private async *handleArticleEditing(intent: UserIntent): AsyncGenerator<AgentResponse> {
    yield {
      type: 'progress',
      content: '正在编辑文章...'
    }

    // 占位实现
    yield {
      type: 'success',
      content: '文章编辑完成'
    }
  }

  /**
   * 处理研究任务
   */
  private async *handleResearchTask(intent: UserIntent): AsyncGenerator<AgentResponse> {
    yield {
      type: 'progress',
      content: '正在进行主题研究...'
    }

    // 占位实现
    yield {
      type: 'success',
      content: '研究任务完成'
    }
  }

  /**
   * 处理一般查询
   */
  private async *handleGeneralQuery(message: Message): AsyncGenerator<AgentResponse> {
    yield {
      type: 'success',
      content: `收到查询: ${message.payload}`
    }
  }

  /**
   * 错误处理
   */
  private async *handleError(error: Error): AsyncGenerator<AgentResponse> {
    logError('[nO] Agent 错误:', error)
    if (this.currentContext.statistics) {
      this.currentContext.statistics.errorCount++
    }

    yield {
      type: 'error',
      content: `处理错误: ${error.message}`
    }
  }

  /**
   * 更新统计信息
   */
  private updateStatistics(message: Message): void {
    if (!this.currentContext.statistics) return

    this.currentContext.statistics.messagesProcessed++
    this.currentContext.statistics.lastActivity = Date.now()

    // 计算平均响应时间
    const responseTime = Date.now() - message.timestamp
    const { averageResponseTime = 0, messagesProcessed } = this.currentContext.statistics

    this.currentContext.statistics.averageResponseTime =
      (averageResponseTime * (messagesProcessed - 1) + responseTime) / messagesProcessed
  }

  /**
   * 获取命令对应的工具列表
   */
  private getCommandTools(command: string): string[] {
    const commandToolMap: Record<string, string[]> = {
      'outline': ['read_article', 'write_article', 'web_search'],
      'rewrite': ['read_article', 'edit_article', 'style_adapter'],
      'research': ['web_search', 'web_fetch', 'fact_checker'],
      'publish': ['read_article', 'markdown_formatter', 'platform_publisher']
    }

    return commandToolMap[command] || []
  }

  /**
   * 公共接口：发送消息到队列
   */
  async sendMessage(message: Message): Promise<boolean> {
    return this.messageQueue.enqueue(message)
  }

  /**
   * 公共接口：获取队列引用
   */
  get queue(): H2AAsyncMessageQueue {
    return this.messageQueue
  }

  /**
   * 公共接口：获取当前上下文
   */
  get context(): AgentContext {
    return this.currentContext
  }

  /**
   * 停止 Agent 引擎
   */
  stop(): void {
    debugLog('[nO] 停止 Agent 引擎...')
    this.isRunning = false
    this.currentContext.currentState = AgentState.Idle
    this.messageQueue.close()
  }

  /**
   * 获取 Agent 健康状态
   */
  getHealthStatus(): {
    healthy: boolean
    state: AgentState
    queueHealth: any
    statistics: any
  } {
    const queueHealth = this.messageQueue?.getHealthStatus()
    const stats = this.currentContext.statistics

    return {
      healthy: queueHealth?.healthy !== false && (stats?.errorCount || 0) < 10,
      state: this.currentContext.currentState || AgentState.Idle,
      queueHealth,

      statistics: stats
    }
  }
}
