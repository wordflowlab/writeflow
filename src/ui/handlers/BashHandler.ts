import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class BashHandler {
  private executionHistory: Array<{
    command: string
    output: string
    timestamp: Date
    success: boolean
  }> = []

  async executeCommand(command: string): Promise<string> {
    try {
      const startTime = Date.now()
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30秒超时
        maxBuffer: 1024 * 1024 // 1MB buffer
      })

      const output = stdout || stderr
      const executionTime = Date.now() - startTime
      
      // 记录执行历史
      this.executionHistory.push({
        command,
        output,
        timestamp: new Date(),
        success: !stderr
      })

      return stderr 
        ? `⚠️ ${output}\n执行时间: ${executionTime}ms`
        : `✅ ${output}\n执行时间: ${executionTime}ms`

    } catch (error) {
      const errorMessage = `❌ 命令执行失败: ${(error as Error).message}`
      
      this.executionHistory.push({
        command,
        output: errorMessage,
        timestamp: new Date(),
        success: false
      })

      return errorMessage
    }
  }

  getHistory(): Array<{ command: string; output: string; timestamp: Date; success: boolean }> {
    return [...this.executionHistory]
  }

  clearHistory(): void {
    this.executionHistory = []
  }
}