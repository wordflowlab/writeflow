import { GlobalConfig, getGlobalConfig } from '../../utils/config.js'

export type MCPServerInfo = {
  name: string
  type: 'stdio' | 'sse'
  command?: string
  args?: string[]
  url?: string
}

/**
 * Minimal MCP manager for listing and describing configured servers.
 * (Lightweight placeholder to keep API stable while adding deeper integration later.)
 */
export class MCPManager {
  private config: GlobalConfig

  constructor() {
    this.config = getGlobalConfig()
  }

  refresh(): void {
    this.config = getGlobalConfig()
  }

  listServers(): MCPServerInfo[] {
    const servers = this.config.mcpServers || {}
    return Object.entries(servers).map(([name, cfg]) => {
      const info: MCPServerInfo = {
        name,
        type: (cfg as any).type === 'sse' ? 'sse' : 'stdio',
      }
      if ((cfg as any).type === 'sse') {
        info.url = (cfg as any).url
      } else {
        info.command = (cfg as any).command
        info.args = (cfg as any).args
      }
      return info
    })
  }
}

let singleton: MCPManager | null = null
export function getMCPManager(): MCPManager {
  if (!singleton) singleton = new MCPManager()
  return singleton
}
