import { z } from 'zod'
import { existsSync, readFileSync, statSync } from 'fs'
import { resolve, extname } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext } from '../../../Tool.js'
import { PROMPT } from './prompt.js'

// 输入参数架构
const ReadToolInputSchema = z.object({
  file_path: z.string().describe('要读取的文件的绝对路径'),
  offset: z.number().optional().describe('开始读取的行号（从1开始）'),
  limit: z.number().optional().describe('读取的行数限制'),
})

type ReadToolInput = z.infer<typeof ReadToolInputSchema>

interface ReadToolOutput {
  content: string
  fileInfo: {
    path: string
    size: number
    extension: string
    lines: number
    isText: boolean
  }
}

/**
 * ReadTool - 文件读取工具
 * 参考 Claude Code Read 工具实现
 */
export class ReadTool extends ToolBase<typeof ReadToolInputSchema, ReadToolOutput> {
  name = 'Read'
  inputSchema = ReadToolInputSchema

  async description(): Promise<string> {
    return '读取文件内容。支持文本文件、代码文件、配置文件等。可以指定读取范围（行号偏移和限制）。'
  }

  async prompt(options?: { safeMode?: boolean }): Promise<string> {
    return PROMPT
  }

  isReadOnly(): boolean {
    return true
  }

  isConcurrencySafe(): boolean {
    return true
  }

  needsPermissions(): boolean {
    return false // 读取操作通常不需要特殊权限
  }

  async *call(
    input: ReadToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result'; data: ReadToolOutput; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* () {
      // 1. 路径验证和安全检查
      const filePath = resolve(input.file_path)
      
      if (!existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`)
      }

      // 2. 文件信息获取
      const stats = statSync(filePath)
      
      if (!stats.isFile()) {
        throw new Error(`路径不是文件: ${filePath}`)
      }

      const fileExtension = extname(filePath)
      
      // 3. 文件类型检测
      const isTextFile = ReadTool.isTextFile(fileExtension)
      
      if (!isTextFile) {
        yield {
          type: 'result' as const,
          data: {
            content: '[二进制文件，无法显示文本内容]',
            fileInfo: {
              path: filePath,
              size: stats.size,
              extension: fileExtension,
              lines: 0,
              isText: false
            }
          },
          resultForAssistant: `文件 ${filePath} 是二进制文件，无法读取文本内容。文件大小: ${stats.size} 字节`
        }
        return
      }

      // 4. 读取文件内容
      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch (error) {
        throw new Error(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 5. 处理行范围
      const lines = content.split('\n')
      const totalLines = lines.length

      let processedContent: string
      let displayLines: string[]

      if (input.offset !== undefined || input.limit !== undefined) {
        const startLine = Math.max(1, input.offset || 1) - 1 // 转换为0基索引
        const endLine = input.limit 
          ? Math.min(totalLines, startLine + input.limit)
          : totalLines

        displayLines = lines.slice(startLine, endLine)
        
        // 添加行号格式 (类似 cat -n)
        processedContent = displayLines
          .map((line, index) => {
            const lineNumber = startLine + index + 1
            return `${lineNumber.toString().padStart(5)}→${line}`
          })
          .join('\n')
      } else {
        // 完整文件，但限制最大显示行数
        const maxLines = 2000
        if (totalLines > maxLines) {
          displayLines = lines.slice(0, maxLines)
          processedContent = displayLines
            .map((line, index) => {
              const lineNumber = index + 1
              return `${lineNumber.toString().padStart(5)}→${line}`
            })
            .join('\n')
          processedContent += `\n\n[文件太长，仅显示前 ${maxLines} 行，共 ${totalLines} 行]`
        } else {
          processedContent = lines
            .map((line, index) => {
              const lineNumber = index + 1
              return `${lineNumber.toString().padStart(5)}→${line}`
            })
            .join('\n')
        }
      }

      // 6. 构建结果
      const result: ReadToolOutput = {
        content: processedContent,
        fileInfo: {
          path: filePath,
          size: stats.size,
          extension: fileExtension,
          lines: totalLines,
          isText: true
        }
      }

      // 7. 生成AI可读的结果描述
      const resultForAssistant = processedContent.length > 10000 
        ? `文件内容过长，已截断。文件路径: ${filePath}，总行数: ${totalLines}`
        : processedContent

      yield {
        type: 'result' as const,
        data: result,
        resultForAssistant
      }

    }.bind(this), context)
  }

  renderResultForAssistant(output: ReadToolOutput): string {
    return output.content
  }

  renderToolUseMessage(
    input: ReadToolInput,
    options: { verbose: boolean }
  ): string {
    const range = input.offset || input.limit 
      ? ` (行 ${input.offset || 1}-${(input.offset || 1) + (input.limit || 100) - 1})`
      : ''
    return `正在读取文件: ${input.file_path}${range}`
  }

  userFacingName(): string {
    return 'Read'
  }

  // 静态方法：检测文件是否为文本文件
  private static isTextFile(extension: string): boolean {
    const textExtensions = new Set([
      // 代码文件
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
      '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      '.sql', '.sh', '.bat', '.ps1', '.fish', '.zsh',
      
      // 配置和数据文件
      '.json', '.yaml', '.yml', '.toml', '.ini', '.env',
      '.xml', '.csv', '.tsv',
      
      // 文档文件
      '.md', '.rst', '.txt', '.log',
      
      // 其他文本文件
      '.gitignore', '.gitattributes', '.editorconfig',
      '.dockerfile', '.makefile'
    ])

    return textExtensions.has(extension.toLowerCase()) || extension === ''
  }
}
