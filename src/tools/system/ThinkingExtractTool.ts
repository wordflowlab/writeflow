import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

/**
 * 从文本中提取 <thinking>…</thinking> 片段（最小实现）
 */
export class ThinkingExtractTool implements WritingTool {
  name = 'thinking_extract'
  description = '从文本中提取 <thinking>…</thinking> 片段并返回'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const text = String(input?.text || input?.content || '')
    if (!text) {
      return { success: true, content: '未提供文本输入，无法提取 thinking 内容。' }
    }
    const m = text.match(/<thinking>([\s\S]*?)<\/thinking>/i)
    if (m) {
      return { success: true, content: `🧠 提取的思考片段:\n\n${m[1].trim()}` }
    }
    return { success: true, content: '未找到 thinking 片段。' }
  }
}

