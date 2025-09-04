import { SlashCommand, ParsedCommand, CommandResult, CommandExecutorConfig } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { SlashCommandParser } from '../parser/slash-parser.js'
import { coreCommands } from '../commands/core-commands.js'
import { systemCommands } from '../commands/system-commands.js'
import { fileCommands } from '../commands/file-commands.js'
import { publishCommands } from '../commands/publish-commands.js'
import { styleCommands } from '../commands/style-commands.js'
import { todoCommands } from '../commands/todo-commands.js'

/**
 * 命令执行器
 * 负责解析和执行斜杠命令
 */
export class CommandExecutor {
  private parser = new SlashCommandParser()
  private availableCommands: SlashCommand[] = []
  private runningCommands = new Set<string>()

  constructor(private config: CommandExecutorConfig) {
    this.availableCommands = [
      ...coreCommands,
      ...systemCommands, 
      ...fileCommands,
      ...publishCommands,
      ...styleCommands,
      ...todoCommands
    ]
  }

  /**
   * 注册新命令
   */
  registerCommand(command: SlashCommand): void {
    // 检查是否已存在相同的命令
    const existingIndex = this.availableCommands.findIndex(
      cmd => cmd.name === command.name && cmd.userFacingName() === command.userFacingName()
    )
    
    if (existingIndex === -1) {
      this.availableCommands.push(command)
    }
  }

  /**
   * 注册多个命令
   */
  registerCommands(commands: SlashCommand[]): void {
    commands.forEach(command => {
      // 检查是否已存在相同的命令
      const existingIndex = this.availableCommands.findIndex(
        cmd => cmd.name === command.name && cmd.userFacingName() === command.userFacingName()
      )
      
      if (existingIndex === -1) {
        this.availableCommands.push(command)
      }
    })
  }

  /**
   * 获取所有可用命令
   */
  getAllCommands(): SlashCommand[] {
    return this.availableCommands
  }

  /**
   * 根据名称获取命令
   */
  getCommandByName(name: string): SlashCommand | null {
    return this.availableCommands.find(cmd => 
      cmd.userFacingName() === name || 
      cmd.aliases?.includes(name)
    ) || null
  }

  /**
   * 搜索命令
   */
  searchCommands(query: string): SlashCommand[] {
    const lowerQuery = query.toLowerCase()
    return this.availableCommands.filter(cmd => {
      const name = cmd.userFacingName().toLowerCase()
      const aliases = cmd.aliases?.map(a => a.toLowerCase()) || []
      return name.includes(lowerQuery) || 
             aliases.some(a => a.includes(lowerQuery))
    })
  }

  /**
   * 执行命令
   */
  async executeCommand(input: string, context: AgentContext): Promise<CommandResult> {
    try {
      // 解析命令
      const parsed = this.parser.parseCommand(input)
      if (!parsed) {
        return {
          success: false,
          error: '无效的命令格式'
        }
      }

      // 查找命令
      const command = this.parser.findCommand(parsed.name, this.availableCommands)
      if (!command) {
        const suggestions = this.parser.getSuggestions(parsed.name, this.availableCommands)
        const suggestionText = suggestions.length > 0 
          ? `\n建议的命令: ${suggestions.join(', ')}`
          : ''
        
        return {
          success: false,
          error: `未知命令: ${parsed.name}${suggestionText}`
        }
      }

      // 检查并发限制
      if (this.runningCommands.size >= this.config.maxConcurrentCommands) {
        return {
          success: false,
          error: '命令执行数量达到上限，请稍后重试'
        }
      }

      // 标记命令正在执行
      const commandId = `${command.name}_${Date.now()}`
      this.runningCommands.add(commandId)

      try {
        // 根据命令类型执行
        let result: CommandResult

        switch (command.type) {
          case 'local':
            result = await this.executeLocalCommand(command, parsed.args, context)
            break
            
          case 'prompt':
            result = await this.executePromptCommand(command, parsed.args, context)
            break
            
          case 'local-jsx':
            result = await this.executeJSXCommand(command, parsed.args, context)
            break
            
          default:
            throw new Error(`不支持的命令类型: ${command.type}`)
        }

        return result

      } finally {
        // 清理运行状态
        this.runningCommands.delete(commandId)
      }

    } catch (error) {
      return {
        success: false,
        error: `命令执行失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 执行本地命令
   */
  private async executeLocalCommand(
    command: SlashCommand, 
    args: string, 
    context: AgentContext
  ): Promise<CommandResult> {
    if (!command.call) {
      throw new Error(`本地命令 ${command.name} 缺少 call 方法`)
    }

    const content = await command.call(args, context)
    
    return {
      success: true,
      messages: [{
        role: 'assistant',
        content
      }]
    }
  }

  /**
   * 执行提示命令
   */
  private async executePromptCommand(
    command: SlashCommand,
    args: string, 
    context: AgentContext
  ): Promise<CommandResult> {
    if (!command.getPromptForCommand) {
      throw new Error(`提示命令 ${command.name} 缺少 getPromptForCommand 方法`)
    }

    const prompt = await command.getPromptForCommand(args, context)
    
    return {
      success: true,
      shouldQuery: true,
      messages: [{
        role: 'user',
        content: prompt
      }],
      allowedTools: command.allowedTools,
      maxThinkingTokens: this.config.enableThinkingTokens ? this.config.defaultMaxTokens : 0
    }
  }

  /**
   * 执行 JSX 命令
   */
  private async executeJSXCommand(
    command: SlashCommand,
    args: string,
    context: AgentContext
  ): Promise<CommandResult> {
    if (!command.call) {
      throw new Error(`JSX命令 ${command.name} 缺少 call 方法`)
    }

    try {
      // 调用命令获取 JSON 格式的结果
      const result = await command.call(args, context)
      
      // 解析 JSON 结果
      let data
      try {
        data = JSON.parse(result)
      } catch {
        // 如果不是有效的 JSON，作为普通消息处理
        return {
          success: true,
          messages: [{
            role: 'assistant',
            content: result
          }],
          skipHistory: false
        }
      }

      // 返回 JSX 类型的结果
      return {
        success: true,
        messages: [{
          role: 'assistant',
          content: result,
          jsx: true,  // 标记为 JSX 消息
          data: data  // 包含结构化数据
        }],
        skipHistory: false
      }
    } catch (error) {
      throw new Error(`JSX命令执行失败: ${(error as Error).message}`)
    }
  }

  /**
   * 获取可用命令列表
   */
  getAvailableCommands(): SlashCommand[] {
    return [...this.availableCommands]
  }

  /**
   * 获取正在执行的命令数量
   */
  getRunningCommandCount(): number {
    return this.runningCommands.size
  }
}