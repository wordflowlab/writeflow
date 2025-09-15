import { existsSync, readFileSync, statSync } from 'fs'
import { resolve, relative, extname } from 'path'
import { debugLog } from '../utils/log.js'

/**
 * 文件引用结果接口
 */
export interface FileReference {
  /** 原始提及文本 */
  mention: string
  /** 解析后的文件路径 */
  filePath: string
  /** 文件是否存在 */
  exists: boolean
  /** 文件内容（如果存在且可读） */
  content?: string
  /** 文件大小（字节） */
  size?: number
  /** 文件扩展名 */
  extension?: string
  /** 错误信息 */
  error?: string
}

/**
 * MentionProcessor 服务
 * 
 * 负责处理用户输入中的 @ 文件引用，参考 Kode 的实现方式
 * 支持相对路径和绝对路径的文件引用
 */
export class MentionProcessor {
  
  // 文件引用匹配模式 - 参考 Kode 的实现
  private static readonly FILE_MENTION_PATTERN = /@([a-zA-Z0-9/._-]+(?:\.[a-zA-Z0-9]+)?)/g
  
  // 安全限制
  private static readonly MAX_FILE_SIZE = 1024 * 1024 // 1MB
  private static readonly MAX_FILES_PER_REQUEST = 10 // 单次请求最多引用10个文件
  private static readonly ALLOWED_EXTENSIONS = [
    '.txt', '.md', '.json', '.yaml', '.yml', '.toml',
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.html', '.css', '.scss', '.sass', '.less',
    '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.go', '.rs', '.php', '.rb', '.sh', '.zsh', '.bash',
    '.sql', '.xml', '.csv', '.log', '.ini', '.conf',
    '.dockerfile', '.gitignore', '.gitattributes',
  ]
  
  // 敏感路径黑名单
  private static readonly BLOCKED_PATHS = [
    '/etc', '/var', '/sys', '/proc', '/dev', '/root',
    '/usr/bin', '/usr/sbin', '/bin', '/sbin',
    '/.ssh', '/.aws', '/.env',
  ]
  
  // 敏感文件名模式
  private static readonly BLOCKED_PATTERNS = [
    /^\.env/i,
    /^\.aws/i,
    /^\.ssh/i,
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /private/i,
    /credential/i,
  ]
  
  /**
   * 处理输入文本中的文件引用
   * 
   * @param input 用户输入文本
   * @param workingDirectory 当前工作目录（默认使用 process.cwd()）
   * @returns 处理后的文本和文件引用信息
   */
  public async processFileReferences(
    input: string, 
    workingDirectory: string = process.cwd(),
  ): Promise<{
    processedInput: string
    fileReferences: FileReference[]
  }> {
    debugLog(`🔧 MentionProcessor: 开始处理文件引用`)
    debugLog(`🔧 MentionProcessor: 输入文本: "${input.substring(0, 100)}..."`)
    debugLog(`🔧 MentionProcessor: 工作目录: ${workingDirectory}`)
    
    const fileReferences: FileReference[] = []
    let processedInput = input
    
    try {
      // 提取所有文件引用
      const matches = [...input.matchAll(MentionProcessor.FILE_MENTION_PATTERN)]
      debugLog(`🔧 MentionProcessor: 找到 ${matches.length} 个文件引用匹配`)
      
      if (matches.length === 0) {
        debugLog(`🔧 MentionProcessor: 没有找到文件引用，返回原始输入`)
        return { processedInput: input, fileReferences: [] }
      }
      
      // 安全检查：限制单次请求的文件数量
      if (matches.length > MentionProcessor.MAX_FILES_PER_REQUEST) {
        debugLog(`文件引用数量超限：${matches.length} > ${MentionProcessor.MAX_FILES_PER_REQUEST}`)
        throw new Error(`单次请求最多只能引用 ${MentionProcessor.MAX_FILES_PER_REQUEST} 个文件，当前请求了 ${matches.length} 个`)
      }
      
      debugLog(`发现 ${matches.length} 个文件引用`)
      
      // 处理每个文件引用
      for (const match of matches) {
        const fullMatch = match[0] // @文件路径
        const mentionPath = match[1] // 文件路径部分
        
        const fileRef = await this.resolveFileReference(mentionPath, workingDirectory)
        fileReferences.push(fileRef)
        
        if (fileRef.exists && fileRef.content) {
          // 替换文件引用为格式化的文件内容
          const formattedContent = this.formatFileContent(fileRef)
          processedInput = processedInput.replace(fullMatch, formattedContent)
          
          debugLog(`成功处理文件引用: ${mentionPath}`)
        } else {
          // 保留原始引用，但添加错误信息
          const errorMsg = fileRef.error || '文件不存在'
          processedInput = processedInput.replace(fullMatch, `@${mentionPath} (${errorMsg})`)
          
          debugLog(`文件引用失败: ${mentionPath} - ${errorMsg}`)
        }
      }
      
      return { processedInput, fileReferences }
      
    } catch (error) {
      debugLog(`文件引用处理失败: ${error}`)
      // 如果是安全相关的错误，重新抛出
      if ((error as Error).message.includes('单次请求最多只能引用')) {
        throw error
      }
      // 其他错误则返回原始输入
      return { processedInput: input, fileReferences }
    }
  }
  
  /**
   * 解析单个文件引用
   */
  private async resolveFileReference(
    mentionPath: string, 
    workingDirectory: string,
  ): Promise<FileReference> {
    const fileRef: FileReference = {
      mention: `@${mentionPath}`,
      filePath: '',
      exists: false,
    }
    
    try {
      // 解析文件路径
      fileRef.filePath = resolve(workingDirectory, mentionPath)
      fileRef.extension = extname(mentionPath).toLowerCase()
      
      // 安全检查1：限制只能访问工作目录及子目录
      const relativePath = relative(workingDirectory, fileRef.filePath)
      if (relativePath.startsWith('..') || resolve(relativePath) !== fileRef.filePath) {
        fileRef.error = '安全限制：只能访问当前项目目录内的文件'
        return fileRef
      }
      
      // 安全检查2：检查是否为敏感路径
      const isBlockedPath = MentionProcessor.BLOCKED_PATHS.some(blockedPath => 
        fileRef.filePath.startsWith(blockedPath)
      )
      if (isBlockedPath) {
        fileRef.error = '安全限制：禁止访问系统敏感目录'
        return fileRef
      }
      
      // 安全检查3：检查是否为敏感文件名
      const fileName = mentionPath.toLowerCase()
      const isBlockedFile = MentionProcessor.BLOCKED_PATTERNS.some(pattern => 
        pattern.test(fileName)
      )
      if (isBlockedFile) {
        fileRef.error = '安全限制：禁止访问敏感文件'
        return fileRef
      }
      
      // 检查文件是否存在
      if (!existsSync(fileRef.filePath)) {
        fileRef.error = '文件不存在'
        return fileRef
      }
      
      fileRef.exists = true
      
      // 检查文件统计信息
      const stats = statSync(fileRef.filePath)
      
      // 检查是否为文件（非目录）
      if (!stats.isFile()) {
        fileRef.error = '路径指向的不是文件'
        return fileRef
      }
      
      fileRef.size = stats.size
      
      // 检查文件大小限制
      if (stats.size > MentionProcessor.MAX_FILE_SIZE) {
        fileRef.error = `文件过大 (${Math.round(stats.size / 1024)}KB > ${MentionProcessor.MAX_FILE_SIZE / 1024}KB)`
        return fileRef
      }
      
      // 检查文件扩展名是否被允许
      if (fileRef.extension && !MentionProcessor.ALLOWED_EXTENSIONS.includes(fileRef.extension)) {
        fileRef.error = `不支持的文件类型: ${fileRef.extension}`
        return fileRef
      }
      
      // 读取文件内容
      fileRef.content = readFileSync(fileRef.filePath, 'utf-8')
      
      return fileRef
      
    } catch (error) {
      fileRef.error = `读取文件失败: ${(error as Error).message}`
      return fileRef
    }
  }
  
  /**
   * 格式化文件内容为 markdown 格式
   */
  private formatFileContent(fileRef: FileReference): string {
    if (!fileRef.content) {
      return `@${fileRef.mention} (无内容)`
    }
    
    // 获取相对路径用于显示
    const displayPath = fileRef.filePath.replace(`${process.cwd()}/`, '')
    
    // 根据文件扩展名确定语言类型
    const language = this.getLanguageFromExtension(fileRef.extension || '')
    
    // 格式化为 markdown 代码块
    return `\n\n## File: ${displayPath}\n\`\`\`${language}\n${fileRef.content}\n\`\`\`\n`
  }
  
  /**
   * 根据文件扩展名获取语言类型
   */
  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.sh': 'bash',
      '.zsh': 'zsh',
      '.bash': 'bash',
      '.sql': 'sql',
      '.xml': 'xml',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.md': 'markdown',
      '.txt': 'text',
      '.log': 'text',
      '.conf': 'text',
      '.ini': 'ini',
      '.dockerfile': 'dockerfile',
    }
    
    return languageMap[extension.toLowerCase()] || 'text'
  }
  
  /**
   * 检测输入中是否包含文件引用
   */
  public hasFileReferences(input: string): boolean {
    // 使用新的正则实例避免 lastIndex 问题
    const pattern = new RegExp(MentionProcessor.FILE_MENTION_PATTERN.source, 'g')
    return pattern.test(input)
  }
  
  /**
   * 提取输入中的所有文件引用（不读取内容）
   */
  public extractFileReferences(input: string): string[] {
    const matches = [...input.matchAll(MentionProcessor.FILE_MENTION_PATTERN)]
    return matches.map(match => match[1])
  }
}

// 导出单例实例
export const mentionProcessor = new MentionProcessor()