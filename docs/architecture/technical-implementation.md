# 🔧 WriteFlow 技术实现详解

基于 Claude Code 核心架构的 Node.js/TypeScript 实现方案

## 🚀 核心技术栈

### Node.js 22.x + TypeScript 5.3+

```json
{
  "engines": {
    "node": ">=22.0.0"
  },
  "type": "module",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "undici": "^6.0.0",
    "yaml": "^2.3.0",
    "react": "^18.2.0",
    "chalk": "^5.3.0"
  }
}
```

## 📨 h2A 双缓冲异步消息队列实现

### 核心队列类（完全复刻 Claude Code）

```typescript
// src/core/queue/h2A-queue.ts
export interface Message {
  id: string
  type: MessageType
  priority: number
  payload: any
  timestamp: number
  source: string
  deadline?: number
}

export enum MessageType {
  UserInput = 'user_input',
  AgentResponse = 'agent_response', 
  ToolInvocation = 'tool_invocation',
  SystemNotification = 'system_notification',
  TaskAssignment = 'task_assignment'
}

export class H2AAsyncMessageQueue {
  private primaryBuffer: Message[] = []
  private secondaryBuffer: Message[] = []
  private readResolve: ((value: IteratorResult<Message>) => void) | null = null
  private isProcessing = false
  private throughputMetrics = {
    messagesPerSecond: 0,
    lastSecondCount: 0,
    currentSecond: Math.floor(Date.now() / 1000)
  }

  constructor(
    private maxBufferSize: number = 10000,
    private backpressureThreshold: number = 8000
  ) {}

  // 核心异步迭代器（零延迟设计）
  async *[Symbol.asyncIterator](): AsyncIterator<Message> {
    while (true) {
      // 检查主缓冲区
      if (this.primaryBuffer.length > 0) {
        const message = this.primaryBuffer.shift()!
        this.recordThroughput()
        yield message
        continue
      }

      // 等待新消息（异步阻塞）
      const message = await new Promise<Message>((resolve) => {
        this.readResolve = (result) => {
          if (!result.done && result.value) {
            resolve(result.value)
          }
        }
      })
      
      this.recordThroughput()
      yield message
    }
  }

  // 零延迟消息入队（Claude Code 核心优势）
  enqueue(message: Message): boolean {
    // 策略1: 零延迟路径 - 直接传递给等待的读取者
    if (this.readResolve && !this.isProcessing) {
      this.readResolve({ done: false, value: message })
      this.readResolve = null
      return true
    }

    // 策略2: 缓冲路径 - 检查背压
    if (this.primaryBuffer.length >= this.maxBufferSize) {
      return false // 队列满，拒绝消息
    }

    // 按优先级插入
    this.insertByPriority(message)
    
    // 背压处理
    if (this.primaryBuffer.length > this.backpressureThreshold) {
      this.triggerBackpressure()
    }

    return true
  }

  private insertByPriority(message: Message): void {
    let insertIndex = this.primaryBuffer.length
    
    // 找到正确的插入位置（高优先级在前）
    for (let i = this.primaryBuffer.length - 1; i >= 0; i--) {
      if (this.primaryBuffer[i].priority >= message.priority) {
        insertIndex = i + 1
        break
      }
    }
    
    this.primaryBuffer.splice(insertIndex, 0, message)
  }

  private recordThroughput(): void {
    const currentSecond = Math.floor(Date.now() / 1000)
    
    if (currentSecond !== this.throughputMetrics.currentSecond) {
      this.throughputMetrics.messagesPerSecond = this.throughputMetrics.lastSecondCount
      this.throughputMetrics.lastSecondCount = 1
      this.throughputMetrics.currentSecond = currentSecond
    } else {
      this.throughputMetrics.lastSecondCount++
    }
  }

  // 性能监控接口
  getMetrics() {
    return {
      queueSize: this.primaryBuffer.length,
      throughput: this.throughputMetrics.messagesPerSecond,
      backpressureActive: this.primaryBuffer.length > this.backpressureThreshold
    }
  }

  private triggerBackpressure(): void {
    // 背压策略：切换到副缓冲区处理
    if (this.secondaryBuffer.length === 0) {
      this.secondaryBuffer = this.primaryBuffer.splice(0, this.backpressureThreshold / 2)
    }
  }
}
```

## 🤖 nO Agent 主循环引擎

```typescript
// src/core/agent/nO-engine.ts
export class NOMainAgentEngine {
  private messageQueue: H2AAsyncMessageQueue
  private contextManager: WU2ContextManager
  private toolEngine: MH1ToolEngine
  private securityValidator: SixLayerValidator
  private currentState: AgentState = AgentState.Idle

  constructor() {
    this.messageQueue = new H2AAsyncMessageQueue()
    this.contextManager = new WU2ContextManager()
    this.toolEngine = new MH1ToolEngine()
    this.securityValidator = new SixLayerValidator()
  }

  // 主 Agent 循环（复刻 Claude Code nO 引擎）
  async *run(): AsyncGenerator<AgentResponse> {
    console.log("WriteFlow Agent 启动...")
    
    try {
      // 启动消息队列
      const messageIterator = this.messageQueue[Symbol.asyncIterator]()
      
      while (true) {
        try {
          // 1. 获取下一个消息
          const { value: message, done } = await messageIterator.next()
          if (done) break

          // 2. 安全验证
          const securityCheck = await this.securityValidator.validate({
            type: 'message',
            content: message.payload,
            source: message.source
          })
          
          if (!securityCheck.allowed) {
            yield { type: 'error', content: `安全检查失败: ${securityCheck.reason}` }
            continue
          }

          // 3. 获取当前上下文
          const context = await this.contextManager.getCurrentContext()

          // 4. 检查 Plan 模式状态
          const planState = await this.checkPlanMode(message, context)

          // 5. 根据状态路由处理
          switch (planState) {
            case 'default':
              yield* this.handleDefaultMode(message, context)
              break
            case 'plan':
              yield* this.handlePlanMode(message, context)
              break
            case 'acceptEdits':
              yield* this.handleAcceptEditsMode(message, context)
              break
            case 'bypassPermissions':
              yield* this.handleBypassMode(message, context)
              break
          }

          // 6. 更新上下文
          await this.contextManager.updateContext(message, context)

        } catch (error) {
          yield* this.handleError(error)
        }
      }
    } catch (error) {
      console.error("Agent 引擎致命错误:", error)
    }
  }

  private async *handleDefaultMode(
    message: Message, 
    context: ArticleContext
  ): AsyncGenerator<AgentResponse> {
    // 解析用户意图
    const intent = await this.parseUserIntent(message.payload)
    
    switch (intent.type) {
      case 'slash_command':
        yield* this.executeSlashCommand(intent.command, intent.args, context)
        break
      case 'article_request':
        yield* this.handleArticleGeneration(intent, context)
        break
      case 'edit_request':
        yield* this.handleArticleEditing(intent, context)
        break
      case 'research_request':
        yield* this.handleResearchTask(intent, context)
        break
      default:
        yield* this.handleGeneralQuery(message, context)
    }
  }

  private async *executeSlashCommand(
    command: string,
    args: string,
    context: ArticleContext
  ): AsyncGenerator<AgentResponse> {
    const cmd = this.findCommand(command)
    if (!cmd) {
      yield { 
        type: 'error', 
        content: `未知命令: ${command}\n可用命令: ${this.getAvailableCommands().join(', ')}` 
      }
      return
    }

    // 执行命令（复刻 Claude Code 三种类型）
    try {
      switch (cmd.type) {
        case 'local':
          const result = await cmd.execute(args, context)
          yield { type: 'success', content: result }
          break
          
        case 'local-jsx':
          const component = await cmd.execute(args, context)
          yield { type: 'component', jsx: component }
          break
          
        case 'prompt':
          const promptData = await cmd.execute(args, context)
          yield { type: 'prompt', ...promptData }
          break
      }
    } catch (error) {
      yield { type: 'error', content: `命令执行失败: ${error.message}` }
    }
  }
}

export enum AgentState {
  Idle = 'idle',
  Processing = 'processing',
  WaitingForInput = 'waiting_for_input',
  Error = 'error'
}

export interface AgentResponse {
  type: 'success' | 'error' | 'prompt' | 'component' | 'progress'
  content?: string
  jsx?: React.ReactElement
  allowedTools?: string[]
  maxTokens?: number
}
```

## 🗜️ wU2 上下文压缩器

```typescript
// src/core/context/wU2-compressor.ts
export class WU2ContextCompressor {
  private readonly COMPRESSION_THRESHOLD = 0.92 // 92% 阈值
  private readonly PRESERVE_RATIO = 0.3 // 保留30%核心内容
  
  async compress(context: ArticleContext): Promise<ArticleContext> {
    const currentTokens = this.calculateTokens(context)
    const maxTokens = this.getMaxContextTokens()
    
    // 检查是否需要压缩
    if (currentTokens < maxTokens * this.COMPRESSION_THRESHOLD) {
      return context
    }

    console.log(`触发上下文压缩: ${currentTokens} tokens > ${Math.floor(maxTokens * this.COMPRESSION_THRESHOLD)} tokens`)

    // 执行压缩
    const compressed = await this.performIntelligentCompression(context)
    
    // 记录压缩结果
    const compressedTokens = this.calculateTokens(compressed)
    const compressionRatio = 1 - (compressedTokens / currentTokens)
    
    console.log(`压缩完成: ${currentTokens} -> ${compressedTokens} tokens (${(compressionRatio * 100).toFixed(1)}% 减少)`)
    
    return compressed
  }

  private async performIntelligentCompression(context: ArticleContext): Promise<ArticleContext> {
    return {
      // 核心上下文（永不压缩）
      currentArticle: context.currentArticle,
      activeOutline: context.activeOutline,
      writingGoals: context.writingGoals,
      userPreferences: context.userPreferences,
      
      // 智能压缩内容
      researchMaterial: await this.compressResearchMaterial(context.researchMaterial),
      dialogueHistory: await this.compressDialogueHistory(context.dialogueHistory),
      referenceArticles: await this.compressReferences(context.referenceArticles),
      toolUsageHistory: await this.compressToolHistory(context.toolUsageHistory),
      
      // 更新元数据
      tokenCount: 0, // 将重新计算
      compressionLevel: 0, // 将重新计算
      lastUpdated: Date.now()
    }
  }

  private async compressResearchMaterial(materials: ResearchItem[]): Promise<ResearchItem[]> {
    if (materials.length === 0) return materials
    
    // 按重要性评分排序
    const scored = materials.map(item => ({
      item,
      score: this.calculateImportanceScore(item)
    })).sort((a, b) => b.score - a.score)
    
    // 保留前70%最重要的内容
    const keepCount = Math.ceil(materials.length * 0.7)
    const kept = scored.slice(0, keepCount)
    
    // 压缩保留的内容
    return kept.map(({ item }) => ({
      ...item,
      content: this.summarizeText(item.content, 200), // 压缩到200字
      summary: this.extractKeyPoints(item.content, 3) // 提取3个关键点
    }))
  }

  private calculateImportanceScore(item: ResearchItem): number {
    let score = 0
    
    // 时效性（最近的内容得分更高）
    const daysSinceCreated = (Date.now() - item.createdAt) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 1 - daysSinceCreated / 30) * 0.3
    
    // 引用频率
    score += Math.min(item.referenceCount / 10, 1) * 0.3
    
    // 内容质量（长度、结构等）
    score += Math.min(item.content.length / 2000, 1) * 0.2
    
    // 相关性（与当前文章主题的匹配度）
    score += item.relevanceScore * 0.2
    
    return score
  }
}
```

## ⚡ 斜杠命令系统实现

### 命令解析器（复刻 Claude Code 解析逻辑）

```typescript
// src/cli/parser/SlashParser.ts
export interface ParsedCommand {
  name: string
  args: string
  type: 'mcp' | 'custom' | 'standard'
  isMCP: boolean
  isCustom: boolean
}

export class SlashCommandParser {
  // 复刻 Claude Code chunks.100.mjs:2048 的解析逻辑
  parseCommand(input: string): ParsedCommand | null {
    // 检测斜杠命令
    if (!input.startsWith("/")) {
      return null
    }

    // 解析命令和参数（完全复刻原逻辑）
    const parts = input.slice(1).split(" ")
    let commandName = parts[0]
    let isMCP = false

    // MCP 命令检测
    if (parts.length > 1 && parts[1] === "(MCP)") {
      commandName = commandName + " (MCP)"
      isMCP = true
    }

    if (!commandName) {
      throw new Error("Commands are in the form `/command [args]`")
    }

    // 命令分类
    const isCustom = commandName.includes(":")
    const type = isMCP ? "mcp" : isCustom ? "custom" : "standard"
    const args = input.slice(commandName.length + 2)

    return {
      name: commandName,
      args,
      type,
      isMCP,
      isCustom
    }
  }

  // 命令验证（复刻 Zj2 函数）
  validateCommand(commandName: string, availableCommands: SlashCommand[]): boolean {
    return availableCommands.some(cmd => 
      cmd.userFacingName() === commandName || 
      cmd.aliases?.includes(commandName)
    )
  }

  // 命令查找（复刻 cw1 函数）
  findCommand(commandName: string, availableCommands: SlashCommand[]): SlashCommand {
    const command = availableCommands.find(cmd =>
      cmd.userFacingName() === commandName ||
      cmd.aliases?.includes(commandName)
    )

    if (!command) {
      const availableNames = availableCommands.map(cmd => {
        const name = cmd.userFacingName()
        return cmd.aliases ? `${name} (aliases: ${cmd.aliases.join(", ")})` : name
      }).join(", ")

      throw new ReferenceError(`Command ${commandName} not found. Available commands: ${availableNames}`)
    }

    return command
  }
}
```

### 写作命令实现

```typescript
// src/cli/commands/writing-commands.ts
export const WritingCommands: SlashCommand[] = [
  {
    type: "prompt",
    name: "outline",
    description: "生成文章大纲",
    aliases: ["大纲", "ol"],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      return `请为主题"${args}"生成详细的技术文章大纲。要求：
1. 包含吸引人的标题
2. 逻辑清晰的章节结构
3. 每个章节的核心论点
4. 预估字数分配
5. 相关资料建议

请生成易于阅读的结构化大纲。`
    },
    
    userFacingName: () => "outline",
    allowedTools: ["web_search", "read_article", "write_article"],
    progressMessage: "generating article outline"
  },

  {
    type: "prompt", 
    name: "rewrite",
    description: "智能改写文章内容",
    aliases: ["改写", "rw"],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      const [style, ...contentParts] = args.split(" ")
      const content = contentParts.join(" ")
      
      if (!content) {
        return `请指定要改写的内容。格式：/rewrite [风格] [内容]
支持的风格：正式(formal), 通俗(casual), 技术(technical), 学术(academic)`
      }

      return `请将以下内容改写为${style}风格，保持原意但改进表达：

原文：
${content}

改写要求：
1. 保持核心信息和观点
2. 调整语言风格为${style}
3. 优化句式结构和流畅性
4. 确保逻辑清晰易懂
5. 适当调整专业术语使用`
    },
    
    userFacingName: () => "rewrite",
    allowedTools: ["read_article", "edit_article", "style_adapter"],
    progressMessage: "rewriting content with specified style"
  },

  {
    type: "prompt",
    name: "research", 
    description: "深度主题研究",
    aliases: ["研究", "rs"],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      return `请对主题"${args}"进行深度研究分析，提供：

1. **背景信息**：主题的基本定义和发展历程
2. **现状分析**：当前的发展状态和主要特点
3. **趋势预测**：未来的发展方向和可能变化
4. **关键观点**：不同角度的重要观点对比
5. **权威资料**：可靠的信息来源和参考资料
6. **实用建议**：针对写作的具体建议

请确保信息准确、来源可靠，并提供引用链接。`
    },
    
    userFacingName: () => "research",
    allowedTools: ["web_search", "web_fetch", "fact_checker", "citation_manager"],
    progressMessage: "conducting deep topic research"
  },

  {
    type: "local",
    name: "publish",
    description: "发布到各平台",
    aliases: ["发布", "pub"],
    
    async call(args: string, context: AgentContext): Promise<string> {
      const [platform, articlePath, ...options] = args.split(" ")
      
      if (!platform || !articlePath) {
        return `用法: /publish [平台] [文章路径] [选项]

支持的平台:
- wechat / 微信: 转换为微信公众号格式
- zhihu / 知乎: 适配知乎发布格式  
- medium: 转换为 Medium 格式
- html: 生成静态 HTML 页面

示例: /publish wechat ./articles/my-article.md`
      }

      try {
        switch (platform.toLowerCase()) {
          case "wechat":
          case "微信":
            return await this.publishToWeChat(articlePath, options)
          case "zhihu":
          case "知乎":
            return await this.publishToZhihu(articlePath, options)
          case "medium":
            return await this.publishToMedium(articlePath, options)
          case "html":
            return await this.generateHTML(articlePath, options)
          default:
            return `不支持的平台: ${platform}`
        }
      } catch (error) {
        return `发布失败: ${error.message}`
      }
    },
    
    userFacingName: () => "publish"
  },

  {
    type: "local-jsx",
    name: "settings",
    description: "打开设置界面", 
    aliases: ["设置", "config"],
    
    async call(args: string, context: AgentContext): Promise<React.ReactElement> {
      const { createElement } = await import('react')
      
      return createElement(SettingsPanel, {
        config: context.getConfig(),
        onSave: async (newConfig) => {
          await context.updateConfig(newConfig)
          console.log("配置已保存")
        },
        onDone: (result) => {
          console.log(result ? "设置已更新" : "设置已取消")
        }
      })
    },
    
    userFacingName: () => "settings"
  }
]
```

## 🛠️ 写作工具系统

### MH1 工具引擎（写作特化版）

```typescript
// src/tools/base/MH1-tool-engine.ts
export class MH1WritingToolEngine {
  private tools: Map<string, WritingTool> = new Map()
  private securityValidator: SixLayerValidator
  private executionMetrics: ToolMetrics = new ToolMetrics()

  constructor() {
    this.securityValidator = new SixLayerValidator()
    this.registerCoreTools()
  }

  private registerCoreTools(): void {
    // 文章操作工具
    this.registerTool(new ReadArticleTool())
    this.registerTool(new WriteArticleTool())
    this.registerTool(new EditArticleTool())
    
    // 写作工具
    this.registerTool(new OutlineGeneratorTool())
    this.registerTool(new ContentRewriterTool())
    this.registerTool(new StyleAdapterTool())
    this.registerTool(new GrammarCheckerTool())
    
    // 研究工具
    this.registerTool(new WebSearchTool())
    this.registerTool(new WebFetchTool())
    this.registerTool(new FactCheckerTool())
    this.registerTool(new CitationManagerTool())
    
    // 发布工具
    this.registerTool(new MarkdownFormatterTool())
    this.registerTool(new WeChatConverterTool())
    this.registerTool(new HTMLGeneratorTool())
  }

  async executeTool(toolName: string, input: ToolInput): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`工具不存在: ${toolName}`)
    }

    // 6层安全验证
    const securityCheck = await this.securityValidator.validate({
      type: 'tool_execution',
      toolName,
      input,
      user: input.context?.userId
    })

    if (!securityCheck.allowed) {
      throw new Error(`安全检查失败: ${securityCheck.reason}`)
    }

    // 执行工具
    const startTime = Date.now()
    try {
      const result = await tool.execute(input)
      
      // 记录执行指标
      this.executionMetrics.recordExecution(toolName, Date.now() - startTime, true)
      
      return result
    } catch (error) {
      this.executionMetrics.recordExecution(toolName, Date.now() - startTime, false)
      throw error
    }
  }
}

// 核心写作工具实现示例
export class OutlineGeneratorTool implements WritingTool {
  name = "outline_generator"
  description = "AI 生成文章大纲"
  inputSchema = OutlineGeneratorInputSchema

  async execute(input: OutlineGeneratorInput): Promise<ToolResult> {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [{
        role: "user", 
        content: `请为主题"${input.topic}"生成详细的文章大纲：

目标读者：${input.audience || "技术读者"}
文章长度：${input.targetLength || 2000}字
写作风格：${input.style || "技术性"}
特殊要求：${input.requirements || "无"}

请生成包含以下结构的大纲：
1. 吸引人的标题
2. 引言部分
3. 主体章节（3-5个）
4. 结论部分
5. 每个章节的核心论点和预估字数`
      }]
    })

    const outline = this.parseOutlineFromResponse(response.content[0].text)
    
    return {
      success: true,
      data: {
        outline,
        estimatedLength: this.calculateEstimatedLength(outline),
        suggestions: this.generateWritingSuggestions(input.topic),
        metadata: {
          model: "claude-3-opus-20240229",
          tokensUsed: response.usage.output_tokens,
          generatedAt: Date.now()
        }
      }
    }
  }

  private parseOutlineFromResponse(text: string): OutlineStructure {
    // 解析 AI 生成的大纲结构
    const lines = text.split('\n').filter(line => line.trim())
    const outline: OutlineItem[] = []
    
    let currentSection: OutlineItem | null = null
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // 检测标题级别
      if (trimmed.startsWith('# ')) {
        outline.push({
          level: 1,
          title: trimmed.slice(2),
          content: "",
          subsections: []
        })
      } else if (trimmed.startsWith('## ')) {
        const section: OutlineItem = {
          level: 2,
          title: trimmed.slice(3),
          content: "",
          subsections: []
        }
        if (currentSection) {
          currentSection.subsections.push(section)
        } else {
          outline.push(section)
        }
      }
      // 继续解析其他级别...
    }
    
    return {
      title: this.extractTitle(text),
      sections: outline,
      estimatedLength: this.calculateEstimatedLength(outline),
      structure: this.analyzeStructure(outline)
    }
  }
}
```

## 🔄 CLI 交互界面

```typescript
// src/cli/index.ts
export class WriteFlowCLI {
  private agent: NOMainAgentEngine
  private commandParser: SlashCommandParser
  private inputHistory: string[] = []
  private isInteractive = false

  constructor() {
    this.agent = new NOMainAgentEngine()
    this.commandParser = new SlashCommandParser()
  }

  async start(): Promise<void> {
    // 显示启动信息
    console.log(chalk.cyan("WriteFlow AI 写作助手 v1.0.0"))
    console.log(chalk.gray("基于 Claude Code 架构 | Node.js 22.x + TypeScript"))
    console.log("")
    console.log("可用命令:")
    console.log("  /outline <主题>     - 生成文章大纲")
    console.log("  /rewrite <风格>     - 智能改写内容") 
    console.log("  /research <主题>    - 深度主题研究")
    console.log("  /publish <平台>     - 发布到平台")
    console.log("  /settings          - 打开设置")
    console.log("  /help              - 显示帮助")
    console.log("")

    // 启动 Agent 引擎
    const agentStream = this.agent.run()
    
    // 启动交互式命令行
    await this.startInteractiveSession(agentStream)
  }

  private async startInteractiveSession(agentStream: AsyncGenerator<AgentResponse>): Promise<void> {
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green('writeflow> ')
    })

    this.isInteractive = true
    rl.prompt()

    // 处理用户输入
    rl.on('line', async (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) {
        rl.prompt()
        return
      }

      try {
        // 记录输入历史
        this.inputHistory.push(trimmed)

        // 发送消息到 Agent
        await this.agent.messageQueue.enqueue({
          id: this.generateMessageId(),
          type: MessageType.UserInput,
          priority: 10,
          payload: trimmed,
          timestamp: Date.now(),
          source: 'cli'
        })

        // 处理 Agent 响应
        await this.handleAgentResponses(agentStream, rl)

      } catch (error) {
        console.error(chalk.red("错误:"), error.message)
      }

      rl.prompt()
    })

    // 优雅关闭
    rl.on('SIGINT', () => {
      console.log(chalk.yellow("\n正在关闭 WriteFlow..."))
      rl.close()
      process.exit(0)
    })
  }

  private async handleAgentResponses(
    agentStream: AsyncGenerator<AgentResponse>, 
    rl: any
  ): Promise<void> {
    try {
      const response = await agentStream.next()
      if (response.done) return

      const { value } = response

      switch (value.type) {
        case 'success':
          console.log(chalk.green("✓"), value.content)
          break
          
        case 'error':
          console.log(chalk.red("✗"), value.content)
          break
          
        case 'progress':
          // 显示进度信息
          process.stdout.write(chalk.yellow("⟳ ") + value.content + "\r")
          break
          
        case 'prompt':
          // AI 正在思考，显示加载动画
          const spinner = ora(chalk.blue("AI 正在思考...")).start()
          // 等待完成后停止
          setTimeout(() => spinner.stop(), 100)
          break
          
        case 'component':
          // 渲染 React 组件（用于设置界面等）
          await this.renderInteractiveComponent(value.jsx, rl)
          break
      }
    } catch (error) {
      console.error(chalk.red("Agent 响应处理错误:"), error.message)
    }
  }

  private async renderInteractiveComponent(jsx: React.ReactElement, rl: any): Promise<void> {
    // 简化的 React 组件渲染（用于设置等交互界面）
    console.log(chalk.cyan("📋 打开交互界面..."))
    
    // 这里可以集成 ink.js 来渲染 React 组件到命令行
    // 或者使用简化的文本界面替代
    const inquirer = await import('enquirer')
    // ... 具体实现
  }
}
```

## 📝 配置管理

### CLAUDE.md 兼容的配置格式

```yaml
# CLAUDE.md - WriteFlow 配置文件（复刻 Claude Code 格式）

输出中文

# 写作设定
writing:
  default_style: "技术性文章"
  target_length: 2000
  auto_outline: true
  grammar_check: true
  fact_check: true

# AI 模型配置
ai:
  provider: "anthropic"
  model: "claude-3-opus-20240229"
  temperature: 0.7
  max_tokens: 4000

# 发布平台
platforms:
  wechat:
    auto_format: true
    image_style: "tech" 
    template: "default"
  zhihu:
    add_references: true
    format_style: "zhihu"
  medium:
    add_tags: true
    format_style: "medium"

# 研究设置
research:
  max_sources: 10
  fact_check_threshold: 0.8
  auto_citation: true
  preferred_languages: ["zh", "en"]

# 性能设置  
performance:
  message_queue_size: 10000
  context_compression_threshold: 0.92
  tool_timeout: 120000
  max_concurrent_tools: 5

# 安全设置
security:
  content_filter: true
  malicious_detection: true
  sandbox_mode: false
  audit_logging: true
```

---

*本实现完全基于 Claude Code 的真实技术栈：Node.js 22.x + TypeScript，保留其核心架构优势*