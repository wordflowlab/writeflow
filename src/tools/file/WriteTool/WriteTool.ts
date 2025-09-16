import { z } from 'zod'
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext, PermissionResult } from '../../../Tool.js'
import { PROMPT } from './prompt.js'
import { hasWritePermission, pathInWorkingDirectory } from '../../../utils/permissions/filesystem.js'

// 输入参数架构
import { debugLog, logError, logWarn, infoLog } from './../../../utils/log.js'

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
    if (!input?.file_path) return false // 简化：默认不需要权限
    
    const filePath = input.file_path
    const isInWorkingDir = pathInWorkingDirectory(filePath)
    
    // 工作目录内的文件无需权限检查
    if (isInWorkingDir) {
      debugLog(`WriteTool: 工作目录内文件无需权限检查: ${filePath}`)
      return false
    }
    
    // 工作目录外的文件需要权限确认
    debugLog(`WriteTool: 工作目录外文件需要权限确认: ${filePath}`)
    return true
  }

  async checkPermissions(
    input: WriteToolInput,
    context: ToolUseContext,
  ): Promise<PermissionResult> {
    // 基础权限检查
    const baseResult = await super.checkPermissions(input, context)
    debugLog(`WriteTool: 基础权限检查结果: ${baseResult.isAllowed}`)
    if (!baseResult.isAllowed) {
      return baseResult
    }

    // 参考 Kode 简化权限检查：当前工作目录下的文件直接允许
    if (pathInWorkingDirectory(input.file_path)) {
      debugLog(`WriteTool: 工作目录内文件，直接允许: ${input.file_path}`)
      return { isAllowed: true }
    }

    // 工作目录外的文件需要检查权限
    if (!hasWritePermission(input.file_path)) {
      debugLog(`WriteTool: 工作目录外文件且无权限，需要用户确认: ${input.file_path}`)
      return {
        isAllowed: false,
        denialReason: `需要权限才能写入工作目录外的文件: ${input.file_path}`,
        behavior: 'ask',
      }
    }

    return { isAllowed: true }
  }

  async *call(
    input: WriteToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: WriteToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    try {
      // 1. 路径处理和验证
      const filePath = resolve(input.file_path)

      // 1.1 权限与安全模式再次校验（双保险）
      try {
        await this.checkFilePermissions(filePath, 'write', context)
      } catch (permErr) {
        yield {
          type: 'error',
          error: permErr instanceof Error ? permErr : new Error(String(permErr)),
          message: permErr instanceof Error ? permErr.message : String(permErr),
          resultForAssistant: permErr instanceof Error ? permErr.message : String(permErr),
        }
        return
      }
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
          yield {
            type: 'error',
            error: new Error(`创建目录失败: ${error instanceof Error ? error.message : String(error)}`),
            message: '创建目录失败',
            resultForAssistant: `创建目录失败: ${error instanceof Error ? error.message : String(error)}`
          }
          return
        }
      }

      // 4. 写入文件
      try {
        writeFileSync(filePath, input.content, 'utf8')
        debugLog('文件写入成功:', filePath)
      } catch (error) {
        logError('写入文件失败:', error)
        yield {
          type: 'error',
          error: new Error(`写入文件失败: ${error instanceof Error ? error.message : String(error)}`),
          message: '写入文件失败',
          resultForAssistant: `写入文件失败: ${error instanceof Error ? error.message : String(error)}`
        }
        return
      }

      // 5. 更新文件时间戳记录（类似 Kode 实现）
      if (context.readFileTimestamps) {
        const stats = statSync(filePath)
        context.readFileTimestamps[filePath] = stats.mtimeMs
      }

      // 6. 构建结果
      const contentBytes = Buffer.byteLength(input.content, 'utf8')
      const message = isNewFile 
        ? `新文件创建成功: ${fileName} (${contentBytes} 字节)`
        : `文件更新成功: ${fileName} (${originalSize} → ${contentBytes} 字节)`

      const result: WriteToolOutput = {
        success: true,
        filePath,
        bytesWritten: contentBytes,
        isNewFile,
        message
      }

      infoLog(message)
      
      // 使用 AsyncGenerator yield 返回结果
      yield {
        type: 'result',
        data: result,
        message: result.message,
        resultForAssistant: this.renderResultForAssistant(result)
      }

    } catch (error) {
      logError('WriteTool 执行失败:', error)
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        message: 'WriteTool 执行失败',
        resultForAssistant: `WriteTool 执行失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
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

}
