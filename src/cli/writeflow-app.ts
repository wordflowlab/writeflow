import { promises as fs } from 'fs'
import path from 'path'
import readline from 'readline'
import chalk from 'chalk'
import enquirer from 'enquirer'
import { EventEmitter } from 'events'
import { getVersion } from '../utils/version.js'

// 核心组件
import { H2AAsyncMessageQueue } from '../core/queue/h2A-queue.js'
import { NOMainAgentEngine } from '../core/agent/nO-engine.js'
import { WU2ContextCompressor } from '../core/context/wU2-compressor.js'
import { ContextManager } from '../core/context/context-manager.js'
import { SixLayerSecurityValidator } from '../core/security/six-layer-validator.js'

// CLI 组件
import { CommandExecutor } from './executor/command-executor.js'
import { coreCommands } from './commands/core-commands.js'

// 工具系统
import { ToolManager } from '../tools/tool-manager.js'
import { 
  OutlineGeneratorTool,
  ContentRewriterTool,
  StyleAdapterTool,
  GrammarCheckerTool,
  AnthropicClientTool,
  DeepseekClientTool,
  QwenClientTool,
  GLMClientTool
} from '../tools/writing/index.js'
import { WebSearchTool, CitationManagerTool } from '../tools/research/index.js'
import { WeChatConverterTool } from '../tools/publish/index.js'

// 记忆系统
import { MemoryManager } from '../tools/memory/MemoryManager.js'

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

  // 配置
  private config: AIWritingConfig & SecurityConfig
  private agentContext!: AgentContext
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
   * 获取客户端名称
   */
  private getClientName(): string {
    switch (this.config.apiProvider) {
      case 'deepseek':
        return 'deepseek_client'
      case 'qwen3':
        return 'qwen_client'
      case 'glm4.5':
        return 'glm_client'
      default:
        return 'anthropic_client'
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
      systemPrompt: '你是WriteFlow AI写作助手，专门帮助用户进行技术文章写作。',

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
        'zhihu.com'
      ],
      blockedPaths: ['/etc', '/var', '/sys', '/proc'],
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10
      }
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

      // 初始化CLI组件
      await this.initializeCLIComponents()

      // 初始化记忆系统
      await this.initializeMemorySystem()

      // 设置Agent上下文
      this.agentContext = {
        userId: 'cli-user',
        sessionId: this.memoryManager.getSessionId(),
        workingDirectory: process.cwd(),
        currentProject: 'writeflow-cli',
        preferences: {
          language: 'zh-CN',
          outputStyle: 'technical'
        },
        tools: this.toolManager.getToolNames(),
        conversationHistory: []
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

    // wU2 上下文压缩器
    this.contextCompressor = new WU2ContextCompressor({
      threshold: 0.92,
      preserveRatio: 0.3,
      maxResearchItems: 20,
      maxDialogueHistory: 50,
      maxReferenceArticles: 10,
      intelligentRanking: true
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
      new GrammarCheckerTool(this.config)
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
      new CitationManagerTool()
    ]
    this.toolManager.registerTools(researchTools)

    // 注册发布工具
    const publishTools = [
      new WeChatConverterTool()
    ]
    this.toolManager.registerTools(publishTools)

    // 命令执行器
    this.commandExecutor = new CommandExecutor({
      maxConcurrentCommands: 3,
      commandTimeout: 120000,
      enableThinkingTokens: true,
      defaultMaxTokens: 4000
    })

    // 注册核心命令
    this.commandExecutor.registerCommands(coreCommands)
  }

  /**
   * 初始化记忆系统
   */
  private async initializeMemorySystem(): Promise<void> {
    this.memoryManager = new MemoryManager({
      autoCompress: true,
      compressionThreshold: 90,
      maxShortTermMessages: 50,
      enableKnowledgeExtraction: true
    })
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
      prompt: chalk.cyan('writeflow> ')
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
      const result = await this.commandExecutor.executeCommand(command, this.agentContext)
      
      if (!result.success) {
        throw new Error(result.error || '命令执行失败')
      }

      // 如果需要AI查询
      if (result.shouldQuery && result.messages) {
        return await this.processAIQuery(result.messages, result.allowedTools, options.signal)
      }

      // 返回直接结果
      return result.messages?.[0]?.content || '命令执行完成'

    } catch (error) {
      throw new Error(`命令执行失败: ${(error as Error).message}`)
    }
  }

  /**
   * 处理AI查询
   */
  private async processAIQuery(
    messages: Array<{ role: string; content: string }>,
    allowedTools?: string[],
    signal?: AbortSignal
  ): Promise<string> {
    
    // 检查是否已经被中断
    if (signal?.aborted) {
      throw new Error('操作已被中断')
    }
    
    // 根据配置的API提供商选择对应的客户端
    const clientName = this.getClientName()
    const aiClient = this.toolManager.getToolInfo(clientName)
    
    if (!aiClient) {
      throw new Error(`AI客户端(${clientName})未初始化`)
    }

    const result = await this.toolManager.executeTool(clientName, {
      messages,
      systemPrompt: this.config.systemPrompt,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    })

    if (!result.success) {
      throw new Error(result.error || 'AI查询失败')
    }

    return result.content || '查询完成'
  }

  /**
   * 处理自由文本输入 - 集成记忆系统
   */
  async handleFreeTextInput(input: string, options: { 
    signal?: AbortSignal, 
    messages?: Array<{ type: string; content: string }> 
  } = {}): Promise<string> {
    try {
      // 添加用户消息到记忆系统
      await this.memoryManager.addMessage('user', input)
      
      // 获取上下文（包含三层记忆）
      const context = await this.memoryManager.getContext(input)
      
      // 构建对话历史（优先使用记忆系统的数据）
      const conversationHistory: Array<{ role: string; content: string }> = []
      
      // 添加相关知识（如果存在）
      if (context.knowledgeEntries.length > 0) {
        const knowledgeContext = context.knowledgeEntries
          .slice(0, 3)
          .map(entry => `知识: ${entry.topic}\n${entry.content}`)
          .join('\n\n')
        
        conversationHistory.push({
          role: 'system',
          content: `相关知识背景:\n${knowledgeContext}`
        })
      }
      
      // 添加相关会话总结（如果存在）
      if (context.relevantSummaries.length > 0) {
        const summaryContext = context.relevantSummaries
          .slice(0, 2)
          .map(summary => summary.summary)
          .join('\n\n')
        
        conversationHistory.push({
          role: 'system',
          content: `相关历史会话总结:\n${summaryContext}`
        })
      }
      
      // 添加短期记忆中的消息
      for (const msg of context.recentMessages) {
        conversationHistory.push({
          role: msg.role,
          content: msg.content
        })
      }
      
      // 使用完整对话历史调用AI
      const response = await this.processAIQuery(conversationHistory, undefined, options.signal)
      
      // 添加AI响应到记忆系统
      await this.memoryManager.addMessage('assistant', response)
      
      // 检查是否需要压缩
      const compressionCheck = await this.memoryManager.checkCompressionNeeded()
      if (compressionCheck.needed) {
        console.log(chalk.yellow(`🧠 记忆系统需要压缩: ${compressionCheck.reason}`))
      }
      
      return response
      
    } catch (error) {
      // 如果AI调用失败，回退到意图检测
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
      messageQueueSize: this.messageQueue?.getMetrics().queueSize || 0,
      activeTools: this.toolManager?.getAvailableTools().length || 0,
      availableCommands: this.commandExecutor?.getAvailableCommands().length || 0,
      currentModel: this.config.model,
      securityEnabled: this.config.enabled,
      memory: memoryStats ? {
        shortTerm: {
          messages: memoryStats.shortTerm.messageCount,
          tokens: memoryStats.shortTerm.totalTokens
        },
        midTerm: {
          summaries: memoryStats.midTerm.summaryCount,
          sessions: memoryStats.midTerm.totalSessions
        },
        longTerm: {
          knowledge: memoryStats.longTerm.knowledgeCount,
          topics: memoryStats.longTerm.topicCount
        }
      } : null
    }
  }

  /**
   * 获取记忆管理器实例
   */
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager || null
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
    // 特殊处理 exit_plan_mode 工具
    if (toolName === 'exit_plan_mode') {
      // 发射事件给 UI
      this.emit('exit-plan-mode', input.plan)
      return {
        success: true,
        content: '等待用户确认计划...',
        metadata: {
          plan: input.plan,
          approved: false,
          message: '等待用户确认计划...'
        }
      }
    }
    
    // 执行其他工具
    return await this.toolManager.executeTool(toolName, input)
  }

  /**
   * 拦截并处理 AI 响应中的工具调用
   */
  async interceptToolCalls(aiResponse: string): Promise<{
    shouldIntercept: boolean
    processedResponse?: string
    toolCalls?: Array<{ toolName: string; input: any }>
  }> {
    // 检测 AI 响应中的工具调用模式
    const toolCallPattern = /<function_calls>[\s\S]*?<invoke name="([^"]+)">[\s\S]*?<parameter name="([^"]+)">([^<]*)<\/antml:parameter>[\s\S]*?<\/antml:invoke>[\s\S]*?<\/antml:function_calls>/g
    
    const matches = [...aiResponse.matchAll(toolCallPattern)]
    
    if (matches.length === 0) {
      return { shouldIntercept: false }
    }

    const toolCalls = []
    let processedResponse = aiResponse

    for (const match of matches) {
      const toolName = match[1]
      const paramName = match[2] 
      const paramValue = match[3]
      
      if (toolName === 'ExitPlanMode') {
        // 提取计划内容
        const input = { plan: paramValue }
        toolCalls.push({ toolName: 'exit_plan_mode', input })
        
        // 发射事件
        this.emit('exit-plan-mode', paramValue)
        
        // 移除工具调用，替换为等待消息
        processedResponse = processedResponse.replace(match[0], '等待用户确认计划...')
      }
    }

    return {
      shouldIntercept: true,
      processedResponse,
      toolCalls
    }
  }
}