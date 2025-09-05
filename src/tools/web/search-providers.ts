// @ts-ignore
import fetch from 'node-fetch'
import { parse } from 'node-html-parser'

export interface SearchResult {
  title: string
  snippet: string
  link: string
}

export interface SearchProvider {
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
  isEnabled: () => boolean
}

export interface SearchOptions {
  maxResults?: number
  language?: string
}

/**
 * DuckDuckGo 搜索提供商
 * 无需API密钥，免费使用
 */
const duckDuckGoProvider: SearchProvider = {
  isEnabled: () => true,
  
  search: async (query: string, options?: SearchOptions): Promise<SearchResult[]> => {
    const maxResults = options?.maxResults || 10
    
    try {
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000 // 10秒超时
        }
      )

      if (!response.ok) {
        throw new Error(`DuckDuckGo 搜索失败，状态码: ${response.status}`)
      }

      const html = await response.text()
      const root = parse(html)
      const results: SearchResult[] = []

      // 解析搜索结果
      const resultNodes = root.querySelectorAll('.result.web-result')

      for (const node of resultNodes) {
        if (results.length >= maxResults) break

        const titleNode = node.querySelector('.result__a')
        const snippetNode = node.querySelector('.result__snippet')

        if (titleNode && snippetNode) {
          const title = titleNode.text.trim()
          let link = titleNode.getAttribute('href') || ''
          const snippet = snippetNode.text.trim()

          if (title && link && snippet) {
            // 清理链接 - DuckDuckGo 有时会包装链接
            if (link.startsWith('https://duckduckgo.com/l/?uddg=')) {
              try {
                const url = new URL(link)
                const cleanLink = url.searchParams.get('uddg')
                if (cleanLink) link = decodeURIComponent(cleanLink)
              } catch {
                // 保持原链接
              }
            }

            results.push({
              title,
              snippet,
              link
            })
          }
        }
      }

      return results

    } catch (error) {
      console.error('DuckDuckGo 搜索错误:', error)
      throw new Error(`搜索失败: ${(error as Error).message}`)
    }
  }
}

/**
 * 百度搜索提供商（备选）
 * 针对中文内容搜索优化
 */
const baiduProvider: SearchProvider = {
  isEnabled: () => true,
  
  search: async (query: string, options?: SearchOptions): Promise<SearchResult[]> => {
    // 简化的百度搜索实现
    // 注意：实际使用可能需要处理反爬虫机制
    const maxResults = options?.maxResults || 10
    
    try {
      const response = await fetch(
        `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          },
          timeout: 10000
        }
      )

      if (!response.ok) {
        throw new Error(`百度搜索失败，状态码: ${response.status}`)
      }

      // 百度搜索结果解析较为复杂，这里返回空结果
      // 在实际项目中可以使用百度搜索 API 或更完善的解析逻辑
      console.warn('百度搜索提供商暂未完全实现')
      return []

    } catch (error) {
      console.error('百度搜索错误:', error)
      throw new Error(`百度搜索失败: ${(error as Error).message}`)
    }
  }
}

/**
 * 搜索提供商集合
 */
export const searchProviders = {
  duckduckgo: duckDuckGoProvider,
  baidu: baiduProvider
}

/**
 * 获取可用的搜索提供商
 */
export function getAvailableProviders(): string[] {
  return Object.keys(searchProviders).filter(key => 
    searchProviders[key as keyof typeof searchProviders].isEnabled()
  )
}

/**
 * 智能选择搜索提供商
 */
export function selectBestProvider(query: string): SearchProvider {
  // 对中文查询优先使用百度（如果可用）
  const hasChinese = /[\u4e00-\u9fa5]/.test(query)
  
  if (hasChinese && searchProviders.baidu.isEnabled()) {
    // 当前百度提供商未完全实现，回退到 DuckDuckGo
    return searchProviders.duckduckgo
  }
  
  // 默认使用 DuckDuckGo
  return searchProviders.duckduckgo
}