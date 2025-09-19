import { z } from 'zod'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext, PermissionResult } from '../../../Tool.js'
import { PROMPT } from './prompt.js'

// 单个编辑操作架构
const EditOperationSchema = z.object({
  old_string: z.string().describe('要替换的原始文本'),
  new_string: z.string().describe('替换后的新文本'),
  replace_all: z.boolean().optional().default(false).describe('是否替换所有匹配项'),
})

// 输入参数架构
const MultiEditToolInputSchema = z.object({
  file_path: z.string().describe('要编辑的文件的绝对路径'),
  edits: z.array(EditOperationSchema).min(1).describe('编辑操作数组，按顺序执行'),
})

type MultiEditToolInput = z.infer<typeof MultiEditToolInputSchema>
type EditOperation = z.infer<typeof EditOperationSchema>

interface MultiEditToolOutput {
  success: boolean
  filePath: string
  totalOperations: number
  successfulOperations: number
  operations: Array<{
    index: number
    success: boolean
    replacements: number
    error?: string
  }>
  originalContent: string
  finalContent: string
  message: string
}

/**
 * MultiEditTool - 批量文件编辑工具
 * 参考 Claude Code MultiEdit 工具实现
 */
export class MultiEditTool extends ToolBase<typeof MultiEditToolInputSchema, MultiEditToolOutput> {
  name = 'MultiEdit'
  inputSchema = MultiEditToolInputSchema
  category = 'file' as const

  async description(): Promise<string> {
    return '在单个文件上执行多个编辑操作。所有编辑按顺序执行，每个编辑都在前一个编辑的结果上进行。要么全部成功，要么全部失败。'
  }

  async prompt(options?: { safeMode?: boolean }): Promise<string> {
    return PROMPT
  }

  isReadOnly(): boolean {
    return false
  }

  isConcurrencySafe(): boolean {
    return false // 文件编辑不是并发安全的
  }

  needsPermissions(_input?: MultiEditToolInput): boolean {
    return true
  }

  async checkPermissions(
    input: MultiEditToolInput,
    _context: ToolUseContext,
  ): Promise<PermissionResult> {
    // 基础权限检查
    const baseResult = await super.checkPermissions(input, _context)
    if (!baseResult.isAllowed) {
      return baseResult
    }

    try {
      // 检查文件读写权限
      const resolvedPath = resolve(input.file_path)
      await this.checkFilePermissions(resolvedPath, 'write', _context)
      
      // 验证文件存在
      if (!existsSync(resolvedPath)) {
        return {
          isAllowed: false,
          denialReason: `文件不存在: ${resolvedPath}`,
          behavior: 'deny',
        }
      }

      // 验证编辑操作
      for (let i = 0; i < input.edits.length; i++) {
        const edit = input.edits[i]
        if (edit.old_string === edit.new_string) {
          return {
            isAllowed: false,
            denialReason: `编辑操作 ${i + 1}: old_string 和 new_string 不能相同`,
            behavior: 'deny',
          }
        }
        if (!edit.old_string) {
          return {
            isAllowed: false,
            denialReason: `编辑操作 ${i + 1}: old_string 不能为空`,
            behavior: 'deny',
          }
        }
      }

      return { isAllowed: true }
    } catch (_error) {
      return {
        isAllowed: false,
        denialReason: _error instanceof Error ? _error.message : String(_error),
        behavior: 'deny',
      }
    }
  }

  async *call(
    input: MultiEditToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: MultiEditToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* (this: MultiEditTool) {
      // 1. 路径处理和验证
      const filePath = resolve(input.file_path)

      // 2. 读取原始文件内容
      let originalContent: string
      try {
        originalContent = readFileSync(filePath, 'utf8')
      } catch (_error) {
        throw new Error(`读取文件失败: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 3. 执行编辑操作
      let currentContent = originalContent
      const operations: Array<{
        index: number
        success: boolean
        replacements: number
        error?: string
      }> = []

      let successfulOperations = 0

      for (let i = 0; i < input.edits.length; i++) {
        const edit = input.edits[i]
        
        try {
          const result = this.performEdit(currentContent, edit)
          currentContent = result.newContent
          
          operations.push({
            index: i + 1,
            success: true,
            replacements: result.replacements,
          })
          
          successfulOperations++
        } catch (_error) {
          const errorMessage = _error instanceof Error ? _error.message : String(_error)
          operations.push({
            index: i + 1,
            success: false,
            replacements: 0,
            _error: errorMessage,
          })
          
          // 如果任何一个操作失败，停止执行并抛出错误
          throw new Error(`编辑操作 ${i + 1} 失败: ${errorMessage}`)
        }
      }

      // 4. 写入文件
      try {
        writeFileSync(filePath, currentContent, 'utf8')
      } catch (_error) {
        throw new Error(`写入文件失败: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 5. 构建结果
      const totalReplacements = operations.reduce((sum, op) => sum + op.replacements, 0)
      const message = `成功执行 ${successfulOperations}/${input.edits.length} 个编辑操作，总计 ${totalReplacements} 次替换`

      const result: MultiEditToolOutput = {
        success: successfulOperations === input.edits.length,
        filePath,
        totalOperations: input.edits.length,
        successfulOperations,
        operations,
        originalContent,
        finalContent: currentContent,
        message,
      }

      // 6. 生成 AI 可读的结果
      const operationsSummary = operations
        .map(op => {
          if (op.success) {
            return `操作 ${op.index}: 成功 (${op.replacements} 次替换)`
          } else {
            return `操作 ${op.index}: 失败 - ${op.error}`
          }
        })
        .join('\n')

      const resultForAssistant = [
        `文件批量编辑完成: ${filePath}`,
        message,
        '',
        '操作详情:',
        operationsSummary,
      ].join('\n')

      yield {
        type: 'result' as const,
        data: result,
        resultForAssistant,
      }

    }.bind(this), context)
  }

  renderResultForAssistant(output: MultiEditToolOutput): string {
    return `${output.message}\n文件路径: ${output.filePath}`
  }

  renderToolUseMessage(
    input: MultiEditToolInput,
    options: { verbose: boolean },
  ): string {
    const preview = options.verbose 
      ? ` (${input.edits.length} 个编辑操作)`
      : ''
    return `正在批量编辑文件: ${input.file_path}${preview}`
  }

  userFacingName(): string {
    return 'MultiEdit'
  }

  // 执行单个编辑操作
  private performEdit(content: string, edit: EditOperation): { newContent: string; replacements: number } {
    if (!content.includes(edit.old_string)) {
      throw new Error(`未找到要替换的文本: "${edit.old_string.substring(0, 100)}${edit.old_string.length > 100 ? '...' : ''}"`)
    }

    let newContent: string
    let replacements = 0

    if (edit.replace_all) {
      // 全部替换
      const regex = new RegExp(this.escapeRegExp(edit.old_string), 'g')
      newContent = content.replace(regex, (_match) => {
        replacements++
        return edit.new_string
      })
    } else {
      // 单次替换
      const index = content.indexOf(edit.old_string)
      if (index === -1) {
        throw new Error('未找到要替换的文本')
      }
      
      // 检查是否唯一（单次替换模式下）
      const secondIndex = content.indexOf(edit.old_string, index + 1)
      if (secondIndex !== -1) {
        throw new Error('找到多个匹配项。请提供更大的上下文以确保唯一性，或使用 replace_all=true')
      }

      newContent = content.replace(edit.old_string, edit.new_string)
      replacements = 1
    }

    return { newContent, replacements }
  }

  // 转义正则表达式特殊字符
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
