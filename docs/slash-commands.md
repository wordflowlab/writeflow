# ⚡ WriteFlow 斜杠命令系统

基于 Claude Code 命令解析机制的写作专用命令系统

## 🎯 命令系统设计理念

完全复刻 Claude Code 的斜杠命令架构，包括：
- **三种命令类型**：`local`、`local-jsx`、`prompt`
- **命令解析器**：复刻 `chunks.100.mjs:2048` 的解析逻辑  
- **MCP 支持**：兼容 MCP 协议命令
- **别名系统**：支持中英文别名

## 📋 核心写作命令

### `/outline` - 大纲生成命令

```typescript
{
  type: "prompt",
  name: "outline", 
  aliases: ["大纲", "ol"],
  description: "AI 生成文章大纲",
  
  usage: "/outline <主题> [选项]",
  examples: [
    "/outline AI代理技术发展趋势",
    "/outline 微服务架构设计 --style=技术 --length=3000"
  ],
  
  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    const [topic, ...options] = args.split(" ")
    const style = this.extractOption(options, "style") || "技术性"
    const length = this.extractOption(options, "length") || "2000"
    
    return `请为主题"${topic}"生成详细的${style}文章大纲：

目标字数：${length}字
写作风格：${style}
目标读者：技术人员

请生成包含以下结构的大纲：
1. 吸引人的标题建议（3个备选）
2. 文章引言（核心问题和价值）
3. 主体章节（3-5个主要部分）
   - 每个章节的核心论点
   - 预估字数分配
   - 关键支撑材料
4. 结论部分（总结和展望）
5. 写作建议和注意事项

请确保大纲逻辑清晰，易于执行。`
  },
  
  allowedTools: ["web_search", "read_article", "write_article", "citation_manager"],
  progressMessage: "正在生成文章大纲"
}
```

### `/rewrite` - 智能改写命令

```typescript
{
  type: "prompt",
  name: "rewrite",
  aliases: ["改写", "rw", "重写"],
  description: "智能改写文章内容",
  
  usage: "/rewrite <风格> <内容或文件路径>",
  examples: [
    "/rewrite 通俗 ./articles/tech-article.md",
    "/rewrite 学术 这是一段需要改写的技术内容...",
    "/rewrite 正式 --tone=专业 --keep-structure"
  ],
  
  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    const [style, ...contentParts] = args.split(" ")
    let content = contentParts.join(" ")
    
    // 检查是否是文件路径
    if (content.startsWith("./") || content.startsWith("/")) {
      const fileContent = await this.readFile(content)
      content = fileContent
    }
    
    if (!content) {
      throw new Error("请提供要改写的内容或文件路径")
    }

    const styleMap = {
      "通俗": "通俗易懂，适合大众读者",
      "正式": "正式严谨，商务场合使用",
      "技术": "技术专业，面向技术人员",
      "学术": "学术规范，符合论文标准",
      "营销": "营销导向，具有说服力",
      "故事": "故事化表达，生动有趣"
    }

    const styleDesc = styleMap[style] || style

    return `请将以下内容改写为${styleDesc}的风格：

原文内容：
${content}

改写要求：
1. 保持核心信息和主要观点不变
2. 调整语言风格为：${styleDesc}
3. 优化句式结构，提高可读性
4. 确保逻辑清晰，表达流畅
5. 适当调整专业术语的使用程度
6. 保持原文的信息密度和价值

请提供改写后的完整内容。`
  },
  
  allowedTools: ["read_article", "edit_article", "style_adapter", "grammar_checker"],
  progressMessage: "正在智能改写内容"
}
```

### `/research` - 主题研究命令

```typescript
{
  type: "prompt", 
  name: "research",
  aliases: ["研究", "调研", "rs"],
  description: "深度主题研究和资料收集",
  
  usage: "/research <主题> [选项]",
  examples: [
    "/research AI Agent架构设计",
    "/research 区块链技术发展 --depth=深入 --sources=10",
    "/research 量子计算应用 --lang=中文 --time=最近一年"
  ],
  
  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    const [topic, ...options] = args.split(" ")
    const depth = this.extractOption(options, "depth") || "标准"
    const maxSources = this.extractOption(options, "sources") || "8"
    const timeRange = this.extractOption(options, "time") || "无限制"
    const language = this.extractOption(options, "lang") || "中英文"
    
    return `请对主题"${topic}"进行深度研究，提供全面的分析报告：

研究参数：
- 研究深度：${depth}
- 最大来源：${maxSources}个
- 时间范围：${timeRange}
- 语言偏好：${language}

请提供以下内容：

## 1. 主题概述
- 基本定义和核心概念
- 发展历程和重要节点
- 当前的重要性和影响

## 2. 现状分析  
- 技术发展现状
- 主要参与者和厂商
- 市场规模和增长趋势
- 存在的问题和挑战

## 3. 最新发展
- 近期重要突破和进展
- 新技术和新方法
- 行业动态和政策变化

## 4. 不同观点对比
- 支持者的主要观点
- 质疑者的主要担忧
- 学术界的研究方向
- 产业界的应用实践

## 5. 权威资料来源
- 学术论文和研究报告
- 权威机构发布的资料
- 知名专家的观点文章
- 可靠的数据统计来源

## 6. 写作建议
- 适合的文章角度和切入点
- 读者关注的核心问题
- 可以深入讨论的技术细节
- 实用的案例和应用场景

请确保信息准确、来源可靠，并提供具体的引用链接。`
  },
  
  allowedTools: [
    "web_search", "web_fetch", "fact_checker", 
    "citation_manager", "read_article", "write_article"
  ],
  progressMessage: "正在进行深度主题研究"
}
```

### `/publish` - 发布命令

```typescript
{
  type: "local",
  name: "publish",
  aliases: ["发布", "pub", "deploy"],
  description: "发布文章到各个平台",
  
  usage: "/publish <平台> <文章路径> [选项]",
  examples: [
    "/publish wechat ./articles/ai-trends.md",
    "/publish zhihu ./articles/blockchain.md --tags=技术,区块链", 
    "/publish medium ./articles/startup.md --draft",
    "/publish html ./articles/tutorial.md --theme=tech"
  ],
  
  async call(args: string, context: AgentContext): Promise<string> {
    const [platform, articlePath, ...options] = args.split(" ")
    
    if (!platform || !articlePath) {
      return `用法: /publish <平台> <文章路径> [选项]

🌐 支持的发布平台:

📱 微信公众号 (wechat/微信):
   - 自动格式化为微信样式
   - 图片优化和样式调整
   - 代码块美化
   - 示例: /publish wechat article.md

🔗 知乎 (zhihu/知乎):
   - 适配知乎编辑器格式
   - 自动添加参考资料
   - 标签建议
   - 示例: /publish zhihu article.md --tags=AI,技术

📝 Medium:
   - 转换为 Medium 格式
   - 英文内容优化
   - 自动添加 tags
   - 示例: /publish medium article.md --draft

🌍 HTML 静态页面:
   - 生成独立 HTML 文件
   - 可选主题样式
   - 适合网站发布
   - 示例: /publish html article.md --theme=tech

📄 PDF 文档:
   - 高质量 PDF 生成
   - 适合打印和分享
   - 示例: /publish pdf article.md --layout=a4`
    }

    try {
      // 检查文章文件是否存在
      const articleExists = await this.checkFileExists(articlePath)
      if (!articleExists) {
        return `❌ 文章文件不存在: ${articlePath}`
      }

      // 读取文章内容
      const article = await this.readArticleFile(articlePath)
      
      // 根据平台执行发布
      switch (platform.toLowerCase()) {
        case "wechat":
        case "微信":
          return await this.publishToWeChat(article, options, context)
          
        case "zhihu":
        case "知乎": 
          return await this.publishToZhihu(article, options, context)
          
        case "medium":
          return await this.publishToMedium(article, options, context)
          
        case "html":
          return await this.generateHTML(article, options, context)
          
        case "pdf":
          return await this.generatePDF(article, options, context)
          
        default:
          return `❌ 不支持的平台: ${platform}\n请使用: wechat, zhihu, medium, html, pdf`
      }
      
    } catch (error) {
      return `❌ 发布失败: ${error.message}`
    }
  },
  
  userFacingName: () => "publish"
}
```

### `/model` - 模型设置命令（复刻 Claude Code）

```typescript
{
  type: "local-jsx",
  name: "model",
  aliases: ["模型", "ai"],
  description: "设置 AI 模型和参数",
  
  usage: "/model [模型名称] [参数]",
  examples: [
    "/model",                                    // 打开模型选择界面
    "/model claude-3-opus-20240229",            // 切换到 Opus
    "/model claude-3-sonnet-20240229 --temp=0.5" // 设置模型和温度
  ],
  
  async call(args: string, context: AgentContext): Promise<React.ReactElement> {
    const { createElement } = await import('react')
    const [modelName, ...params] = args.split(" ")
    
    if (!args.trim()) {
      // 打开模型选择界面
      return createElement(ModelSelectorPanel, {
        currentModel: context.getConfig().ai.model,
        availableModels: [
          {
            id: "claude-3-opus-20240229",
            name: "Claude 3 Opus",
            description: "最强大的模型，适合复杂写作任务",
            maxTokens: 4000,
            costLevel: "高"
          },
          {
            id: "claude-3-sonnet-20240229", 
            name: "Claude 3 Sonnet",
            description: "平衡性能和成本，适合日常写作",
            maxTokens: 4000,
            costLevel: "中"
          },
          {
            id: "claude-3-haiku-20240307",
            name: "Claude 3 Haiku", 
            description: "快速响应，适合简单任务",
            maxTokens: 4000,
            costLevel: "低"
          }
        ],
        onSelect: async (model) => {
          await context.updateConfig({
            ai: { ...context.getConfig().ai, model: model.id }
          })
          console.log(`✓ 已切换到模型: ${model.name}`)
        },
        onDone: () => {
          console.log("模型设置完成")
        }
      })
    } else {
      // 直接设置模型
      const config = context.getConfig()
      config.ai.model = modelName
      
      // 解析其他参数
      const temperature = this.extractParam(params, "temp") 
      const maxTokens = this.extractParam(params, "tokens")
      
      if (temperature) config.ai.temperature = parseFloat(temperature)
      if (maxTokens) config.ai.max_tokens = parseInt(maxTokens)
      
      await context.updateConfig(config)
      
      return createElement('div', null, [
        createElement('p', null, `✓ 模型已设置为: ${modelName}`),
        temperature && createElement('p', null, `✓ 温度参数: ${temperature}`),
        maxTokens && createElement('p', null, `✓ 最大令牌: ${maxTokens}`)
      ].filter(Boolean))
    }
  },
  
  userFacingName: () => "model"
}
```

### `/style` - 写作风格命令

```typescript
{
  type: "prompt",
  name: "style",
  aliases: ["风格", "语调"],
  description: "调整文章写作风格",
  
  usage: "/style <目标风格> [内容]",
  examples: [
    "/style 通俗",                        // 查看通俗风格说明
    "/style 正式 这段内容需要更正式的表达",   // 直接改写
    "/style 技术 ./articles/draft.md"      // 改写整个文件
  ],
  
  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    const [targetStyle, ...contentParts] = args.split(" ")
    
    const styleGuides = {
      "通俗": {
        description: "通俗易懂，适合大众读者",
        features: ["简单词汇", "生活化比喻", "避免专业术语", "口语化表达"],
        tone: "亲切友好"
      },
      "正式": {
        description: "正式严谨，商务和官方场合",
        features: ["规范用词", "完整句式", "逻辑严密", "措辞准确"],
        tone: "客观专业"
      },
      "技术": {
        description: "技术专业，面向技术人员",
        features: ["准确术语", "逻辑清晰", "细节充分", "实例丰富"],
        tone: "专业权威"
      },
      "学术": {
        description: "学术规范，符合论文标准",
        features: ["引用规范", "论证严密", "用词精确", "结构完整"],
        tone: "客观中性"
      }
    }
    
    const guide = styleGuides[targetStyle]
    if (!guide) {
      return `请选择有效的写作风格：

📝 可用风格：
${Object.entries(styleGuides).map(([name, info]) => 
  `• ${name}: ${info.description}`
).join('\n')}

用法示例：
/style 通俗 这段技术内容需要更通俗的表达
/style 正式 ./articles/draft.md`
    }
    
    let content = contentParts.join(" ")
    
    // 检查是否是文件路径
    if (content.startsWith("./") || content.startsWith("/")) {
      // 这里会触发 read_article 工具
      content = `[文件内容将通过 read_article 工具读取: ${content}]`
    }
    
    if (!content || content.includes("[文件内容将通过")) {
      return `请使用 read_article 工具读取文件，然后改写为${targetStyle}风格。

风格特点 - ${guide.description}：
${guide.features.map(f => `• ${f}`).join('\n')}
语调：${guide.tone}`
    }

    return `请将以下内容改写为${targetStyle}风格：

🎯 目标风格：${guide.description}
📋 风格特点：${guide.features.join(', ')}
🗣️ 语调要求：${guide.tone}

原文内容：
${content}

改写要求：
1. 严格按照${targetStyle}风格的特点进行改写
2. 保持原文的核心信息和观点
3. 调整词汇选择和句式结构
4. 确保改写后的内容符合目标读者需求
5. 保持逻辑清晰和表达流畅

请提供完整的改写结果。`
  },
  
  allowedTools: ["read_article", "edit_article", "style_adapter", "grammar_checker"],
  progressMessage: "正在调整写作风格"
}
```

### `/help` - 帮助命令

```typescript
{
  type: "local",
  name: "help",
  aliases: ["帮助", "h", "?"],
  description: "显示命令帮助信息",
  
  async call(args: string, context: AgentContext): Promise<string> {
    if (args.trim()) {
      // 显示特定命令的详细帮助
      return this.getCommandHelp(args.trim())
    }
    
    return `WriteFlow AI 写作助手 - 命令参考

📝 写作命令:
  /outline <主题>           生成文章大纲
  /rewrite <风格> <内容>    智能改写内容
  /research <主题>          深度主题研究  
  /style <风格> [内容]      调整写作风格

📤 发布命令:
  /publish <平台> <文件>    发布到平台
  /format <格式> <文件>     格式转换

⚙️ 系统命令:
  /model [模型名]           设置AI模型
  /settings                 打开设置界面
  /status                   查看系统状态
  /clear                    清除会话历史

🔍 工具命令:
  /read <文件路径>          读取文件内容
  /edit <文件路径>          编辑文件
  /search <关键词>          搜索内容

💡 使用技巧:
  - 命令支持中英文别名 (如 /大纲 等同于 /outline)
  - 使用 /help <命令> 查看详细说明
  - 大部分命令支持 --参数=值 的选项格式

示例会话:
> /outline AI代理技术
> /research 自然语言处理
> /rewrite 通俗 ./articles/technical-article.md
> /publish wechat ./articles/final-article.md`
  },
  
  userFacingName: () => "help"
}
```

## 🔧 命令执行引擎

### 命令路由器（复刻 rN5 函数）

```typescript
// src/cli/commands/command-executor.ts
export class SlashCommandExecutor {
  private commands: Map<string, SlashCommand> = new Map()
  
  constructor() {
    this.registerWritingCommands()
  }

  // 复刻 Claude Code 的 rN5 函数逻辑
  async executeCommand(
    commandName: string,
    args: string, 
    context: AgentContext,
    callbacks: CommandCallbacks
  ): Promise<CommandResult> {
    try {
      // 查找命令（复刻 cw1 函数）
      const command = this.findCommand(commandName)
      
      // 根据命令类型执行（复刻三种类型处理）
      switch (command.type) {
        case "local-jsx":
          return this.executeJSXCommand(command, args, context, callbacks)
          
        case "local":
          return this.executeLocalCommand(command, args, context)
          
        case "prompt":
          return this.executePromptCommand(command, args, context)
          
        default:
          throw new Error(`未知命令类型: ${command.type}`)
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        messages: [
          { role: 'assistant', content: `❌ 命令执行失败: ${error.message}` }
        ]
      }
    }
  }

  // local-jsx 类型命令执行（复刻逻辑）
  private async executeJSXCommand(
    command: SlashCommand,
    args: string,
    context: AgentContext,
    callbacks: CommandCallbacks
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      command.call((output, skipMessage) => {
        if (skipMessage?.skipMessage) {
          resolve({ 
            success: true, 
            messages: [], 
            shouldQuery: false, 
            skipHistory: true 
          })
          return
        }
        
        resolve({
          success: true,
          messages: [
            {
              role: 'assistant',
              content: `<command-name>/${command.userFacingName()}</command-name>
<command-message>${command.userFacingName()}</command-message>
<command-args>${args}</command-args>`
            },
            output ? {
              role: 'assistant',
              content: `<local-command-stdout>${output}</local-command-stdout>`
            } : {
              role: 'assistant', 
              content: `<local-command-stdout>命令执行完成</local-command-stdout>`
            }
          ],
          shouldQuery: false
        })
      }, context, args).then((jsx) => {
        callbacks.onJSXResult?.({ jsx, shouldHidePromptInput: true })
      })
    })
  }

  // local 类型命令执行
  private async executeLocalCommand(
    command: SlashCommand,
    args: string, 
    context: AgentContext
  ): Promise<CommandResult> {
    const commandMessage = {
      role: 'assistant' as const,
      content: `<command-name>/${command.userFacingName()}</command-name>
<command-message>${command.userFacingName()}</command-message>
<command-args>${args}</command-args>`
    }

    try {
      const result = await command.call(args, context)
      return {
        success: true,
        messages: [
          commandMessage,
          {
            role: 'assistant',
            content: `<local-command-stdout>${result}</local-command-stdout>`
          }
        ],
        shouldQuery: false
      }
    } catch (error) {
      return {
        success: false,
        messages: [
          commandMessage,
          {
            role: 'assistant', 
            content: `<local-command-stderr>${String(error)}</local-command-stderr>`
          }
        ],
        shouldQuery: false
      }
    }
  }

  // prompt 类型命令执行
  private async executePromptCommand(
    command: SlashCommand,
    args: string,
    context: AgentContext
  ): Promise<CommandResult> {
    const promptData = await command.getPromptForCommand(args, context)
    const allowedTools = command.allowedTools || []
    
    const commandMessages = [
      `<command-message>${command.userFacingName()} ${command.progressMessage || 'is processing'}…</command-message>`,
      `<command-name>/${command.userFacingName()}</command-name>`,
      args ? `<command-args>${args}</command-args>` : null
    ].filter(Boolean).join('\n')
    
    const maxThinkingTokens = await this.calculateThinkingTokens(promptData)
    
    return {
      success: true,
      messages: [
        { role: 'assistant', content: commandMessages },
        { role: 'user', content: promptData, isMeta: true }
      ],
      shouldQuery: true,
      allowedTools,
      maxThinkingTokens: maxThinkingTokens > 0 ? maxThinkingTokens : undefined
    }
  }
}
```

## 📱 React 交互组件

### 设置面板组件

```typescript
// src/cli/interactive/SettingsPanel.tsx
import React, { useState } from 'react'

interface SettingsPanelProps {
  config: WriteFlowConfig
  onSave: (config: WriteFlowConfig) => Promise<void>
  onDone: (success: boolean) => void
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  config, 
  onSave, 
  onDone 
}) => {
  const [formConfig, setFormConfig] = useState(config)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(formConfig)
      onDone(true)
    } catch (error) {
      console.error("保存配置失败:", error)
      onDone(false)
    } finally {
      setSaving(false)
    }
  }

  return React.createElement('div', { className: 'settings-panel' }, [
    React.createElement('h2', null, '⚙️ WriteFlow 设置'),
    
    // 写作设置
    React.createElement('section', null, [
      React.createElement('h3', null, '📝 写作设置'),
      React.createElement('label', null, [
        '默认风格: ',
        React.createElement('select', {
          value: formConfig.writing.default_style,
          onChange: (e) => setFormConfig({
            ...formConfig,
            writing: { ...formConfig.writing, default_style: e.target.value }
          })
        }, [
          React.createElement('option', { value: '技术性' }, '技术性'),
          React.createElement('option', { value: '通俗' }, '通俗'),
          React.createElement('option', { value: '正式' }, '正式'),
          React.createElement('option', { value: '学术' }, '学术')
        ])
      ])
    ]),
    
    // AI 模型设置  
    React.createElement('section', null, [
      React.createElement('h3', null, '🤖 AI 模型'),
      React.createElement('label', null, [
        '模型: ',
        React.createElement('select', {
          value: formConfig.ai.model,
          onChange: (e) => setFormConfig({
            ...formConfig,
            ai: { ...formConfig.ai, model: e.target.value }
          })
        }, [
          React.createElement('option', { value: 'claude-3-opus-20240229' }, 'Claude 3 Opus'),
          React.createElement('option', { value: 'claude-3-sonnet-20240229' }, 'Claude 3 Sonnet'),
          React.createElement('option', { value: 'claude-3-haiku-20240307' }, 'Claude 3 Haiku')
        ])
      ])
    ]),
    
    // 按钮
    React.createElement('div', { className: 'button-group' }, [
      React.createElement('button', { 
        onClick: handleSave, 
        disabled: saving 
      }, saving ? '保存中...' : '💾 保存'),
      React.createElement('button', { 
        onClick: () => onDone(false) 
      }, '❌ 取消')
    ])
  ])
}
```

## 🎨 命令行界面渲染

### CLI 输出格式化（复刻 Claude Code 风格）

```typescript
// src/cli/renderer/cli-renderer.ts
export class CLIRenderer {
  private chalk = require('chalk')
  private ora = require('ora')

  // 渲染命令执行结果
  renderCommandResult(result: CommandResult): void {
    if (result.success) {
      if (result.jsx) {
        this.renderReactComponent(result.jsx)
      } else if (result.messages) {
        this.renderMessages(result.messages)
      }
    } else {
      this.renderError(result.error)
    }
  }

  // 渲染消息列表
  private renderMessages(messages: Message[]): void {
    for (const message of messages) {
      if (message.content.includes('<command-name>')) {
        // 解析命令执行信息
        const commandInfo = this.parseCommandInfo(message.content)
        this.renderCommandInfo(commandInfo)
      } else if (message.content.includes('<local-command-stdout>')) {
        // 渲染命令输出
        const output = this.extractCommandOutput(message.content)
        console.log(this.chalk.green("✓"), output)
      } else if (message.content.includes('<local-command-stderr>')) {
        // 渲染命令错误
        const error = this.extractCommandError(message.content)
        console.log(this.chalk.red("✗"), error)
      } else {
        // 普通消息
        console.log(message.content)
      }
    }
  }

  // 渲染交互式进度
  renderProgress(message: string): () => void {
    const spinner = this.ora({
      text: this.chalk.blue(message),
      spinner: 'dots'
    }).start()
    
    return () => spinner.stop()
  }

  // 渲染文章大纲
  renderOutline(outline: OutlineStructure): void {
    console.log(this.chalk.cyan.bold(`📋 ${outline.title}`))
    console.log()
    
    for (const section of outline.sections) {
      const indent = '  '.repeat(section.level - 1)
      const marker = section.level === 1 ? '■' : section.level === 2 ? '▪' : '·'
      
      console.log(`${indent}${this.chalk.blue(marker)} ${this.chalk.bold(section.title)}`)
      if (section.summary) {
        console.log(`${indent}  ${this.chalk.gray(section.summary)}`)
      }
      if (section.estimatedWords) {
        console.log(`${indent}  ${this.chalk.yellow(`预估字数: ${section.estimatedWords}`)}`)
      }
    }
    
    console.log()
    console.log(`总预估字数: ${this.chalk.yellow.bold(outline.estimatedLength)}`)
  }

  // 渲染发布结果
  renderPublishResult(platform: string, result: PublishResult): void {
    console.log(this.chalk.green.bold(`✅ 已发布到 ${platform}`))
    
    if (result.url) {
      console.log(`🔗 链接: ${this.chalk.underline(result.url)}`)
    }
    
    if (result.previewPath) {
      console.log(`👀 预览: ${result.previewPath}`)
    }
    
    if (result.stats) {
      console.log(`📊 统计: ${result.stats.words}字, ${result.stats.characters}字符`)
    }
  }
}
```

---

*本实现完全基于 Claude Code 的真实架构：Node.js CLI + TypeScript + 斜杠命令系统*