import { ParsedCommand, SlashCommand } from '../../types/command.js'

/**
 * 斜杠命令解析器
 * 完全复刻 Claude Code chunks.100.mjs:2048 的解析逻辑
 */
export class SlashCommandParser {
  /**
   * 解析斜杠命令
   * 复刻 Claude Code 的命令解析逻辑
   */
  parseCommand(input: string): ParsedCommand | null {
    // 检测斜杠命令
    if (!input.startsWith('/')) {
      return null
    }

    // 解析命令和参数（复刻原逻辑）
    const parts = input.slice(1).split(' ')
    let commandName = parts[0]
    let isMCP = false

    // MCP 命令检测
    if (parts.length > 1 && parts[1] === '(MCP)') {
      commandName = commandName + ' (MCP)'
      isMCP = true
    }

    if (!commandName) {
      throw new Error('Commands are in the form `/command [args]`')
    }

    // 命令分类
    const isCustom = commandName.includes(':')
    const type = isMCP ? 'mcp' : isCustom ? 'custom' : 'standard'
    const args = input.slice(commandName.length + 2)

    return {
      name: commandName,
      args,
      type,
      isMCP,
      isCustom
    }
  }

  /**
   * 命令验证（复刻 Zj2 函数）
   */
  validateCommand(commandName: string, availableCommands: SlashCommand[]): boolean {
    return availableCommands.some(cmd => 
      cmd.userFacingName() === commandName || 
      cmd.aliases?.includes(commandName)
    )
  }

  /**
   * 命令查找（复刻 cw1 函数）
   */
  findCommand(commandName: string, availableCommands: SlashCommand[]): SlashCommand | null {
    const command = availableCommands.find(cmd =>
      cmd.userFacingName() === commandName ||
      cmd.aliases?.includes(commandName)
    )

    return command || null
  }

  /**
   * 获取命令建议（当用户输入错误命令时）
   */
  getSuggestions(input: string, availableCommands: SlashCommand[]): string[] {
    const inputLower = input.toLowerCase()
    const suggestions: string[] = []
    
    for (const cmd of availableCommands) {
      // 检查命令名相似性
      if (this.calculateSimilarity(inputLower, cmd.name.toLowerCase()) > 0.6) {
        suggestions.push(cmd.name)
      }
      
      // 检查别名相似性
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          if (this.calculateSimilarity(inputLower, alias.toLowerCase()) > 0.6) {
            suggestions.push(alias)
          }
        }
      }
    }
    
    return suggestions.slice(0, 3) // 最多返回3个建议
  }

  /**
   * 计算字符串相似性（简单实现）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Levenshtein 距离算法
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * 解析命令参数
   */
  parseArguments(args: string): Record<string, string | boolean> {
    const parsed: Record<string, string | boolean> = {}
    const parts = args.split(' ').filter(part => part.trim())
    
    let i = 0
    while (i < parts.length) {
      const part = parts[i]
      
      if (part.startsWith('--')) {
        // 长选项
        const option = part.slice(2)
        
        if (option.includes('=')) {
          const [key, value] = option.split('=', 2)
          parsed[key] = value
        } else {
          // 检查下一个部分是否是值
          if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
            parsed[option] = parts[i + 1]
            i++
          } else {
            parsed[option] = true
          }
        }
      } else if (part.startsWith('-')) {
        // 短选项
        const option = part.slice(1)
        parsed[option] = true
      } else {
        // 位置参数
        parsed[`arg${Object.keys(parsed).filter(k => k.startsWith('arg')).length}`] = part
      }
      
      i++
    }
    
    return parsed
  }
}