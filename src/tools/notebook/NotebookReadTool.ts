import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { promises as fs } from 'fs'
import path from 'path'

export class NotebookReadTool implements WritingTool {
  name = 'NotebookRead'
  description = '读取项目笔记 .writeflow/notebook.md 内容'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(_input: ToolInput): Promise<ToolResult> {
    try {
      const p = path.join(process.cwd(), '.writeflow', 'notebook.md')
      const text = await fs.readFile(p, 'utf-8')
      return { success: true, content: text }
    } catch {
      return { success: true, content: '暂无笔记。使用 NotebookEdit 写入内容。' }
    }
  }
}

