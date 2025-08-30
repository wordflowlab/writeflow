import { promises as fs } from 'fs'
import path from 'path'
import readline from 'readline'
import chalk from 'chalk'
import enquirer from 'enquirer'

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
  AnthropicClientTool
} from '../tools/writing/index.js'
import { WebSearchTool, CitationManagerTool } from '../tools/research/index.js'
import { WeChatConverterTool } from '../tools/publish/index.js'

// 类型定义
import { AIWritingConfig } from '../types/writing.js'
import { AgentContext, PlanMode } from '../types/agent.js'
import { SecurityConfig } from '../types/security.js'

/**
 * WriteFlow 主应用类
 * 整合所有核心组件
 */
export class WriteFlowApp {
  // 核心组件
  private messageQueue!: H2AAsyncMessageQueue
  private agentEngine!: NOMainAgentEngine
  private contextCompressor!: WU2ContextCompressor
  private contextManager!: ContextManager
  private securityValidator!: SixLayerSecurityValidator

  // CLI 组件
  private commandExecutor!: CommandExecutor
  private toolManager!: ToolManager

  // 配置
  private config: AIWritingConfig & SecurityConfig
  private agentContext!: AgentContext
  private isInitialized = false

  constructor() {
    this.config = this.getDefaultConfig()
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): AIWritingConfig & SecurityConfig {
    return {
      // AI 配置
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-sonnet-20240229',
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

      // 设置Agent上下文
      this.agentContext = {
        userId: 'cli-user',
        sessionId: `session-${Date.now()}`,
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
    this.messageQueue = new H2AAsyncMessageQueue({
      maxSize: 10000,
      compressionThreshold: 0.92
    })

    // wU2 上下文压缩器
    this.contextCompressor = new WU2ContextCompressor({
      compressionThreshold: 0.92,
      maxContextLength: 8000,
      preserveRecentMessages: 10
    })

    // 上下文管理器
    this.contextManager = new ContextManager(
      this.contextCompressor,
      this.messageQueue
    )

    // 六层安全验证器
    this.securityValidator = new SixLayerSecurityValidator(this.config)

    // nO Agent 引擎
    this.agentEngine = new NOMainAgentEngine({
      messageQueue: this.messageQueue,
      contextManager: this.contextManager,
      securityValidator: this.securityValidator,
      planMode: PlanMode.Default,
      maxConcurrentTasks: 5,
      taskTimeout: 300000
    })
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
      new AnthropicClientTool(this.config)
    ]
    this.toolManager.registerTools(writingTools)

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
   * 启动交互式会话
   */
  async startInteractiveSession(): Promise<void> {
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
        return await this.processAIQuery(result.messages, result.allowedTools)
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
    allowedTools?: string[]
  ): Promise<string> {
    
    // 使用AnthropicClient处理AI查询
    const anthropicClient = this.toolManager.getToolInfo('anthropic_client')
    
    if (!anthropicClient) {
      throw new Error('AI客户端未初始化')
    }

    const result = await this.toolManager.executeTool('anthropic_client', {
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
   * 处理自由文本输入
   */
  private async handleFreeTextInput(input: string): Promise<string> {
    // 智能判断用户意图并转换为命令
    const intent = await this.detectUserIntent(input)
    
    switch (intent.type) {
      case 'outline':
        return await this.executeCommand(`/outline ${intent.topic}`)
      
      case 'rewrite':
        return await this.executeCommand(`/rewrite ${intent.style} "${intent.content}"`)
      
      case 'research':
        return await this.executeCommand(`/research ${intent.topic}`)
      
      default:
        return '我理解您的输入，但暂时无法处理。请尝试使用斜杠命令，或输入 /help 查看帮助。'
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
   * 获取系统状态
   */
  async getSystemStatus(): Promise<Record<string, any>> {
    return {
      version: '1.0.0',
      initialized: this.isInitialized,
      messageQueueSize: this.messageQueue?.size || 0,
      activeTools: this.toolManager?.getAvailableTools().length || 0,
      availableCommands: this.commandExecutor?.getAvailableCommands().length || 0,
      currentModel: this.config.model,
      securityEnabled: this.config.enabled
    }
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
}