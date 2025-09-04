import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import fetch from 'node-fetch'

/**
 * WebFetch 工具
 * 获取网页内容
 */
export class WebFetchTool implements WritingTool {
  name = 'web_fetch'
  description = '获取网页内容工具'
  securityLevel = 'ai-powered' as const

  private allowedDomains = [
    'github.com',
    'stackoverflow.com',
    'developer.mozilla.org',
    'docs.python.org',
    'reactjs.org',
    'vuejs.org',
    'angular.io',
    'nodejs.org',
    'npmjs.com',
    'medium.com',
    'dev.to',
    'hackernews.com',
    'reddit.com',
    'wikipedia.org',
    'scholar.google.com',
    'arxiv.org'
  ]

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { url, prompt } = input as {
        url: string
        prompt: string
      }

      if (!url) {
        return {
          success: false,
          error: '缺少 URL 参数'
        }
      }

      if (!prompt) {
        return {
          success: false,
          error: '缺少处理提示词参数'
        }
      }

      // 验证 URL
      const validation = this.validateUrl(url)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason
        }
      }

      // 获取网页内容
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WriteFlow Web Fetch Tool'
        },
        timeout: 10000 // 10 seconds timeout
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        return {
          success: false,
          error: '不支持的内容类型，仅支持 HTML 和文本'
        }
      }

      const html = await response.text()
      
      // 简单的 HTML 到 Markdown 转换
      const markdown = this.htmlToMarkdown(html)
      
      // 使用提示词处理内容
      const processedContent = await this.processContentWithPrompt(markdown, prompt)

      return {
        success: true,
        content: processedContent,
        metadata: {
          url,
          contentType,
          contentLength: html.length,
          fetchedAt: new Date().toISOString()
        }
      }

    } catch (error) {
      return {
        success: false,
        error: `网页获取失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 验证 URL
   */
  private validateUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url)
      
      // 检查协议
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: '只支持 HTTP/HTTPS 协议' }
      }

      // 检查域名白名单
      const hostname = parsed.hostname.toLowerCase()
      const isAllowed = this.allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      )

      if (!isAllowed) {
        return { valid: false, reason: `不允许访问的域名: ${hostname}` }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, reason: 'URL 格式无效' }
    }
  }

  /**
   * 简单的 HTML 到 Markdown 转换
   */
  private htmlToMarkdown(html: string): string {
    // 移除 script 和 style 标签
    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    
    // 基本的 HTML 标签转换
    html = html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
    html = html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
    html = html.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
    html = html.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1')
    html = html.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1')
    html = html.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1')
    
    html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    
    html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    html = html.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    
    html = html.replace(/<p[^>]*>/gi, '\n\n')
    html = html.replace(/<\/p>/gi, '')
    html = html.replace(/<br[^>]*>/gi, '\n')
    
    html = html.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
    html = html.replace(/<ul[^>]*>/gi, '')
    html = html.replace(/<\/ul>/gi, '\n')
    html = html.replace(/<ol[^>]*>/gi, '')
    html = html.replace(/<\/ol>/gi, '\n')
    
    // 移除其他 HTML 标签
    html = html.replace(/<[^>]*>/g, '')
    
    // 解码 HTML 实体
    html = html.replace(/&nbsp;/g, ' ')
    html = html.replace(/&amp;/g, '&')
    html = html.replace(/&lt;/g, '<')
    html = html.replace(/&gt;/g, '>')
    html = html.replace(/&quot;/g, '"')
    html = html.replace(/&#39;/g, "'")
    
    // 清理多余的空白
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n')
    html = html.trim()
    
    return html
  }

  /**
   * 使用提示词处理内容
   */
  private async processContentWithPrompt(content: string, prompt: string): Promise<string> {
    // 这里可以集成 AI 模型来处理内容
    // 目前返回简单的格式化内容
    
    const sections = [
      `# 网页内容摘要\n`,
      `**处理提示**: ${prompt}\n`,
      `## 内容\n`,
      content,
      `\n---\n`,
      `*内容已根据提示词"${prompt}"进行处理*`
    ]
    
    return sections.join('\n')
  }

  /**
   * 获取允许的域名列表
   */
  getAllowedDomains(): string[] {
    return [...this.allowedDomains]
  }
}