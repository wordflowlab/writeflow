import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import path from 'path'
import { 
  WritingTool, 
  ToolInput, 
  ToolResult, 
  FileState, 
  WriteOptions 
} from '../../types/tool.js'
import { ReadArticleTool } from './read-article.js'

/**
 * WriteArticle 工具
 * 复刻 Claude Code 的强制读取机制和原子性写入
 */
export class WriteArticleTool implements WritingTool {
  name = 'write_article'
  description = '写入文章文件内容'
  securityLevel = 'ai-powered' as const

  private fileStates = new Map<string, FileState>()
  private readTool = new ReadArticleTool()

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { 
        file_path, 
        content, 
        backup = true, 
        atomic = true, 
        validateChecksum = true,
        encoding = 'utf8' 
      } = input as {
        file_path: string
        content: string
        backup?: boolean
        atomic?: boolean
        validateChecksum?: boolean
        encoding?: string
      }

      if (!file_path || !content) {
        return {
          success: false,
          error: '缺少文件路径或内容参数'
        }
      }

      // 强制读取验证（复刻 Claude Code 机制）
      const readResult = await this.enforceReadValidation(file_path)
      if (!readResult.success) {
        return {
          success: false,
          error: `写入前必须先读取文件: ${readResult.error}`
        }
      }

      // 安全路径验证
      const pathValidation = await this.validateWritePath(file_path)
      if (!pathValidation.valid) {
        return {
          success: false,
          error: pathValidation.reason
        }
      }

      // 创建备份（如果需要）
      if (backup && await this.fileExists(file_path)) {
        const backupResult = await this.createBackup(file_path)
        if (!backupResult.success) {
          return {
            success: false,
            error: `备份创建失败: ${backupResult.error}`
          }
        }
      }

      // 原子性写入
      if (atomic) {
        return await this.atomicWrite(file_path, content, encoding, validateChecksum)
      } else {
        return await this.directWrite(file_path, content, encoding, validateChecksum)
      }

    } catch (error) {
      return {
        success: false,
        error: `文件写入失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 强制读取验证
   * 复刻 Claude Code 的强制读取机制
   */
  private async enforceReadValidation(filePath: string): Promise<ToolResult> {
    const fileState = this.fileStates.get(filePath)
    const now = Date.now()

    // 检查是否最近读取过文件
    if (fileState && (now - fileState.lastRead) < 300000) { // 5分钟内
      return { success: true }
    }

    // 强制读取文件
    try {
      const readResult = await this.readTool.execute({ file_path: filePath })
      if (!readResult.success) {
        return readResult
      }

      // 更新文件状态
      const checksum = createHash('sha256')
        .update(readResult.content || '')
        .digest('hex')

      this.fileStates.set(filePath, {
        path: filePath,
        lastRead: now,
        checksum,
        isModified: false
      })

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: `强制读取失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 验证写入路径
   */
  private async validateWritePath(filePath: string): Promise<{ valid: boolean; reason?: string }> {
    const resolvedPath = path.resolve(filePath)
    
    // 检查目录是否存在
    const dir = path.dirname(resolvedPath)
    try {
      await fs.access(dir)
    } catch {
      try {
        await fs.mkdir(dir, { recursive: true })
      } catch {
        return { valid: false, reason: `无法创建目录: ${dir}` }
      }
    }

    // 检查写入权限
    try {
      await fs.access(dir, fs.constants.W_OK)
    } catch {
      return { valid: false, reason: `目录无写入权限: ${dir}` }
    }

    return { valid: true }
  }

  /**
   * 原子性写入
   */
  private async atomicWrite(
    filePath: string, 
    content: string, 
    encoding: string, 
    validateChecksum: boolean
  ): Promise<ToolResult> {
    const tempPath = `${filePath}.tmp.${Date.now()}`
    
    try {
      // 写入临时文件
      await fs.writeFile(tempPath, content, encoding as BufferEncoding)
      
      // 验证写入内容
      if (validateChecksum) {
        const writtenContent = await fs.readFile(tempPath, encoding as BufferEncoding)
        const expectedChecksum = createHash('sha256').update(content).digest('hex')
        const actualChecksum = createHash('sha256').update(writtenContent).digest('hex')
        
        if (expectedChecksum !== actualChecksum) {
          await fs.unlink(tempPath)
          return {
            success: false,
            error: '内容校验失败：写入内容与预期不符'
          }
        }
      }

      // 原子性替换
      await fs.rename(tempPath, filePath)

      // 更新文件状态
      const checksum = createHash('sha256').update(content).digest('hex')
      this.fileStates.set(filePath, {
        path: filePath,
        lastRead: Date.now(),
        checksum,
        isModified: false
      })

      return {
        success: true,
        content: `文件写入成功: ${filePath}`,
        metadata: {
          path: filePath,
          size: content.length,
          checksum,
          writeMode: 'atomic'
        }
      }

    } catch (error) {
      // 清理临时文件
      await fs.unlink(tempPath).catch(() => {})
      
      return {
        success: false,
        error: `原子写入失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 直接写入
   */
  private async directWrite(
    filePath: string,
    content: string,
    encoding: string,
    validateChecksum: boolean
  ): Promise<ToolResult> {
    try {
      await fs.writeFile(filePath, content, encoding as BufferEncoding)

      // 验证写入（如果需要）
      if (validateChecksum) {
        const writtenContent = await fs.readFile(filePath, encoding as BufferEncoding)
        const expectedChecksum = createHash('sha256').update(content).digest('hex')
        const actualChecksum = createHash('sha256').update(writtenContent).digest('hex')
        
        if (expectedChecksum !== actualChecksum) {
          return {
            success: false,
            error: '内容校验失败：写入内容与预期不符'
          }
        }
      }

      const checksum = createHash('sha256').update(content).digest('hex')
      this.fileStates.set(filePath, {
        path: filePath,
        lastRead: Date.now(),
        checksum,
        isModified: false
      })

      return {
        success: true,
        content: `文件写入成功: ${filePath}`,
        metadata: {
          path: filePath,
          size: content.length,
          checksum,
          writeMode: 'direct'
        }
      }

    } catch (error) {
      return {
        success: false,
        error: `文件写入失败: ${(error as Error).message}`
      }
    }
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
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
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