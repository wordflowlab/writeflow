# 🛠️ WriteFlow 写作工具集

基于 Claude Code MH1 工具引擎的写作专用工具实现

## 🎯 工具设计理念

完全复刻 Claude Code 的工具架构，将编程工具转换为写作工具：
- **强制读取机制**：编辑文章前必须先读取（复刻 Edit 工具逻辑）
- **六层安全验证**：每个工具调用都经过完整安全检查
- **批量操作支持**：单次响应支持多工具并发执行
- **工具替代强制**：禁用传统文本命令，强制使用专用工具

## 📝 核心文章操作工具

### ReadArticle 工具（复刻 Read 工具）

```typescript
// src/tools/base/read-article.ts
export class ReadArticleTool implements WritingTool {
  name = "read_article"
  description = "读取文章内容，支持多种格式"
  securityLevel = "read-only"
  
  inputSchema = {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "文章文件的绝对路径"
      },
      limit: {
        type: "number", 
        description: "读取行数限制，默认2000行"
      },
      offset: {
        type: "number",
        description: "开始读取的行号"
      }
    },
    required: ["file_path"]
  }

  async execute(input: ReadArticleInput): Promise<ToolResult> {
    // 安全验证
    await this.validateSecurity(input)
    
    // 路径规范化（必须是绝对路径）
    const absolutePath = path.resolve(input.file_path)
    
    try {
      // 读取文件内容
      const content = await fs.readFile(absolutePath, 'utf-8')
      const lines = content.split('\n')
      
      // 处理分页（复刻 Read 工具的分页逻辑）
      const offset = input.offset || 0
      const limit = input.limit || 2000
      const pageLines = lines.slice(offset, offset + limit)
      const pageContent = pageLines.join('\n')
      
      // 检测文章格式
      const format = this.detectFileFormat(absolutePath, content)
      
      // 提取文章元数据
      const metadata = this.extractArticleMetadata(content, format)
      
      // 自动恶意内容检测（复刻 tG5 机制）
      const securityWarning = await this.checkMaliciousContent(content)
      
      // 统计信息
      const stats = this.calculateArticleStats(content)
      
      return {
        success: true,
        data: {
          content: pageContent,
          format,
          metadata,
          stats,
          pagination: {
            offset,
            limit,
            totalLines: lines.length,
            hasMore: offset + limit < lines.length
          },
          securityWarning
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: `读取文章失败: ${error.message}`
      }
    }
  }

  private detectFileFormat(filePath: string, content: string): ArticleFormat {
    const ext = path.extname(filePath).toLowerCase()
    
    switch (ext) {
      case '.md':
      case '.markdown':
        return 'markdown'
      case '.txt':
        return 'plain_text'
      case '.html':
      case '.htm':
        return 'html'
      case '.docx':
        return 'docx'
      default:
        // 通过内容特征检测
        if (content.includes('# ') || content.includes('## ')) {
          return 'markdown'
        }
        return 'plain_text'
    }
  }

  private extractArticleMetadata(content: string, format: ArticleFormat): ArticleMetadata {
    const metadata: ArticleMetadata = {}
    
    if (format === 'markdown') {
      // 解析 Markdown 前置数据
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (frontMatterMatch) {
        try {
          const yaml = require('yaml')
          metadata.frontMatter = yaml.parse(frontMatterMatch[1])
        } catch (error) {
          // 忽略解析错误
        }
      }
      
      // 提取标题
      const titleMatch = content.match(/^#\s+(.+)$/m)
      if (titleMatch) {
        metadata.title = titleMatch[1]
      }
    }
    
    return metadata
  }

  private calculateArticleStats(content: string): ArticleStats {
    const words = content.match(/[\u4e00-\u9fa5]|[a-zA-Z]+/g) || []
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || []
    const englishWords = content.match(/[a-zA-Z]+/g) || []
    
    return {
      totalCharacters: content.length,
      chineseCharacters: chineseChars.length,
      englishWords: englishWords.length,
      totalWords: words.length,
      paragraphs: content.split(/\n\s*\n/).filter(p => p.trim()).length,
      estimatedReadingTime: Math.ceil(words.length / 200) // 按200字/分钟估算
    }
  }
}
```

### WriteArticle 工具（复刻 Write 工具）

```typescript
// src/tools/base/write-article.ts
export class WriteArticleTool implements WritingTool {
  name = "write_article"
  description = "写入文章内容到文件"
  securityLevel = "write"
  
  inputSchema = {
    type: "object",
    properties: {
      file_path: { type: "string", description: "文章文件的绝对路径" },
      content: { type: "string", description: "文章内容" },
      format: { type: "string", enum: ["markdown", "html", "txt"], description: "文件格式" },
      metadata: { type: "object", description: "文章元数据" },
      backup: { type: "boolean", description: "是否创建备份" }
    },
    required: ["file_path", "content"]
  }

  async execute(input: WriteArticleInput): Promise<ToolResult> {
    // 安全验证
    await this.validateSecurity(input)
    
    const absolutePath = path.resolve(input.file_path)
    
    try {
      // 检查是否覆盖现有文件（复刻 Write 工具的读取前置机制）
      const fileExists = await this.checkFileExists(absolutePath)
      if (fileExists && !input.force) {
        // 强制要求先读取现有文件
        throw new Error(`文件已存在: ${absolutePath}。请先使用 read_article 工具读取文件内容，或使用 edit_article 工具进行编辑。`)
      }
      
      // 创建备份
      if (fileExists && input.backup !== false) {
        const backupPath = `${absolutePath}.backup.${Date.now()}`
        await fs.copyFile(absolutePath, backupPath)
      }
      
      // 确保目录存在
      const dir = path.dirname(absolutePath)
      await fs.mkdir(dir, { recursive: true })
      
      // 处理文章内容
      let finalContent = input.content
      
      // 添加元数据（如果是 Markdown 格式）
      if (input.format === 'markdown' && input.metadata) {
        const frontMatter = this.generateFrontMatter(input.metadata)
        finalContent = `---\n${frontMatter}\n---\n\n${input.content}`
      }
      
      // 写入文件（原子性操作）
      const tempPath = `${absolutePath}.tmp.${process.pid}`
      await fs.writeFile(tempPath, finalContent, 'utf-8')
      await fs.rename(tempPath, absolutePath)
      
      // 计算统计信息
      const stats = this.calculateArticleStats(finalContent)
      
      return {
        success: true,
        data: {
          path: absolutePath,
          size: finalContent.length,
          format: input.format || this.detectFormat(absolutePath),
          stats,
          created_at: new Date().toISOString()
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: `写入文章失败: ${error.message}`
      }
    }
  }

  private generateFrontMatter(metadata: ArticleMetadata): string {
    const yaml = require('yaml')
    const frontMatter = {
      title: metadata.title,
      author: metadata.author,
      date: metadata.date || new Date().toISOString().split('T')[0],
      tags: metadata.tags || [],
      category: metadata.category,
      summary: metadata.summary,
      ...metadata.custom
    }
    
    return yaml.stringify(frontMatter)
  }
}
```

### EditArticle 工具（复刻 Edit 工具的强制读取机制）

```typescript
// src/tools/base/edit-article.ts
export class EditArticleTool implements WritingTool {
  name = "edit_article"
  description = "精确编辑文章内容"
  securityLevel = "write"
  
  private fileStateTracker: FileStateTracker = new FileStateTracker()
  
  inputSchema = {
    type: "object",
    properties: {
      file_path: { type: "string", description: "文章文件的绝对路径" },
      old_string: { type: "string", description: "要替换的文本（必须完全匹配）" },
      new_string: { type: "string", description: "新的文本内容" },
      replace_all: { type: "boolean", description: "是否替换所有匹配项" }
    },
    required: ["file_path", "old_string", "new_string"]
  }

  async execute(input: EditArticleInput): Promise<ToolResult> {
    const absolutePath = path.resolve(input.file_path)
    
    // 强制读取验证（复刻 Claude Code 的核心机制）
    const fileState = this.fileStateTracker.getFileState(absolutePath)
    if (!fileState) {
      throw new Error(`文件 ${absolutePath} 尚未读取。请先使用 read_article 工具读取文件内容。`)
    }
    
    // 验证文件内容未被外部修改
    const currentContent = await fs.readFile(absolutePath, 'utf-8')
    if (this.calculateHash(currentContent) !== fileState.hash) {
      throw new Error(`文件 ${absolutePath} 已被外部修改。请重新使用 read_article 工具读取最新内容。`)
    }
    
    try {
      // 执行字符串替换（完全复刻 Edit 工具逻辑）
      let newContent: string
      
      if (input.replace_all) {
        // 全部替换
        newContent = currentContent.replaceAll(input.old_string, input.new_string)
        const replaceCount = (currentContent.match(new RegExp(escapeRegex(input.old_string), 'g')) || []).length
        
        if (replaceCount === 0) {
          throw new Error(`未找到要替换的文本: "${input.old_string}"`)
        }
        
      } else {
        // 单次替换 - 确保唯一性
        const matches = currentContent.split(input.old_string)
        if (matches.length === 1) {
          throw new Error(`未找到要替换的文本: "${input.old_string}"`)
        }
        if (matches.length > 2) {
          throw new Error(`文本不唯一，找到${matches.length - 1}处匹配。请提供更大的上下文或使用 replace_all 参数。`)
        }
        
        newContent = currentContent.replace(input.old_string, input.new_string)
      }
      
      // 原子性写入
      const tempPath = `${absolutePath}.tmp.${process.pid}`
      await fs.writeFile(tempPath, newContent, 'utf-8')
      await fs.rename(tempPath, absolutePath)
      
      // 更新文件状态追踪
      this.fileStateTracker.updateFileState(absolutePath, newContent)
      
      // 计算变更统计
      const changeStats = this.calculateChangeStats(currentContent, newContent)
      
      return {
        success: true,
        data: {
          path: absolutePath,
          changes: {
            old_length: currentContent.length,
            new_length: newContent.length,
            diff: changeStats.diff,
            lines_changed: changeStats.linesChanged
          },
          statistics: this.calculateArticleStats(newContent)
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: `编辑文章失败: ${error.message}`
      }
    }
  }

  // 文件状态追踪器（复刻 readFileState 机制）
  private class FileStateTracker {
    private fileStates: Map<string, FileState> = new Map()
    
    trackFileRead(filePath: string, content: string): FileState {
      const state: FileState = {
        path: filePath,
        hash: this.calculateHash(content),
        content,
        lastRead: Date.now(),
        lineCount: content.split('\n').length
      }
      
      this.fileStates.set(filePath, state)
      return state
    }
    
    getFileState(filePath: string): FileState | undefined {
      return this.fileStates.get(filePath)
    }
    
    updateFileState(filePath: string, newContent: string): void {
      const state = this.fileStates.get(filePath)
      if (state) {
        state.content = newContent
        state.hash = this.calculateHash(newContent)
        state.lastModified = Date.now()
        state.lineCount = newContent.split('\n').length
      }
    }
  }
}
```

## ✍️ 高级写作工具

### OutlineGenerator 工具

```typescript
// src/tools/writing/outline-generator.ts
export class OutlineGeneratorTool implements WritingTool {
  name = "generate_outline"
  description = "AI 生成文章大纲"
  securityLevel = "ai-powered"
  
  async execute(input: OutlineGeneratorInput): Promise<ToolResult> {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    
    // 构建提示词
    const prompt = this.buildOutlinePrompt(input)
    
    const response = await anthropic.messages.create({
      model: input.model || "claude-3-opus-20240229",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [{
        role: "user",
        content: prompt
      }]
    })
    
    // 解析生成的大纲
    const outline = this.parseOutlineFromAI(response.content[0].text)
    
    // 生成文件建议
    const fileSuggestions = this.generateFileSuggestions(input.topic, outline)
    
    return {
      success: true,
      data: {
        outline,
        fileSuggestions,
        metadata: {
          model: input.model || "claude-3-opus-20240229",
          tokensUsed: response.usage.output_tokens,
          generatedAt: Date.now(),
          topic: input.topic
        }
      }
    }
  }

  private buildOutlinePrompt(input: OutlineGeneratorInput): string {
    return `请为主题"${input.topic}"生成详细的文章大纲。

文章参数：
- 目标读者：${input.audience || "技术读者"}
- 文章类型：${input.articleType || "技术文章"}
- 目标长度：${input.targetLength || 2000}字
- 写作风格：${input.style || "技术性"}
- 特殊要求：${input.requirements || "无"}

请生成以下结构的大纲：

## 1. 标题建议
提供3个不同角度的标题选项，要求吸引人且准确。

## 2. 文章结构
### 引言部分 (10-15%)
- 问题引入或背景介绍
- 文章价值和读者收益
- 预估字数：XXX字

### 主体部分 (70-80%)
#### 第一章节：[章节标题]
- 核心论点：
- 关键内容：
- 支撑材料：
- 预估字数：XXX字

#### 第二章节：[章节标题]
- 核心论点：
- 关键内容：
- 支撑材料：
- 预估字数：XXX字

[继续其他章节...]

### 结论部分 (10-15%)
- 要点总结
- 深度思考或展望
- 行动建议（如适用）
- 预估字数：XXX字

## 3. 写作建议
- 关键信息来源建议
- 可能的难点和解决方案
- 读者互动点设计
- SEO 优化建议

## 4. 相关资料
- 必需的背景资料
- 权威参考来源
- 数据统计需求

请确保大纲逻辑清晰，易于执行。`
  }

  private parseOutlineFromAI(text: string): OutlineStructure {
    // 智能解析 AI 生成的大纲结构
    const sections: OutlineSection[] = []
    const lines = text.split('\n')
    
    let currentSection: OutlineSection | null = null
    let currentSubsection: OutlineSubsection | null = null
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.match(/^##\s+\d+\.\s+(.+)/)) {
        // 主要章节
        const title = trimmed.match(/^##\s+\d+\.\s+(.+)/)?.[1] || ''
        currentSection = {
          level: 1,
          title,
          subsections: [],
          estimatedWords: 0
        }
        sections.push(currentSection)
        
      } else if (trimmed.match(/^###\s+(.+)/)) {
        // 子章节
        const title = trimmed.match(/^###\s+(.+)/)?.[1] || ''
        currentSubsection = {
          level: 2,
          title,
          content: [],
          estimatedWords: 0
        }
        if (currentSection) {
          currentSection.subsections.push(currentSubsection)
        }
        
      } else if (trimmed.match(/^####\s+(.+)/)) {
        // 子子章节
        const title = trimmed.match(/^####\s+(.+)/)?.[1] || ''
        if (currentSubsection) {
          currentSubsection.content.push({
            type: 'subsection',
            title,
            description: ''
          })
        }
        
      } else if (trimmed.startsWith('- ') && currentSubsection) {
        // 要点列表
        const content = trimmed.slice(2)
        if (content.includes('：') || content.includes(':')) {
          const [label, description] = content.split(/[:：]/)
          currentSubsection.content.push({
            type: 'point',
            label: label.trim(),
            description: description.trim()
          })
        } else {
          currentSubsection.content.push({
            type: 'bullet',
            text: content
          })
        }
        
      } else if (trimmed.match(/预估字数：(\d+)字/)) {
        // 提取字数估算
        const wordCount = parseInt(trimmed.match(/预估字数：(\d+)字/)?.[1] || '0')
        if (currentSubsection) {
          currentSubsection.estimatedWords = wordCount
        } else if (currentSection) {
          currentSection.estimatedWords = wordCount
        }
      }
    }
    
    return {
      title: this.extractMainTitle(text),
      sections,
      totalEstimatedWords: sections.reduce((sum, section) => 
        sum + section.estimatedWords + 
        section.subsections.reduce((subSum, sub) => subSum + sub.estimatedWords, 0), 0
      ),
      structure: this.analyzeOutlineStructure(sections)
    }
  }
}
```

### ContentRewriter 工具

```typescript
// src/tools/writing/content-rewriter.ts 
export class ContentRewriterTool implements WritingTool {
  name = "rewrite_content"
  description = "智能改写和优化文章内容"
  securityLevel = "ai-powered"
  
  async execute(input: ContentRewriterInput): Promise<ToolResult> {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    
    // 分析原文特征
    const originalStats = this.analyzeContent(input.originalContent)
    
    // 构建改写提示
    const prompt = this.buildRewritePrompt(input, originalStats)
    
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: Math.max(4000, input.originalContent.length * 1.2),
      temperature: input.creativity || 0.7,
      messages: [{
        role: "user",
        content: prompt
      }]
    })
    
    const rewrittenContent = response.content[0].text
    
    // 分析改写结果
    const rewrittenStats = this.analyzeContent(rewrittenContent)
    const qualityMetrics = this.assessRewriteQuality(
      input.originalContent, 
      rewrittenContent, 
      input.targetStyle
    )
    
    return {
      success: true,
      data: {
        originalContent: input.originalContent,
        rewrittenContent,
        changes: this.generateChangeReport(input.originalContent, rewrittenContent),
        statistics: {
          original: originalStats,
          rewritten: rewrittenStats
        },
        quality: qualityMetrics,
        suggestions: this.generateImprovementSuggestions(rewrittenContent)
      }
    }
  }

  private buildRewritePrompt(input: ContentRewriterInput, stats: ContentStats): string {
    const styleGuides = {
      "通俗": "使用简单词汇，避免专业术语，多用生活化比喻，语言亲切自然",
      "正式": "用词规范严谨，句式完整，逻辑结构清晰，避免口语化表达",  
      "技术": "使用准确的技术术语，逻辑严密，提供充分的技术细节和实例",
      "学术": "遵循学术写作规范，用词精确，论证严密，引用规范",
      "营销": "具有说服力，突出价值和益处，使用有力的词汇，引导行动",
      "故事": "采用叙事手法，情节生动，场景描述丰富，具有代入感"
    }

    const targetGuide = styleGuides[input.targetStyle] || input.targetStyle

    return `请将以下内容改写为"${input.targetStyle}"风格：

🎯 目标风格说明：${targetGuide}

📊 原文分析：
- 字数：${stats.wordCount}字
- 段落：${stats.paragraphCount}个
- 专业术语：${stats.technicalTerms}个
- 可读性等级：${stats.readabilityLevel}

📝 原文内容：
${input.originalContent}

🔄 改写要求：
1. **风格转换**：严格按照"${input.targetStyle}"风格特点进行改写
2. **信息保持**：保留所有核心信息和观点，不能遗漏重要内容
3. **逻辑优化**：优化段落结构和逻辑流程，提高可读性
4. **长度控制**：${input.targetLength ? `控制在${input.targetLength}字左右` : '保持与原文相近的长度'}
5. **质量提升**：改进表达方式，消除冗余，增强表现力

${input.preserveStructure ? '📋 **结构保持**：保持原文的章节结构和标题层级' : ''}
${input.audienceLevel ? `👥 **读者水平**：针对${input.audienceLevel}水平的读者` : ''}

请提供完整的改写结果，确保符合目标风格要求。`
  }

  private assessRewriteQuality(
    original: string, 
    rewritten: string, 
    targetStyle: string
  ): QualityMetrics {
    return {
      styleConsistency: this.calculateStyleConsistency(rewritten, targetStyle),
      readabilityImprovement: this.calculateReadabilityImprovement(original, rewritten),
      informationRetention: this.calculateInformationRetention(original, rewritten),
      languageQuality: this.assessLanguageQuality(rewritten),
      overallScore: 0 // 将根据上述指标计算
    }
  }
}
```

## 🔍 研究工具系统

### WebSearch 工具（复刻 WebSearch）

```typescript
// src/tools/research/web-search.ts
export class WebSearchTool implements WritingTool {
  name = "web_search"
  description = "网络搜索相关主题资料"
  securityLevel = "network"
  
  private searchEngines = {
    google: new GoogleSearchEngine(),
    bing: new BingSearchEngine(),
    baidu: new BaiduSearchEngine()
  }
  
  async execute(input: WebSearchInput): Promise<ToolResult> {
    const engine = this.searchEngines[input.engine || 'google']
    if (!engine) {
      throw new Error(`不支持的搜索引擎: ${input.engine}`)
    }
    
    try {
      const results = await engine.search({
        query: input.query,
        limit: input.limit || 10,
        language: input.language || 'zh',
        region: input.region,
        timeRange: input.timeRange
      })
      
      // 过滤和排序结果
      const filteredResults = this.filterSearchResults(results, input.filters)
      const rankedResults = this.rankByRelevance(filteredResults, input.query)
      
      // 提取关键信息
      const insights = this.extractSearchInsights(rankedResults)
      
      return {
        success: true,
        data: {
          query: input.query,
          engine: input.engine || 'google',
          results: rankedResults,
          insights,
          metadata: {
            totalResults: results.total,
            searchTime: results.duration,
            language: input.language || 'zh'
          }
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: `搜索失败: ${error.message}`
      }
    }
  }

  private extractSearchInsights(results: SearchResult[]): SearchInsights {
    const domains = new Map<string, number>()
    const publishTimes: Date[] = []
    const topics = new Set<string>()
    
    for (const result of results) {
      // 统计域名分布
      const domain = new URL(result.url).hostname
      domains.set(domain, (domains.get(domain) || 0) + 1)
      
      // 收集发布时间
      if (result.publishTime) {
        publishTimes.push(new Date(result.publishTime))
      }
      
      // 提取主题词
      const resultTopics = this.extractTopics(result.title + ' ' + result.description)
      resultTopics.forEach(topic => topics.add(topic))
    }
    
    return {
      topDomains: Array.from(domains.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([domain, count]) => ({ domain, count })),
      timeDistribution: this.analyzeTimeDistribution(publishTimes),
      relatedTopics: Array.from(topics).slice(0, 10),
      sourceQuality: this.assessSourceQuality(results)
    }
  }
}
```

### FactChecker 工具

```typescript
// src/tools/research/fact-checker.ts
export class FactCheckerTool implements WritingTool {
  name = "fact_checker" 
  description = "事实核查和信息验证"
  securityLevel = "ai-powered"
  
  async execute(input: FactCheckerInput): Promise<ToolResult> {
    const statements = this.extractStatements(input.content)
    const factChecks: FactCheckResult[] = []
    
    // 并发检查多个陈述
    const checkPromises = statements.map(async (statement, index) => {
      const result = await this.checkSingleStatement(statement, input.sources)
      return { index, result }
    })
    
    const results = await Promise.allSettled(checkPromises)
    
    for (const promiseResult of results) {
      if (promiseResult.status === 'fulfilled') {
        const { index, result } = promiseResult.value
        factChecks[index] = result
      } else {
        factChecks.push({
          statement: statements[factChecks.length] || '未知陈述',
          confidence: 0,
          status: 'error',
          error: promiseResult.reason.message
        })
      }
    }
    
    // 生成总体报告
    const overallAssessment = this.generateOverallAssessment(factChecks)
    
    return {
      success: true,
      data: {
        originalContent: input.content,
        factChecks,
        overallAssessment,
        recommendations: this.generateRecommendations(factChecks),
        checkedAt: new Date().toISOString()
      }
    }
  }

  private async checkSingleStatement(
    statement: string, 
    sources?: string[]
  ): Promise<FactCheckResult> {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    
    const prompt = `请对以下陈述进行事实核查：

陈述：${statement}

请提供：
1. 事实性评估（正确/部分正确/错误/无法验证）
2. 置信度（0-1之间的数值）
3. 支持或反驳的证据
4. 权威信息来源
5. 修正建议（如有必要）

${sources ? `\n参考来源：\n${sources.join('\n')}` : ''}

请以JSON格式返回结果。`

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
    
    try {
      const result = JSON.parse(response.content[0].text)
      return {
        statement,
        confidence: result.confidence,
        status: result.status,
        evidence: result.evidence,
        sources: result.sources,
        correction: result.correction
      }
    } catch (error) {
      return {
        statement,
        confidence: 0.5,
        status: 'unknown',
        error: '解析AI响应失败'
      }
    }
  }
}
```

## 📤 发布工具系统

### WeChatConverter 工具

```typescript
// src/tools/publish/wechat-converter.ts
export class WeChatConverterTool implements WritingTool {
  name = "convert_wechat"
  description = "转换为微信公众号格式"
  securityLevel = "format-conversion"
  
  async execute(input: WeChatConverterInput): Promise<ToolResult> {
    try {
      // 解析 Markdown 内容
      const parsed = this.parseMarkdown(input.markdown)
      
      // 应用微信样式
      const styled = this.applyWeChatStyling(parsed, input.theme || 'default')
      
      // 生成 HTML
      const html = this.generateWeChatHTML(styled)
      
      // 优化图片
      const optimizedImages = await this.optimizeImagesForWeChat(styled.images)
      
      return {
        success: true,
        data: {
          html,
          css: this.generateWeChatCSS(input.theme),
          images: optimizedImages,
          preview: input.generatePreview ? await this.generatePreview(html) : null,
          metadata: {
            theme: input.theme || 'default',
            wordCount: this.countWords(input.markdown),
            convertedAt: new Date().toISOString()
          }
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: `微信格式转换失败: ${error.message}`
      }
    }
  }

  private applyWeChatStyling(content: ParsedContent, theme: string): StyledContent {
    const themes = {
      'default': {
        primaryColor: '#1AAD19',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
        fontSize: '16px',
        lineHeight: '1.6'
      },
      'tech': {
        primaryColor: '#2196F3', 
        fontFamily: 'Monaco, "Cascadia Code", monospace',
        fontSize: '15px',
        lineHeight: '1.7'
      },
      'minimal': {
        primaryColor: '#333',
        fontFamily: 'system-ui, sans-serif', 
        fontSize: '16px',
        lineHeight: '1.8'
      }
    }
    
    const themeConfig = themes[theme] || themes.default
    
    return {
      ...content,
      style: themeConfig,
      headings: content.headings.map(h => ({
        ...h,
        style: this.getHeadingStyle(h.level, themeConfig)
      })),
      paragraphs: content.paragraphs.map(p => ({
        ...p,
        style: this.getParagraphStyle(themeConfig)
      })),
      codeBlocks: content.codeBlocks.map(cb => ({
        ...cb,
        style: this.getCodeBlockStyle(themeConfig)
      }))
    }
  }
}
```

---

*所有工具完全基于 Claude Code 的 MH1 工具引擎架构，确保架构一致性*