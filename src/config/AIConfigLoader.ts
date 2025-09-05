import { promises as fs } from 'fs'
import path from 'path'

/**
 * AI 配置接口
 */
export interface AIProjectConfig {
  todoListEnabled: boolean
  systemRemindersEnabled: boolean
  autoSuggestions: boolean
  writingGuidelines: string
  customPrompts?: Record<string, string>
  toolPreferences?: {
    preferredModels?: string[]
    maxTokens?: number
    temperature?: number
  }
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AIProjectConfig = {
  todoListEnabled: true,
  systemRemindersEnabled: true,
  autoSuggestions: true,
  writingGuidelines: '遵循 WriteFlow 写作助手的最佳实践',
  customPrompts: {},
  toolPreferences: {
    preferredModels: ['claude-3-opus', 'gpt-4'],
    maxTokens: 4096,
    temperature: 0.7,
  },
}

/**
 * AI 配置加载器
 * 负责加载项目的 AI 配置和指导文档
 */
export class AIConfigLoader {
  private configCache = new Map<string, AIProjectConfig>()
  private guideCache = new Map<string, string>()

  /**
   * 加载项目 AI 指导文档
   * 按优先级顺序查找：WRITEFLOW.md, AI_GUIDE.md, .writeflow/instructions.md
   */
  async loadProjectGuide(projectRoot?: string): Promise<string> {
    const root = projectRoot || process.cwd()
    const cacheKey = `guide:${root}`

    // 检查缓存
    if (this.guideCache.has(cacheKey)) {
      return this.guideCache.get(cacheKey)!
    }

    // 配置文件优先级列表
    const configFiles = [
      'WRITEFLOW.md',
      'AI_GUIDE.md',
      '.writeflow/instructions.md',
      '.ai/guide.md',
    ]

    for (const fileName of configFiles) {
      const filePath = path.join(root, fileName)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        if (content.trim()) {
          this.guideCache.set(cacheKey, content)
          return content
        }
      } catch (error) {
        // 文件不存在或无法读取，继续尝试下一个
        continue
      }
    }

    // 如果没有找到任何配置文件，返回默认指导
    const defaultGuide = this.getDefaultGuide()
    this.guideCache.set(cacheKey, defaultGuide)
    return defaultGuide
  }

  /**
   * 加载项目配置
   */
  async loadProjectConfig(projectRoot?: string): Promise<AIProjectConfig> {
    const root = projectRoot || process.cwd()
    const cacheKey = `config:${root}`

    // 检查缓存
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!
    }

    // 配置文件路径
    const configFiles = [
      '.writeflow.json',
      '.writeflow/config.json',
      'writeflow.config.json',
    ]

    for (const fileName of configFiles) {
      const filePath = path.join(root, fileName)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const userConfig = JSON.parse(content) as Partial<AIProjectConfig>
        
        // 合并用户配置和默认配置
        const config = { ...DEFAULT_CONFIG, ...userConfig }
        this.configCache.set(cacheKey, config)
        return config
      } catch (error) {
        // 文件不存在或解析错误，继续尝试下一个
        continue
      }
    }

    // 没有找到配置文件，使用默认配置
    this.configCache.set(cacheKey, DEFAULT_CONFIG)
    return DEFAULT_CONFIG
  }

  /**
   * 检查文件是否存在
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
   * 获取默认 AI 指导文档
   */
  private getDefaultGuide(): string {
    return `# WriteFlow AI 助手指导

## 写作任务管理

### 何时使用 TodoList
- 复杂多步骤写作任务（3个以上步骤）
- 用户提供多个写作任务
- 需要规划复杂写作流程的项目
- 用户明确要求使用任务列表

### 任务状态管理
1. **单一活跃原则**：同时只能有一个 in_progress 任务
2. **双重描述**：
   - content: 命令式描述（如"撰写技术分析"）
   - activeForm: 进行时描述（如"正在撰写技术分析"）
3. **即时更新**：完成任务后立即标记为 completed
4. **阻塞处理**：遇到阻塞时保持 in_progress，创建新的子任务

### 工具使用（工具优先 + 输出契约）
- 当用户提出“计划/清单/待办/任务/安排/进度”等需求，优先调用工具：
  - todo_write: 更新任务列表（增删改、状态切换）
  - todo_read: 查看当前任务状态
- 仅允许两种输出模式（二选一）：
  1) 纯文本内容（无任何工具标签）
  2) 工具调用（不要混入解释文本）
- Function calling（OpenAI/DeepSeek 兼容）: 严格使用工具名和 JSON 参数
- 传统回退格式（不支持 function calling 的提供商使用）：
  <function_calls>
    <invoke name="TodoWrite">
      <parameter name="todos">[{"id":"1","content":"写开篇","activeForm":"正在写开篇","status":"in_progress"}]</parameter>
    </invoke>
  </function_calls>

### 写作场景示例

#### 技术文章创作
1. 研究主题背景和最新发展
2. 设计文章结构和大纲
3. 撰写核心技术内容
4. 添加实例和案例分析
5. 全文校对和优化

#### 商业文案创作
1. 分析目标受众和需求
2. 提炼核心卖点和价值
3. 创作引人入胜的开头
4. 撰写具有说服力的正文
5. 设计有效的行动号召

### 质量标准
- 内容准确性和专业性
- 逻辑清晰和结构完整
- 语言流畅和表达精准
- 符合目标受众的阅读习惯

## 流式与思维链（thinking）
- 采用流式输出策略：先回“确认/简述”一行，随后持续输出内容或发起工具调用
- 若需要展示思考过程，请使用 <thinking>…</thinking> 包裹，正文中不保留该片段

## MCP 资源（可选）
- 如果配置了 mcpServers，可将 MCP 作为外部知识源（检索/文件/搜索）
- 当需要外部事实或项目上下文时，优先提示使用 MCP 端点（例如：知识检索、读取工作区文件）

遵循这些指导原则，WriteFlow 将为您提供专业的写作协助！`
  }

  /**
   * 保存项目配置
   */
  async saveProjectConfig(config: Partial<AIProjectConfig>, projectRoot?: string): Promise<void> {
    const root = projectRoot || process.cwd()
    const configPath = path.join(root, '.writeflow.json')
    
    try {
      // 读取现有配置
      let existingConfig = DEFAULT_CONFIG
      if (await this.fileExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8')
        existingConfig = JSON.parse(content)
      }

      // 合并配置
      const mergedConfig = { ...existingConfig, ...config }

      // 写入配置文件
      await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8')

      // 更新缓存
      const cacheKey = `config:${root}`
      this.configCache.set(cacheKey, mergedConfig)

    } catch (error) {
      console.error('保存配置失败:', error)
      throw new Error(`配置保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 清除缓存
   */
  clearCache(projectRoot?: string): void {
    const root = projectRoot || process.cwd()
    this.configCache.delete(`config:${root}`)
    this.guideCache.delete(`guide:${root}`)
  }

  /**
   * 获取完整的 AI 系统配置
   * 包括配置文件和指导文档
   */
  async loadFullConfig(projectRoot?: string): Promise<{
    config: AIProjectConfig
    guide: string
    projectRoot: string
  }> {
    const root = projectRoot || process.cwd()

    const [config, guide] = await Promise.all([
      this.loadProjectConfig(root),
      this.loadProjectGuide(root),
    ])

    return {
      config,
      guide,
      projectRoot: root,
    }
  }

  /**
   * 验证配置文件格式
   */
  validateConfig(config: any): config is AIProjectConfig {
    return (
      typeof config === 'object' &&
      typeof config.todoListEnabled === 'boolean' &&
      typeof config.systemRemindersEnabled === 'boolean' &&
      typeof config.autoSuggestions === 'boolean' &&
      typeof config.writingGuidelines === 'string'
    )
  }

  /**
   * 获取配置模板
   */
  getConfigTemplate(): AIProjectConfig {
    return { ...DEFAULT_CONFIG }
  }

  /**
   * 初始化项目配置
   * 在项目根目录创建默认配置文件
   */
  async initializeProject(projectRoot?: string): Promise<void> {
    const root = projectRoot || process.cwd()
    
    // 检查是否已存在配置
    const configPath = path.join(root, '.writeflow.json')
    if (await this.fileExists(configPath)) {
      console.log('WriteFlow 配置文件已存在')
      return
    }

    // 创建默认配置
    await this.saveProjectConfig(DEFAULT_CONFIG, root)

    // 创建指导文档（如果不存在）
    const guidePath = path.join(root, 'WRITEFLOW.md')
    if (!(await this.fileExists(guidePath))) {
      await fs.writeFile(guidePath, this.getDefaultGuide(), 'utf-8')
    }

    console.log('WriteFlow 项目配置已初始化')
  }
}

// 导出单例实例
export const aiConfigLoader = new AIConfigLoader()

// 导出便捷函数
export const loadProjectGuide = (projectRoot?: string) => 
  aiConfigLoader.loadProjectGuide(projectRoot)

export const loadProjectConfig = (projectRoot?: string) =>
  aiConfigLoader.loadProjectConfig(projectRoot)

export const loadFullConfig = (projectRoot?: string) =>
  aiConfigLoader.loadFullConfig(projectRoot)

export const saveProjectConfig = (config: Partial<AIProjectConfig>, projectRoot?: string) =>
  aiConfigLoader.saveProjectConfig(config, projectRoot)

export const initializeWriteFlowProject = (projectRoot?: string) =>
  aiConfigLoader.initializeProject(projectRoot)
