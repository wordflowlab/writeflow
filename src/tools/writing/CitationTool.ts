import { z } from 'zod'
import { EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult, ToolConfig } from '../../types/tool.js'

// 引文数据结构
interface Citation {
  id: string
  type: 'article' | 'book' | 'website' | 'conference' | 'thesis'
  title: string
  authors: string[]
  year?: number
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  publisher?: string
  url?: string
  doi?: string
  isbn?: string
  accessDate?: string
  notes?: string
}

// 搜索结果结构（用于从搜索结果生成引文）
interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  publishDate?: string
  author?: string
  domain: string
}

// 输入参数架构
const CitationToolInputSchema = z.object({
  action: z.enum(['add', 'remove', 'list', 'format', 'generate', 'import']).describe('操作类型'),
  citation: z.object({
    type: z.enum(['article', 'book', 'website', 'conference', 'thesis']),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number().optional(),
    journal: z.string().optional(),
    volume: z.string().optional(),
    issue: z.string().optional(),
    pages: z.string().optional(),
    publisher: z.string().optional(),
    url: z.string().optional(),
    doi: z.string().optional(),
    isbn: z.string().optional(),
    accessDate: z.string().optional(),
    notes: z.string().optional()
  }).optional().describe('引文信息'),
  citationId: z.string().optional().describe('引文ID'),
  searchResult: z.object({
    title: z.string(),
    url: z.string(),
    snippet: z.string(),
    source: z.string(),
    publishDate: z.string().optional(),
    author: z.string().optional(),
    domain: z.string()
  }).optional().describe('搜索结果（用于生成引文）'),
  format: z.enum(['apa', 'mla', 'chicago', 'ieee', 'gb7714']).optional().default('apa').describe('引文格式'),
  content: z.string().optional().describe('内容（用于导入引文）')
})

type CitationToolInput = z.infer<typeof CitationToolInputSchema>

/**
 * CitationTool - 引文和参考文献管理工具
 * 为学术写作提供专业的引文管理功能
 */
export class CitationTool implements EnhancedWritingTool {
  name = 'Citation'
  description = '引文和参考文献管理工具。支持添加、编辑、格式化引文，生成参考文献列表，支持多种学术引文格式。'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'
  
  config: ToolConfig = {
    readOnly: false,
    concurrencySafe: true,
    requiresPermission: false,
    timeout: 10000,
    category: 'writing'
  }

  private citations = new Map<string, Citation>()

  /**
   * 主要执行方法
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { action, citation, citationId, searchResult, format, content } = this.validateAndParseInput(input)
      
      switch (action) {
        case 'add':
          return await this.addCitation(citation, searchResult)
        case 'remove':
          return this.removeCitation(citationId!)
        case 'list':
          return this.listCitations(format!)
        case 'format':
          return this.formatCitation(citationId!, format!)
        case 'generate':
          return this.generateBibliography(format!)
        case 'import':
          return await this.importFromContent(content!)
        default:
          throw new Error(`不支持的操作: ${action}`)
      }

    } catch (_error) {
      return {
        success: false,
        error: `引文管理操作失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 获取专用提示词
   */
  async getPrompt(options?: { safeMode?: boolean }): Promise<string> {
    return `引文管理工具用于学术和专业写作中的参考文献管理：

主要功能：
- 添加和管理引文记录
- 支持多种文献类型（期刊文章、书籍、网站等）
- 多种引文格式（APA、MLA、Chicago、IEEE、GB7714）
- 从搜索结果自动生成引文
- 生成完整的参考文献列表

使用示例：
1. 添加引文: { "action": "add", "citation": {...} }
2. 列出引文: { "action": "list", "format": "apa" }
3. 生成参考文献: { "action": "generate", "format": "apa" }
4. 从搜索结果添加: { "action": "add", "searchResult": {...} }

支持的引文格式：
- APA: 美国心理学会格式
- MLA: 现代语言协会格式  
- Chicago: 芝加哥格式
- IEEE: 电气电子工程师学会格式
- GB7714: 中国国家标准格式`
  }

  /**
   * 权限验证
   */
  async validatePermission(input: ToolInput, context?: ToolContext): Promise<PermissionResult> {
    return {
      granted: true,
      reason: '引文管理是安全的写作辅助功能'
    }
  }

  /**
   * 结果渲染
   */
  renderResult(result: ToolResult): string {
    if (result.metadata?.citations) {
      const citations = result.metadata.citations as Citation[]
      return `管理了 ${citations.length} 个引文记录`
    }
    return result.content || '引文操作完成'
  }

  /**
   * 输入验证
   */
  async validateInput(input: ToolInput): Promise<boolean> {
    try {
      CitationToolInputSchema.parse(input)
      return true
    } catch {
      return false
    }
  }

  /**
   * 验证并解析输入
   */
  private validateAndParseInput(input: ToolInput): CitationToolInput {
    return CitationToolInputSchema.parse(input)
  }

  /**
   * 添加引文
   */
  private async addCitation(citation?: any, searchResult?: SearchResult): Promise<ToolResult> {
    let newCitation: Citation

    if (citation) {
      // 直接添加引文
      newCitation = {
        id: this.generateId(),
        ...citation
      }
    } else if (searchResult) {
      // 从搜索结果生成引文
      newCitation = this.searchResultToCitation(searchResult)
    } else {
      return {
        success: false,
        error: '必须提供引文信息或搜索结果'
      }
    }

    this.citations.set(newCitation.id, newCitation)

    return {
      success: true,
      content: `✅ 成功添加引文: ${newCitation.title}`,
      metadata: {
        citationId: newCitation.id,
        citation: newCitation
      }
    }
  }

  /**
   * 移除引文
   */
  private removeCitation(citationId: string): ToolResult {
    const citation = this.citations.get(citationId)
    if (!citation) {
      return {
        success: false,
        error: `未找到引文: ${citationId}`
      }
    }

    this.citations.delete(citationId)
    
    return {
      success: true,
      content: `✅ 成功移除引文: ${citation.title}`
    }
  }

  /**
   * 列出所有引文
   */
  private listCitations(format: string): ToolResult {
    const citations = Array.from(this.citations.values())
    
    if (citations.length === 0) {
      return {
        success: true,
        content: '📚 当前没有保存的引文记录'
      }
    }

    let content = `📚 引文列表 (共 ${citations.length} 条)\n\n`
    
    citations.forEach((citation, index) => {
      content += `**${index + 1}.** ${citation.title}\n`
      content += `   作者: ${citation.authors.join(', ')}\n`
      content += `   类型: ${this.getTypeDisplayName(citation.type)}\n`
      content += `   ID: ${citation.id}\n\n`
    })

    return {
      success: true,
      content,
      metadata: {
        citations,
        totalCount: citations.length
      }
    }
  }

  /**
   * 格式化单个引文
   */
  private formatCitation(citationId: string, format: string): ToolResult {
    const citation = this.citations.get(citationId)
    if (!citation) {
      return {
        success: false,
        error: `未找到引文: ${citationId}`
      }
    }

    const formattedCitation = this.formatCitationByStyle(citation, format)

    return {
      success: true,
      content: `📝 ${format.toUpperCase()} 格式引文:\n\n${formattedCitation}`,
      metadata: {
        citationId,
        format,
        formattedCitation
      }
    }
  }

  /**
   * 生成参考文献列表
   */
  private generateBibliography(format: string): ToolResult {
    const citations = Array.from(this.citations.values())
    
    if (citations.length === 0) {
      return {
        success: true,
        content: '📚 当前没有引文记录，无法生成参考文献列表'
      }
    }

    // 按作者姓氏排序
    const sortedCitations = citations.sort((a, b) => {
      const aAuthor = a.authors[0]?.split(' ').pop() || ''
      const bAuthor = b.authors[0]?.split(' ').pop() || ''
      return aAuthor.localeCompare(bAuthor)
    })

    let bibliography = `# 参考文献 (${format.toUpperCase()} 格式)\n\n`
    
    sortedCitations.forEach(citation => {
      bibliography += this.formatCitationByStyle(citation, format) + '\n\n'
    })

    return {
      success: true,
      content: bibliography,
      metadata: {
        format,
        citationCount: citations.length,
        bibliography
      }
    }
  }

  /**
   * 从内容导入引文
   */
  private async importFromContent(content: string): Promise<ToolResult> {
    // 简化的引文解析实现
    // 实际应用中可以实现更复杂的解析逻辑
    
    const lines = content.split('\n').filter(line => line.trim())
    let importedCount = 0
    
    for (const line of lines) {
      try {
        // 尝试解析为简单的引文格式
        const citation = this.parseSimpleCitation(line)
        if (citation) {
          this.citations.set(citation.id, citation)
          importedCount++
        }
      } catch (_error) {
        // 跳过无法解析的行
        continue
      }
    }

    return {
      success: true,
      content: `✅ 成功导入 ${importedCount} 个引文记录`,
      metadata: {
        importedCount,
        totalLines: lines.length
      }
    }
  }

  /**
   * 从搜索结果生成引文
   */
  private searchResultToCitation(searchResult: SearchResult): Citation {
    return {
      id: this.generateId(),
      type: 'website',
      title: searchResult.title,
      authors: searchResult.author ? [searchResult.author] : ['Unknown'],
      url: searchResult.url,
      accessDate: new Date().toISOString().split('T')[0],
      notes: searchResult.snippet,
      year: searchResult.publishDate ? new Date(searchResult.publishDate).getFullYear() : undefined
    }
  }

  /**
   * 按格式格式化引文
   */
  private formatCitationByStyle(citation: Citation, format: string): string {
    switch (format.toLowerCase()) {
      case 'apa':
        return this.formatAPA(citation)
      case 'mla':
        return this.formatMLA(citation)
      case 'chicago':
        return this.formatChicago(citation)
      case 'ieee':
        return this.formatIEEE(citation)
      case 'gb7714':
        return this.formatGB7714(citation)
      default:
        return this.formatAPA(citation)
    }
  }

  /**
   * APA 格式
   */
  private formatAPA(citation: Citation): string {
    let result = ''
    const authors = citation.authors.join(', ')
    const year = citation.year ? `(${citation.year})` : '(n.d.)'
    
    result += `${authors} ${year}. ${citation.title}`
    
    if (citation.journal) {
      result += `. *${citation.journal}*`
      if (citation.volume) result += `, ${citation.volume}`
      if (citation.issue) result += `(${citation.issue})`
      if (citation.pages) result += `, ${citation.pages}`
    }
    
    if (citation.url) {
      result += `. Retrieved from ${citation.url}`
    }
    
    return result + '.'
  }

  /**
   * MLA 格式
   */
  private formatMLA(citation: Citation): string {
    let result = ''
    const authors = citation.authors.join(', ')
    
    result += `${authors}. "${citation.title}"`
    
    if (citation.journal) {
      result += `. *${citation.journal}*`
      if (citation.volume) result += `, vol. ${citation.volume}`
      if (citation.issue) result += `, no. ${citation.issue}`
      if (citation.year) result += `, ${citation.year}`
      if (citation.pages) result += `, pp. ${citation.pages}`
    }
    
    if (citation.url) {
      result += `. Web. ${citation.accessDate || new Date().toISOString().split('T')[0]}`
    }
    
    return result + '.'
  }

  /**
   * Chicago 格式
   */
  private formatChicago(citation: Citation): string {
    // 简化的 Chicago 格式实现
    return this.formatAPA(citation)
  }

  /**
   * IEEE 格式
   */
  private formatIEEE(citation: Citation): string {
    let result = ''
    const authors = citation.authors.map(author => {
      const parts = author.split(' ')
      if (parts.length >= 2) {
        return `${parts[parts.length - 1]}, ${parts[0][0]}.`
      }
      return author
    }).join(', ')
    
    result += `${authors}, "${citation.title}"`
    
    if (citation.journal) {
      result += `, *${citation.journal}*`
      if (citation.volume) result += `, vol. ${citation.volume}`
      if (citation.issue) result += `, no. ${citation.issue}`
      if (citation.pages) result += `, pp. ${citation.pages}`
      if (citation.year) result += `, ${citation.year}`
    }
    
    return result + '.'
  }

  /**
   * GB7714 格式（中文）
   */
  private formatGB7714(citation: Citation): string {
    let result = ''
    const authors = citation.authors.join(', ')
    
    result += `${authors}. ${citation.title}`
    
    if (citation.journal) {
      result += `[J]. ${citation.journal}`
      if (citation.year) result += `, ${citation.year}`
      if (citation.volume) result += `, ${citation.volume}`
      if (citation.issue) result += `(${citation.issue})`
      if (citation.pages) result += `: ${citation.pages}`
    }
    
    return result + '.'
  }

  /**
   * 获取类型显示名称
   */
  private getTypeDisplayName(type: string): string {
    const typeNames = {
      article: '期刊文章',
      book: '书籍',
      website: '网站',
      conference: '会议论文',
      thesis: '学位论文'
    }
    return typeNames[type as keyof typeof typeNames] || type
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `citation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 解析简单引文格式
   */
  private parseSimpleCitation(line: string): Citation | null {
    // 非常简化的解析实现
    // 实际应用中需要更复杂的解析逻辑
    
    if (line.includes('http')) {
      return {
        id: this.generateId(),
        type: 'website',
        title: line.split('.')[0] || 'Unknown Title',
        authors: ['Unknown'],
        url: line.match(/https?:\/\/[^\s]+/)?.[0],
        accessDate: new Date().toISOString().split('T')[0]
      }
    }
    
    return null
  }
}