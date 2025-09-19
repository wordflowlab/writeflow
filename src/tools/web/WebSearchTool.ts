import { z } from 'zod'
import { EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult, ToolConfig } from '../../types/tool.js'
import { SearchResult, searchProviders, selectBestProvider } from './search-providers.js'

// 输入参数架构
const WebSearchToolInputSchema = z.object({
  query: z.string().describe('搜索查询关键词'),
  maxResults: z.number().min(1).max(20).optional().default(10).describe('最大结果数量（1-20）'),
  provider: z.enum(['duckduckgo', 'baidu', 'auto']).optional().default('auto').describe('搜索引擎选择'),
})

type WebSearchToolInput = z.infer<typeof WebSearchToolInputSchema>

interface WebSearchToolOutput {
  query: string
  provider: string
  results: SearchResult[]
  totalResults: number
  durationMs: number
  searchTime: string
}

/**
 * WebSearchTool - 网络搜索工具
 * 为写作研究提供实时信息检索能力
 */
export class WebSearchTool implements EnhancedWritingTool {
  name = 'WebSearch'
  description = '网络搜索工具，用于获取最新信息和研究资料。支持多种搜索引擎，为写作提供实时数据支持。'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'
  
  config: ToolConfig = {
    readOnly: true,
    concurrencySafe: true,
    requiresPermission: false,
    timeout: 15000, // 15秒超时
    category: 'research'
  }

  /**
   * 主要执行方法
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    const startTime = Date.now()
    
    try {
      const { query, maxResults, provider } = this.validateAndParseInput(input)
      
      // 选择搜索提供商
      const selectedProvider = this.selectProvider(provider, query)
      
      // 执行搜索
      const results = await selectedProvider.search(query, {
        maxResults
      })
      
      const duration = Date.now() - startTime
      const output: WebSearchToolOutput = {
        query,
        provider: this.getProviderName(selectedProvider),
        results,
        totalResults: results.length,
        durationMs: duration,
        searchTime: new Date().toISOString()
      }
      
      return {
        success: true,
        content: this.formatSearchResults(output),
        metadata: {
          toolName: this.name,
          searchQuery: query,
          resultCount: results.length,
          duration,
          ...output
        }
      }

    } catch (_error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        error: `网络搜索失败: ${(error as Error).message}`,
        metadata: {
          duration,
          error: (error as Error).message
        }
      }
    }
  }

  /**
   * 流式执行（逐个返回搜索结果）
   */
  async* executeStream(input: ToolInput): AsyncGenerator<ToolResult, void, unknown> {
    const startTime = Date.now()
    
    try {
      const { query, maxResults, provider } = this.validateAndParseInput(input)
      
      // 先返回搜索开始的状态
      yield {
        success: true,
        content: `🔍 开始搜索: "${query}"`,
        metadata: { status: 'searching', query }
      }
      
      const selectedProvider = this.selectProvider(provider, query)
      const results = await selectedProvider.search(query, { maxResults })
      
      // 逐个返回搜索结果
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        yield {
          success: true,
          content: this.formatSingleResult(result, i + 1),
          metadata: {
            resultIndex: i + 1,
            totalResults: results.length,
            result
          }
        }
      }
      
      // 最后返回汇总
      const duration = Date.now() - startTime
      yield {
        success: true,
        content: `✅ 搜索完成！共找到 ${results.length} 个相关结果，耗时 ${duration}ms`,
        metadata: {
          status: 'completed',
          totalResults: results.length,
          duration
        }
      }

    } catch (_error) {
      yield {
        success: false,
        error: `搜索流程失败: ${(error as Error).message}`,
        metadata: { duration: Date.now() - startTime }
      }
    }
  }

  /**
   * 获取专用提示词
   */
  async getPrompt(options?: { safeMode?: boolean }): Promise<string> {
    return `WebSearch 工具用于搜索最新信息和研究资料，特别适用于：

使用指南：
- 搜索时事新闻和最新动态
- 查找数据、统计信息和事实
- 研究特定主题的背景资料
- 获取产品信息和技术更新
- 验证信息的准确性

搜索技巧：
- 使用具体、明确的关键词
- 可以使用引号搜索完整短语
- 支持中英文搜索
- 结果按相关性排序

注意事项：
- 搜索结果来自公开网络信息
- 建议交叉验证重要信息
- 遵守相关法律法规和网站使用条款`
  }

  /**
   * 权限验证
   */
  async validatePermission(input: ToolInput, context?: ToolContext): Promise<PermissionResult> {
    return {
      granted: true,
      reason: '网络搜索是只读操作，安全可用'
    }
  }

  /**
   * 结果渲染
   */
  renderResult(result: ToolResult): string {
    if (result.metadata?.results) {
      return this.formatSearchResults(result.metadata as WebSearchToolOutput)
    }
    return result.content || '搜索完成'
  }

  /**
   * 输入验证
   */
  async validateInput(input: ToolInput): Promise<boolean> {
    try {
      WebSearchToolInputSchema.parse(input)
      return true
    } catch {
      return false
    }
  }

  /**
   * 验证并解析输入
   */
  private validateAndParseInput(input: ToolInput): WebSearchToolInput {
    return WebSearchToolInputSchema.parse(input)
  }

  /**
   * 选择搜索提供商
   */
  private selectProvider(provider: string, query: string) {
    if (provider === 'auto') {
      return selectBestProvider(query)
    }
    
    if (provider === 'duckduckgo' && searchProviders.duckduckgo.isEnabled()) {
      return searchProviders.duckduckgo
    }
    
    if (provider === 'baidu' && searchProviders.baidu.isEnabled()) {
      return searchProviders.baidu
    }
    
    // 回退到默认提供商
    return searchProviders.duckduckgo
  }

  /**
   * 获取提供商名称
   */
  private getProviderName(provider: any): string {
    if (provider === searchProviders.duckduckgo) return 'DuckDuckGo'
    if (provider === searchProviders.baidu) return '百度'
    return 'Unknown'
  }

  /**
   * 格式化搜索结果
   */
  private formatSearchResults(output: WebSearchToolOutput): string {
    const { query, provider, results, totalResults, durationMs } = output
    
    if (results.length === 0) {
      return `🔍 搜索查询: "${query}"\n📊 使用引擎: ${provider}\n⏱️  搜索耗时: ${durationMs}ms\n\n❌ 未找到相关结果`
    }
    
    let formatted = `🔍 搜索查询: "${query}"\n📊 使用引擎: ${provider}\n📈 结果数量: ${totalResults}\n⏱️  搜索耗时: ${durationMs}ms\n\n`
    
    results.forEach((result, index) => {
      formatted += `**${index + 1}. ${result.title}**\n`
      formatted += `${result.snippet}\n`
      formatted += `🔗 ${result.link}\n\n`
    })
    
    formatted += `💡 提示：可以点击链接查看完整内容，或使用这些信息作为写作素材。`
    
    return formatted
  }

  /**
   * 格式化单个搜索结果（用于流式输出）
   */
  private formatSingleResult(result: SearchResult, index: number): string {
    return `**${index}. ${result.title}**\n${result.snippet}\n🔗 ${result.link}`
  }
}