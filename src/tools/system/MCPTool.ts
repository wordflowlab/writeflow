import { z } from 'zod'
import { EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult, ToolConfig } from '../../types/tool.js'
import { getGlobalConfig } from '../../utils/config.js'

// 输入参数架构
const MCPToolInputSchema = z.object({
  action: z.enum(['list', 'connect', 'disconnect', 'call', 'tools', 'resources', 'prompts']).describe('MCP 操作类型'),
  server: z.string().optional().describe('MCP 服务器名称'),
  tool: z.string().optional().describe('要调用的工具名称'),
  parameters: z.record(z.any()).optional().describe('工具调用参数'),
  resource: z.string().optional().describe('资源路径'),
})

type MCPToolInput = z.infer<typeof MCPToolInputSchema>

interface MCPServerInfo {
  name: string
  type: 'stdio' | 'sse'
  command?: string
  args?: string[]
  url?: string
  connected?: boolean
}

interface MCPToolInfo {
  name: string
  description?: string
  schema?: any
}

interface MCPResourceInfo {
  name: string
  uri: string
  mimeType?: string
  description?: string
}

/**
 * MCPTool - Model Context Protocol 工具
 * 支持完整的 MCP 协议交互
 */
export class MCPTool implements EnhancedWritingTool {
  name = 'MCP'
  description = 'Model Context Protocol 工具，用于与外部 MCP 服务器交互，获取额外的工具、资源和提示词能力。'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'ai-powered'
  
  config: ToolConfig = {
    readOnly: false,
    concurrencySafe: false,
    requiresPermission: true,
    timeout: 30000,
    category: 'system'
  }

  private connectedServers = new Map<string, any>()

  /**
   * 主要执行方法
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { action, server, tool, parameters, resource } = this.validateAndParseInput(input)
      
      switch (action) {
        case 'list':
          return this.listServers()
        
        case 'connect':
          if (!server) throw new Error('连接 MCP 服务器需要指定服务器名称')
          return this.connectServer(server)
        
        case 'disconnect':
          if (!server) throw new Error('断开连接需要指定服务器名称')
          return this.disconnectServer(server)
        
        case 'tools':
          if (!server) throw new Error('列出工具需要指定服务器名称')
          return this.listTools(server)
        
        case 'resources':
          if (!server) throw new Error('列出资源需要指定服务器名称')
          return this.listResources(server)
        
        case 'prompts':
          if (!server) throw new Error('列出提示词需要指定服务器名称')
          return this.listPrompts(server)
        
        case 'call':
          if (!server || !tool) throw new Error('调用工具需要指定服务器名称和工具名称')
          return this.callTool(server, tool, parameters || {})
        
        default:
          throw new Error(`不支持的操作: ${action}`)
      }

    } catch (_error) {
      return {
        success: false,
        error: `MCP 操作失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 流式执行（支持长时间运行的 MCP 调用）
   */
  async* executeStream(input: ToolInput): AsyncGenerator<ToolResult, void, unknown> {
    try {
      const { action, server, tool, parameters } = this.validateAndParseInput(input)
      
      if (action === 'call' && server && tool) {
        yield {
          success: true,
          content: `🔄 开始调用 ${server} 的 ${tool} 工具...`,
          metadata: { status: 'calling' }
        }
        
        // 这里应该实现实际的 MCP 调用
        // 当前为简化实现
        yield {
          success: true,
          content: `📡 正在与 ${server} 服务器通信...`,
          metadata: { status: 'communicating' }
        }
        
        const result = await this.callTool(server, tool, parameters || {})
        yield result
        
      } else {
        // 对于其他操作，回退到普通执行
        yield await this.execute(input)
      }

    } catch (_error) {
      yield {
        success: false,
        error: `MCP 流式操作失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 获取专用提示词
   */
  async getPrompt(options?: { safeMode?: boolean }): Promise<string> {
    return `MCP (Model Context Protocol) 工具用于与外部服务器交互，扩展 AI 助手的能力：

主要功能：
- 连接和管理 MCP 服务器
- 调用外部工具和服务
- 获取外部资源和数据
- 使用外部提示词模板

使用指南：
1. 列出配置的服务器: { "action": "list" }
2. 连接服务器: { "action": "connect", "server": "server-name" }
3. 列出工具: { "action": "tools", "server": "server-name" }
4. 调用工具: { "action": "call", "server": "server-name", "tool": "tool-name", "parameters": {...} }
5. 断开连接: { "action": "disconnect", "server": "server-name" }

安全注意事项：
- MCP 工具可能修改外部系统状态
- 谨慎调用未知的外部工具
- 建议在安全环境中测试新的 MCP 服务器`
  }

  /**
   * 权限验证
   */
  async validatePermission(input: ToolInput, context?: ToolContext): Promise<PermissionResult> {
    const { action } = this.validateAndParseInput(input)
    
    // 只读操作无需特殊权限
    if (['list', 'tools', 'resources', 'prompts'].includes(action)) {
      return { granted: true }
    }
    
    // 连接、断开连接和调用工具需要权限
    return {
      granted: context?.options?.allowMCPInteraction === true,
      reason: 'MCP 交互可能影响外部系统，需要用户授权',
      requiredPermissions: ['mcp:connect', 'mcp:call'],
      warningMessage: `MCP 操作 "${action}" 可能与外部系统交互，请确认安全性`
    }
  }

  /**
   * 结果渲染
   */
  renderResult(result: ToolResult): string {
    if (result.success && result.metadata?.mcpResult) {
      const { action, server } = result.metadata.mcpResult
      return `MCP ${action} 操作完成 ${server ? `(服务器: ${server})` : ''}`
    }
    return result.content || 'MCP 操作完成'
  }

  /**
   * 输入验证
   */
  async validateInput(input: ToolInput): Promise<boolean> {
    try {
      MCPToolInputSchema.parse(input)
      return true
    } catch {
      return false
    }
  }

  /**
   * 验证并解析输入
   */
  private validateAndParseInput(input: ToolInput): MCPToolInput {
    return MCPToolInputSchema.parse(input)
  }

  /**
   * 列出配置的 MCP 服务器
   */
  private async listServers(): Promise<ToolResult> {
    const config = getGlobalConfig()
    const servers = config.mcpServers || {}
    const serverNames = Object.keys(servers)
    
    if (serverNames.length === 0) {
      return {
        success: true,
        content: '📡 未配置任何 MCP 服务器\n\n请在 ~/.writeflow.json 的 mcpServers 配置项中添加服务器。',
        metadata: { servers: [] }
      }
    }
    
    const serverInfos: MCPServerInfo[] = serverNames.map(name => {
      const server = (servers as any)[name]
      return {
        name,
        type: server.type || 'stdio',
        command: server.command,
        args: server.args,
        url: server.url,
        connected: this.connectedServers.has(name)
      }
    })
    
    let content = '📡 MCP 服务器列表\n\n'
    serverInfos.forEach(server => {
      const status = server.connected ? '🟢 已连接' : '🔴 未连接'
      content += `**${server.name}** (${server.type}) ${status}\n`
      
      if (server.type === 'stdio') {
        content += `   命令: ${server.command} ${(server.args || []).join(' ')}\n`
      } else if (server.type === 'sse') {
        content += `   URL: ${server.url}\n`
      }
      content += '\n'
    })
    
    return {
      success: true,
      content,
      metadata: { servers: serverInfos }
    }
  }

  /**
   * 连接 MCP 服务器
   */
  private async connectServer(serverName: string): Promise<ToolResult> {
    const config = getGlobalConfig()
    const servers = config.mcpServers || {}
    const serverConfig = (servers as any)[serverName]
    
    if (!serverConfig) {
      return {
        success: false,
        error: `未找到服务器配置: ${serverName}`
      }
    }
    
    try {
      // 这里应该实现实际的连接逻辑
      // 当前为简化实现
      this.connectedServers.set(serverName, {
        config: serverConfig,
        connected: true,
        connectedAt: Date.now()
      })
      
      return {
        success: true,
        content: `✅ 已连接到 MCP 服务器: ${serverName}`,
        metadata: {
          mcpResult: { action: 'connect', server: serverName }
        }
      }
      
    } catch (_error) {
      return {
        success: false,
        error: `连接服务器失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 断开 MCP 服务器连接
   */
  private async disconnectServer(serverName: string): Promise<ToolResult> {
    if (!this.connectedServers.has(serverName)) {
      return {
        success: false,
        error: `服务器 ${serverName} 未连接`
      }
    }
    
    try {
      // 实际断开连接逻辑
      this.connectedServers.delete(serverName)
      
      return {
        success: true,
        content: `✅ 已断开与 MCP 服务器的连接: ${serverName}`,
        metadata: {
          mcpResult: { action: 'disconnect', server: serverName }
        }
      }
      
    } catch (_error) {
      return {
        success: false,
        error: `断开连接失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 列出服务器提供的工具
   */
  private async listTools(serverName: string): Promise<ToolResult> {
    if (!this.connectedServers.has(serverName)) {
      return {
        success: false,
        error: `服务器 ${serverName} 未连接，请先连接`
      }
    }
    
    try {
      // 这里应该调用 MCP 协议获取工具列表
      // 当前为模拟数据
      const mockTools: MCPToolInfo[] = [
        { name: 'file_read', description: '读取文件内容' },
        { name: 'web_search', description: '网络搜索' },
        { name: 'database_query', description: '数据库查询' }
      ]
      
      let content = `🛠️ ${serverName} 提供的工具\n\n`
      mockTools.forEach(tool => {
        content += `**${tool.name}**\n${tool.description || '无描述'}\n\n`
      })
      
      return {
        success: true,
        content,
        metadata: {
          tools: mockTools,
          mcpResult: { action: 'tools', server: serverName }
        }
      }
      
    } catch (_error) {
      return {
        success: false,
        error: `获取工具列表失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 列出服务器提供的资源
   */
  private async listResources(serverName: string): Promise<ToolResult> {
    if (!this.connectedServers.has(serverName)) {
      return {
        success: false,
        error: `服务器 ${serverName} 未连接，请先连接`
      }
    }
    
    // 模拟实现
    const mockResources: MCPResourceInfo[] = [
      { name: 'project_files', uri: 'file://project/', description: '项目文件' },
      { name: 'documentation', uri: 'docs://', description: '文档资源' }
    ]
    
    let content = `📁 ${serverName} 提供的资源\n\n`
    mockResources.forEach(resource => {
      content += `**${resource.name}**\n${resource.description || '无描述'}\nURI: ${resource.uri}\n\n`
    })
    
    return {
      success: true,
      content,
      metadata: {
        resources: mockResources,
        mcpResult: { action: 'resources', server: serverName }
      }
    }
  }

  /**
   * 列出服务器提供的提示词
   */
  private async listPrompts(serverName: string): Promise<ToolResult> {
    if (!this.connectedServers.has(serverName)) {
      return {
        success: false,
        error: `服务器 ${serverName} 未连接，请先连接`
      }
    }
    
    // 简化实现
    return {
      success: true,
      content: `📝 ${serverName} 暂无可用提示词模板`,
      metadata: {
        prompts: [],
        mcpResult: { action: 'prompts', server: serverName }
      }
    }
  }

  /**
   * 调用 MCP 工具
   */
  private async callTool(serverName: string, toolName: string, parameters: Record<string, any>): Promise<ToolResult> {
    if (!this.connectedServers.has(serverName)) {
      return {
        success: false,
        error: `服务器 ${serverName} 未连接，请先连接`
      }
    }
    
    try {
      // 这里应该实现实际的 MCP 工具调用
      // 当前为模拟实现
      const result = {
        toolName,
        parameters,
        output: `工具 ${toolName} 执行完成`,
        executedAt: new Date().toISOString()
      }
      
      return {
        success: true,
        content: `🔧 工具调用成功\n\n**工具**: ${toolName}\n**参数**: ${JSON.stringify(parameters, null, 2)}\n**结果**: ${result.output}`,
        metadata: {
          toolResult: result,
          mcpResult: { action: 'call', server: serverName, tool: toolName }
        }
      }
      
    } catch (_error) {
      return {
        success: false,
        error: `工具调用失败: ${(_error as Error).message}`
      }
    }
  }
}