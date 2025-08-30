import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { SearchResult, ResearchRequest } from '../../types/research.js'

/**
 * WebSearch 工具
 * 多搜索引擎研究工具
 */
export class WebSearchTool implements WritingTool {
  name = 'web_search'
  description = '网络搜索工具'
  securityLevel = 'ai-powered' as const

  private searchEngines = ['google', 'bing', 'baidu']
  private allowedDomains = [
    'scholar.google.com',
    'arxiv.org', 
    'wikipedia.org',
    'github.com',
    'stackoverflow.com',
    'medium.com',
    'zhihu.com',
    'csdn.net'
  ]

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        query,
        maxResults = 10,
        language = 'both',
        sourceTypes = ['academic', 'news', 'blog'],
        timeRange = 'unlimited',
        engines = ['google']
      } = input as {
        query: string
        maxResults?: number
        language?: 'chinese' | 'english' | 'both'
        sourceTypes?: ('academic' | 'news' | 'blog' | 'official')[]
        timeRange?: 'week' | 'month' | 'year' | 'unlimited'
        engines?: string[]
      }

      if (!query) {
        return {
          success: false,
          error: '缺少搜索查询参数'
        }
      }

      // 验证搜索引擎
      const validEngines = engines.filter(engine => 
        this.searchEngines.includes(engine.toLowerCase())
      )
      
      if (validEngines.length === 0) {
        return {
          success: false,
          error: '未指定有效的搜索引擎'
        }
      }

      // 执行搜索
      const searchResults = await this.performSearch({
        query,
        maxResults,
        language,
        sourceTypes,
        timeRange,
        engines: validEngines
      })

      // 过滤和排序结果
      const filteredResults = this.filterAndRankResults(searchResults, sourceTypes)

      return {
        success: true,
        content: this.formatSearchResults(filteredResults),
        metadata: {
          query,
          totalResults: filteredResults.length,
          searchEngines: validEngines,
          searchParams: {
            maxResults,
            language, 
            sourceTypes,
            timeRange
          },
          searchedAt: new Date().toISOString(),
          results: filteredResults
        }
      }

    } catch (error) {
      return {
        success: false,
        error: `网络搜索失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 执行搜索
   */
  private async performSearch(request: {
    query: string
    maxResults: number
    language: string
    sourceTypes: string[]
    timeRange: string
    engines: string[]
  }): Promise<SearchResult[]> {
    
    // 模拟搜索结果
    // 在实际实现中会调用真实的搜索 API
    const mockResults: SearchResult[] = [
      {
        title: `${request.query}技术发展现状与趋势分析`,
        url: 'https://scholar.google.com/paper/12345',
        snippet: `本文深入分析了${request.query}的技术发展现状，探讨了未来发展趋势和应用前景...`,
        source: 'Google Scholar',
        relevanceScore: 0.95,
        publishDate: '2024-01-15',
        author: 'Zhang Wei, Li Ming',
        domain: 'scholar.google.com'
      },
      {
        title: `${request.query}在企业中的实践应用`,
        url: 'https://medium.com/tech-blog/ai-application',
        snippet: `通过对多家企业的调研，我们发现${request.query}正在各个行业中发挥重要作用...`,
        source: 'Medium',
        relevanceScore: 0.88,
        publishDate: '2024-02-01',
        author: 'Tech Blog Team',
        domain: 'medium.com'
      },
      {
        title: `${request.query}技术白皮书`,
        url: 'https://github.com/company/whitepaper',
        snippet: `详细介绍了${request.query}的技术架构、实现方案和最佳实践...`,
        source: 'GitHub',
        relevanceScore: 0.92,
        publishDate: '2024-01-30',
        author: 'Company Research Team',
        domain: 'github.com'
      },
      {
        title: `关于${request.query}的深度解析`,
        url: 'https://zhihu.com/question/12345',
        snippet: `知乎上关于${request.query}的高质量讨论，包含了业内专家的深度见解...`,
        source: '知乎',
        relevanceScore: 0.85,
        publishDate: '2024-02-10',
        author: '技术专家',
        domain: 'zhihu.com'
      },
      {
        title: `${request.query}开源项目集合`,
        url: 'https://github.com/awesome-list/awesome-ai',
        snippet: `收集了${request.query}相关的优秀开源项目和学习资源...`,
        source: 'GitHub',
        relevanceScore: 0.80,
        publishDate: '2024-01-20',
        author: 'Open Source Community',
        domain: 'github.com'
      }
    ]

    return mockResults.slice(0, request.maxResults)
  }

  /**
   * 过滤和排序搜索结果
   */
  private filterAndRankResults(results: SearchResult[], sourceTypes: string[]): SearchResult[] {
    // 根据来源类型过滤
    const sourceMapping = {
      academic: ['scholar.google.com', 'arxiv.org'],
      news: ['news.google.com', 'reuters.com', 'bbc.com'],
      blog: ['medium.com', 'csdn.net', 'zhihu.com'],
      official: ['github.com', 'docs.microsoft.com', 'developer.mozilla.org']
    }

    const allowedDomains = sourceTypes.flatMap(type => 
      sourceMapping[type as keyof typeof sourceMapping] || []
    )

    const filtered = results.filter(result => 
      allowedDomains.some(domain => result.domain.includes(domain)) ||
      this.allowedDomains.includes(result.domain)
    )

    // 按相关性排序
    return filtered.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * 格式化搜索结果
   */
  private formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
      return '未找到相关搜索结果。'
    }

    let output = `# 搜索结果 (共${results.length}条)\n\n`

    results.forEach((result, index) => {
      output += `## ${index + 1}. ${result.title}\n`
      output += `**来源**: ${result.source} | **发布时间**: ${result.publishDate || '未知'}\n`
      output += `**作者**: ${result.author || '未知'} | **相关性**: ${(result.relevanceScore * 100).toFixed(1)}%\n`
      output += `**链接**: ${result.url}\n\n`
      output += `${result.snippet}\n\n`
      output += `---\n\n`
    })

    return output
  }

  /**
   * 验证搜索查询
   */
  private validateQuery(query: string): { valid: boolean; reason?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, reason: '搜索查询不能为空' }
    }

    if (query.length > 200) {
      return { valid: false, reason: '搜索查询过长' }
    }

    // 检查潜在的恶意查询
    const maliciousPatterns = [
      /site:\s*file:\/\//i,
      /intitle:\s*"password"/i,
      /filetype:\s*(passwd|shadow)/i
    ]

    for (const pattern of maliciousPatterns) {
      if (pattern.test(query)) {
        return { valid: false, reason: '检测到潜在的恶意搜索查询' }
      }
    }

    return { valid: true }
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { query } = input as { query?: string }
    const validation = this.validateQuery(query || '')
    return validation.valid
  }

  /**
   * 获取支持的搜索引擎
   */
  getSupportedEngines(): string[] {
    return [...this.searchEngines]
  }

  /**
   * 获取允许的域名列表
   */
  getAllowedDomains(): string[] {
    return [...this.allowedDomains]
  }
}