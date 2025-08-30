import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { Citation, SearchResult } from '../../types/research.js'

/**
 * CitationManager 工具
 * 引用和参考文献管理
 */
export class CitationManagerTool implements WritingTool {
  name = 'citation_manager'
  description = '管理引用和参考文献'
  securityLevel = 'safe' as const

  private citations = new Map<string, Citation>()

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        action,
        citation,
        citationId,
        searchResult,
        format = 'apa',
        content
      } = input as {
        action: 'add' | 'remove' | 'list' | 'format' | 'generate' | 'import'
        citation?: Citation
        citationId?: string
        searchResult?: SearchResult
        format?: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gb7714'
        content?: string
      }

      switch (action) {
        case 'add':
          return await this.addCitation(citation, searchResult)
          
        case 'remove':
          return this.removeCitation(citationId!)
          
        case 'list':
          return this.listCitations(format)
          
        case 'format':
          return this.formatCitation(citationId!, format)
          
        case 'generate':
          return this.generateBibliography(format)
          
        case 'import':
          return await this.importFromContent(content!)
          
        default:
          return {
            success: false,
            error: `不支持的操作: ${action}`
          }
      }

    } catch (error) {
      return {
        success: false,
        error: `引用管理失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 添加引用
   */
  private async addCitation(citation?: Citation, searchResult?: SearchResult): Promise<ToolResult> {
    let newCitation: Citation

    if (citation) {
      newCitation = citation
    } else if (searchResult) {
      newCitation = this.convertSearchResultToCitation(searchResult)
    } else {
      return {
        success: false,
        error: '必须提供引用信息或搜索结果'
      }
    }

    // 生成唯一ID
    if (!newCitation.id) {
      newCitation.id = this.generateCitationId(newCitation)
    }

    this.citations.set(newCitation.id, newCitation)

    return {
      success: true,
      content: `引用已添加: ${newCitation.title}`,
      metadata: {
        citationId: newCitation.id,
        citation: newCitation
      }
    }
  }

  /**
   * 移除引用
   */
  private removeCitation(citationId: string): ToolResult {
    if (!this.citations.has(citationId)) {
      return {
        success: false,
        error: `引用不存在: ${citationId}`
      }
    }

    const citation = this.citations.get(citationId)!
    this.citations.delete(citationId)

    return {
      success: true,
      content: `引用已移除: ${citation.title}`,
      metadata: { removedCitationId: citationId }
    }
  }

  /**
   * 列出所有引用
   */
  private listCitations(format: string): ToolResult {
    const citations = Array.from(this.citations.values())
    
    if (citations.length === 0) {
      return {
        success: true,
        content: '当前没有引用。',
        metadata: { citations: [] }
      }
    }

    let output = `# 引用列表 (${format.toUpperCase()}格式)\n\n`
    
    citations.forEach((citation, index) => {
      const formatted = this.formatCitationInStyle(citation, format)
      output += `${index + 1}. ${formatted}\n\n`
    })

    return {
      success: true,
      content: output,
      metadata: {
        citations,
        count: citations.length,
        format
      }
    }
  }

  /**
   * 格式化单个引用
   */
  private formatCitation(citationId: string, format: string): ToolResult {
    const citation = this.citations.get(citationId)
    
    if (!citation) {
      return {
        success: false,
        error: `引用不存在: ${citationId}`
      }
    }

    const formatted = this.formatCitationInStyle(citation, format)

    return {
      success: true,
      content: formatted,
      metadata: {
        citationId,
        citation,
        format,
        formatted
      }
    }
  }

  /**
   * 生成参考文献
   */
  private generateBibliography(format: string): ToolResult {
    const citations = Array.from(this.citations.values())
    
    if (citations.length === 0) {
      return {
        success: true,
        content: '# 参考文献\n\n暂无引用。',
        metadata: { citations: [] }
      }
    }

    // 按作者姓氏和年份排序
    const sorted = citations.sort((a, b) => {
      const authorA = a.authors[0] || ''
      const authorB = b.authors[0] || ''
      return authorA.localeCompare(authorB) || a.date.localeCompare(b.date)
    })

    let bibliography = `# 参考文献\n\n`

    sorted.forEach((citation, index) => {
      const formatted = this.formatCitationInStyle(citation, format)
      bibliography += `[${index + 1}] ${formatted}\n\n`
    })

    return {
      success: true,
      content: bibliography,
      metadata: {
        citations: sorted,
        count: sorted.length,
        format
      }
    }
  }

  /**
   * 从内容中导入引用
   */
  private async importFromContent(content: string): Promise<ToolResult> {
    // 简化的引用提取
    const urlPattern = /https?:\/\/[^\s\)]+/g
    const urls = content.match(urlPattern) || []
    
    const imported: Citation[] = []
    
    for (const url of urls) {
      try {
        const citation = await this.extractCitationFromUrl(url)
        if (citation) {
          this.citations.set(citation.id, citation)
          imported.push(citation)
        }
      } catch (error) {
        console.warn(`提取引用失败: ${url}`, error)
      }
    }

    return {
      success: true,
      content: `从内容中导入了 ${imported.length} 个引用`,
      metadata: {
        importedCount: imported.length,
        citations: imported
      }
    }
  }

  /**
   * 转换搜索结果为引用
   */
  private convertSearchResultToCitation(result: SearchResult): Citation {
    const authors = result.author ? [result.author] : []
    const date = result.publishDate || new Date().toISOString().split('T')[0]

    return {
      id: this.generateCitationId({
        title: result.title,
        authors,
        date,
        url: result.url
      } as Citation),
      type: this.detectCitationType(result.url),
      title: result.title,
      authors,
      publication: result.source,
      date,
      url: result.url,
      abstract: result.snippet
    }
  }

  /**
   * 检测引用类型
   */
  private detectCitationType(url: string): Citation['type'] {
    if (url.includes('scholar.google') || url.includes('arxiv.org')) {
      return 'paper'
    }
    if (url.includes('github.com')) {
      return 'website'
    }
    if (url.includes('medium.com') || url.includes('blog')) {
      return 'article'
    }
    return 'website'
  }

  /**
   * 生成引用ID
   */
  private generateCitationId(citation: Partial<Citation>): string {
    const author = citation.authors?.[0] || 'unknown'
    const year = citation.date?.split('-')[0] || new Date().getFullYear()
    const titleWords = citation.title?.split(' ').slice(0, 3).join('-') || 'untitled'
    
    return `${author.toLowerCase().replace(/\s+/g, '-')}-${year}-${titleWords.toLowerCase().replace(/[^a-z0-9-]/g, '')}`
  }

  /**
   * 按格式样式格式化引用
   */
  private formatCitationInStyle(citation: Citation, style: string): string {
    switch (style.toLowerCase()) {
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
    const authors = citation.authors.length > 0 
      ? citation.authors.join(', ')
      : 'Unknown Author'
    const year = citation.date.split('-')[0]
    
    let formatted = `${authors} (${year}). ${citation.title}`
    
    if (citation.publication) {
      formatted += `. ${citation.publication}`
    }
    
    if (citation.url) {
      formatted += `. Retrieved from ${citation.url}`
    }

    return formatted
  }

  /**
   * MLA 格式
   */
  private formatMLA(citation: Citation): string {
    const authors = citation.authors.length > 0
      ? citation.authors.join(', ')
      : 'Unknown Author'
    
    let formatted = `${authors}. "${citation.title}"`
    
    if (citation.publication) {
      formatted += ` ${citation.publication}`
    }
    
    formatted += `, ${citation.date}`
    
    if (citation.url) {
      formatted += `. Web. ${citation.url}`
    }

    return formatted
  }

  /**
   * Chicago 格式
   */
  private formatChicago(citation: Citation): string {
    const authors = citation.authors.length > 0
      ? citation.authors.join(', ')
      : 'Unknown Author'
    
    return `${authors}. "${citation.title}." ${citation.publication || 'Web'}, ${citation.date}. ${citation.url || ''}`
  }

  /**
   * IEEE 格式
   */
  private formatIEEE(citation: Citation): string {
    const authors = citation.authors.length > 0
      ? citation.authors.map(author => author.split(' ').reverse().join(', ')).join(', ')
      : 'Unknown Author'
    
    return `${authors}, "${citation.title}," ${citation.publication || 'Online'}, ${citation.date}. Available: ${citation.url || 'N/A'}`
  }

  /**
   * GB/T 7714 格式（中文）
   */
  private formatGB7714(citation: Citation): string {
    const authors = citation.authors.length > 0
      ? citation.authors.join(', ')
      : '佚名'
    
    let formatted = `${authors}. ${citation.title}`
    
    if (citation.publication) {
      formatted += `[J]. ${citation.publication}`
    } else {
      formatted += `[EB/OL]`
    }
    
    formatted += `, ${citation.date}`
    
    if (citation.url) {
      formatted += `. ${citation.url}`
    }

    return formatted
  }

  /**
   * 从URL提取引用信息
   */
  private async extractCitationFromUrl(url: string): Promise<Citation | null> {
    // 简化的URL解析
    // 实际实现会获取网页内容并解析元数据
    
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname
      
      return {
        id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'website',
        title: `从${domain}导入的引用`,
        authors: ['Unknown Author'],
        publication: domain,
        date: new Date().toISOString().split('T')[0],
        url
      }
    } catch {
      return null
    }
  }

  /**
   * 获取所有引用
   */
  getAllCitations(): Citation[] {
    return Array.from(this.citations.values())
  }

  /**
   * 根据ID获取引用
   */
  getCitation(id: string): Citation | undefined {
    return this.citations.get(id)
  }

  /**
   * 清空所有引用
   */
  clearAllCitations(): void {
    this.citations.clear()
  }

  /**
   * 获取引用数量
   */
  getCitationCount(): number {
    return this.citations.size
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { action } = input as { action?: string }
    const validActions = ['add', 'remove', 'list', 'format', 'generate', 'import']
    return Boolean(action && validActions.includes(action))
  }
}