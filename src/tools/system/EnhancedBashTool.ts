import { z } from 'zod'
import { spawn, SpawnOptions } from 'child_process'
import { EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult, ToolConfig } from '../../types/tool.js'

// 输入参数架构
const BashToolInputSchema = z.object({
  command: z.string().describe('要执行的命令'),
  description: z.string().optional().describe('命令描述（5-10个词）'),
  timeout: z.number().min(1000).max(600000).optional().default(120000).describe('超时时间（毫秒），最大10分钟'),
  run_in_background: z.boolean().optional().default(false).describe('是否在后台运行'),
  stream_output: z.boolean().optional().default(false).describe('是否流式输出结果'),
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
 * EnhancedBashTool - 增强的系统命令执行工具
 * 支持流式输出、后台进程管理和安全检查
 */
export class EnhancedBashTool implements EnhancedWritingTool {
  name = 'Bash'
  description = '执行系统命令。支持超时控制、后台执行、流式输出。可以运行文件操作、网络请求、程序启动等各种系统命令。'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'restricted'
  
  config: ToolConfig = {
    readOnly: false,
    concurrencySafe: false,
    requiresPermission: true,
    timeout: 600000, // 10分钟
    category: 'system'
  }

  // 后台进程管理
  private static backgroundProcesses = new Map<string, any>()

  /**
   * 主要执行方法
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { command, description, timeout, run_in_background, stream_output } = this.validateAndParseInput(input)
      
      // 如果请求流式输出，建议使用 executeStream
      if (stream_output) {
        // 转换为流式执行并收集所有结果
        const results: ToolResult[] = []
        for await (const result of this.executeStream(input)) {
          results.push(result)
        }
        
        // 返回最后一个结果（通常是汇总结果）
        return results[results.length - 1] || {
          success: false,
          error: '流式执行未产生结果'
        }
      }

      const startTime = Date.now()
      
      if (run_in_background) {
        return await this.executeInBackground(command, timeout)
      } else {
        return await this.executeCommand(command, timeout, startTime)
      }

    } catch (_error) {
      return {
        success: false,
        error: `命令执行失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 流式执行方法 - 实时输出命令结果
   */
  async* executeStream(input: ToolInput): AsyncGenerator<ToolResult, void, unknown> {
    try {
      const { command, timeout } = this.validateAndParseInput(input)
      
      yield {
        success: true,
        content: `🚀 开始执行命令: ${command}`,
        metadata: { status: 'starting', command }
      }
      
      const startTime = Date.now()
      
      // 创建子进程
      const childProcess = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      } as SpawnOptions)
      
      let stdout = ''
      let stderr = ''
      let hasOutput = false
      
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        childProcess.kill('SIGTERM')
        setTimeout(() => childProcess.kill('SIGKILL'), 5000)
      }, timeout)
      
      // 收集输出数据
      const stdoutChunks: string[] = []
      const stderrChunks: string[] = []
      
      childProcess.stdout?.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk
        stdoutChunks.push(chunk.trim())
        hasOutput = true
      })
      
      childProcess.stderr?.on('data', (data) => {
        const chunk = data.toString()
        stderr += chunk
        stderrChunks.push(chunk.trim())
        hasOutput = true
      })
      
      // 定期输出进度
      const progressInterval = setInterval(() => {
        if (hasOutput) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000)
          // 返回进度更新而不是直接 yield
          hasOutput = false // 重置标志
        }
      }, 2000)
      
      // 等待一小段时间让数据收集
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 等待进程结束
      const exitCode = await new Promise<number | null>((resolve) => {
        childProcess.on('close', (code) => {
          clearInterval(progressInterval)
          clearTimeout(timeoutHandle)
          resolve(code)
        })
        
        childProcess.on('error', (error) => {
          clearInterval(progressInterval)
          clearTimeout(timeoutHandle)
          resolve(null)
        })
      })
      
      const duration = Date.now() - startTime
      const success = exitCode === 0
      
      // 最终汇总结果
      yield {
        success,
        content: this.formatFinalResult(command, stdout, stderr, exitCode, duration),
        metadata: {
          command,
          exitCode,
          duration,
          stdout,
          stderr,
          status: 'completed'
        }
      }
      
    } catch (_error) {
      yield {
        success: false,
        error: `流式执行失败: ${(error as Error).message}`,
        metadata: { status: 'error' }
      }
    }
  }

  /**
   * 获取专用提示词
   */
  async getPrompt(options?: { safeMode?: boolean }): Promise<string> {
    return `Bash 工具用于执行系统命令，功能强大但需谨慎使用：

支持的功能：
- 文件和目录操作 (ls, cp, mv, rm, mkdir 等)
- 文本处理 (grep, sed, awk, sort 等)
- 网络操作 (curl, wget, ping 等)
- 程序编译和运行
- 系统信息查询
- 后台进程管理
- 流式输出显示

安全注意事项：
- 避免执行危险的系统命令 (如 rm -rf /)
- 网络命令在安全模式下可能被限制
- 长时间运行的命令建议使用流式输出
- 敏感操作需要用户确认

使用技巧：
- 使用 "stream_output": true 实时查看输出
- 使用 "run_in_background": true 后台执行长任务
- 设置合适的 timeout 避免命令超时
- 提供 description 说明命令用途

${options?.safeMode ? '\n⚠️ 当前处于安全模式，部分命令可能被限制' : ''}`
  }

  /**
   * 权限验证
   */
  async validatePermission(input: ToolInput, context?: ToolContext): Promise<PermissionResult> {
    const { command } = this.validateAndParseInput(input)
    
    // 危险命令检查
    const dangerousCommands = [
      'rm -rf /', 'rm -rf /*', 'rm -rf ~',
      'dd if=', 'mkfs', 'fdisk', 
      'format', 'del /s',
      ':(){ :|:& };:', // fork bomb
      'sudo rm -rf', 'sudo dd', 'sudo fdisk'
    ]
    
    const commandLower = command.toLowerCase()
    for (const dangerous of dangerousCommands) {
      if (commandLower.includes(dangerous)) {
        return {
          granted: false,
          reason: `危险命令被禁止: ${dangerous}`,
          warningMessage: '此命令可能造成系统损坏，已被安全系统阻止'
        }
      }
    }
    
    // 网络访问检查
    const networkCommands = ['curl', 'wget', 'nc', 'telnet', 'ssh', 'scp']
    const hasNetworkCommand = networkCommands.some(cmd => commandLower.includes(cmd))
    
    if (hasNetworkCommand && context?.safeMode) {
      return {
        granted: false,
        reason: '安全模式下不允许网络访问命令',
        warningMessage: '网络命令在安全模式下被限制，请关闭安全模式后重试'
      }
    }
    
    // 系统修改命令需要特别确认
    const systemCommands = ['sudo', 'su', 'chmod 777', 'chown root']
    const hasSystemCommand = systemCommands.some(cmd => commandLower.includes(cmd))
    
    return {
      granted: true,
      requiredPermissions: hasSystemCommand ? ['system:admin'] : ['system:execute'],
      warningMessage: hasSystemCommand ? '此命令需要系统管理员权限' : '即将执行系统命令'
    }
  }

  /**
   * 结果渲染
   */
  renderResult(result: ToolResult): string {
    if (result.metadata?.command) {
      const { command, exitCode, duration, stdout, stderr } = result.metadata
      
      let rendered = `命令: ${command}\n`
      rendered += `退出码: ${exitCode}\n`
      rendered += `执行时长: ${duration}ms\n\n`
      
      if (stdout) {
        rendered += `标准输出:\n${stdout}\n`
      }
      
      if (stderr) {
        rendered += `错误输出:\n${stderr}\n`
      }
      
      return rendered
    }
    
    return result.content || '命令执行完成'
  }

  /**
   * 输入验证
   */
  async validateInput(input: ToolInput): Promise<boolean> {
    try {
      BashToolInputSchema.parse(input)
      return true
    } catch {
      return false
    }
  }

  /**
   * 验证并解析输入
   */
  private validateAndParseInput(input: ToolInput): BashToolInput {
    return BashToolInputSchema.parse(input)
  }

  /**
   * 执行命令（非流式）
   */
  private async executeCommand(command: string, timeout: number, startTime: number): Promise<ToolResult> {
    return new Promise((resolve) => {
      const childProcess = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      } as SpawnOptions)
      
      let stdout = ''
      let stderr = ''
      let timedOut = false
      
      // 设置超时
      const timeoutHandle = setTimeout(() => {
        timedOut = true
        childProcess.kill('SIGTERM')
        setTimeout(() => childProcess.kill('SIGKILL'), 5000)
      }, timeout)
      
      // 收集输出
      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      
      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
      
      // 处理进程结束
      childProcess.on('close', (exitCode) => {
        clearTimeout(timeoutHandle)
        const duration = Date.now() - startTime
        
        const result: BashToolOutput = {
          command,
          success: exitCode === 0 && !timedOut,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
          timedOut
        }
        
        resolve({
          success: result.success,
          content: this.formatCommandResult(result),
          metadata: result
        })
      })
      
      childProcess.on('error', (error) => {
        clearTimeout(timeoutHandle)
        resolve({
          success: false,
          error: `进程启动失败: ${error.message}`,
          metadata: { command, duration: Date.now() - startTime }
        })
      })
    })
  }

  /**
   * 后台执行命令
   */
  private async executeInBackground(command: string, timeout: number): Promise<ToolResult> {
    const processId = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const childProcess = spawn('sh', ['-c', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      detached: true
    } as SpawnOptions)
    
    // 保存后台进程信息
    EnhancedBashTool.backgroundProcesses.set(processId, {
      process: childProcess,
      command,
      startTime: Date.now(),
      timeout
    })
    
    return {
      success: true,
      content: `命令已在后台启动\n命令: ${command}\n进程ID: ${processId}\nPID: ${childProcess.pid}`,
      metadata: {
        command,
        backgroundProcess: {
          pid: childProcess.pid || 0,
          processId
        }
      }
    }
  }

  /**
   * 格式化命令结果
   */
  private formatCommandResult(result: BashToolOutput): string {
    let output = `命令: ${result.command}\n`
    output += `执行时长: ${result.duration}ms\n`
    output += `退出码: ${result.exitCode}\n\n`
    
    if (result.timedOut) {
      output += '⚠️ 命令执行超时\n\n'
    }
    
    if (result.stdout) {
      output += `标准输出:\n${result.stdout}\n\n`
    }
    
    if (result.stderr) {
      output += `错误输出:\n${result.stderr}\n\n`
    }
    
    output += result.success ? '✅ 执行成功' : '❌ 执行失败'
    
    return output
  }

  /**
   * 格式化最终结果（流式输出用）
   */
  private formatFinalResult(command: string, stdout: string, stderr: string, exitCode: number | null, duration: number): string {
    const success = exitCode === 0
    let result = `\n📊 命令执行完成\n`
    result += `命令: ${command}\n`
    result += `退出码: ${exitCode}\n`
    result += `执行时长: ${duration}ms\n`
    result += success ? '✅ 执行成功' : '❌ 执行失败'
    
    return result
  }


  /**
   * 获取后台进程状态
   */
  static getBackgroundProcesses(): Map<string, any> {
    return EnhancedBashTool.backgroundProcesses
  }

  /**
   * 终止后台进程
   */
  static killBackgroundProcess(processId: string): boolean {
    const processInfo = EnhancedBashTool.backgroundProcesses.get(processId)
    if (processInfo && processInfo.process) {
      processInfo.process.kill('SIGTERM')
      EnhancedBashTool.backgroundProcesses.delete(processId)
      return true
    }
    return false
  }
}