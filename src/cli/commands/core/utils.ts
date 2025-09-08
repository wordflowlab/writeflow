import { SlashCommand } from '../../../types/command.js'

/**
 * 辅助函数：提取选项参数
 */
export function extractOption(options: string[], optionName: string): string | undefined {
  for (const option of options) {
    if (option.startsWith(`--${optionName}=`)) {
      return option.split('=')[1]
    }
  }
  return undefined
}

/**
 * 辅助函数：获取命令帮助信息
 */
export function getCommandHelp(commandName: string, commands: SlashCommand[]): string {
  const command = commands.find(cmd => 
    cmd.name === commandName || 
    cmd.aliases?.includes(commandName)
  )

  if (!command) {
    return `命令 '${commandName}' 不存在。使用 /help 查看所有可用命令。`
  }

  let help = `📝 ${command.name} - ${command.description}\n\n`
  
  if (command.usage) {
    help += `📋 用法: ${command.usage}\n\n`
  }
  
  if (command.aliases && command.aliases.length > 0) {
    help += `🔗 别名: ${command.aliases.join(', ')}\n\n`
  }
  
  if (command.examples && command.examples.length > 0) {
    help += `💡 示例:\n`
    command.examples.forEach(example => {
      help += `  ${example}\n`
    })
    help += `\n`
  }
  
  if (command.allowedTools && command.allowedTools.length > 0) {
    help += `🛠️ 可用工具: ${command.allowedTools.join(', ')}\n`
  }

  return help
}