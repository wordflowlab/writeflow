import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import path from 'path'
import { 
  WritingTool, 
  ToolInput, 
  ToolResult, 
  FileState 
} from '@/types/tool.js'
import { ReadArticleTool } from './read-article.js'
import { WriteArticleTool } from './write-article.js'

export interface EditOperation {
  old_string: string
  new_string: string
  replace_all?: boolean
}

/**
 * EditArticle 工具
 * 复刻 Claude Code 的文件编辑机制
 * 包含文件状态追踪和外部修改检测
 */
export class EditArticleTool implements WritingTool {
  name = 'edit_article'
  description = '编辑文章文件内容'
  securityLevel = 'ai-powered' as const

  private fileStates = new Map<string, FileState>()
  private readTool = new ReadArticleTool()
  private writeTool = new WriteArticleTool()

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { 
        file_path, 
        old_string, 
        new_string, 
        replace_all = false,
        edits 
      } = input as {
        file_path: string
        old_string?: string
        new_string?: string
        replace_all?: boolean
        edits?: EditOperation[]
      }

      if (!file_path) {
        return {
          success: false,
          error: '缺少文件路径参数'
        }
      }

      // 多编辑操作
      if (edits && edits.length > 0) {
        return await this.executeMultipleEdits(file_path, edits)
      }

      // 单个编辑操作
      if (!old_string || new_string === undefined) {
        return {
          success: false,
          error: '缺少 old_string 或 new_string 参数'
        }
      }

      return await this.executeSingleEdit(file_path, {
        old_string,
        new_string,
        replace_all
      })

    } catch (error) {
      return {
        success: false,
        error: `文件编辑失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 执行单个编辑操作
   */
  private async executeSingleEdit(filePath: string, edit: EditOperation): Promise<ToolResult> {
    // 强制读取验证
    const readResult = await this.readTool.execute({ file_path: filePath })
    if (!readResult.success) {
      return {
        success: false,
        error: `编辑前读取文件失败: ${readResult.error}`
      }
    }

    // 检测外部修改
    const externalModCheck = await this.detectExternalModification(filePath)
    if (!externalModCheck.valid) {
      return {
        success: false,
        error: externalModCheck.reason
      }
    }

    // 提取原始内容（移除行号）
    const originalContent = this.extractContentFromRead(readResult.content!)
    
    // 验证 old_string 存在且唯一性
    const occurrences = this.countOccurrences(originalContent, edit.old_string)
    if (occurrences === 0) {
      return {
        success: false,
        error: `未找到要替换的字符串: "${edit.old_string}"`
      }
    }

    if (occurrences > 1 && !edit.replace_all) {
      return {
        success: false,
        error: `字符串不唯一，找到 ${occurrences} 个匹配项。使用 replace_all: true 替换所有匹配项`
      }
    }

    // 执行替换
    let newContent: string
    if (edit.replace_all) {
      newContent = originalContent.replaceAll(edit.old_string, edit.new_string)
    } else {
      newContent = originalContent.replace(edit.old_string, edit.new_string)
    }

    // 验证内容发生了变化
    if (newContent === originalContent) {
      return {
        success: false,
        error: 'old_string 和 new_string 相同，内容未发生变化'
      }
    }

    // 写入文件
    const writeResult = await this.writeTool.execute({
      file_path: filePath,
      content: newContent,
      backup: false, // 我们已经处理了备份
      atomic: true,
      validateChecksum: true
    })

    if (!writeResult.success) {
      return writeResult
    }

    // 更新文件状态
    this.updateFileState(filePath, newContent)

    return {
      success: true,
      content: `文件编辑成功: ${filePath}`,
      metadata: {
        ...writeResult.metadata,
        operation: edit.replace_all ? 'replace_all' : 'replace',
        replacements: edit.replace_all ? occurrences : 1
      }
    }
  }

  /**
   * 执行多个编辑操作
   */
  private async executeMultipleEdits(filePath: string, edits: EditOperation[]): Promise<ToolResult> {
    // 强制读取验证
    const readResult = await this.readTool.execute({ file_path: filePath })
    if (!readResult.success) {
      return {
        success: false,
        error: `多编辑前读取文件失败: ${readResult.error}`
      }
    }

    // 提取原始内容
    let currentContent = this.extractContentFromRead(readResult.content!)

    // 验证所有编辑操作
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i]
      const occurrences = this.countOccurrences(currentContent, edit.old_string)
      
      if (occurrences === 0) {
        return {
          success: false,
          error: `编辑 ${i + 1}: 未找到要替换的字符串: "${edit.old_string}"`
        }
      }

      if (occurrences > 1 && !edit.replace_all) {
        return {
          success: false,
          error: `编辑 ${i + 1}: 字符串不唯一，找到 ${occurrences} 个匹配项`
        }
      }

      if (edit.old_string === edit.new_string) {
        return {
          success: false,
          error: `编辑 ${i + 1}: old_string 和 new_string 相同`
        }
      }
    }

    // 按顺序执行所有编辑
    let totalReplacements = 0
    for (const edit of edits) {
      const beforeLength = currentContent.length
      
      if (edit.replace_all) {
        currentContent = currentContent.replaceAll(edit.old_string, edit.new_string)
        totalReplacements += this.countOccurrences(currentContent.substring(0, beforeLength), edit.old_string)
      } else {
        currentContent = currentContent.replace(edit.old_string, edit.new_string)
        totalReplacements += 1
      }
    }

    // 写入最终内容
    const writeResult = await this.writeTool.execute({
      file_path: filePath,
      content: currentContent,
      backup: true,
      atomic: true
    })

    if (!writeResult.success) {
      return writeResult
    }

    this.updateFileState(filePath, currentContent)

    return {
      success: true,
      content: `多编辑操作完成: ${filePath}`,
      metadata: {
        ...writeResult.metadata,
        editsApplied: edits.length,
        totalReplacements
      }
    }
  }

  /**
   * 检测外部修改
   */
  private async detectExternalModification(filePath: string): Promise<{ valid: boolean; reason?: string }> {
    const fileState = this.fileStates.get(filePath)
    if (!fileState) {
      return { valid: true } // 首次编辑，无需检查
    }

    try {
      const currentContent = await fs.readFile(filePath, 'utf8')
      const currentChecksum = createHash('sha256').update(currentContent).digest('hex')

      if (currentChecksum !== fileState.checksum) {
        return { 
          valid: false, 
          reason: '文件已被外部修改，请重新读取后再编辑' 
        }
      }

      return { valid: true }

    } catch (error) {
      return { 
        valid: false, 
        reason: `检查文件状态失败: ${(error as Error).message}` 
      }
    }
  }

  /**
   * 提取读取结果中的实际内容
   */
  private extractContentFromRead(numberedContent: string): string {
    return numberedContent
      .split('\n')
      .map(line => {
        // 移除行号前缀（格式：空格+行号+→）
        const match = line.match(/^\s*\d+→(.*)$/)
        return match ? match[1] : line
      })
      .join('\n')
  }

  /**
   * 统计字符串出现次数
   */
  private countOccurrences(content: string, searchString: string): number {
    let count = 0
    let position = 0
    
    while ((position = content.indexOf(searchString, position)) !== -1) {
      count++
      position += searchString.length
    }
    
    return count
  }

  /**
   * 创建文件备份
   */
  private async createBackup(filePath: string): Promise<ToolResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const ext = path.extname(filePath)
      const base = path.basename(filePath, ext)
      const dir = path.dirname(filePath)
      const backupPath = path.join(dir, `${base}.backup.${timestamp}${ext}`)

      await fs.copyFile(filePath, backupPath)

      return {
        success: true,
        metadata: { backupPath }
      }

    } catch (error) {
      return {
        success: false,
        error: `备份失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 更新文件状态
   */
  private updateFileState(filePath: string, content: string): void {
    const checksum = createHash('sha256').update(content).digest('hex')
    
    this.fileStates.set(filePath, {
      path: filePath,
      lastRead: Date.now(),
      checksum,
      isModified: true
    })
  }

  /**
   * 获取文件状态
   */
  getFileState(filePath: string): FileState | undefined {
    return this.fileStates.get(filePath)
  }

  /**
   * 清理文件状态缓存
   */
  clearFileState(filePath?: string): void {
    if (filePath) {
      this.fileStates.delete(filePath)
    } else {
      this.fileStates.clear()
    }
  }
}