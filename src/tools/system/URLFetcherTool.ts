import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

export class URLFetcherTool implements WritingTool {
  name = 'URLFetcher'
  description = '抓取指定 URL 的文本内容。入参：{ url: string }'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const url = String(input?.url || '')
    if (!url) return { success: false, error: '缺少 url 参数' }
    try {
      const res = await fetch(url)
      if (!res.ok) return { success: false, error: `请求失败: ${res.status} ${res.statusText}` }
      const text = await res.text()
      const preview = text.length > 4000 ? text.slice(0, 4000) + '\n...[截断]' : text
      return { success: true, content: `URL: ${url}\n\n${preview}` }
    } catch (e) {
      return { success: false, error: `抓取失败: ${(e as Error).message}` }
    }
  }
}

