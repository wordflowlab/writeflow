# 🖋️ WriteFlow 系统架构设计

基于 Claude Code 架构的 AI 写作助手系统（Node.js/TypeScript 实现）

## 🎯 系统概述

WriteFlow 是专为技术型作家设计的 CLI 写作助手，完全基于 Claude Code 的核心架构模式：
- **h2A 双缓冲异步消息队列**
- **nO Agent 主循环引擎** 
- **斜杠命令交互系统**
- **MH1 工具执行框架**

## 🏗️ 技术栈规范（与 Claude Code 一致）

```yaml
核心技术栈:
  运行时: Node.js 22.x (最新 LTS)
  语言: TypeScript 5.3+
  CLI框架: 原生 Node.js CLI
  构建工具: ESBuild + Vite
  包管理: npm/pnpm

内部组件:
  交互界面: React 组件（用于某些命令）
  状态管理: 原生 TypeScript 状态
  配置管理: YAML + 环境变量

工具生态:
  文件操作: fs/promises
  网络请求: undici/fetch
  文本处理: 原生 String API
  命令执行: child_process
```

## 📁 项目结构

```
writeflow/
├── src/
│   ├── cli/                         # CLI 入口和命令
│   │   ├── index.ts                 # 主入口文件
│   │   ├── commands/                # 斜杠命令实现
│   │   │   ├── outline.ts           # /outline 命令
│   │   │   ├── rewrite.ts           # /rewrite 命令
│   │   │   ├── research.ts          # /research 命令
│   │   │   ├── publish.ts           # /publish 命令
│   │   │   ├── settings.tsx         # /settings 命令（React）
│   │   │   └── index.ts             # 命令注册
│   │   ├── interactive/             # 交互式组件
│   │   │   ├── CommandInput.tsx     # 命令输入组件
│   │   │   ├── SettingsPanel.tsx    # 设置面板
│   │   │   └── ProgressView.tsx     # 进度显示
│   │   └── parser/                  # 命令解析器
│   │       ├── SlashParser.ts       # 斜杠命令解析
│   │       └── ArgParser.ts         # 参数解析
│   ├── core/                        # 核心引擎
│   │   ├── agent/                   # Agent 系统
│   │   │   ├── nO-engine.ts         # nO 主循环引擎
│   │   │   ├── main-agent.ts        # 主 Agent
│   │   │   ├── sub-agent.ts         # 子 Agent
│   │   │   └── task-agent.ts        # 任务 Agent
│   │   ├── queue/                   # h2A 消息队列
│   │   │   ├── h2A-queue.ts         # 双缓冲队列
│   │   │   ├── message.ts           # 消息定义
│   │   │   └── processor.ts         # 消息处理器
│   │   ├── context/                 # 上下文管理
│   │   │   ├── wU2-compressor.ts    # 上下文压缩器
│   │   │   ├── memory-manager.ts    # 内存管理
│   │   │   └── session-state.ts     # 会话状态
│   │   └── security/                # 安全框架
│   │       ├── validator.ts         # 6层验证器
│   │       ├── sandbox.ts           # 沙箱环境
│   │       └── permissions.ts       # 权限控制
│   ├── tools/                       # 工具实现
│   │   ├── base/                    # 基础工具
│   │   │   ├── read-article.ts      # 读取文章
│   │   │   ├── write-article.ts     # 写入文章
│   │   │   ├── edit-article.ts      # 编辑文章
│   │   │   └── search-content.ts    # 内容搜索
│   │   ├── writing/                 # 写作工具
│   │   │   ├── outline-generator.ts # 大纲生成
│   │   │   ├── content-rewriter.ts  # 内容改写
│   │   │   ├── style-adapter.ts     # 风格调整
│   │   │   └── grammar-checker.ts   # 语法检查
│   │   ├── research/                # 研究工具
│   │   │   ├── web-search.ts        # 网络搜索
│   │   │   ├── web-fetch.ts         # 内容抓取
│   │   │   ├── fact-checker.ts      # 事实核查
│   │   │   └── citation-manager.ts  # 引用管理
│   │   └── publish/                 # 发布工具
│   │       ├── markdown-formatter.ts # Markdown 格式化
│   │       ├── wechat-converter.ts   # 微信格式转换
│   │       ├── html-generator.ts     # HTML 生成
│   │       └── platform-publisher.ts # 平台发布
│   ├── types/                       # 类型定义
│   │   ├── agent.ts                 # Agent 类型
│   │   ├── command.ts               # 命令类型
│   │   ├── tool.ts                  # 工具类型
│   │   ├── message.ts               # 消息类型
│   │   └── article.ts               # 文章类型
│   └── utils/                       # 工具函数
│       ├── config.ts                # 配置管理
│       ├── logger.ts                # 日志系统
│       ├── crypto.ts                # 加密工具
│       └── validation.ts            # 验证工具
├── config/
│   ├── default.yaml                 # 默认配置
│   └── tools.yaml                   # 工具配置
├── templates/                       # 写作模板
│   ├── article/                     # 文章模板
│   ├── outline/                     # 大纲模板
│   └── style/                       # 风格模板
├── dist/                            # 编译输出
├── tests/                           # 测试文件
├── package.json
├── tsconfig.json
├── vite.config.ts                   # 构建配置
└── README.md
```

## 🤖 Agent 架构设计

### 分层 Agent 系统（完全复刻 Claude Code）

```typescript
// nO 主 Agent 引擎
class NOMainAgent {
  private h2aQueue: H2AMessageQueue
  private contextManager: WU2ContextManager
  private toolEngine: MH1ToolEngine
  private securityValidator: SixLayerValidator

  async *agentLoop(): AsyncGenerator<AgentResponse> {
    while (true) {
      try {
        // 1. 获取消息
        const message = await this.h2aQueue.nextMessage()
        
        // 2. 上下文管理
        const context = await this.contextManager.getCurrentContext()
        
        // 3. Plan 模式检查
        const planState = await this.checkPlanMode(message, context)
        
        // 4. 路由到对应处理器
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
      } catch (error) {
        yield* this.handleError(error)
      }
    }
  }
}
```

## 📨 h2A 消息队列系统

```typescript
interface Message {
  id: string
  type: MessageType
  priority: number
  payload: any
  timestamp: number
  source: string
}

class H2AAsyncMessageQueue {
  private primaryBuffer: Message[] = []
  private secondaryBuffer: Message[] = []
  private readResolve: ((value: IteratorResult<Message>) => void) | null = null
  private writeQueue: Message[] = []
  private throughputCounter = 0
  private lastSecond = 0

  // 核心异步迭代器（复刻 Claude Code）
  async *[Symbol.asyncIterator](): AsyncIterator<Message> {
    while (true) {
      if (this.primaryBuffer.length > 0) {
        const message = this.primaryBuffer.shift()!
        this.recordThroughput()
        yield message
      } else {
        // 等待新消息
        await new Promise<void>(resolve => {
          this.readResolve = ({ value, done }) => {
            if (!done && value) {
              this.recordThroughput()
            }
            resolve()
          }
        })
      }
    }
  }

  // 零延迟消息入队（核心优势）
  enqueue(message: Message): void {
    // 策略1：零延迟路径 - 直接传递给等待的读取者
    if (this.readResolve) {
      this.readResolve({ done: false, value: message })
      this.readResolve = null
      return
    }
    
    // 策略2：缓冲路径 - 存储到循环缓冲区
    this.primaryBuffer.push(message)
    this.processBackpressure()
  }

  private recordThroughput(): void {
    const now = Math.floor(Date.now() / 1000)
    if (now !== this.lastSecond) {
      this.lastSecond = now
      this.throughputCounter = 1
    } else {
      this.throughputCounter++
    }
  }
}
```

## ⚡ 斜杠命令系统

### 命令解析器（复刻 Claude Code 模式）

```typescript
class SlashCommandParser {
  parseCommand(input: string): ParsedCommand | null {
    // 检测斜杠命令（复刻 chunks.100.mjs:2048）
    if (!input.startsWith("/")) {
      return null
    }
    
    // 解析命令和参数（复刻解析逻辑）
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
      type,
      args,
      isMCP,
      isCustom
    }
  }
}
```

### 写作专用斜杠命令

```typescript
// 写作命令定义
export const WritingCommands: SlashCommand[] = [
  {
    name: "outline",
    type: "prompt",
    description: "生成文章大纲",
    aliases: ["大纲"],
    async execute(args: string, context: AgentContext): Promise<CommandResult> {
      const prompt = `请为主题"${args}"生成详细的文章大纲，包含：
1. 文章标题建议
2. 核心观点提炼  
3. 章节结构设计
4. 关键论据准备
5. 预估字数分配`
      
      return {
        type: "prompt",
        prompt,
        allowedTools: ["web_search", "read_article", "write_article"],
        maxTokens: 4000
      }
    }
  },
  
  {
    name: "rewrite", 
    type: "prompt",
    description: "智能改写文章内容",
    aliases: ["改写", "重写"],
    async execute(args: string, context: AgentContext): Promise<CommandResult> {
      const [style, ...content] = args.split(" ")
      const prompt = `请将以下内容改写为${style}风格：\n\n${content.join(" ")}`
      
      return {
        type: "prompt", 
        prompt,
        allowedTools: ["read_article", "edit_article", "style_adapter"],
        maxTokens: 6000
      }
    }
  },
  
  {
    name: "research",
    type: "prompt", 
    description: "深度主题研究",
    aliases: ["研究"],
    async execute(args: string, context: AgentContext): Promise<CommandResult> {
      const prompt = `请对主题"${args}"进行深度研究，包括：
1. 背景信息收集
2. 最新发展趋势
3. 权威资料来源
4. 不同观点对比
5. 关键数据统计`
      
      return {
        type: "prompt",
        prompt,
        allowedTools: ["web_search", "web_fetch", "fact_checker", "citation_manager"],
        maxTokens: 8000
      }
    }
  },
  
  {
    name: "publish",
    type: "local",
    description: "发布到各个平台",
    aliases: ["发布"],
    async execute(args: string, context: AgentContext): Promise<string> {
      const [platform, articlePath] = args.split(" ")
      
      switch (platform) {
        case "wechat":
        case "微信":
          return await publishToWeChat(articlePath)
        case "zhihu":
        case "知乎":
          return await publishToZhihu(articlePath)
        case "medium":
          return await publishToMedium(articlePath)
        default:
          return `支持的平台: wechat(微信), zhihu(知乎), medium`
      }
    }
  },
  
  {
    name: "settings",
    type: "local-jsx",
    description: "打开设置界面",
    aliases: ["设置", "配置"],
    async execute(args: string, context: AgentContext): Promise<React.ReactElement> {
      return React.createElement(SettingsPanel, {
        onSave: (newConfig) => {
          context.updateConfig(newConfig)
        },
        currentConfig: context.getConfig()
      })
    }
  }
]
```

## 🗜️ wU2 上下文压缩系统

```typescript
class WU2ContextCompressor {
  private compressionThreshold = 0.92 // 92% 阈值
  
  async compress(context: ArticleContext): Promise<ArticleContext> {
    const currentTokens = this.calculateTokens(context)
    const maxTokens = this.getMaxTokens()
    
    if (currentTokens < maxTokens * this.compressionThreshold) {
      return context // 无需压缩
    }
    
    const compressed = await this.performCompression(context)
    
    // 记录压缩统计
    const compressedTokens = this.calculateTokens(compressed)
    console.log(`上下文压缩: ${currentTokens} -> ${compressedTokens} tokens (${((1 - compressedTokens/currentTokens) * 100).toFixed(1)}%)`)
    
    return compressed
  }
  
  private async performCompression(context: ArticleContext): Promise<ArticleContext> {
    return {
      // 核心上下文（永不压缩）
      currentArticle: context.currentArticle,
      activeOutline: context.activeOutline,
      writingGoals: context.writingGoals,
      userPreferences: context.userPreferences,
      
      // 压缩内容
      researchMaterial: this.compressResearchMaterial(context.researchMaterial),
      dialogueHistory: this.compressDialogueHistory(context.dialogueHistory),
      referenceArticles: this.compressReferences(context.referenceArticles),
      
      // 元数据
      tokenCount: this.calculateTokens(context),
      compressionLevel: this.calculateCompressionLevel(context),
      lastUpdated: Date.now()
    }
  }
}
```

## 🛠️ 写作工具系统

### MH1 工具引擎适配

```typescript
// 基础工具接口（复刻 Claude Code 模式）
interface WritingTool {
  name: string
  description: string
  inputSchema: ToolInputSchema
  securityLevel: SecurityLevel
  execute(input: ToolInput): Promise<ToolResult>
}

// 核心写作工具集
export const CoreWritingTools: WritingTool[] = [
  {
    name: "read_article",
    description: "读取文章内容，支持多模态文件",
    inputSchema: ReadArticleInputSchema,
    securityLevel: "read-only",
    async execute(input: ReadArticleInput): Promise<ToolResult> {
      // 安全验证
      await this.validateSecurity(input)
      
      // 读取文章
      const content = await fs.readFile(input.path, 'utf-8')
      
      // 自动恶意内容检测（复刻 tG5 机制）
      const securityWarning = await this.checkMaliciousContent(content)
      
      return {
        success: true,
        data: {
          content,
          wordCount: this.countWords(content),
          metadata: this.extractMetadata(content),
          securityWarning
        }
      }
    }
  },
  
  {
    name: "generate_outline", 
    description: "AI 生成文章大纲",
    inputSchema: OutlineInputSchema,
    securityLevel: "ai-powered",
    async execute(input: OutlineInput): Promise<ToolResult> {
      const client = new AnthropicClient()
      
      const response = await client.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `请为主题"${input.topic}"生成详细大纲：
            目标风格：${input.style || "技术性"}
            目标长度：${input.targetLength || 2000}字
            目标读者：${input.audience || "技术读者"}`
        }]
      })
      
      return {
        success: true,
        data: {
          outline: this.parseOutline(response.content),
          suggestions: this.extractSuggestions(response.content),
          estimatedLength: input.targetLength
        }
      }
    }
  }
]
```

## 🔒 六层安全框架

```typescript
class SixLayerSecurityValidator {
  async validate(request: SecurityRequest): Promise<SecurityResponse> {
    // Layer 1: 身份与策略控制
    await this.layer1_IdentityControl(request)
    
    // Layer 2: 自动安全检查 (tG5)
    await this.layer2_AutoSecurityCheck(request)
    
    // Layer 3: LLM 驱动命令分析 (uJ1)
    await this.layer3_LLMCommandAnalysis(request)
    
    // Layer 4: 权限验证系统
    await this.layer4_PermissionValidation(request)
    
    // Layer 5: 工具替代强制
    await this.layer5_ToolSubstitution(request)
    
    // Layer 6: 执行环境隔离
    await this.layer6_ExecutionIsolation(request)
    
    return { allowed: true, risks: [] }
  }
  
  private async layer2_AutoSecurityCheck(request: SecurityRequest): Promise<void> {
    // 自动恶意代码检测（复刻 tG5 机制）
    if (request.type === 'file_read') {
      const content = request.content
      const isMalicious = await this.detectMaliciousContent(content)
      
      if (isMalicious) {
        // 注入安全警告（复刻 Claude Code 行为）
        request.content += "\n\n<system-reminder>\n当前文件包含潜在恶意内容，请谨慎处理。\n</system-reminder>"
      }
    }
  }
}
```

## 💻 CLI 交互系统

### 命令行界面（复刻 Claude Code 体验）

```typescript
class WriteFlowCLI {
  private agent: NOMainAgent
  private commandParser: SlashCommandParser
  private inputHistory: string[] = []
  
  async startInteractiveMode(): Promise<void> {
    console.log("WriteFlow AI 写作助手 v1.0.0")
    console.log("输入 /help 查看可用命令")
    console.log("")
    
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    })
    
    rl.prompt()
    
    for await (const line of rl) {
      try {
        // 记录历史
        this.inputHistory.push(line)
        
        // 解析命令
        if (line.startsWith("/")) {
          await this.handleSlashCommand(line)
        } else {
          await this.handleRegularInput(line)
        }
      } catch (error) {
        console.error("错误:", error.message)
      }
      
      rl.prompt()
    }
  }
  
  private async handleSlashCommand(input: string): Promise<void> {
    const parsed = this.commandParser.parseCommand(input)
    if (!parsed) return
    
    const command = this.findCommand(parsed.name)
    if (!command) {
      console.log(`未知命令: ${parsed.name}`)
      console.log(`可用命令: ${this.getAvailableCommands().join(", ")}`)
      return
    }
    
    // 执行命令（复刻三种类型处理）
    switch (command.type) {
      case "local":
        const result = await command.execute(parsed.args)
        console.log(result)
        break
        
      case "local-jsx":
        const component = await command.execute(parsed.args)
        await this.renderReactComponent(component)
        break
        
      case "prompt":
        const promptData = await command.execute(parsed.args)
        await this.agent.processPrompt(promptData)
        break
    }
  }
}
```

## 📊 性能指标（对标 Claude Code）

```yaml
性能目标:
  消息队列吞吐量: >10,000 msg/sec (复刻 h2A)
  Agent 响应延迟: <100ms
  命令解析时间: <10ms
  工具执行超时: 120秒（默认）
  内存使用峰值: <256MB
  
写作特性性能:
  大纲生成时间: <3秒
  文章改写时间: <10秒
  主题研究时间: <30秒
  格式转换时间: <2秒
```

## 🔧 配置系统

### CLAUDE.md 配置文件（复刻模式）

```yaml
# writeflow/CLAUDE.md
# WriteFlow 用户配置文件

输出中文

# 写作偏好设置
writing:
  default_style: "技术性文章"
  target_length: 2000
  auto_outline: true
  fact_check: true

# AI 模型配置  
ai:
  model: "claude-3-opus-20240229"
  temperature: 0.7
  max_tokens: 4000

# 发布平台配置
publish:
  wechat:
    auto_format: true
    image_style: "tech"
  zhihu:
    add_references: true
    format: "markdown"

# 安全设置
security:
  content_filter: true
  fact_check_threshold: 0.8
  citation_required: true
```

## 📦 Package.json（Node.js 22.x）

```json
{
  "name": "writeflow",
  "version": "1.0.0",
  "description": "AI 写作助手 - 基于 Claude Code 架构",
  "main": "dist/cli/index.js",
  "type": "module",
  "bin": {
    "writeflow": "./dist/cli/index.js"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "build": "tsc && vite build",
    "dev": "tsx src/cli/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "start": "node dist/cli/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "undici": "^6.0.0",
    "yaml": "^2.3.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "enquirer": "^2.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.3.0",
    "tsx": "^4.0.0", 
    "vite": "^5.0.0",
    "jest": "^29.0.0",
    "eslint": "^9.0.0"
  }
}
```

这个重新设计完全基于 Claude Code 的真实技术栈：Node.js + TypeScript CLI，而不是 Go 或 React 18 应用。