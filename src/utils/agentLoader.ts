/**
 * Agent 配置加载器
 * 动态加载和管理 WriteFlow 的专用 Agent
 * 参考 Kode 项目的架构设计，实现按需加载机制
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import matter from 'gray-matter'
import { fileURLToPath } from 'url'

export interface AgentConfig {
  name: string                    // Agent 标识符
  description: string             // Agent 描述
  whenToUse: string              // 何时使用此 Agent
  tools: string[]                // 工具权限列表
  systemPrompt: string           // 系统提示词
  model?: string                 // 可选：模型名称
  location?: 'project' | 'user' | 'built-in'
}

export interface AgentTool {
  name: string
  description: string | (() => Promise<string>)
  execute: (args: any) => Promise<any>
}

/**
 * Agent 加载器类
 * 使用单例模式管理 Agent 的生命周期
 */
export class AgentLoader {
  private static instances: Map<string, AgentLoader> = new Map()
  private agentConfig: AgentConfig | null = null
  private tools: Map<string, AgentTool> = new Map()
  private lastAccessTime: number = Date.now()
  private unloadTimer?: NodeJS.Timeout

  private constructor(private agentName: string) {}

  /**
   * 获取 Agent 加载器实例
   */
  static getInstance(agentName: string): AgentLoader {
    if (!this.instances.has(agentName)) {
      this.instances.set(agentName, new AgentLoader(agentName))
    }
    return this.instances.get(agentName)!
  }

  /**
   * 加载 Agent 配置
   */
  async loadAgent(): Promise<AgentConfig> {
    if (this.agentConfig) {
      this.updateAccessTime()
      return this.agentConfig
    }

    // 查找配置文件（优先级：项目 > 用户 > 内置）
    const configPath = this.findAgentConfig()
    if (!configPath) {
      throw new Error(`Agent 配置文件未找到: ${this.agentName}`)
    }

    // 读取和解析配置
    const content = readFileSync(configPath, 'utf-8')
    const { data: frontmatter, content: systemPrompt } = matter(content)

    // 验证必要字段
    if (!frontmatter.name || !frontmatter.description) {
      throw new Error(`Agent 配置缺少必要字段: name, description`)
    }

    // 构建配置对象
    this.agentConfig = {
      name: frontmatter.name,
      description: frontmatter.description,
      whenToUse: frontmatter.whenToUse || '',
      tools: Array.isArray(frontmatter.tools) ? frontmatter.tools : [],
      systemPrompt: systemPrompt.trim(),
      model: frontmatter.model_name || frontmatter.model,
      location: this.getLocationFromPath(configPath)
    }

    // 动态加载工具
    await this.loadTools(this.agentConfig.tools)

    // 设置自动卸载定时器
    this.setUnloadTimer()

    return this.agentConfig
  }

  /**
   * 查找 Agent 配置文件
   */
  private findAgentConfig(): string | null {
    const paths = [
      // 项目级配置
      join(process.cwd(), '.writeflow/agents', `${this.agentName}.md`),
      // 用户级配置
      join(homedir(), '.writeflow/agents', `${this.agentName}.md`),
      // 内置配置（如果有的话）
      (() => { const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename); return join(__dirname, '../../agents', `${this.agentName}.md`) })()
    ]

    for (const path of paths) {
      if (existsSync(path)) {
        return path
      }
    }

    return null
  }

  /**
   * 获取配置位置类型
   */
  private getLocationFromPath(path: string): 'project' | 'user' | 'built-in' {
    if (path.includes(process.cwd())) return 'project'
    if (path.includes(homedir())) return 'user'
    return 'built-in'
  }

  /**
   * 动态加载工具
   */
  private async loadTools(toolNames: string[]): Promise<void> {
    for (const toolName of toolNames) {
      if (this.tools.has(toolName)) {
        continue // 已加载
      }

      try {
        // 尝试从 slidev 工具目录加载
        const toolPath = `../tools/slidev/${toolName}.js`
        const toolModule = await import(toolPath)
        const ToolClass = toolModule.default || toolModule[toolName]
        
        if (ToolClass) {
          const toolInstance = new ToolClass()
          this.tools.set(toolName, toolInstance)
        }
      } catch (error) {
        // 如果是基础工具，尝试从主工具目录加载
        try {
          const basePath = `../tools/writing/${toolName}.js`
          const baseModule = await import(basePath)
          const BaseClass = baseModule.default || baseModule[toolName]
          
          if (BaseClass) {
            const baseInstance = new BaseClass()
            this.tools.set(toolName, baseInstance)
          }
        } catch (baseError) {
          console.warn(`无法加载工具 ${toolName}:`, error)
        }
      }
    }
  }

  /**
   * 获取已加载的工具
   */
  getTools(): AgentTool[] {
    this.updateAccessTime()
    return Array.from(this.tools.values())
  }

  /**
   * 获取工具映射
   */
  getToolsMap(): Map<string, AgentTool> {
    this.updateAccessTime()
    return this.tools
  }

  /**
   * 获取配置
   */
  getConfig(): AgentConfig | null {
    this.updateAccessTime()
    return this.agentConfig
  }

  /**
   * 更新访问时间
   */
  private updateAccessTime(): void {
    this.lastAccessTime = Date.now()
  }

  /**
   * 设置自动卸载定时器
   */
  private setUnloadTimer(): void {
    // 清除旧定时器
    if (this.unloadTimer) {
      clearTimeout(this.unloadTimer)
    }

    // 设置新定时器（默认 1 小时后卸载）
    const unloadDelay = 60 * 60 * 1000 // 1 hour
    this.unloadTimer = setTimeout(() => {
      const idleTime = Date.now() - this.lastAccessTime
      if (idleTime >= unloadDelay) {
        this.unload()
      } else {
        // 如果还在活跃，重新设置定时器
        this.setUnloadTimer()
      }
    }, unloadDelay)
  }

  /**
   * 卸载 Agent，释放资源
   */
  unload(): void {
    this.agentConfig = null
    this.tools.clear()
    
    if (this.unloadTimer) {
      clearTimeout(this.unloadTimer)
      this.unloadTimer = undefined
    }

    // 从实例缓存中移除
    AgentLoader.instances.delete(this.agentName)
  }

  /**
   * 检查 Agent 是否已加载
   */
  isLoaded(): boolean {
    return this.agentConfig !== null
  }

  /**
   * 获取所有已加载的 Agent
   */
  static getAllLoadedAgents(): string[] {
    return Array.from(this.instances.keys())
  }

  /**
   * 卸载所有 Agent
   */
  static unloadAll(): void {
    for (const [name, instance] of this.instances) {
      instance.unload()
    }
    this.instances.clear()
  }
}

/**
 * 便捷函数：加载 Agent
 */
export async function loadAgent(agentName: string): Promise<AgentConfig> {
  const loader = AgentLoader.getInstance(agentName)
  return loader.loadAgent()
}

/**
 * 便捷函数：获取 Agent 工具
 */
export function getAgentTools(agentName: string): AgentTool[] {
  const loader = AgentLoader.getInstance(agentName)
  return loader.getTools()
}

/**
 * 便捷函数：检查 Agent 是否已加载
 */
export function isAgentLoaded(agentName: string): boolean {
  const loader = AgentLoader.getInstance(agentName)
  return loader.isLoaded()
}