import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { MemoryManager } from './MemoryManager.js'

// 注意：这里使用独立的 MemoryManager 实例做最小占位，
// 与 WriteFlowApp 的实例并不共享，仅用于演示和本地工具化操作。
const singleton = new MemoryManager({ autoCompress: false })

export class MemoryReadTool implements WritingTool {
  name = 'MemoryRead'
  description = '读取最近的会话消息摘要（轻量演示）'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(_input: ToolInput): Promise<ToolResult> {
    const ctx = await singleton.getContext()
    const recent = ctx.recentMessages.slice(-5)
    const out = recent.map(m => `• [${m.role}] ${m.content}`).join('\n') || '暂无消息'
    return { success: true, content: `最近消息 (最多5条):\n${out}` }
  }
}

