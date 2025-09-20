import { z } from 'zod'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext, PermissionResult } from '../../../Tool.js'
import { PROMPT } from './prompt.js'

// 输入参数架构
const EditToolInputSchema = z.object({
  file_path: z.string().describe('要编辑的文件的绝对路径'),
  old_string: z.string().describe('要替换的原始文本'),
  new_string: z.string().describe('替换后的新文本'),
  replace_all: z.boolean().optional().default(false).describe('是否替换所有匹配项'),
})

type EditToolInput = z.infer<typeof EditToolInputSchema>

interface EditToolOutput {
  success: boolean
  filePath: string
  replacements: number
  oldContent: string
  newContent: string
  message: string
}

/**
 * EditTool - 文件编辑工具
 * 参考 Claude Code Edit 工具实现
 */
export class EditTool extends ToolBase<typeof EditToolInputSchema, EditToolOutput> {
  name = 'Edit'
  inputSchema = EditToolInputSchema
  category = 'file' as const

  async description(): Promise<string> {
    return '通过字符串替换的方式编辑文件内容。可以精确替换指定的文本片段，支持单次替换或全部替换。'
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

  needsPermissions(_input?: EditToolInput): boolean {
    return true
  }

  async checkPermissions(
    input: EditToolInput, _context: ToolUseContext
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
          behavior: 'deny'
        }
      }

      return { isAllowed: true }
    } catch (_error) {
      return {
        isAllowed: false,
        denialReason: _error instanceof Error ? _error.message : String(_error),
        behavior: 'deny'
      }
    }
  }

  async *call(
    input: EditToolInput,
    _context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: EditToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* (this: EditTool) {
      // 1. 路径处理和验证
      const filePath = resolve(input.file_path)

      // 2. 读取原始文件内容
      let originalContent: string
      try {
        originalContent = readFileSync(filePath, 'utf8')
      } catch (_error) {
        throw new Error(`读取文件失败: ${_error instanceof Error ? _error.message : String(_error)}`)
      }

      // 3. 验证输入
      if (input.old_string === input.new_string) {
        throw new Error('old_string 和 new_string 不能相同')
      }

      if (!input.old_string) {
        throw new Error('old_string 不能为空')
      }

      // 4. 检查是否能找到要替换的字符串
      if (!originalContent.includes(input.old_string)) {
        throw new Error(`在文件中未找到要替换的文本: "${input.old_string.substring(0, 100)}${input.old_string.length > 100 ? '...' : ''}"`)
      }

      // 5. 执行替换
      let newContent: string
      let replacements = 0

      if (input.replace_all) {
        // 全部替换
        const regex = new RegExp(this.escapeRegExp(input.old_string), 'g')
        newContent = originalContent.replace(regex, (_match) => {
          replacements++
          return input.new_string
        })
      } else {
        // 单次替换
        const index = originalContent.indexOf(input.old_string)
        if (index === -1) {
          throw new Error('未找到要替换的文本')
        }
        
        // 检查是否唯一（单次替换模式下）
        const secondIndex = originalContent.indexOf(input.old_string, index + 1)
        if (secondIndex !== -1) {
          throw new Error('在文件中找到多个匹配项。请提供更大的上下文以确保唯一性，或使用 replace_all=true 替换所有匹配项。')
        }

        newContent = originalContent.replace(input.old_string, input.new_string)
        replacements = 1
      }

      // 6. 写入文件
      try {
        writeFileSync(filePath, newContent, 'utf8')
      } catch (_error) {
        throw new Error(`写入文件失败: ${_error instanceof Error ? _error.message : String(_error)}`)
      }

      // 7. 构建结果
      const message = `成功执行 ${replacements} 次替换`

      const result: EditToolOutput = {
        success: true,
        filePath,
        replacements,
        oldContent: originalContent,
        newContent,
        message,
      }

      // 8. 生成 AI 可读的结果
      const changesSummary = this.generateChangesSummary(
        input.old_string,
        input.new_string,
        replacements
      )

      const resultForAssistant = [
        `文件编辑完成: ${filePath}`,
        message,
        '',
        '变更摘要:',
        changesSummary,
      ].join('\n')

      yield {
        type: 'result' as const,
        data: result,
        resultForAssistant,
      }

    }.bind(this), _context)
  }

  renderResultForAssistant(output: EditToolOutput): string {
    return `${output.message}\n文件路径: ${output.filePath}`
  }

  renderToolUseMessage(
    input: EditToolInput,
    options: { verbose: boolean },
  ): string {
    const mode = input.replace_all ? '全部替换' : '单次替换'
    const preview = options.verbose 
      ? ` "${input.old_string.substring(0, 50)}${input.old_string.length > 50 ? '...' : ''}" → "${input.new_string.substring(0, 50)}${input.new_string.length > 50 ? '...' : ''}"`
      : ''
    return `正在编辑文件: ${input.file_path} (${mode})${preview}`
  }

  userFacingName(): string {
    return 'Edit'
  }

  // 转义正则表达式特殊字符
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // 生成变更摘要
  private generateChangesSummary(oldStr: string, newStr: string, count: number): string {
    const oldPreview = oldStr.length > 100 ? `${oldStr.substring(0, 100)}...` : oldStr
    const newPreview = newStr.length > 100 ? `${newStr.substring(0, 100)}...` : newStr
    
    return [
      `替换次数: ${count}`,
      `原文本: "${oldPreview}"`,
      `新文本: "${newPreview}"`,
    ].join('\n')
  }
}
