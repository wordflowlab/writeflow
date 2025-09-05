import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

export class TaskTool implements WritingTool {
  name = 'Task'
  description = '根据输入生成或格式化任务条目（轻量占位工具）'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const items: Array<string> = Array.isArray(input?.items) ? input.items : []
    if (items.length === 0) return { success: true, content: '未提供任务项。入参示例: { items: ["写开篇", "列大纲"] }' }
    const out = items.map((t, i) => ` ${i + 1}. ${t}`).join('\n')
    return { success: true, content: `待办任务:\n${out}` }
  }
}

