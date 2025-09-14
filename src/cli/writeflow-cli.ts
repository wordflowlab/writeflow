#!/usr/bin/env node

import { debugLog, logError, logWarn, infoLog } from './../utils/log.js'
import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import React from 'react'
import { render } from 'ink'
import { WriteFlowApp } from './writeflow-app.js'
import { AIWritingConfig } from '../types/writing.js'
import { displayCLILogo, displayMiniLogo } from '../utils/cli-logo.js'
import { getVersion } from '../utils/version.js'
import { getGlobalConfig, shouldShowOnboarding } from '../utils/config.js'
import { WriteFlowOnboarding } from '../ui/components/onboarding/WriteFlowOnboarding.js'
import { WriteFlowREPL } from '../ui/WriteFlowREPL.js'
import { displayWelcomeBanner } from '../utils/welcome.js'

/**
 * WriteFlow CLI 主入口
 * 完整的命令行界面实现
 */
export class WriteFlowCLI {
  private app: WriteFlowApp
  private program: Command
  private keepAlive?: NodeJS.Timeout

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
      .version(getVersion())

    // 交互式模式（默认）
    this.program
      .command('start')
      .alias('s')
      .description('启动交互式写作助手')
      .option('-m, --model <model>', '指定AI模型', 'claude-4-sonnet-20250506')
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
    try {
      // 显示 ASCII 艺术 Logo
      displayCLILogo()
      
      // 检查是否需要显示引导
      if (shouldShowOnboarding()) {
        // 显示引导流程
        await this.showOnboarding()
      }

      // 初始化应用
      await this.app.initialize(options)
      
      // 启动提示：在进入 UI 前输出一次欢迎横幅
      // 这样可以与 \"WriteFlow 初始化完成\" 串联，恢复旧版的欢迎框体验
      displayWelcomeBanner()
      
      // 启动 React UI
      this.startReactUI()

    } catch (error) {
      logError(chalk.red(`启动失败: ${(error as Error).message}`))
      process.exit(1)
    }
  }

  /**
   * 显示引导流程
   */
  private async showOnboarding(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onboardingComponent = React.createElement(WriteFlowOnboarding, {
        onComplete: () => {
          try {
            // 引导完成，清理并继续
            unmount()
            // 给一点时间让组件完全卸载
            setTimeout(() => {
              resolve()
            }, 100)
          } catch (error) {
            logError(chalk.red('引导完成时出错:'), error)
            reject(error)
          }
        },
        onExit: () => {
          debugLog(chalk.yellow('\n👋 引导已取消，您可以随时运行 writeflow start 重新开始'))
          process.exit(0)
        },
      })

      const { unmount } = render(onboardingComponent)
    })
  }

  /**
   * 启动 React UI
   */
  private startReactUI(): void {
    try {
      // 标记当前为交互模式，供全局异常处理判断，避免错误时直接退出
      (global as any).WRITEFLOW_INTERACTIVE = true
      // 注入全局 APP 实例，供 /status 等命令友好读取
      ;(global as any).WRITEFLOW_APP_INSTANCE = this.app

      // 确保应用已正确初始化
      if (!this.app) {
        throw new Error('WriteFlowApp 未初始化')
      }

      const replComponent = React.createElement(WriteFlowREPL, {
        writeFlowApp: this.app,
      })

      // 保活：Ink 在所有 UI 卸载时可能导致进程自然退出，这里用定时 no-op 防止提前退出
      this.keepAlive?.hasRef && this.keepAlive.unref()
      this.keepAlive = setInterval(() => {}, 1 << 30) // 超长间隔，仅用于保持事件循环

      render(replComponent)
    } catch (error) {
      logError(chalk.red('启动主界面失败:'), error)
      debugLog(chalk.yellow('请尝试重新运行 writeflow 或联系支持'))
      process.exit(1)
    }
  }

  /**
   * 执行单个斜杠命令
   */
  private async executeSlashCommand(command: string, options: any): Promise<void> {
    // 确保命令以斜杠开头
    if (!command.startsWith('/')) {
      command = `/${  command}`
    }

    // 显示简化版Logo
    debugLog(`${displayMiniLogo()} ${chalk.gray('AI Writing Assistant')}`)
    debugLog('')

    const spinner = ora(`执行命令: ${command}`).start()

    try {
      await this.app.initialize(options)
      const result = await this.app.executeCommand(command, options)
      
      spinner.succeed('命令执行完成')
      debugLog(result)

    } catch (error) {
      spinner.fail('命令执行失败')
      logError(chalk.red((error as Error).message))
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
        debugLog(chalk.green(`配置已设置: ${key} = ${value}`))
      } else if (options.get) {
        const value = await this.app.getConfig(options.get)
        debugLog(`${options.get}: ${value}`)
      } else if (options.list) {
        const config = await this.app.getAllConfig()
        debugLog(chalk.cyan('当前配置:'))
        debugLog(JSON.stringify(config, null, 2))
      } else {
        debugLog(chalk.yellow('请指定配置操作: --set, --get, 或 --list'))
      }

    } catch (error) {
      logError(chalk.red((error as Error).message))
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

      debugLog(chalk.cyan.bold('📊 WriteFlow 系统状态'))
      debugLog(chalk.gray('─'.repeat(40)))

      const simple = { ...status }
      // 特殊结构字段友好打印
      if (simple.memory) delete (simple as any).memory
      if (simple.context) delete (simple as any).context

      Object.entries(simple).forEach(([key, value]) => {
        const displayKey = key.replace(/([A-Z])/g, ' $1').toLowerCase()
        debugLog(`${displayKey}: ${chalk.green(String(value))}`)
      })

      // 打印 context 摘要
      if ((status as any).context) {
        const ctx = (status as any).context
        debugLog(chalk.gray('\nContext'))
        debugLog(`  tokens: ${chalk.green(`${ctx.currentTokens}/${ctx.maxTokens}`)} (${(ctx.utilizationRatio*100).toFixed(1)}%)`)
        if (ctx.lastCompression) debugLog(`  last compression: ${chalk.green(new Date(ctx.lastCompression).toLocaleString())}`)
      }

      // 打印 memory 摘要
      if ((status as any).memory) {
        const mem = (status as any).memory
        debugLog(chalk.gray('\nMemory'))
        debugLog(`  short-term: ${chalk.green(`${mem.shortTerm.messages} msgs, ${mem.shortTerm.tokens} tokens`)}`)
        debugLog(`  mid-term: ${chalk.green(`${mem.midTerm.summaries} summaries, ${mem.midTerm.sessions} sessions`)}`)
        debugLog(`  long-term: ${chalk.green(`${mem.longTerm.knowledge} knowledge, ${mem.longTerm.topics} topics`)}`)
      }

    } catch (error) {
      logError(chalk.red((error as Error).message))
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
      logError(chalk.red(`WriteFlow CLI 错误: ${(error as Error).message}`))
      process.exit(1)
    }
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new WriteFlowCLI()
  cli.run()
}
