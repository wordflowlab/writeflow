import { SlashCommand, ParsedCommand, CommandResult, CommandExecutorConfig } from '@/types/command.js'
import { AgentContext } from '@/types/agent.js'
import { SlashCommandParser } from '@/cli/parser/slash-parser.js'
import { coreCommands } from '@/cli/commands/core-commands.js'

/**
 * 命令执行器
 * 负责解析和执行斜杠命令
 */
export class CommandExecutor {
  private parser = new SlashCommandParser()
  private availableCommands: SlashCommand[] = []
  private runningCommands = new Set<string>()

  constructor(private config: CommandExecutorConfig) {
    this.availableCommands = [...coreCommands]
  }

  /**
   * 注册新命令
   */
  registerCommand(command: SlashCommand): void {
    this.availableCommands.push(command)
  }

  /**
   * 注册多个命令
   */
  registerCommands(commands: SlashCommand[]): void {
    this.availableCommands.push(...commands)
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
    // JSX 命令的具体实现取决于 React 组件系统
    // 这里提供基础框架
    
    return {
      success: true,
      jsx: undefined, // 需要实际的 JSX 组件
      skipHistory: true
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