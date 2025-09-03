/**
 * 命令注册表
 * 管理所有可用命令及其别名的中央注册表
 */

import { SlashCommand } from '../types/command.js'
import { advancedMatcher } from './advancedFuzzyMatcher.js'

export interface CommandSuggestion {
  command: SlashCommand
  score: number
  algorithm: string
  displayValue: string
  value: string
}

export class CommandRegistry {
  private static instance: CommandRegistry | null = null
  private commands: Map<string, SlashCommand> = new Map()
  private aliases: Map<string, string> = new Map()

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry()
    }
    return CommandRegistry.instance
  }

  /**
   * 注册命令
   */
  registerCommand(command: SlashCommand | { name: string; description: string; aliases?: string[] }): void {
    // 兼容两种输入格式
    let name: string
    let cmdToStore: SlashCommand
    
    if ('type' in command && 'userFacingName' in command) {
      // 完整的 SlashCommand 对象
      name = command.userFacingName()
      cmdToStore = command
    } else {
      // 简化格式，转换为 SlashCommand
      name = command.name
      cmdToStore = {
        type: 'prompt' as const,
        name: command.name,
        description: command.description,
        aliases: command.aliases,
        userFacingName: () => command.name
      } as SlashCommand
    }
    
    this.commands.set(name, cmdToStore)
    
    // 注册别名
    const aliases = 'aliases' in command && command.aliases ? command.aliases : []
    for (const alias of aliases) {
      this.aliases.set(alias, name)
    }
  }

  /**
   * 批量注册命令
   */
  registerCommands(commands: SlashCommand[]): void {
    for (const command of commands) {
      this.registerCommand(command)
    }
  }

  /**
   * 获取所有命令
   */
  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * 根据名称获取命令
   */
  getCommand(name: string): SlashCommand | null {
    // 首先尝试直接匹配
    if (this.commands.has(name)) {
      return this.commands.get(name)!
    }
    
    // 尝试别名匹配
    const resolvedName = this.aliases.get(name)
    if (resolvedName && this.commands.has(resolvedName)) {
      return this.commands.get(resolvedName)!
    }
    
    return null
  }

  /**
   * 解析别名
   */
  resolveAlias(alias: string): string | null {
    return this.aliases.get(alias) || null
  }

  /**
   * 搜索匹配的命令
   */
  searchCommands(query: string, maxResults: number = 10): CommandSuggestion[] {
    if (!query) {
      // 如果没有查询，返回所有命令
      return this.getAllCommands()
        .slice(0, maxResults)
        .map(cmd => ({
          command: cmd,
          score: 100,
          algorithm: 'all',
          displayValue: `/${cmd.userFacingName()} - ${cmd.description}`,
          value: cmd.userFacingName()
        }))
    }

    const suggestions: CommandSuggestion[] = []
    
    // 搜索所有命令
    for (const command of this.commands.values()) {
      const name = command.userFacingName()
      const matchResult = advancedMatcher.match(name, query)
      
      if (matchResult.matched) {
        suggestions.push({
          command,
          score: matchResult.score,
          algorithm: matchResult.algorithm,
          displayValue: `/${name} - ${command.description}`,
          value: name
        })
      }
      
      // 也搜索别名
      if (command.aliases) {
        for (const alias of command.aliases) {
          const aliasMatch = advancedMatcher.match(alias, query)
          if (aliasMatch.matched && aliasMatch.score > 50) {
            // 别名匹配的分数稍低
            suggestions.push({
              command,
              score: aliasMatch.score * 0.8,
              algorithm: `alias-${aliasMatch.algorithm}`,
              displayValue: `/${name} (${alias}) - ${command.description}`,
              value: name
            })
          }
        }
      }
    }
    
    // 按分数排序并限制结果数量
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
  }

  /**
   * 获取命令的子命令建议
   */
  getSubcommandSuggestions(commandName: string, subQuery: string = ''): string[] {
    const command = this.getCommand(commandName)
    if (!command) return []
    
    // 基于命令的 examples 提取子命令
    if (command.examples) {
      const subcommands: Set<string> = new Set()
      
      for (const example of command.examples) {
        // 从示例中提取子命令
        // 例如: "/slide create ..." -> "create"
        const match = example.match(new RegExp(`^/${commandName}\\s+(\\w+)`))
        if (match) {
          subcommands.add(match[1])
        }
      }
      
      if (!subQuery) {
        return Array.from(subcommands)
      }
      
      // 过滤匹配的子命令
      return Array.from(subcommands).filter(sub => 
        sub.toLowerCase().startsWith(subQuery.toLowerCase())
      )
    }
    
    return []
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.commands.clear()
    this.aliases.clear()
  }

  /**
   * 获取命令数量
   */
  get size(): number {
    return this.commands.size
  }
}

// 导出全局实例
export const commandRegistry = CommandRegistry.getInstance()