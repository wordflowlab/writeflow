import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

export class ThinkTool implements WritingTool {
  name = 'Think'
  description = '将输入包装为 <thinking>…</thinking> 片段，便于调试与展示'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const text = String(input?.text || input?.content || '')
    if (!text) return { success: true, content: '<thinking>无内容</thinking>' }
    return { success: true, content: `<thinking>\n${text}\n</thinking>` }
  }
}

