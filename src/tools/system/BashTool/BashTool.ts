import { z } from 'zod'
import { spawn, SpawnOptions } from 'child_process'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext, PermissionResult } from '../../../Tool.js'
import { PROMPT } from './prompt.js'

// 输入参数架构
const BashToolInputSchema = z.object({
  command: z.string().describe('要执行的命令'),
  description: z.string().optional().describe('命令描述（5-10个词）'),
  timeout: z.number().min(1000).max(600000).optional().default(120000).describe('超时时间（毫秒），最大10分钟'),
  run_in_background: z.boolean().optional().default(false).describe('是否在后台运行'),
})

type BashToolInput = z.infer<typeof BashToolInputSchema>

interface BashToolOutput {
  command: string
  success: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  duration: number
  timedOut: boolean
  backgroundProcess?: {
    pid: number
    processId: string
  }
}

/**
 * BashTool - 系统命令执行工具
 * 参考 Claude Code Bash 工具实现
 */
export class BashTool extends ToolBase<typeof BashToolInputSchema, BashToolOutput> {
  name = 'Bash'
  inputSchema = BashToolInputSchema

  // 后台进程管理
  private static backgroundProcesses = new Map<string, any>()

  async description(): Promise<string> {
    return '执行系统命令。支持超时控制、后台执行。可以运行任何系统命令，包括文件操作、网络请求、程序启动等。'
  }

  async prompt(options?: { safeMode?: boolean }): Promise<string> {
    return PROMPT
  }

  isReadOnly(): boolean {
    return false // 命令执行可能修改系统状态
  }

  isConcurrencySafe(): boolean {
    return false // 命令执行不是并发安全的
  }

  needsPermissions(input?: BashToolInput): boolean {
    return true // 系统命令总是需要权限检查
  }

  async checkPermissions(
    input: BashToolInput,
    context: ToolUseContext,
  ): Promise<PermissionResult> {
    // 基础权限检查
    const baseResult = await super.checkPermissions(input, context)
    if (!baseResult.isAllowed) {
      return baseResult
    }

    // 危险命令检查
    const dangerousCommands = [
      'rm -rf /', 'rm -rf /*', 'rm -rf ~',
      'dd if=', 'mkfs', 'fdisk',
      'sudo rm', 'sudo dd', 'sudo fdisk',
      'format', 'del /s',
      ':(){ :|:& };:', // fork bomb
    ]

    const command = (input as BashToolInput).command.toLowerCase()
    for (const dangerous of dangerousCommands) {
      if (command.includes(dangerous)) {
        return {
          isAllowed: false,
          denialReason: `危险命令被禁止: ${dangerous}`,
          behavior: 'deny',
        }
      }
    }

    // 网络访问检查
    const networkCommands = ['curl', 'wget', 'nc', 'telnet', 'ssh', 'scp', 'rsync']
    const hasNetworkCommand = networkCommands.some(cmd => command.includes(cmd))
    
    if (hasNetworkCommand && context.safeMode) {
      return {
        isAllowed: false,
        denialReason: '安全模式下不允许网络访问命令',
        behavior: 'deny',
      }
    }

    return { isAllowed: true }
  }

  async *call(
    input: BashToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result'; data: BashToolOutput; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* (this: BashTool) {
      const startTime = Date.now()
      const command = (input as BashToolInput).command.trim()

      if (!command) {
        throw new Error('命令不能为空')
      }

      // 为后台进程生成唯一ID
      const processId = (input as BashToolInput).run_in_background 
        ? `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        : undefined

      try {
        if ((input as BashToolInput).run_in_background) {
          // 后台执行
          const result = await this.executeInBackground(command, (input as BashToolInput).timeout, processId!)
          yield {
            type: 'result' as const,
            data: result,
            resultForAssistant: this.formatBackgroundResult(result),
          }
        } else {
          // 前台执行
          const result = await this.executeCommand(command, (input as BashToolInput).timeout)
          yield {
            type: 'result' as const,
            data: result,
            resultForAssistant: this.formatResult(result),
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const duration = Date.now() - startTime
        
        const result: BashToolOutput = {
          command,
          success: false,
          exitCode: null,
          stdout: '',
          stderr: errorMessage,
          duration,
          timedOut: errorMessage.includes('timeout'),
        }

        yield {
          type: 'result' as const,
          data: result,
          resultForAssistant: `命令执行失败: ${errorMessage}`,
        }
      }

    }.bind(this), this.name)
  }

  renderResultForAssistant(output: BashToolOutput): string {
    if (output.backgroundProcess) {
      return this.formatBackgroundResult(output)
    }
    return this.formatResult(output)
  }

  renderToolUseMessage(
    input: BashToolInput,
    options: { verbose: boolean },
  ): string {
    const description = input.description || '执行命令'
    const mode = input.run_in_background ? '（后台）' : ''
    const commandPreview = options.verbose ? `: ${input.command}` : ''
    return `${description}${mode}${commandPreview}`
  }

  userFacingName(): string {
    return 'Bash'
  }

  // 执行命令（前台）
  private executeCommand(command: string, timeout: number): Promise<BashToolOutput> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      let stdout = ''
      let stderr = ''
      let timedOut = false

      // 解析命令和参数
      const shell = process.platform === 'win32' ? 'cmd' : 'bash'
      const shellFlag = process.platform === 'win32' ? '/c' : '-c'
      
      const child = spawn(shell, [shellFlag, command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        cwd: process.cwd(),
        timeout,
      })

      // 设置超时
      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        // 如果温和终止失败，使用强制终止
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL')
          }
        }, 5000)
      }, timeout)

      // 收集输出
      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        const duration = Date.now() - startTime

        resolve({
          command,
          success: code === 0 && !timedOut,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
          timedOut,
        })
      })

      child.on('error', (error) => {
        clearTimeout(timer)
        const duration = Date.now() - startTime

        resolve({
          command,
          success: false,
          exitCode: null,
          stdout: stdout.trim(),
          stderr: error.message,
          duration,
          timedOut,
        })
      })
    })
  }

  // 执行命令（后台）
  private async executeInBackground(
    command: string,
    timeout: number,
    processId: string,
  ): Promise<BashToolOutput> {
    const startTime = Date.now()

    const shell = process.platform === 'win32' ? 'cmd' : 'bash'
    const shellFlag = process.platform === 'win32' ? '/c' : '-c'

    const child = spawn(shell, [shellFlag, command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env },
      cwd: process.cwd(),
    })

    // 存储后台进程
    BashTool.backgroundProcesses.set(processId, {
      process: child,
      command,
      startTime,
      timeout,
      stdout: '',
      stderr: '',
    })

    const duration = Date.now() - startTime

    return {
      command,
      success: true,
      exitCode: null,
      stdout: `后台进程已启动 (PID: ${child.pid})`,
      stderr: '',
      duration,
      timedOut: false,
      backgroundProcess: {
        pid: child.pid!,
        processId,
      },
    }
  }

  // 格式化结果
  private formatResult(output: BashToolOutput): string {
    const parts = []

    if (output.success) {
      parts.push(`命令执行成功 (${output.duration}ms)`)
    } else {
      parts.push(`命令执行失败 (退出码: ${output.exitCode}, 耗时: ${output.duration}ms)`)
    }

    if (output.stdout) {
      parts.push('', '输出:', output.stdout)
    }

    if (output.stderr) {
      parts.push('', '错误:', output.stderr)
    }

    if (output.timedOut) {
      parts.push('', '注意: 命令因超时被终止')
    }

    return parts.join('\n')
  }

  // 格式化后台进程结果
  private formatBackgroundResult(output: BashToolOutput): string {
    if (!output.backgroundProcess) {
      return this.formatResult(output)
    }

    return [
      `后台命令已启动:`,
      `命令: ${output.command}`,
      `进程ID: ${output.backgroundProcess.pid}`,
      `进程标识: ${output.backgroundProcess.processId}`,
      '',
      '使用 BashOutput 工具监控输出',
      '使用 KillBash 工具终止进程',
    ].join('\n')
  }

  // 静态方法：获取后台进程
  static getBackgroundProcess(processId: string) {
    return BashTool.backgroundProcesses.get(processId)
  }

  // 静态方法：列出所有后台进程
  static listBackgroundProcesses() {
    return Array.from(BashTool.backgroundProcesses.entries()).map(([id, proc]) => ({
      processId: id,
      pid: proc.process.pid,
      command: proc.command,
      startTime: proc.startTime,
    }))
  }

  // 静态方法：终止后台进程
  static killBackgroundProcess(processId: string): boolean {
    const proc = BashTool.backgroundProcesses.get(processId)
    if (!proc) {
      return false
    }

    try {
      proc.process.kill('SIGTERM')
      BashTool.backgroundProcesses.delete(processId)
      return true
    } catch (error) {
      return false
    }
  }
}