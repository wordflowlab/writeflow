import { z } from 'zod'
import { readFileSync, statSync } from 'fs'
import { resolve, relative, extname } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext } from '../../../Tool.js'

const ReadToolInputSchema = z.object({
  path: z.string().describe('要读取的文件路径，可相对当前工作目录或绝对路径'),
  offset: z.number().int().nonnegative().optional().describe('起始行(0-based)，仅对文本文件生效'),
  limit: z.number().int().positive().optional().describe('读取的最大行数，仅对文本文件生效'),
})

type ReadToolInput = z.infer<typeof ReadToolInputSchema>

interface ReadToolOutput {
  absolutePath: string
  relativePath: string
  isText: boolean
  size: number
  ext: string
  totalLines?: number
  shownRange?: { start: number; end: number }
  contentPreview?: string
  message: string
}

export class ReadTool extends ToolBase<typeof ReadToolInputSchema, ReadToolOutput> {
  name = 'Read'
  inputSchema = ReadToolInputSchema
  category = 'file' as const

  async description(): Promise<string> {
    return '读取指定文件内容。支持相对路径，文本文件可按行分页读取(offset/limit)。大文件自动截断并给出继续读取指引。'
  }

  async prompt(): Promise<string> {
    return '当需要查看文件内容时使用 Read 工具。优先传入相对路径，如 a.md；需要分页时提供 offset 与 limit。'
  }

  isReadOnly(): boolean { return true }
  isConcurrencySafe(): boolean { return true }
  needsPermissions(): boolean { return false }

  async *call(
    input: ReadToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: ReadToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* (this: ReadTool): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: ReadToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
      const cwd = process.cwd()
      const absolutePath = resolve(cwd, input.path)

      let stat
      try {
        stat = statSync(absolutePath)
        if (!stat.isFile()) {
          throw new Error(`目标不是普通文件: ${absolutePath}`)
        }
      } catch (e: any) {
        if (e?.code === 'ENOENT') throw new Error(`文件不存在: ${absolutePath}`)
        throw e
      }

      const rel = relative(cwd, absolutePath)
      const ext = extname(absolutePath).toLowerCase()

      // 简单判定文本类型
      const textExts = new Set(['.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.css', '.scss', '.html', '.mdx', '.sh'])
      const isText = textExts.has(ext) || stat.size < 1024 * 64 // 小文件按文本尝试

      let output: ReadToolOutput
      if (isText) {
        const raw = readFileSync(absolutePath, 'utf8')
        const lines = raw.split(/\r?\n/)
        const totalLines = lines.length
        let start = 0
        let end = totalLines - 1
        if (input.offset !== undefined && input.limit !== undefined) {
          start = Math.max(0, input.offset)
          end = Math.min(totalLines - 1, start + input.limit - 1)
        } else if (totalLines > 2000) {
          // 大文件默认只展示前 500 行
          start = 0
          end = Math.min(totalLines - 1, 499)
        }
        const slice = lines.slice(start, end + 1).join('\n')
        const preview = slice.length > 4000 ? slice.slice(0, 4000) + '\n... (已截断)' : slice

        const shownRange = { start, end }
        const msgParts = [`已读取 ${rel}`, `行数 ${start + 1}-${end + 1}/${totalLines}`]
        if (end < totalLines - 1) {
          msgParts.push(`要继续阅读可设置 offset=${end + 1}, limit=...`)
        }

        output = {
          absolutePath,
          relativePath: rel,
          isText: true,
          size: stat.size,
          ext,
          totalLines,
          shownRange,
          contentPreview: preview,
          message: msgParts.join(' | '),
        }
      } else {
        // 二进制文件仅返回摘要
        const msg = `二进制或非文本文件: ${rel} (大小 ${stat.size} 字节, 扩展名 ${ext || '无'})`
        output = {
          absolutePath,
          relativePath: rel,
          isText: false,
          size: stat.size,
          ext,
          message: msg,
        }
      }

      const assistant = this.renderResultForAssistant(output)
      yield { type: 'result', data: output, resultForAssistant: assistant }
    }.bind(this), context)
  }

  renderResultForAssistant(output: ReadToolOutput): string {
    if (!output.isText) {
      return `${output.message}`
    }
    const range = output.shownRange ? `行 ${output.shownRange.start + 1}-${output.shownRange.end + 1}` : ''
    return `文件: ${output.relativePath}\n${range}\n---\n${output.contentPreview ?? ''}`
  }

  userFacingName(): string { return 'Read' }
}
