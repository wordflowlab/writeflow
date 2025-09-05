import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { promises as fs } from 'fs'
import path from 'path'

export class NotebookEditTool implements WritingTool {
  name = 'NotebookEdit'
  description = '向项目笔记 .writeflow/notebook.md 追加内容。入参：{ content: string }'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const content = String(input?.content || '')
    if (!content) return { success: false, error: '缺少 content' }
    const dir = path.join(process.cwd(), '.writeflow')
    const p = path.join(dir, 'notebook.md')
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(p, `\n${content}\n`, 'utf-8')
    return { success: true, content: '已写入 notebook.md' }
  }
}

