import type { ProviderAdapter, InlineToolCall } from './ProviderAdapter.js'

export class DeepSeekAdapter implements ProviderAdapter {
  sanitizeText(text: string): string {
    if (!text) return ''
    let cleaned = text
    const outer = /<\s*[\|｜]tool▁calls▁begin\s*[\|｜]>[\s\S]*?<\s*[\|｜]tool▁calls▁end\s*[\|｜]>/g
    cleaned = cleaned.replace(outer, '')
    const single = /<\s*[\|｜]tool[^>]*[\|｜]>/g
    cleaned = cleaned.replace(single, '')
    return cleaned
  }

  extractInlineToolCalls(text: string): { cleaned: string; calls: InlineToolCall[] } {
    let cleaned = text
    const calls: InlineToolCall[] = []
    const outer = /<\s*[\|｜]tool▁calls▁begin\s*[\|｜]>([\s\S]*?)<\s*[\|｜]tool▁calls▁end\s*[\|｜]>/g
    cleaned = cleaned.replace(outer, (_m, inner: string) => {
      const innerRegex = /<\s*[\|｜]tool▁call▁begin\s*[\|｜]>([a-zA-Z0-9_\-]+)<\s*[\|｜]tool▁sep\s*[\|｜]>([\s\S]*?)<\s*[\|｜]tool▁call▁end\s*[\|｜]>/g
      let m
      while ((m = innerRegex.exec(inner)) !== null) {
        const name = (m[1] || '').trim()
        let argStr = (m[2] || '').trim()
        argStr = argStr.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '')
        try {
          const args = JSON.parse(argStr)
          calls.push({ name, args })
        } catch {
          // ignore
        }
      }
      return ''
    })
    cleaned = this.sanitizeText(cleaned)
    return { cleaned, calls }
  }

  async parseJSONResponse(response: any): Promise<any> {
    try {
      return await response.json()
    } catch (e) {
      // 某些网关仍返回 SSE：提取最后一个 data: JSON
      const text = await response.text()
      const lines = text.split(/\n/).map((l: string) => l.trim()).filter(Boolean)
      const lastData = [...lines].reverse().find((l: string) => l.startsWith('data:'))
      if (!lastData) throw e
      const jsonStr = lastData.replace(/^data:\s*/, '')
      return JSON.parse(jsonStr)
    }
  }
}
