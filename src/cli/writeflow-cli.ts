#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { WriteFlowApp } from './writeflow-app.js'
import { AIWritingConfig } from '../types/writing.js'

/**
 * WriteFlow CLI 主入口
 * 完整的命令行界面实现
 */
export class WriteFlowCLI {
  private app: WriteFlowApp
  private program: Command

  constructor() {
    this.program = new Command()
    this.app = new WriteFlowApp()
    this.setupCommands()
  }

  /**
   * 设置命令行界面
   */
  private setupCommands(): void {
    this.program
      .name('writeflow')
      .description('WriteFlow AI 写作助手')
      .version('1.0.0')

    // 交互式模式（默认）
    this.program
      .command('start')
      .alias('s')
      .description('启动交互式写作助手')
      .option('-m, --model <model>', '指定AI模型', 'claude-3-sonnet-20240229')
      .option('-c, --config <path>', '指定配置文件路径')
      .action(async (options) => {
        await this.startInteractiveMode(options)
      })

    // 直接执行斜杠命令
    this.program
      .command('exec <command>')
      .alias('e')
      .description('直接执行斜杠命令（如：/outline AI技术）')
      .action(async (command, options) => {
        await this.executeSlashCommand(command, options)
      })

    // 配置管理
    this.program
      .command('config')
      .description('配置管理')
      .option('--set <key=value>', '设置配置项')
      .option('--get <key>', '获取配置项')
      .option('--list', '列出所有配置')
      .action(async (options) => {
        await this.manageConfig(options)
      })

    // 状态检查
    this.program
      .command('status')
      .description('查看系统状态')
      .action(async () => {
        await this.showStatus()
      })

    // 默认命令（无参数时进入交互模式）
    this.program
      .action(async () => {
        await this.startInteractiveMode({})
      })
  }

  /**
   * 启动交互式模式
   */
  private async startInteractiveMode(options: any): Promise<void> {
    console.log(chalk.cyan.bold('🚀 WriteFlow AI 写作助手'))
    console.log(chalk.gray('输入斜杠命令开始使用，输入 /help 查看帮助\n'))

    try {
      await this.app.initialize(options)
      await this.app.startInteractiveSession()
    } catch (error) {
      console.error(chalk.red(`启动失败: ${(error as Error).message}`))
      process.exit(1)
    }
  }

  /**
   * 执行单个斜杠命令
   */
  private async executeSlashCommand(command: string, options: any): Promise<void> {
    // 确保命令以斜杠开头
    if (!command.startsWith('/')) {
      command = '/' + command
    }

    const spinner = ora(`执行命令: ${command}`).start()

    try {
      await this.app.initialize(options)
      const result = await this.app.executeCommand(command, options)
      
      spinner.succeed('命令执行完成')
      console.log(result)

    } catch (error) {
      spinner.fail('命令执行失败')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  }


  /**
   * 管理配置
   */
  private async manageConfig(options: any): Promise<void> {
    try {
      await this.app.initialize()

      if (options.set) {
        const [key, value] = options.set.split('=')
        await this.app.setConfig(key, value)
        console.log(chalk.green(`配置已设置: ${key} = ${value}`))
      } else if (options.get) {
        const value = await this.app.getConfig(options.get)
        console.log(`${options.get}: ${value}`)
      } else if (options.list) {
        const config = await this.app.getAllConfig()
        console.log(chalk.cyan('当前配置:'))
        console.log(JSON.stringify(config, null, 2))
      } else {
        console.log(chalk.yellow('请指定配置操作: --set, --get, 或 --list'))
      }

    } catch (error) {
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  }

  /**
   * 显示状态
   */
  private async showStatus(): Promise<void> {
    try {
      await this.app.initialize()
      const status = await this.app.getSystemStatus()
      
      console.log(chalk.cyan.bold('📊 WriteFlow 系统状态'))
      console.log(chalk.gray('─'.repeat(40)))
      
      Object.entries(status).forEach(([key, value]) => {
        const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase()
        console.log(`${displayKey}: ${chalk.green(value)}`)
      })

    } catch (error) {
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  }

  /**
   * 运行CLI
   */
  async run(): Promise<void> {
    try {
      await this.program.parseAsync()
    } catch (error) {
      console.error(chalk.red(`WriteFlow CLI 错误: ${(error as Error).message}`))
      process.exit(1)
    }
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new WriteFlowCLI()
  cli.run()
}