import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { getGlobalConfig } from '../../utils/config.js'

/**
 * 列出已配置的 MCP 服务器（最小可用版本）
 */
export class MCPListTool implements WritingTool {
  name = 'mcp_list'
  description = '列出 .writeflow.json 中配置的 MCP 服务器'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(_input: ToolInput): Promise<ToolResult> {
    const cfg = getGlobalConfig()
    const servers = cfg.mcpServers || {}
    const names = Object.keys(servers)
    if (names.length === 0) {
      return {
        success: true,
        content: '🔍 未配置任何 MCP 服务器。请在 ~/.writeflow.json 的 mcpServers 下进行配置。',
      }
    }

    let out = '📡 MCP 服务器列表\n\n'
    for (const name of names) {
      const s = (servers as any)[name]
      const type = s?.type === 'sse' ? 'sse' : 'stdio'
      out += `• ${name}  [${type}]\n`
      if (type === 'sse') {
        out += `   url: ${s?.url || '-'}\n`
      } else {
        out += `   command: ${s?.command || '-'} ${(s?.args || []).join(' ')}\n`
      }
    }
    return { success: true, content: out }
  }
}

