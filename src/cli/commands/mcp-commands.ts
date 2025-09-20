import { SlashCommand } from '../../types/command.js'
import { getMCPManager } from '../../services/mcp/MCPManager.js'

export const mcpCommands: SlashCommand[] = [
  {
    type: 'local',
    name: 'mcp',
    description: 'MCP 管理与调试工具',
    aliases: ['MCP'],
    usage: '/mcp <subcommand>',
    examples: [
      '/mcp list',
      '/mcp help'
    ],
    async call(_args: string): Promise<string> {
      const [sub] = _args.trim().split(/\s+/)
      switch ((sub || 'list').toLowerCase()) {
        case 'list':
          return listServers()
        case 'help':
        default:
          return help()
      }

      function listServers(): string {
        const mgr = getMCPManager()
        mgr.refresh()
        const servers = mgr.listServers()
        if (servers.length === 0) return '🔍 未配置任何 MCP 服务器\n在 .writeflow.json 的 mcpServers 中添加配置。'
        let out = '📡 MCP 服务器列表\n\n'
        for (const s of servers) {
          out += `• ${s.name}  [${s.type}]\n`
          if (s.type === 'sse') {
            out += `   url: ${s.url}\n`
          } else {
            out += `   command: ${s.command} ${s.args?.join(' ') || ''}\n`
          }
        }
        out += '\n提示: 某些工具需要模型支持 function calling 或特定插件。'
        return out
      }

      function help(): string {
        return `MCP 命令帮助\n\n用法:\n  /mcp list       显示已配置的 MCP 服务器\n  /mcp help       显示帮助\n\n配置:\n  请在 ~/.writeflow.json 中的 mcpServers 字段配置 stdio 或 sse 服务器。`
      }
    },
    userFacingName: () => 'mcp'
  },
]
