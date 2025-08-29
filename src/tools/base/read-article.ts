import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import path from 'path'
import { 
  WritingTool, 
  ToolInput, 
  ToolResult, 
  FileMetadata, 
  FileFormat, 
  ReadOptions 
} from '@/types/tool.js'

/**
 * ReadArticle 工具
 * 复刻 Claude Code 的强制读取机制
 * 支持多格式文件读取和恶意内容检测
 */
export class ReadArticleTool implements WritingTool {
  name = 'read_article'
  description = '读取文章文件内容'
  securityLevel = 'safe' as const

  private maliciousPatterns = [
    /eval\s*\(/i,
    /exec\s*\(/i, 
    /system\s*\(/i,
    /__import__/i,
    /document\.cookie/i,
    /localStorage\./i,
    /process\.env/i,
    /require\s*\(/i
  ]

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const { file_path, offset, limit, encoding = 'utf8', detectMalicious = true } = input as {
        file_path: string
        offset?: number
        limit?: number
        encoding?: string
        detectMalicious?: boolean
      }

      if (!file_path) {
        return {
          success: false,
          error: '缺少文件路径参数'
        }
      }

      // 安全路径验证
      const validationResult = await this.validateFilePath(file_path)
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.reason
        }
      }

      // 检查文件是否存在
      const stats = await fs.stat(file_path).catch(() => null)
      if (!stats) {
        return {
          success: false,
          error: `文件不存在: ${file_path}`
        }
      }

      if (!stats.isFile()) {
        return {
          success: false,
          error: `路径不是文件: ${file_path}`
        }
      }

      // 读取文件内容
      const content = await fs.readFile(file_path, encoding as BufferEncoding)
      const lines = content.split('\n')

      // 应用偏移和限制（复刻 Claude Code 逻辑）
      const startLine = offset || 0
      const endLine = limit ? startLine + limit : lines.length
      const selectedLines = lines.slice(startLine, endLine)

      // 生成带行号的内容（复刻 cat -n 格式）
      const numberedContent = selectedLines
        .map((line, index) => `${String(startLine + index + 1).padStart(6)}→${line}`)
        .join('\n')

      // 恶意内容检测
      const warnings: string[] = []
      if (detectMalicious) {
        const maliciousContent = this.detectMaliciousContent(content)
        if (maliciousContent.length > 0) {
          warnings.push(`检测到潜在恶意内容: ${maliciousContent.join(', ')}`)
        }
      }

      // 生成文件元数据
      const metadata = await this.generateMetadata(file_path, content, stats)

      return {
        success: true,
        content: numberedContent,
        metadata,
        warnings
      }

    } catch (error) {
      return {
        success: false,
        error: `文件读取失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 验证文件路径安全性
   */
  private async validateFilePath(filePath: string): Promise<{ valid: boolean; reason?: string }> {
    const resolvedPath = path.resolve(filePath)
    
    // 检查路径遍历攻击
    if (!filePath.startsWith('.') && !path.isAbsolute(filePath)) {
      if (resolvedPath.includes('..')) {
        return { valid: false, reason: '检测到路径遍历攻击' }
      }
    }

    // 检查受限目录
    const blockedPaths = ['/etc', '/var', '/sys', '/proc', '/dev']
    for (const blocked of blockedPaths) {
      if (resolvedPath.startsWith(blocked)) {
        return { valid: false, reason: `访问受限目录: ${blocked}` }
      }
    }

    return { valid: true }
  }

  /**
   * 检测恶意内容
   */
  private detectMaliciousContent(content: string): string[] {
    const detected: string[] = []
    
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(content)) {
        detected.push(pattern.source)
      }
    }
    
    return detected
  }

  /**
   * 生成文件元数据
   */
  private async generateMetadata(filePath: string, content: string, stats: any): Promise<FileMetadata> {
    const format = this.detectFileFormat(filePath, content)
    const checksum = createHash('sha256').update(content).digest('hex')
    
    // 统计信息
    const lines = content.split('\n')
    const words = content.split(/\s+/).filter(word => word.length > 0)
    
    return {
      path: filePath,
      size: stats.size,
      wordCount: words.length,
      lineCount: lines.length,
      encoding: 'utf8',
      format,
      lastModified: stats.mtime.getTime(),
      checksum
    }
  }

  /**
   * 检测文件格式
   */
  private detectFileFormat(filePath: string, content: string): FileFormat {
    const ext = path.extname(filePath).toLowerCase()
    
    switch (ext) {
      case '.md':
      case '.markdown':
        return 'markdown'
      case '.html':
      case '.htm':
        return 'html'
      case '.txt':
        return 'text'
      case '.docx':
        return 'docx'
      case '.pdf':
        return 'pdf'
      default:
        // 基于内容检测
        if (content.includes('# ') || content.includes('## ')) {
          return 'markdown'
        }
        if (content.includes('<html>') || content.includes('<!DOCTYPE')) {
          return 'html'
        }
        return 'text'
    }
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(filePath: string): Promise<FileMetadata | null> {
    try {
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf8')
      return await this.generateMetadata(filePath, content, stats)
    } catch {
      return null
    }
  }
}