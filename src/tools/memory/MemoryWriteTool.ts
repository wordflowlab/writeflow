import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { MemoryManager } from './MemoryManager.js'

const singleton = new MemoryManager({ autoCompress: false })

export class MemoryWriteTool implements WritingTool {
  name = 'MemoryWrite'
  description = '向会话记忆添加一条消息（轻量演示）。入参：{ role: "user|assistant|system", content: string }'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const role = (input?.role || 'assistant') as 'user' | 'assistant' | 'system'
    const content = String(input?.content || '')
    if (!content) return { success: false, error: '缺少 content' }
    await singleton.addMessage(role, content)
    return { success: true, content: `已写入记忆: [${role}] ${content}` }
  }
}

