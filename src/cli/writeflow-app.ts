import { promises as fs } from 'fs'
import path from 'path'
import readline from 'readline'
import chalk from 'chalk'
import enquirer from 'enquirer'
import { EventEmitter } from 'events'
import { getVersion } from '../utils/version.js'

// 核心组件
import { H2AAsyncMessageQueue } from '../core/queue/h2A-queue.js'
import { CoreEngineAdapter } from '../core/adapter/core-engine-adapter.js'
import { NOMainAgentEngine } from '../core/agent/nO-engine.js'
import { WU2ContextCompressor } from '../core/context/wU2-compressor.js'
import { ContextManager } from '../core/context/context-manager.js'
import { SixLayerSecurityValidator } from '../core/security/six-layer-validator.js'

// AI 服务
import { getWriteFlowAIService, AIRequest } from '../services/ai/WriteFlowAIService.js'

// CLI 组件
import { CommandExecutor } from './executor/command-executor.js'
import { coreCommands } from './commands/core/index.js'
import { slideCommands } from './commands/slide-commands.js'
import { SlashCommand } from '../types/command.js'

// 工具系统
import { ToolManager } from '../tools/tool-manager.js'
import { TodoWriteTool } from '../tools/writing/TodoWriteTool.js'
import {
  OutlineGeneratorTool,
  ContentRewriterTool,
  StyleAdapterTool,
  GrammarCheckerTool,
  AnthropicClientTool,
  DeepseekClientTool,
  QwenClientTool,
  GLMClientTool,
} from '../tools/writing/index.js'
import { WebSearchTool } from '../tools/web/WebSearchTool.js'
import { CitationTool } from '../tools/writing/CitationTool.js'
import { WeChatConverterTool } from '../tools/publish/index.js'
import { SlideProjectInitTool } from '../tools/slidev/SlideProjectInitTool.js'
import { SlideExporterTool } from '../tools/slidev/SlideExporterTool.js'
import { ExitPlanModeTool } from '../tools/ExitPlanMode.js'

// 记忆系统
import { MemoryManager } from '../tools/memory/MemoryManager.js'

// Plan 模式管理
import { PlanModeManager } from '../modes/PlanModeManager.js'

// 类型定义
import { AIWritingConfig } from '../types/writing.js'
import { AgentContext, PlanMode } from '../types/agent.js'
import { SecurityConfig } from '../types/security.js'
import { Message, MessageType, MessagePriority } from '../types/message.js'

/**
 * WriteFlow 主应用类
 * 整合所有核心组件
 */
export class WriteFlowApp extends EventEmitter {
  // Agent 桥接统计（最小）
  private agentBridgeStats: { promptsHandled: number; toolCallsExecuted: number } = {
    promptsHandled: 0,
    toolCallsExecuted: 0,
  }

  // 核心组件
  private messageQueue!: H2AAsyncMessageQueue
  private agentEngine!: NOMainAgentEngine
  private contextCompressor!: WU2ContextCompressor
  private contextManager!: ContextManager
  private securityValidator!: SixLayerSecurityValidator

  // CLI 组件
  private commandExecutor!: CommandExecutor
  private toolManager!: ToolManager

  // 记忆系统
  private memoryManager!: MemoryManager

  // Plan 模式管理
  private planModeManager!: PlanModeManager

  // AI 服务
  private aiService = getWriteFlowAIService()

  // 配置
  private config: AIWritingConfig & SecurityConfig
  private agentContext!: AgentContext
  private projectWritingConfig: string = '' // 存储 WRITEFLOW.md 内容
  private isInitialized = false

  constructor() {
    super()
    this.config = this.getDefaultConfig()
  }

  /**
   * 获取默认模型
   */
  private getDefaultModel(): string {
    const provider = process.env.API_PROVIDER
    switch (provider) {
      case 'deepseek':
        return 'deepseek-chat'
      case 'qwen3':
        return 'qwen-max'
      case 'glm4.5':
        return 'glm-4.5'
      default:
        return 'claude-opus-4-1-20250805'
    }
  }


  /**
   * 获取默认配置
   */
  private getDefaultConfig(): AIWritingConfig & SecurityConfig {
    return {
      // AI 配置
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.QWEN_API_KEY || process.env.GLM_API_KEY || '',
      apiBaseUrl: process.env.API_BASE_URL,
      apiProvider: (process.env.API_PROVIDER as 'anthropic' | 'deepseek' | 'qwen3' | 'glm4.5') || 'anthropic',
      model: process.env.AI_MODEL || this.getDefaultModel(),
      temperature: 0.7,
      maxTokens: 4000,
      systemPrompt: `你是 WriteFlow AI 写作助手，专门帮助用户进行技术文章写作、创意写作、学术论文等各类内容创作。

核心实时响应要求：
- 始终使用流式输出，提供实时反馈和进度指示
- 响应速度优先：立即开始输出，边思考边回答
- 用户体验至上：每个响应都要考虑实时性和互动性
- 支持中断：用户可随时按 ESC 中断长时间处理
- 进度可见：显示处理进度、token 计数和持续时间

写作响应原则：
- 重要：尽可能简洁高效，避免冗余信息和不必要的解释
- 直接回答用户问题，避免"让我来解释"、"基于以上分析"等套话
- 提供可直接使用的内容和建议，而不是长篇理论阐述
- 如果可以用 1-3 句话回答清楚，就不要写成段落
- 避免不必要的前言和总结，除非用户明确要求详细解释

输出格式要求：
- 你的输出将在命令行界面中显示，请使用 GitHub 风格的 Markdown 格式
- 响应会使用等宽字体渲染，遵循 CommonMark 规范
- 充分使用 Markdown 语法来增强可读性：
  * 使用 \`\`\`语言 代码块来显示代码，会自动进行语法高亮

内容生成优先原则：
- 核心任务：当用户请求内容创作时，你的主要职责是生成高质量的内容
- TODO工具仅用于进度追踪，不是主要任务：使用TodoWrite工具跟踪写作进度，但这只是辅助功能
- 内容优先：先专注于创作用户requested的实际内容，TODO管理是后台进度显示
- 响应结构：主要输出应该是用户requested的内容，工具调用结果会在UI的专门区域显示

TODO 管理规范：
- 完成一个任务后“必须”同步状态：使用 todo_write 将该任务标记为 completed
- 若一次性完成了多个任务，应批量同步所有相关任务的状态（不要遗漏）
- 工具调用是隐式的：执行/完成任务时更新进度，但主要输出仍是内容
- 避免在主响应中包含“任务列表已更新”等工具执行信息；进度会显示在专门区域

流式输出规范：
- 按段落组织输出，每个段落完整后再显示，避免逐字符的打字机效果
- 代码块必须完整输出，不要分片传输
- 重要内容应该在完整的行或段落中一次性显示
- 避免在响应中混入不完整的 JSON 片段
  * 使用 # ## ### 标题来组织内容层次
  * 使用 \`行内代码\` 来突出显示关键词和变量名
  * 使用 **粗体** 和 *斜体* 来强调重点
  * 使用有序列表 (1. 2. 3.) 和无序列表 (- * +) 来结构化信息
  * 使用 > 引用块来突出显示重要提示
  * 使用表格来展示对比数据
- 为技术内容选择合适的语法高亮语言标识符（如 javascript, python, bash, json 等）

项目写作记忆：
- 如果当前工作目录包含 WRITEFLOW.md 文件，它将自动加载为项目上下文
- 该文件用于存储：用户写作风格偏好、常用模板、项目术语表、目标读者信息
- 在提供写作建议时，优先参考 WRITEFLOW.md 中记录的项目特定信息
- 学习并遵循文件中定义的写作约定和格式偏好

写作辅助职责：
- 专注于内容创作和文档写作，代码功能仅作为写作的辅助工具
- 用工具完成实际任务，不用工具或代码注释与用户交流
- 所有交流内容直接输出给用户，保持写作助手的专业身份

技术架构要求：
- 充分利用 H2A 消息队列系统实现高性能并发处理
- 使用 CoreEngineAdapter 提供统一的工具调用接口
- 通过 ContextManager 维护会话连续性和上下文理解
- 遵循 WriteFlow 核心组件设计模式

写作约定遵循：
- 分析用户现有文档的写作风格、语调和表达习惯
- 保持术语使用的一致性，遵循项目既定的专业词汇
- 学习并采用用户偏好的文档结构和格式模式
- 在创建新内容时优先参考现有文档的写作模式

友好写作指导：
- 不批评或纠正用户的写作方式，以协作而非指导的语气交流
- 遇到无法帮助的情况时，不要解释原因或后果，直接提供替代建议
- 保持简短友好的拒绝回应（1-2句话），避免说教式的解释
- 尊重用户的写作风格和习惯，提供建设性的改进建议

交互模式：
- 以协作而非指导的方式提供写作建议
- 支持多轮对话和上下文继承
- 实时显示处理状态和进度信息
- 优雅处理错误和异常情况`,
      stream: process.env.WRITEFLOW_STREAM === 'false' ? false : true, // 默认启用流式输出

      // 安全配置
      enabled: true,
      strictMode: false,
      contentFilter: true,
      maliciousDetection: true,
      auditLogging: true,
      allowedDomains: [
        'api.anthropic.com',
        'scholar.google.com',
        'github.com',
        'medium.com',
        'zhihu.com',
      ],
      blockedPaths: ['/etc', '/var', '/sys', '/proc'],
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
    }
  }

  /**
   * 初始化应用
   */
  async initialize(options: any = {}): Promise<void> {
    if (this.isInitialized) return

    try {
      // 加载配置
      await this.loadConfig(options.config)

      // 初始化核心组件
      await this.initializeCoreComponents()

      // 初始化记忆系统（需最先完成，以便暴露全局会话ID给 Todo 存储等模块）
      await this.initializeMemorySystem()

      // 初始化Plan模式管理器
      await this.initializePlanModeManager()

      // 初始化CLI组件
      await this.initializeCLIComponents()

      // 加载项目写作配置
      await this.loadProjectWritingConfig()

      // 设置Agent上下文
      this.agentContext = {
        userId: 'cli-user',
        sessionId: this.memoryManager.getSessionId(),
        workingDirectory: process.cwd(),
        currentProject: 'writeflow-cli',
        preferences: {
          language: 'zh-CN',
          outputStyle: 'technical',
        },
        tools: this.toolManager.getToolNames(),
        conversationHistory: [],
      }

      this.isInitialized = true
      console.log(chalk.green('✅ WriteFlow 初始化完成'))

    } catch (error) {
      console.error(chalk.red(`初始化失败: ${(error as Error).message}`))
      throw error
    }
  }

  /**
   * 初始化核心组件
   */
  private async initializeCoreComponents(): Promise<void> {
    // h2A 消息队列
    this.messageQueue = new H2AAsyncMessageQueue(10000, 8000)

    // nO Agent 引擎（需在使用前初始化）
    this.agentEngine = new NOMainAgentEngine()

    // 核心系统配置
    const useQueue = process.env.WRITEFLOW_USE_QUEUE !== 'false' // 默认启用 H2A 队列
    const agentEnabled = process.env.WRITEFLOW_AGENT_ENABLED !== 'false' // 默认启用 Agent 引擎

    // 启动 H2A 高性能消息队列系统
    if (useQueue) {
      // 用最小 CoreEngineAdapter 消费 SlashCommand 消息（当启用队列时）
      const adapter = new CoreEngineAdapter(
        this.messageQueue,
        (cmd, ctx) => this.commandExecutor.executeCommand(cmd, ctx as any),
        (msgs, allowed, sig) => this.processAIQuery(msgs, allowed, sig),
        this.agentContext,
        {
          agentEnabled: agentEnabled,
          agentEngine: this.agentEngine,
          agentStrict: process.env.WRITEFLOW_AGENT_STRICT === 'true',
        },
      )
      adapter.start().catch((e: unknown) => {
        const err = e as Error
        console.warn('[CoreEngineAdapter] 异常:', err?.message || e)
      })
    }

    // 启用 Agent 引擎系统
    if (agentEnabled) {
      this.agentEngine.onPrompt = async (prompt: string, allowed?: string[]) => {
        // 当前阶段仅事件分发；如需自动投 AI，请设置 WRITEFLOW_AGENT_PROMPT_TO_AI=true（见 startAgentLoop）
        this.emit('agent-prompt', { content: prompt, allowedTools: allowed })
      }
      this.startAgentLoop().catch((e: unknown) => {
        const err = e as Error
        console.warn('[nO] Agent 循环异常:', err?.message || e)
      })
    }

    // wU2 上下文压缩器
    this.contextCompressor = new WU2ContextCompressor({
      threshold: 0.92,
      preserveRatio: 0.3,
      maxResearchItems: 20,
      maxDialogueHistory: 50,
      maxReferenceArticles: 10,
      intelligentRanking: true,
    })

    // 上下文管理器
    this.contextManager = new ContextManager()

    // 六层安全验证器
    this.securityValidator = new SixLayerSecurityValidator(this.config)

    // nO Agent 引擎
    this.agentEngine = new NOMainAgentEngine()
  }

  /**
   * 初始化CLI组件
   */
  private async initializeCLIComponents(): Promise<void> {
    // 工具管理器
    this.toolManager = new ToolManager()

    // 注册高级写作工具
    const writingTools = [
      new OutlineGeneratorTool(this.config),
      new ContentRewriterTool(this.config),
      new StyleAdapterTool(this.config),
      new GrammarCheckerTool(this.config),
    ]
    this.toolManager.registerTools(writingTools)

    // 根据配置的API提供商注册对应的客户端
    const aiClients = []
    switch (this.config.apiProvider) {
      case 'deepseek':
        aiClients.push(new DeepseekClientTool(this.config))
        break
      case 'qwen3':
        aiClients.push(new QwenClientTool(this.config))
        break
      case 'glm4.5':
        aiClients.push(new GLMClientTool(this.config))
        break
      default:
        aiClients.push(new AnthropicClientTool(this.config))
        break
    }
    this.toolManager.registerTools(aiClients)

    // 注册研究工具
    const researchTools = [
      new WebSearchTool(),
      new CitationTool(),
    ]
    this.toolManager.registerTools(researchTools)

    // 注册发布工具
    const publishTools = [
      new WeChatConverterTool(),
    ]
    this.toolManager.registerTools(publishTools)

    // 注册 Slidev 工具（Agent 可调用）
    const slidevTools = [
      new SlideProjectInitTool(),
      new SlideExporterTool(),
    ]
    this.toolManager.registerTools(slidevTools)

    // 注册 Plan 模式工具
    const planTools = [
      new ExitPlanModeTool(),
    ]
    this.toolManager.registerTools(planTools)

    // 命令执行器
    this.commandExecutor = new CommandExecutor({
      maxConcurrentCommands: 3,
      commandTimeout: 120000,
      enableThinkingTokens: true,
      defaultMaxTokens: 4000,
    })

    // 注册核心命令
    this.commandExecutor.registerCommands(coreCommands)
    // 注册 Slide 命令（按需加载）
    this.commandExecutor.registerCommands(slideCommands)
  }

  /**
   * 初始化记忆系统
   */
  private async initializeMemorySystem(): Promise<void> {
    this.memoryManager = new MemoryManager({
      autoCompress: true,
      compressionThreshold: 90,
      maxShortTermMessages: 50,
      enableKnowledgeExtraction: true,
    })

    // 将会话ID暴露为环境变量，供 TodoStorage/旧域工具共享
    try {
      const sid = this.memoryManager.getSessionId()
      process.env.WRITEFLOW_SESSION_ID = sid
    } catch {}
  }

  /**
   * 初始化Plan模式管理器
   */
  private async initializePlanModeManager(): Promise<void> {
    this.planModeManager = new PlanModeManager(
      {
        autoInjectReminders: true,
        strictPermissionCheck: true,
        planQualityCheck: true,
        maxPlanHistory: 10,
        reminderDisplayDuration: 300000, // 5分钟
      },
      {
        onModeEnter: (previousMode) => {
          console.log('📋 已进入 Plan 模式')
          this.emit('plan-mode-enter', { previousMode })
        },
        onModeExit: (nextMode, approved) => {
          console.log(`🔄 已退出 Plan 模式，计划${approved ? '已批准' : '被拒绝'}`)
          this.emit('plan-mode-exit', { nextMode, approved })
        },
        onPlanUpdate: (plan) => {
          this.emit('plan-update', { plan })
        },
        onPlanApproval: (approved, reason) => {
          this.emit('plan-approval', { approved, reason })
        },
        onSystemReminder: (reminder) => {
          this.emit('system-reminder', reminder)
        },
      },
    )
  }

  /**
   * 启动交互式会话 (React+Ink UI)
   */
  async startInteractiveSession(): Promise<void> {
    // 动态导入UI组件以避免循环依赖
    const { startWriteFlowUI } = await import('../ui/WriteFlowUIApp.js')
    await startWriteFlowUI(this)
  }

  /**
   * 启动传统终端会话 (备用)
   */
  async startLegacySession(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('writeflow> '),
    })

    console.log(chalk.yellow('💡 提示: 输入 /help 查看可用命令，输入 /exit 退出'))
    rl.prompt()

    rl.on('line', async (input) => {
      const trimmedInput = input.trim()

      if (!trimmedInput) {
        rl.prompt()
        return
      }

      if (trimmedInput === '/exit' || trimmedInput === '/quit') {
        console.log(chalk.yellow('👋 再见！'))
        rl.close()
        return
      }

      try {
        if (trimmedInput.startsWith('/')) {
          // 执行斜杠命令
          const result = await this.executeCommand(trimmedInput)
          console.log(result)
        } else {
          // 自由对话模式
          const response = await this.handleFreeTextInput(trimmedInput)
          console.log(chalk.blue(response))
        }

      } catch (error) {
        console.error(chalk.red(`错误: ${(error as Error).message}`))
      }

      rl.prompt()
    })

    rl.on('close', () => {
      process.exit(0)
    })
  }

  /**
   * 执行命令
   */
  async executeCommand(command: string, options: any = {}): Promise<string> {
    try {
      const useQueue = process.env.WRITEFLOW_USE_QUEUE === 'true'

      if (useQueue) {
        // 将命令包装为消息并通过 h2A 队列处理（最小试点）
        const message = H2AAsyncMessageQueue.createMessage(
          MessageType.SlashCommand,
          `${command} ${options?.args || ''}`.trim(),
          MessagePriority.Normal,
          'cli',
        )
        this.messageQueue.enqueue(message)

        // 若严格模式开启，则不再执行本地执行器，由 Agent 协调
        if (process.env.WRITEFLOW_AGENT_STRICT === 'true') {
          return '命令已提交到 Agent（STRICT 模式）'
        }

        // 兼容路径：仍由现有执行器同步处理，收集队列指标
      }

      const result = await this.commandExecutor.executeCommand(command, this.agentContext)

      if (!result.success) {
        throw new Error(result.error || '命令执行失败')
      }

      // 处理特殊的模型配置命令
      if (result.messages?.[0]?.content === 'LAUNCH_MODEL_CONFIG') {
        this.emit('launch-model-config')
        // 交互模式：仅在 React UI 内切换界面；返回提示但不退出
        return '正在启动模型配置界面...'
      }

      // 特殊处理：如果是plan命令，先进入Plan模式
      if (command.startsWith('/plan')) {
        if (!this.isInPlanMode()) {
          console.log('🔄 执行 /plan 命令，自动进入 Plan 模式')
          await this.enterPlanMode()
        }
      }

      // 如果需要AI查询
      if (result.shouldQuery && result.messages) {
        // 在Plan模式下使用专用的处理逻辑
        if (this.isInPlanMode()) {
          return await this.processAIQuery(
            result.messages, 
            result.allowedTools, 
            options.signal, 
            true, 
            options.onToken,
          )
        } else {
          return await this.processAIQuery(result.messages, result.allowedTools, options.signal, true, options.onToken)
        }
      }

      // 返回直接结果
      return result.messages?.[0]?.content || '命令执行完成'

    } catch (error) {
      throw new Error(`命令执行失败: ${(error as Error).message}`)
    }
  }

  /**
   * 处理AI查询 - 使用 WriteFlowAIService
   */
  private async processAIQuery(
    messages: Array<{ role: string; content: string }>,
    allowedTools?: string[],
    signal?: AbortSignal,
    includeTools?: boolean,
    onToken?: (chunk: string) => void,
  ): Promise<string> {
    // 基于上下文管理器做最小压缩接入
    try {
      if (this.contextManager) {
        // 将合并前的用户消息更新到上下文（仅最后一条）
        const latestUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''
        if (latestUserMessage) {
          const msg: Message = {
            id: `msg-${Date.now()}`,
            type: MessageType.UserInput,
            priority: MessagePriority.Normal,
            payload: latestUserMessage,
            timestamp: Date.now(),
            source: 'cli',
          }
          await this.contextManager.updateContext(msg, {})
        }
      }
    } catch (e) {
      console.warn('[Context] 更新上下文失败，继续执行:', (e as Error).message)
    }

    // 检查是否已经被中断
    if (signal?.aborted) {
      throw new Error('操作已被中断')
    }

    // 构建系统提示词
    let systemPrompt = this.config.systemPrompt
    
    // 添加项目写作配置到系统提示词
    if (this.projectWritingConfig) {
      systemPrompt = `${systemPrompt}

# 项目写作配置

以下是当前项目的写作配置信息，请在提供写作建议时参考这些内容：

${this.projectWritingConfig}`
    }

    // 构建用户提示词（合并所有消息）
    const userMessages = messages.filter(msg => msg.role === 'user')
    const assistantMessages = messages.filter(msg => msg.role === 'assistant')
    const systemMessages = messages.filter(msg => msg.role === 'system')

    // 将系统消息合并到系统提示词
    if (systemMessages.length > 0) {
      systemPrompt = `${systemMessages.map(msg => msg.content).join('\n\n')  }\n\n${  systemPrompt}`
    }

    // 构建对话历史作为用户提示词的上下文
    let contextualPrompt = ''
    if (assistantMessages.length > 0 || userMessages.length > 1) {
      contextualPrompt = '对话历史:\n'
      const allMessages = messages.slice(0, -1) // 排除最后一条消息
      for (const msg of allMessages) {
        if (msg.role === 'user') {
          contextualPrompt += `用户: ${msg.content}\n`
        } else if (msg.role === 'assistant') {
          contextualPrompt += `助手: ${msg.content}\n`
        }
      }
      contextualPrompt += '\n当前请求:\n'
    }

    // 获取最新的用户消息
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || ''
    const finalPrompt = contextualPrompt + latestUserMessage

    // 构建AI请求
    const aiRequest: AIRequest = {
      prompt: finalPrompt,
      systemPrompt,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      stream: this.config.stream,
      onToken,
      // 如果指定了工具，则启用工具调用
      allowedTools: allowedTools && allowedTools.length > 0 ? allowedTools : undefined,
      enableToolCalls: Boolean(includeTools && allowedTools && allowedTools.length > 0),
    }

    try {
      const response = await this.aiService.processRequest(aiRequest)

      // 统一拦截一步，提取 thinking 和可能的传统工具调用（兼容非 function-calling 提供商）
      try {
        const intercept = await this.interceptToolCalls(response.content)
        if (intercept.thinkingContent) {
          // 将 thinking 通过事件发给 UI（可选择展示）
          this.emit('ai-thinking', intercept.thinkingContent)
        }
        if (intercept.shouldIntercept && intercept.toolCalls?.length) {
          let toolResults = ''
          for (const call of intercept.toolCalls) {
            const result = await this.executeToolWithEvents(call.toolName, call.input)
            // 过滤TODO工具的结果，不添加到主响应中
            if (result && result.success && result.content && 
                !call.toolName.includes('todo') && 
                !call.toolName.includes('Todo')) {
              toolResults += `${result.content  }\n`
            }
          }
          
          // 如果有非TODO工具执行结果，将其添加到响应中
          if (toolResults.trim()) {
            const cleanedResponse = intercept.processedResponse || ''
            const finalResponse = cleanedResponse.trim() + (cleanedResponse.trim() ? '\n\n' : '') + toolResults.trim()
            return finalResponse
          }
        }
        // 若拦截返回了清理后的正文，优先返回它
        if (intercept.processedResponse) {
          return intercept.processedResponse
        }
      } catch (e) {
        console.warn('[AI] 拦截/解析工具调用失败，使用原始响应:', (e as Error)?.message)
      }

      // 直接返回响应内容，TODO 显示由 TodoPanel 处理
      return response.content
    } catch (error) {
      throw new Error(`AI查询失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }


  /**
   * 处理自由文本输入 - 使用 WriteFlowAIService
   */
  async handleFreeTextInput(input: string, options: {
    signal?: AbortSignal,
    messages?: Array<{ type: string; content: string }>,
    planMode?: boolean,
    onToken?: (chunk: string) => void,
  } = {}): Promise<string> {
    try {
      // 检查是否被中断
      if (options.signal?.aborted) {
        throw new Error('操作已被中断')
      }

      // 添加用户消息到记忆系统
      if (this.memoryManager) {
        await this.memoryManager.addMessage('user', input)
      }

      // 构建系统提示词
      let systemPrompt = this.config.systemPrompt
      
      // 添加项目写作配置到系统提示词  
      if (this.projectWritingConfig) {
        systemPrompt = `${systemPrompt}

# 项目写作配置

以下是当前项目的写作配置信息，请在提供写作建议时参考这些内容：

${this.projectWritingConfig}`
      }

      // Plan 模式的特殊处理
      if (options.planMode || this.isInPlanMode()) {
        // 注入Plan模式的系统提醒
        const planModeReminder = this.planModeManager?.injectSystemReminder()
        if (planModeReminder) {
          systemPrompt = `${planModeReminder.content}

${systemPrompt}`
        }

        console.log('📋 Plan 模式已激活')
      }

      // 获取记忆上下文（如果可用）
      let contextualPrompt = input
      if (this.memoryManager) {
        try {
          const context = await this.memoryManager.getContext(input)

          let contextInfo = ''

          // 添加相关知识
          if (context.knowledgeEntries.length > 0) {
            const knowledgeContext = context.knowledgeEntries
              .slice(0, 2)
              .map(entry => `知识: ${entry.topic}\n${entry.content}`)
              .join('\n\n')

            contextInfo += `相关知识背景:\n${knowledgeContext}\n\n`
          }

          // 添加相关会话总结
          if (context.relevantSummaries.length > 0) {
            const summaryContext = context.relevantSummaries
              .slice(0, 2)
              .map(summary => summary.summary)
              .join('\n\n')

            contextInfo += `相关历史会话总结:\n${summaryContext}\n\n`
          }

          // 添加最近的对话历史
          if (context.recentMessages.length > 1) {
            contextInfo += '最近的对话:\n'
            const recentMessages = context.recentMessages.slice(-4, -1) // 排除当前消息，只取最近几条
            for (const msg of recentMessages) {
              contextInfo += `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}\n`
            }
            contextInfo += '\n'
          }

          if (contextInfo) {
            contextualPrompt = `${contextInfo  }当前请求:\n${  input}`
          }
        } catch (error) {
          console.warn('获取记忆上下文失败，使用原始输入:', error)
        }
      }

      // 构建AI请求
      const aiRequest: AIRequest = {
        prompt: contextualPrompt,
        systemPrompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        stream: this.config.stream,
        onToken: options.onToken,
        // 允许 AI 直接调用 Todo 工具（DeepSeek/OpenAI 兼容路径优先生效）
        allowedTools: ['todo_write', 'todo_read', 'exit_plan_mode'],
        enableToolCalls: true,
      }

      // 调用AI服务
      const response = await this.aiService.processRequest(aiRequest)

      // 在Plan模式下，检查响应是否包含exit_plan_mode工具调用
      if (this.isInPlanMode() && response.content) {
        try {
          const intercept = await this.interceptToolCalls(response.content)
          if (intercept.shouldIntercept && intercept.toolCalls?.length) {
            for (const call of intercept.toolCalls) {
              if (call.toolName === 'exit_plan_mode') {
                // 直接处理退出Plan模式的请求
                await this.executeToolWithEvents(call.toolName, call.input)
              } else {
                await this.executeToolWithEvents(call.toolName, call.input)
              }
            }
          }
        } catch (e) {
          console.warn('[Plan Mode] 工具调用处理失败:', (e as Error)?.message)
        }
      }

      // 添加响应到记忆系统
      if (this.memoryManager) {
        await this.memoryManager.addMessage('assistant', response.content)

        // 检查是否需要压缩
        const compressionCheck = await this.memoryManager.checkCompressionNeeded()
        if (compressionCheck.needed) {
          console.log(chalk.yellow(`🧠 记忆系统需要压缩: ${compressionCheck.reason}`))
        }
      }

      return response.content

    } catch (error) {
      console.warn('AI对话失败，回退到意图检测:', error)
      return this.fallbackToIntentDetection(input)
    }
  }

  /**
   * 回退的意图检测逻辑
   */
  private async fallbackToIntentDetection(input: string): Promise<string> {
    const intent = await this.detectUserIntent(input)

    switch (intent.type) {
      case 'outline':
        return await this.executeCommand(`/outline ${intent.topic}`)

      case 'rewrite':
        return await this.executeCommand(`/rewrite ${intent.style} "${intent.content}"`)

      case 'research':
        return await this.executeCommand(`/research ${intent.topic}`)

      default:
        // 提供更友好的响应，而不是错误
        return `你好！我是WriteFlow AI写作助手。你可以：
• 直接与我对话："${input}"
• 使用斜杠命令：/help 查看帮助
• 生成大纲：/outline [主题]
• 改写内容：/rewrite [内容]

有什么我可以帮助你的吗？`
    }
  }

  /**
   * 检测用户意图
   */
  private async detectUserIntent(input: string): Promise<{ type: string; [key: string]: any }> {
    // 简化的意图检测
    if (input.includes('大纲') || input.includes('outline')) {
      const topic = input.replace(/.*?(大纲|outline)\s*[:：]?\s*/, '').trim()
      return { type: 'outline', topic }
    }

    if (input.includes('改写') || input.includes('rewrite')) {
      return { type: 'rewrite', style: 'popular', content: input }
    }

    if (input.includes('研究') || input.includes('research')) {
      const topic = input.replace(/.*?(研究|research)\s*[:：]?\s*/, '').trim()
      return { type: 'research', topic }
    }

    return { type: 'unknown', input }
  }

  /**
   * 保存到文件
   */
  async saveToFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8')
  }

  /**
   * 配置管理
   */
  async loadConfig(configPath?: string): Promise<void> {
    if (configPath && await this.fileExists(configPath)) {
      try {
        const configContent = await fs.readFile(configPath, 'utf8')
        const userConfig = JSON.parse(configContent)
        this.config = { ...this.config, ...userConfig }
      } catch (error) {
        console.warn(chalk.yellow(`配置文件加载失败: ${(error as Error).message}`))
      }
    }
  }

  async setConfig(key: string, value: any): Promise<void> {
    (this.config as any)[key] = value
    // 可以保存到配置文件
  }

  async getConfig(key: string): Promise<any> {
    return (this.config as any)[key]
  }

  async getAllConfig(): Promise<any> {
    return { ...this.config }
  }

  /**
   * 获取系统状态 - 包含记忆系统状态
   */
  async getSystemStatus(): Promise<Record<string, any>> {
    const memoryStats = this.memoryManager ? await this.memoryManager.getStats() : null

    return {
      version: getVersion(),
      initialized: this.isInitialized,
      h2aQueue: this.messageQueue ? this.messageQueue.getMetrics() : null,
      agent: this.agentEngine ? this.agentEngine.getHealthStatus() : null,
      bridgeStats: this.agentBridgeStats || null,
      activeTools: this.toolManager?.getAvailableTools().length || 0,
      availableCommands: this.commandExecutor?.getAvailableCommands().length || 0,
      currentModel: this.config.model,
      securityEnabled: this.config.enabled,
      // 新增：上下文指标输出
      context: this.contextManager ? {
        ...this.contextManager.getMetrics(),
        compressionStats: this.contextManager.getCompressionStats(),
      } : null,
      memory: memoryStats ? {
        shortTerm: {
          messages: memoryStats.shortTerm.messageCount,
          tokens: memoryStats.shortTerm.totalTokens,
        },
        midTerm: {
          summaries: memoryStats.midTerm.summaryCount,
          sessions: memoryStats.midTerm.totalSessions,
        },
        longTerm: {
          knowledge: memoryStats.longTerm.knowledgeCount,
          topics: memoryStats.longTerm.topicCount,
        },
      } : null,
    }
  }

  /**
   * 获取记忆管理器实例
   */
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager || null
  }

  /**
   * 获取 TodoManager 实例
   */
  getTodoManager() {
    // 统一命名: 仅支持 'todo_write'
    const tool = this.toolManager?.getToolInfo('todo_write') as any
    if (tool && (tool.todoManager || tool.getTodoManager)) {
      return tool.todoManager || tool.getTodoManager?.()
    }
    return null
  }

  /**
   * 获取所有可用的命令（用于命令补全）
   */
  getAllCommands(): SlashCommand[] {
    if (!this.commandExecutor) {
      return []
    }
    return this.commandExecutor.getAllCommands()
  }

  /**
   * 手动触发记忆压缩
   */
  async compressMemory(): Promise<any> {
    if (!this.memoryManager) {
      throw new Error('记忆系统未初始化')
    }
    return await this.memoryManager.forceCompression()
  }

  /**
   * 搜索记忆
   */
  async searchMemory(query: string): Promise<any> {
    if (!this.memoryManager) {
      throw new Error('记忆系统未初始化')
    }
    return await this.memoryManager.search(query)
  }

  /**
   * 文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 执行工具并处理事件发射
   */
  async executeToolWithEvents(toolName: string, input: any): Promise<any> {
    // 安全校验：六层安全验证（最小接入）
    const securityEnabled = process.env.WRITEFLOW_SECURITY_ENABLED !== 'false' && this.config.enabled
    if (this.securityValidator && securityEnabled) {
      try {
        const secResp = await this.securityValidator.validate({
          type: 'tool_execution',
          toolName,
          input,
          user: this.agentContext?.userId || 'unknown',
          source: 'cli',
          timestamp: Date.now(),
        })
        if (!secResp.allowed) {
          return {
            success: false,
            content: '❌ 安全校验未通过',
            error: secResp.reason || '安全策略拒绝',
          }
        }
        if (secResp.warnings?.length) {
          console.warn('[Security warnings]', secResp.warnings.join(' | '))
        }
      } catch (e) {
        console.warn('[Security] 校验异常，阻断执行:', (e as Error).message)
        return {
          success: false,
          content: '❌ 安全校验异常，已阻断执行',
          error: (e as Error).message,
        }
      }
    }
    // 特殊处理 exit_plan_mode 工具
    if (toolName === 'exit_plan_mode') {
      console.log('🔄 执行 exit_plan_mode 工具，计划内容长度:', input.plan?.length || 0)

      // 确保计划内容存在
      if (!input.plan || input.plan.trim().length === 0) {
        return {
          success: false,
          content: '❌ 计划内容为空，请提供详细计划',
          error: '计划内容不能为空',
        }
      }

      // 发射事件给 UI，传递完整的计划内容
      this.emit('exit-plan-mode', input.plan)

      return {
        success: true,
        content: `📋 计划已生成，等待用户确认...

计划预览:
${input.plan.substring(0, 300)}${input.plan.length > 300 ? '...' : ''}`,
        metadata: {
          plan: input.plan,
          approved: false,
          message: '等待用户确认计划...',
          timestamp: Date.now(),
        },
      }
    }

    // 执行其他工具
    return await this.toolManager.executeTool(toolName, input)
  }
  /**
   * 拦截并处理 AI 响应中的工具调用
   */
  async interceptToolCalls(aiResponse: any): Promise<{
    shouldIntercept: boolean
    processedResponse?: string
    toolCalls?: Array<{ toolName: string; input: any }>
    thinkingContent?: string
  }> {
    console.log('🔍 开始拦截工具调用，响应类型:', typeof aiResponse)

    let shouldIntercept = false
    let processedResponse = ''
    const toolCalls = []
    let thinkingContent: string | undefined

    // 处理不同格式的响应
    let responseToProcess = aiResponse

    // 如果是包装的对象，提取 content
    if (typeof aiResponse === 'object' && aiResponse !== null && !Array.isArray(aiResponse)) {
      if ((aiResponse as any).content) {
        responseToProcess = (aiResponse as any).content
        console.log('📦 从包装对象中提取 content')
      }
    }

    // 处理结构化响应（content 数组）
    if (Array.isArray(responseToProcess)) {
      console.log('📦 处理结构化响应，内容块数量:', responseToProcess.length)

      for (const block of responseToProcess) {
        if (block.type === 'text') {
          let textContent = block.text || ''

          // 提取 thinking 内容
          const thinkingMatch = textContent.match(/<thinking>([\s\S]*?)<\/thinking>/i)
          if (thinkingMatch) {
            thinkingContent = thinkingMatch[1].trim()
            console.log('🧠 提取到 thinking 内容，长度:', thinkingContent?.length || 0)
            textContent = textContent.replace(thinkingMatch[0], '').trim()
          }

          processedResponse += textContent
        } else if (block.type === 'tool_use') {
          shouldIntercept = true
          const toolName = block.name
          const input = block.input

          console.log('🎯 检测到工具调用:', toolName)

          if (toolName === 'ExitPlanMode' && input?.plan) {
            toolCalls.push({ toolName: 'exit_plan_mode', input })
            console.log('📋 ExitPlanMode 计划内容长度:', input.plan.length)
            this.emit('exit-plan-mode', input.plan)
          } else if (toolName === 'todo_write') {
            // TodoWrite 更新任务列表
            toolCalls.push({ toolName: 'todo_write', input })
            console.log('🗒️  todo_write 调用已拦截，转交 todo_write 工具执行')
          } else if (toolName === 'TodoRead' || toolName === 'todo_read') {
            toolCalls.push({ toolName: 'todo_read', input })
            console.log('📖  TodoRead 调用已拦截，转交 todo_read 工具执行')
          }
        }
      }
    } else if (typeof aiResponse === 'string') {
      // 处理传统的文本响应（向后兼容）
      console.log('📝 处理传统文本响应，长度:', aiResponse.length)

      // 使用 provider 适配器处理内联标记
      try {
        const { getProviderAdapter } = await import('../services/ai/providers/index.js')
        const adapter = getProviderAdapter(this.config.apiProvider)
        const extracted = adapter.extractInlineToolCalls(aiResponse)
        aiResponse = extracted.cleaned
        if (extracted.calls.length > 0) {
          shouldIntercept = true
          for (const c of extracted.calls) {
            // 兼容大小写/历史命名
            const name = (c.name || '').toLowerCase()
            const mapped = name === 'todowrite' ? 'todo_write' : name === 'todoread' ? 'todo_read' : c.name
            toolCalls.push({ toolName: mapped, input: c.args })
          }
        }
        // 再兜底清理
        aiResponse = adapter.sanitizeText(aiResponse)
      } catch {}

      const thinkingMatch = aiResponse.match(/<thinking>([\s\S]*?)<\/thinking>/i)
      if (thinkingMatch) {
        thinkingContent = thinkingMatch[1].trim()
      }

      // 检测传统工具调用格式
      const patterns = [
        /<function_calls>[\s\S]*?<invoke name="ExitPlanMode">[\s\S]*?<parameter name="plan">([\s\S]*?)<\/antml:parameter>[\s\S]*?<\/antml:invoke>[\s\S]*?<\/antml:function_calls>/gi,
        /<function_calls>[\s\S]*?<invoke name="todo_write">[\s\S]*?<parameter name="todos">([\s\S]*?)<\/antml:parameter>[\s\S]*?<\/antml:invoke>[\s\S]*?<\/antml:function_calls>/gi,
      ]

      for (const pattern of patterns) {
        const matches = [...aiResponse.matchAll(pattern)]

        for (const match of matches) {
          shouldIntercept = true
          if (pattern.source.includes('ExitPlanMode')) {
            const planContent = match[1].trim()
            toolCalls.push({ toolName: 'exit_plan_mode', input: { plan: planContent } })
            console.log('🎯 检测到传统 ExitPlanMode 工具调用')
            this.emit('exit-plan-mode', planContent)
            processedResponse = aiResponse.replace(match[0], '')
          } else {
            // 传统 todo_write 调用：尝试解析 todos JSON
            const rawTodos = match[1].trim()
            let parsed: any = null
            try {
              const cleaned = rawTodos.replace(/^```[a-zA-Z]*\n?/,'').replace(/```\s*$/,'')
              parsed = JSON.parse(cleaned)
            } catch (e) {
              console.warn('⚠️  解析传统 TodoWrite 参数失败，按原始文本传递:', (e as Error).message)
            }
            const input = parsed ? { todos: parsed } : { todos: rawTodos }
            toolCalls.push({ toolName: 'todo_write', input })
            console.log('🎯 检测到传统 todo_write 工具调用')
            processedResponse = aiResponse.replace(match[0], '')
          }
        }
      }

      if (!shouldIntercept) {
        processedResponse = aiResponse
      }
    }

    console.log('✅ 拦截结果:', { shouldIntercept, hasThinking: !!thinkingContent, toolCallsCount: toolCalls.length })

    return {
      shouldIntercept,
      processedResponse,
      toolCalls,
      thinkingContent,
    }
  }

  /**
   * 启动 nO Agent 主循环（只读消费，当前阶段不改变外部行为）
   */
  private async startAgentLoop(): Promise<void> {
    try {
      for await (const resp of this.agentEngine.run()) {
        // 分发事件，便于 UI 或测试监听
        try {
          this.emit('agent-response', resp)
          if (resp.type === 'plan') this.emit('agent-plan', resp)
          if (resp.type === 'prompt') this.emit('agent-prompt', resp)
        } catch {}

        // 统计：处理过的 prompt 计数
        this.agentBridgeStats.promptsHandled++


        // 闭环桥接：当 Agent 产出 prompt 时，先尝试拦截/执行工具；若无工具调用且开启了自动AI，则再投到 AI
        if (resp.type === 'prompt' && resp.content) {
          let intercepted = false
          try {
            const intercept = await this.interceptToolCalls(resp)
            if (intercept.shouldIntercept && intercept.toolCalls?.length) {
              intercepted = true
              for (const call of intercept.toolCalls) {
                await this.executeToolWithEvents(call.toolName, call.input)
                this.agentBridgeStats.toolCallsExecuted++
              }
            }

            // 最小闭环：如果没有工具调用但携带了 plan 元数据，则触发 exit_plan_mode
            if (!intercepted && (resp as any).metadata?.plan) {
              intercepted = true
              await this.executeToolWithEvents('exit_plan_mode', { plan: (resp as any).metadata.plan })
            }
          } catch (err) {
            console.warn('[Agent Bridge] 工具拦截/闭环失败:', (err as Error)?.message || err)
          }

          if (!intercepted && process.env.WRITEFLOW_AGENT_PROMPT_TO_AI === 'true') {
            try {
              const content = await this.processAIQuery([{ role: 'user', content: resp.content }], resp.allowedTools)
              this.emit('agent-ai-result', content)
            } catch (err) {
              console.warn('[nO] Agent prompt->AI 失败:', (err as Error)?.message || err)
            }
          }
        }
      }
    } catch (e) {
      const err = e as Error
      console.warn('[nO] Agent 循环结束:', err?.message || e)
    }
  }



  /**
   * 加载项目写作配置文件 (WRITEFLOW.md)
   */
  private async loadProjectWritingConfig(): Promise<void> {
    try {
      const writeflowConfigPath = path.join(process.cwd(), 'WRITEFLOW.md')
      
      if (await fs.access(writeflowConfigPath).then(() => true).catch(() => false)) {
        this.projectWritingConfig = await fs.readFile(writeflowConfigPath, 'utf-8')
        console.log(chalk.blue('📋 已加载项目写作配置: WRITEFLOW.md'))
      }
    } catch (error) {
      // 配置文件不存在或读取失败，静默处理
      console.debug('WRITEFLOW.md 配置文件未找到或读取失败')
    }
  }

  /**
   * 最小队列消费者：仅用于推进队列指标与稳态验证
   * 后续可以在这里对接 Agent 引擎处理消息
   */
  private async startQueueConsumer(): Promise<void> {
    try {
      for await (const _msg of this.messageQueue) {
        // 暂不执行业务逻辑
      }
    } catch (e) {
      const err = e as Error
      console.warn('[h2A] 消费循环结束:', err?.message || e)
    }
  }

  /**
   * 进入 Plan 模式
   */
  async enterPlanMode(): Promise<void> {
    if (!this.planModeManager) {
      throw new Error('Plan 模式管理器未初始化')
    }
    
    const reminders = await this.planModeManager.enterPlanMode()
    console.log('✅ 已成功进入 Plan 模式')
    
    // 通知UI更新状态
    this.emit('plan-mode-changed', {
      isActive: true,
      reminders,
    })
  }

  /**
   * 退出 Plan 模式
   */
  async exitPlanMode(plan: string): Promise<boolean> {
    if (!this.planModeManager) {
      throw new Error('Plan 模式管理器未初始化')
    }
    
    const result = await this.planModeManager.exitPlanMode(plan)
    
    // 通知UI更新状态
    this.emit('plan-mode-changed', {
      isActive: !result.approved,
      approved: result.approved,
      reminders: result.reminders,
    })
    
    return result.approved
  }

  /**
   * 检查是否处于 Plan 模式
   */
  isInPlanMode(): boolean {
    return this.planModeManager?.isInPlanMode() || false
  }

  /**
   * 获取Plan模式管理器
   */
  getPlanModeManager(): PlanModeManager | null {
    return this.planModeManager || null
  }

  /**
   * 获取当前计划
   */
  getCurrentPlan(): string | undefined {
    return this.planModeManager?.getCurrentPlan()
  }

}
