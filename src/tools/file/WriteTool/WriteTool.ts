import { z } from 'zod'
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext, PermissionResult } from '../../../Tool.js'
import { PROMPT } from './prompt.js'

// 输入参数架构
const WriteToolInputSchema = z.object({
  file_path: z.string().describe('要写入的文件的绝对路径'),
  content: z.string().describe('要写入文件的内容'),
})

type WriteToolInput = z.infer<typeof WriteToolInputSchema>

interface WriteToolOutput {
  success: boolean
  filePath: string
  bytesWritten: number
  isNewFile: boolean
  message: string
}

/**
 * WriteTool - 文件写入工具
 * 参考 Claude Code Write 工具实现
 */
export class WriteTool extends ToolBase<typeof WriteToolInputSchema, WriteToolOutput> {
  name = 'Write'
  inputSchema = WriteToolInputSchema
  category = 'file' as const

  async description(): Promise<string> {
    return '将内容写入文件。如果文件不存在会创建新文件，如果存在会完全覆盖原内容。会自动创建所需的目录结构。'
  }

  async prompt(options?: { safeMode?: boolean }): Promise<string> {
    return PROMPT
  }

  isReadOnly(): boolean {
    return false
  }

  isConcurrencySafe(): boolean {
    return false // 文件写入不是并发安全的
  }

  needsPermissions(input?: WriteToolInput): boolean {
    return true // 写入操作总是需要权限检查
  }

  async checkPermissions(
    input: WriteToolInput,
    context: ToolUseContext
  ): Promise<PermissionResult> {
    // 基础权限检查
    const baseResult = await super.checkPermissions(input, context)
    if (!baseResult.isAllowed) {
      return baseResult
    }

    try {
      // 检查文件写入权限
      await this.checkFilePermissions(input.file_path, 'write', context)
      
      // 检查是否为敏感文件
      if (this.isSensitiveFile(input.file_path)) {
        return {
          isAllowed: false,
          denialReason: `不允许写入敏感系统文件: ${input.file_path}`,
          behavior: 'deny'
        }
      }

      return { isAllowed: true }
    } catch (error) {
      return {
        isAllowed: false,
        denialReason: error instanceof Error ? error.message : String(error),
        behavior: 'deny'
      }
    }
  }

  async *call(
    input: WriteToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: WriteToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* () {
      // 1. 路径处理和验证
      const filePath = resolve(input.file_path)
      const fileDir = dirname(filePath)
      const fileName = basename(filePath)
      
      // 2. 检查是否为新文件
      const isNewFile = !existsSync(filePath)
      let originalSize = 0
      
      if (!isNewFile) {
        const stats = statSync(filePath)
        originalSize = stats.size
      }

      // 3. 确保目录存在
      if (!existsSync(fileDir)) {
        try {
          mkdirSync(fileDir, { recursive: true })
        } catch (error) {
          throw new Error(`创建目录失败: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // 4. 内容预处理
      const content = input.content
      const contentBytes = Buffer.byteLength(content, 'utf8')

      // 5. 写入文件
      try {
        writeFileSync(filePath, content, 'utf8')
      } catch (error) {
        throw new Error(`写入文件失败: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 6. 验证写入结果
      let actualSize = 0
      try {
        const stats = statSync(filePath)
        actualSize = stats.size
      } catch (error) {
        console.warn('无法验证文件写入结果:', error)
      }

      // 7. 构建结果
      const message = isNewFile 
        ? `新文件创建成功: ${fileName} (${contentBytes} 字节)`
        : `文件更新成功: ${fileName} (${originalSize} → ${actualSize} 字节)`

      const result: WriteToolOutput = {
        success: true,
        filePath,
        bytesWritten: contentBytes,
        isNewFile,
        message
      }

      const resultForAssistant = `文件已成功写入: ${filePath}\n${message}\n\n文件内容预览 (前200字符):\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`

      yield {
        type: 'result' as const,
        data: result,
        resultForAssistant
      }

    }.bind(this), context)
  }

  renderResultForAssistant(output: WriteToolOutput): string {
    return output.message
  }

  renderToolUseMessage(
    input: WriteToolInput,
    options: { verbose: boolean }
  ): string {
    const contentPreview = options.verbose 
      ? ` 内容长度: ${input.content.length} 字符`
      : ''
    return `正在写入文件: ${input.file_path}${contentPreview}`
  }

  userFacingName(): string {
    return 'Write'
  }

  // 检查是否为敏感文件
  private isSensitiveFile(filePath: string): boolean {
    const sensitivePatterns = [
      // 系统文件
      '/etc/',
      '/bin/',
      '/sbin/',
      '/usr/bin/',
      '/usr/sbin/',
      
      // 配置文件
      '/.ssh/',
      '/.aws/',
      
      // 常见敏感文件名
      'passwd',
      'shadow',
      'sudoers',
      '.env.production',
      '.env.prod',
      'id_rsa',
      'id_ed25519',
      
      // 系统库
      'node_modules/',
      '.git/',
    ]

    const normalizedPath = filePath.toLowerCase()
    return sensitivePatterns.some(pattern => normalizedPath.includes(pattern))
  }
}