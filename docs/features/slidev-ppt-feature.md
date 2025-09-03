# 🎯 WriteFlow Slidev PPT 创作功能需求文档

## 📋 项目概述

### 背景

WriteFlow 作为专为技术型作家设计的 AI 写作助手，目前主要专注于文章创作。随着技术分享和演讲需求的增长，将 WriteFlow 的 AI 能力扩展到 PPT 创作领域，特别是与 Slidev（开发者友好的演示文稿工具）的深度集成，将极大提升技术内容创作者的生产力。

### 目标

1. **无缝集成**：将 Slidev 的 Markdown 演示文稿能力与 WriteFlow 的 AI 写作能力深度融合
2. **智能转换**：支持将现有 Markdown 文章智能转换为演示文稿格式
3. **AI 增强**：利用 AI 能力自动生成演讲大纲、优化内容结构、生成演讲备注
4. **多格式导出**：支持导出为 PDF、PPTX、PNG、静态网站等多种格式
5. **模块化设计**：通过 Agent 配置系统实现按需加载，避免工具膨胀

### 核心价值

- **效率提升**：将文章到 PPT 的转换时间从小时级降至分钟级
- **质量保证**：AI 辅助确保演讲内容逻辑清晰、重点突出
- **开发者友好**：保持 Markdown 工作流，支持代码高亮、组件化、版本控制
- **资源优化**：按需加载工具，不占用主系统上下文

## 🎮 Agent 配置系统设计

### 核心理念：模块化与按需加载

参考 Kode 项目和 Claude Code 的架构设计，WriteFlow 的 Slidev 功能将通过独立的 Agent 配置系统实现，确保：
- **工具隔离**：Slidev 相关工具不会污染主系统的工具列表
- **上下文优化**：仅在需要时加载，不占用默认 system prompt 空间
- **灵活扩展**：易于添加新功能，不影响核心系统稳定性

### Agent 配置文件结构

```yaml
# .writeflow/agents/slidev-ppt.md
---
name: slidev-ppt
description: "专门用于创建和管理 Slidev 演示文稿，包括 Markdown 到 PPT 的转换、大纲生成、内容优化等功能"
whenToUse: |
  - 用户需要创建技术演讲稿或 PPT
  - 需要将 Markdown 文章转换为演示文稿
  - 优化现有的 Slidev 演示文稿
  - 导出演示文稿为多种格式
tools:
  - SlidevGenerator
  - SlideConverter
  - SlideOptimizer
  - SlideExporter
  - ReadArticle
  - WriteArticle
  - WebSearch
model_name: main  # 可选：指定使用的模型
---

你是 WriteFlow 的 Slidev PPT 创作专家。你的任务是帮助用户创建专业、美观、富有表现力的技术演示文稿。

## 核心能力

1. **内容转换**：将长文章智能拆分为适合演讲的幻灯片
2. **结构优化**：确保演讲逻辑清晰，节奏合理
3. **视觉增强**：建议合适的图表、动画和过渡效果
4. **时间控制**：根据演讲时长优化内容密度

## 工作流程

1. 分析用户需求（主题、时长、受众）
2. 生成或转换内容结构
3. 优化每页幻灯片的信息量
4. 添加视觉元素和动画建议
5. 生成演讲备注和时间提示

## 最佳实践

- 每页幻灯片聚焦一个核心观点
- 使用渐进式披露控制信息流
- 代码示例要简洁且高亮关键部分
- 合理使用图表替代文字描述
- 保持视觉风格的一致性
```

### Agent 加载机制

```typescript
// src/utils/agentLoader.ts
export class SlidevAgentLoader {
  private static instance: SlidevAgentLoader
  private agentConfig: AgentConfig | null = null
  private tools: Map<string, WritingTool> = new Map()
  
  // 单例模式，避免重复加载
  static getInstance(): SlidevAgentLoader {
    if (!this.instance) {
      this.instance = new SlidevAgentLoader()
    }
    return this.instance
  }
  
  // 按需加载 Agent 配置
  async loadAgent(): Promise<AgentConfig> {
    if (this.agentConfig) {
      return this.agentConfig
    }
    
    // 读取配置文件
    const configPath = path.join(process.cwd(), '.writeflow/agents/slidev-ppt.md')
    const content = await fs.readFile(configPath, 'utf-8')
    const { data: frontmatter, content: systemPrompt } = matter(content)
    
    // 构建 Agent 配置
    this.agentConfig = {
      name: frontmatter.name,
      description: frontmatter.description,
      whenToUse: frontmatter.whenToUse,
      tools: frontmatter.tools,
      systemPrompt,
      model: frontmatter.model_name || 'main'
    }
    
    // 动态加载工具
    await this.loadTools(frontmatter.tools)
    
    return this.agentConfig
  }
  
  // 动态加载指定的工具
  private async loadTools(toolNames: string[]): Promise<void> {
    for (const toolName of toolNames) {
      if (!this.tools.has(toolName)) {
        // 懒加载工具模块
        const tool = await import(`../tools/slidev/${toolName}`)
        this.tools.set(toolName, new tool.default())
      }
    }
  }
  
  // 获取已加载的工具
  getTools(): WritingTool[] {
    return Array.from(this.tools.values())
  }
  
  // 卸载 Agent，释放资源
  unload(): void {
    this.agentConfig = null
    this.tools.clear()
  }
}
```

### 命令触发机制

```typescript
// src/commands/slide.ts
export class SlideCommand {
  async execute(args: string, context: CommandContext): Promise<void> {
    // 检测是否为 slide 相关命令
    if (!this.isSlideCommand(args)) {
      return
    }
    
    // 动态加载 Slidev Agent
    const loader = SlidevAgentLoader.getInstance()
    const agent = await loader.loadAgent()
    
    try {
      // 创建独立的执行上下文
      const slideContext = {
        ...context,
        systemPrompt: agent.systemPrompt,
        tools: loader.getTools(),
        model: agent.model
      }
      
      // 执行 Slidev 相关任务
      await this.executeSlideTask(args, slideContext)
      
    } finally {
      // 可选：执行完毕后卸载，释放内存
      // loader.unload()
    }
  }
}
```

## 🏗️ 功能架构设计

### 1. 命令系统扩展

#### `/slide` - PPT 创作主命令

```typescript
{
  type: "prompt",
  name: "slide",
  aliases: ["ppt", "演示", "幻灯片"],
  description: "AI 辅助创建 Slidev 演示文稿",
  
  subcommands: {
    "create": "创建新的演示文稿",
    "convert": "将文章转换为演示文稿",
    "outline": "生成演讲大纲",
    "optimize": "优化现有演示文稿",
    "export": "导出演示文稿"
  },
  
  usage: "/slide <子命令> [选项]",
  examples: [
    "/slide create 'AI Agent 架构设计' --duration=30 --style=technical",
    "/slide convert ./articles/tech-article.md --split-by=h2",
    "/slide outline 'Rust 性能优化' --slides=15 --audience=senior",
    "/slide optimize ./slides.md --add-animations --improve-flow",
    "/slide export ./slides.md --format=pdf --theme=seriph"
  ]
}
```

#### `/slide-outline` - 演讲大纲生成

```typescript
{
  type: "prompt",
  name: "slide-outline",
  aliases: ["ppt-outline", "演讲大纲"],
  description: "生成结构化的演讲大纲",
  
  parameters: {
    topic: "演讲主题",
    duration: "演讲时长（分钟）",
    slides: "幻灯片数量",
    audience: "目标听众（junior/senior/mixed）",
    style: "演讲风格（technical/business/educational）"
  },
  
  output: {
    title: "演讲标题",
    subtitle: "副标题",
    sections: [
      {
        name: "章节名称",
        slides: "预计页数",
        duration: "预计时长",
        keyPoints: ["要点1", "要点2"],
        speakerNotes: "演讲备注"
      }
    ],
    timeline: "时间安排",
    resources: "参考资源"
  }
}
```

#### `/slide-convert` - Markdown 文章转换

```typescript
{
  type: "local",
  name: "slide-convert",
  aliases: ["md2slide", "文章转PPT"],
  description: "将 Markdown 文章智能转换为 Slidev 格式",
  
  parameters: {
    source: "源文件路径",
    splitBy: "分割策略（h1/h2/h3/section/auto）",
    maxSlides: "最大幻灯片数",
    includeNotes: "是否生成演讲备注",
    theme: "应用的主题"
  },
  
  conversionRules: {
    headings: "标题映射规则",
    content: "内容分割规则",
    code: "代码块处理",
    images: "图片优化",
    lists: "列表转换"
  }
}
```

### 2. 工具集设计

#### SlidevGenerator - Slidev 格式生成器

```typescript
export class SlidevGeneratorTool implements WritingTool {
  name = "slidev_generator"
  description = "生成 Slidev 格式的演示文稿"
  
  async execute(input: SlidevGeneratorInput): Promise<ToolResult> {
    const { content, config } = input
    
    // 1. 解析内容结构
    const structure = this.analyzeContent(content)
    
    // 2. 生成 Slidev 头部配置
    const headmatter = this.generateHeadmatter({
      title: config.title,
      theme: config.theme || 'default',
      layout: config.layout,
      highlighter: 'shiki',
      monaco: config.includeCodeEditor,
      mdc: true
    })
    
    // 3. 生成幻灯片内容
    const slides = this.generateSlides(structure, {
      splitStrategy: config.splitBy,
      maxSlidesCount: config.maxSlides,
      animationLevel: config.animations,
      includeTransitions: config.transitions
    })
    
    // 4. 添加演讲者备注
    const slidesWithNotes = this.addSpeakerNotes(slides, {
      autoGenerate: config.autoNotes,
      style: config.noteStyle
    })
    
    // 5. 组装最终内容
    const slidevContent = this.assembleSlidev(
      headmatter,
      slidesWithNotes
    )
    
    return {
      success: true,
      data: {
        content: slidevContent,
        metadata: {
          slideCount: slides.length,
          estimatedDuration: this.estimateDuration(slides),
          features: this.detectFeatures(slidevContent)
        }
      }
    }
  }
  
  private generateSlides(structure: ContentStructure, config: SlideConfig): Slide[] {
    const slides: Slide[] = []
    
    // 封面页
    slides.push(this.createCoverSlide(structure.title, structure.subtitle))
    
    // 目录页（可选）
    if (config.includeTOC) {
      slides.push(this.createTOCSlide(structure.sections))
    }
    
    // 内容页
    structure.sections.forEach(section => {
      slides.push(...this.createContentSlides(section, config))
    })
    
    // 结尾页
    slides.push(this.createEndSlide(structure.conclusion))
    
    return slides
  }
}
```

#### SlideConverter - Markdown 到 Slidev 转换器

```typescript
export class SlideConverterTool implements WritingTool {
  name = "slide_converter"
  description = "将 Markdown 文章转换为 Slidev 演示文稿"
  
  async execute(input: SlideConverterInput): Promise<ToolResult> {
    const { markdown, options } = input
    
    // 1. 解析 Markdown 结构
    const ast = this.parseMarkdown(markdown)
    
    // 2. 智能内容分割
    const segments = this.intelligentSplit(ast, {
      strategy: options.splitBy || 'auto',
      targetSlides: options.maxSlides || 20,
      preserveContext: true
    })
    
    // 3. 内容优化和重组
    const optimizedSegments = segments.map(segment => ({
      ...segment,
      content: this.optimizeForPresentation(segment.content),
      layout: this.selectBestLayout(segment),
      animations: this.suggestAnimations(segment)
    }))
    
    // 4. 生成 Slidev 格式
    const slidevContent = this.generateSlidevFormat(optimizedSegments, {
      theme: options.theme,
      transitions: options.transitions,
      aspectRatio: options.aspectRatio || '16/9'
    })
    
    // 5. 添加交互元素
    const interactiveContent = this.addInteractiveElements(slidevContent, {
      codePlayground: options.enablePlayground,
      clickAnimations: options.enableAnimations,
      polls: options.includePills
    })
    
    return {
      success: true,
      data: {
        content: interactiveContent,
        conversionReport: this.generateReport(markdown, interactiveContent)
      }
    }
  }
  
  private intelligentSplit(ast: MarkdownAST, config: SplitConfig): Segment[] {
    // AI 驱动的智能分割算法
    const segments: Segment[] = []
    
    if (config.strategy === 'auto') {
      // 分析内容密度和逻辑关系
      const density = this.analyzeContentDensity(ast)
      const relationships = this.analyzeLogicalRelationships(ast)
      
      // 基于分析结果动态分割
      return this.dynamicSplit(ast, density, relationships, config.targetSlides)
    }
    
    // 基于标题级别分割
    return this.splitByHeading(ast, config.strategy)
  }
}
```

#### SlideOptimizer - PPT 内容优化器

```typescript
export class SlideOptimizerTool implements WritingTool {
  name = "slide_optimizer"
  description = "优化演示文稿内容和结构"
  
  async execute(input: SlideOptimizerInput): Promise<ToolResult> {
    const { slidevContent, goals } = input
    
    const optimizations = []
    
    // 1. 内容精简
    if (goals.includes('conciseness')) {
      optimizations.push(this.simplifyContent(slidevContent))
    }
    
    // 2. 视觉增强
    if (goals.includes('visual')) {
      optimizations.push(this.enhanceVisuals(slidevContent))
    }
    
    // 3. 流程优化
    if (goals.includes('flow')) {
      optimizations.push(this.improveFlow(slidevContent))
    }
    
    // 4. 动画建议
    if (goals.includes('animations')) {
      optimizations.push(this.suggestAnimations(slidevContent))
    }
    
    // 5. 时间优化
    if (goals.includes('timing')) {
      optimizations.push(this.optimizeTiming(slidevContent))
    }
    
    const optimizedContent = this.applyOptimizations(
      slidevContent,
      optimizations
    )
    
    return {
      success: true,
      data: {
        content: optimizedContent,
        improvements: this.summarizeImprovements(optimizations)
      }
    }
  }
}
```

### 3. AI 增强功能

#### 智能内容分析

```typescript
interface ContentAnalyzer {
  // 分析内容结构和重要性
  analyzeImportance(content: string): ImportanceMap
  
  // 识别关键概念和术语
  extractKeyConepts(content: string): Concept[]
  
  // 检测内容类型（技术、商务、教育等）
  detectContentType(content: string): ContentType
  
  // 评估复杂度级别
  assessComplexity(content: string): ComplexityLevel
}
```

#### 演讲备注生成

```typescript
interface SpeakerNotesGenerator {
  // 生成演讲要点
  generateTalkingPoints(slide: Slide): string[]
  
  // 生成时间提示
  generateTimingCues(slide: Slide, totalDuration: number): TimingCue[]
  
  // 生成过渡语句
  generateTransitions(currentSlide: Slide, nextSlide: Slide): string
  
  // 生成互动建议
  suggestInteractions(slide: Slide): Interaction[]
}
```

#### 视觉元素建议

```typescript
interface VisualSuggestionEngine {
  // 建议图表类型
  suggestCharts(data: any): ChartSuggestion[]
  
  // 建议图标使用
  suggestIcons(content: string): IconSuggestion[]
  
  // 建议布局模式
  suggestLayout(content: string): LayoutSuggestion
  
  // 建议配色方案
  suggestColorScheme(theme: string): ColorScheme
}
```

## 🛠️ 技术实现方案

### 1. 核心依赖（按需安装）

```json
{
  "optionalDependencies": {
    "@slidev/cli": "^latest",
    "@slidev/theme-seriph": "^latest",
    "@slidev/theme-default": "^latest",
    "markdown-it": "^14.0.0",
    "markdown-it-mdc": "^latest",
    "shiki": "^latest",
    "playwright": "^latest",
    "pdf-lib": "^latest"
  }
}
```

注意：Slidev 相关依赖将作为可选依赖，仅在用户首次使用 `/slide` 命令时提示安装。

### 2. 项目结构扩展

```bash
writeflow/
├── .writeflow/
│   └── agents/                        # Agent 配置目录
│       ├── slidev-ppt.md              # Slidev Agent 配置
│       └── README.md                  # Agent 使用说明
├── src/
│   ├── utils/
│   │   └── agentLoader.ts             # Agent 加载器
│   ├── tools/
│   │   └── slidev/                    # Slidev 相关工具（按需加载）
│   │       ├── SlidevGenerator.ts     # 生成器
│   │       ├── SlideConverter.ts      # 转换器
│   │       ├── SlideOptimizer.ts      # 优化器
│   │       ├── SlideExporter.ts       # 导出器
│   │       └── index.ts               # 工具导出
│   ├── commands/
│   │   └── slide.ts                   # Slide 主命令
│   └── templates/
│       └── slidev/                    # Slidev 模板
│           ├── default/                # 默认模板集
│           │   ├── cover.md           # 封面模板
│           │   ├── toc.md             # 目录模板
│           │   ├── content.md         # 内容模板
│           │   └── end.md             # 结尾模板
│           └── themes/                # 主题特定模板
│               ├── technical/         # 技术演讲模板
│               ├── business/          # 商务演示模板
│               └── academic/          # 学术报告模板
```

### 3. 配置系统

```yaml
# .writeflow/slidev.config.yaml
slidev:
  # 默认主题
  defaultTheme: seriph
  
  # Agent 设置
  agent:
    autoLoad: false      # 是否自动加载（默认否）
    cacheTools: true     # 是否缓存工具（默认是）
    unloadAfter: 3600000 # 闲置多久后卸载（毫秒）
  
  # 默认配置
  defaults:
    aspectRatio: 16/9
    canvasWidth: 1024
    highlighter: shiki
    monaco: true
    mdc: true
    
  # 转换规则
  conversion:
    splitStrategy: auto
    maxSlidesPerSection: 5
    includeNotes: true
    preserveCodeBlocks: true
    
  # 导出设置
  export:
    formats: [pdf, pptx, png]
    quality: high
    withNotes: false
    withClicks: false
    
  # 性能优化
  performance:
    preloadTemplates: false  # 预加载模板
    cacheExports: true       # 缓存导出结果
    maxConcurrentExports: 2  # 最大并发导出数
```

## 📊 实施计划

### 第一阶段：基础功能（2周）

1. **Week 1**
   - 实现 `/slide` 主命令框架
   - 实现基础的 Markdown 到 Slidev 转换
   - 支持基本的幻灯片生成

2. **Week 2**
   - 实现 `/slide-outline` 大纲生成
   - 添加基础的内容分割策略
   - 支持简单的主题应用

### 第二阶段：AI 增强（2周）

1. **Week 3**
   - 实现智能内容分析
   - 添加演讲备注自动生成
   - 优化内容分割算法

2. **Week 4**
   - 实现内容优化建议
   - 添加视觉元素建议
   - 完善动画和过渡效果

### 第三阶段：高级功能（2周）

1. **Week 5**
   - 实现多格式导出
   - 添加实时预览功能
   - 支持自定义模板

2. **Week 6**
   - 性能优化
   - 错误处理完善
   - 文档编写和测试

## 🎯 成功指标

### 功能指标

- ✅ 支持至少 5 种 Slidev 官方主题
- ✅ Markdown 到 Slidev 转换成功率 > 95%
- ✅ AI 生成的大纲满意度 > 80%
- ✅ 支持导出 PDF、PPTX、PNG 格式

### 性能指标

- ⚡ 30 页 PPT 生成时间 < 10 秒
- ⚡ 文章转换响应时间 < 5 秒
- ⚡ PDF 导出时间 < 30 秒

### 用户体验指标

- 🎨 命令使用学习成本 < 5 分钟
- 🎨 生成内容无需手动调整比例 > 70%
- 🎨 用户满意度评分 > 4.5/5

## 🔄 迭代优化方向

### 短期优化（1-2月）

1. **模板系统**
   - 行业特定模板（技术、商务、教育）
   - 场景模板（产品发布、技术分享、培训）
   - 自定义模板支持

2. **协作功能**
   - 多人协作编辑
   - 评论和批注
   - 版本管理

### 中期规划（3-6月）

1. **智能助手**
   - 实时内容建议
   - 语音转文字输入
   - 自动配图和图表生成

2. **平台集成**
   - GitHub/GitLab 集成
   - Notion/Obsidian 导入
   - 云端同步和分享

### 长期愿景（6月+）

1. **AI 演讲教练**
   - 演讲节奏分析
   - 内容改进建议
   - 观众互动预测

2. **多媒体支持**
   - 视频嵌入和剪辑
   - 音频旁白生成
   - AR/VR 演示支持

## 📝 风险与对策

### 技术风险

| 风险 | 影响 | 对策 |
|-----|-----|-----|
| Slidev API 变更 | 高 | 版本锁定，渐进式升级 |
| AI 生成质量不稳定 | 中 | 多模型备份，人工审核机制 |
| 导出格式兼容性 | 中 | 充分测试，提供多种导出选项 |

### 用户风险

| 风险 | 影响 | 对策 |
|-----|-----|-----|
| 学习曲线陡峭 | 高 | 提供详细教程和示例 |
| 生成内容不符预期 | 中 | 预览功能，撤销机制 |
| 性能问题 | 低 | 优化算法，提供进度提示 |

## 🎊 总结

WriteFlow Slidev PPT 创作功能将为技术内容创作者提供一个强大的演示文稿创作工具，通过 AI 技术大幅提升 PPT 制作效率，同时保持专业性和美观性。该功能的实现将使 WriteFlow 成为一个更加完整的技术内容创作平台，覆盖从文章写作到演讲准备的完整工作流。

---

---

*文档版本：2.0.0*  
*创建日期：2025-01-03*  
*更新日期：2025-01-03*  
*作者：WriteFlow Team*

## 📚 附录：Agent 配置示例

### 示例 1：基础 Slidev Agent 配置

保存为 `.writeflow/agents/slidev-ppt.md`：

```markdown
---
name: slidev-ppt
description: "Slidev PPT 创作专家"
whenToUse: "用户需要创建或转换演示文稿"
tools: ["SlidevGenerator", "SlideConverter"]
---

你是 Slidev PPT 创作专家，帮助用户创建专业的技术演示文稿。
```

### 示例 2：使用流程

```bash
# 1. 用户输入命令
$ writeflow /slide create "AI Agent 架构设计"

# 2. 系统检测到 slide 命令，动态加载 Slidev Agent

# 3. Agent 接管任务，使用专用工具生成 PPT

# 4. 完成后返回结果，可选择性卸载 Agent 释放资源
```

### 示例 3：依赖安装提示

```typescript
// 首次使用时的安装引导
if (!isSlidevInstalled()) {
  console.log(`
    首次使用 Slidev 功能需要安装相关依赖。
    这些依赖是可选的，仅在使用 PPT 功能时需要。
    
    是否安装？(y/n)
  `)
  
  if (userConfirms()) {
    await installOptionalDependencies(['@slidev/cli', '@slidev/theme-seriph'])
  }
}
```
