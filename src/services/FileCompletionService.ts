import { promises as fs } from 'fs'
import { join, extname, relative } from 'path'
import { debugLog } from '../utils/log.js'

/**
 * 文件补全项接口
 */
export interface FileCompletionItem {
  /** 文件/目录名 */
  name: string
  /** 完整路径 */
  fullPath: string
  /** 相对路径（用于显示） */
  relativePath: string
  /** 文件类型 */
  type: 'file' | 'directory'
  /** 文件扩展名 */
  extension?: string
  /** 文件大小（字节） */
  size?: number
  /** 是否可读 */
  readable: boolean
  /** 匹配优先级（用于排序） */
  priority: number
}

/**
 * 文件补全选项
 */
export interface FileCompletionOptions {
  /** 工作目录 */
  workingDirectory?: string
  /** 最大返回数量 */
  maxResults?: number
  /** 是否包含隐藏文件 */
  includeHidden?: boolean
  /** 允许的文件扩展名 */
  allowedExtensions?: string[]
  /** 搜索模式：'prefix' | 'fuzzy' */
  searchMode?: 'prefix' | 'fuzzy'
}

/**
 * 文件自动补全服务
 * 
 * 为 WriteFlow 的 @ 文件引用功能提供智能文件补全
 * 参考现代 IDE 的文件补全体验
 */
export class FileCompletionService {
  
  // 默认配置
  private static readonly DEFAULT_OPTIONS: Required<FileCompletionOptions> = {
    workingDirectory: process.cwd(),
    maxResults: 50,
    includeHidden: false,
    allowedExtensions: [
      '.txt', '.md', '.json', '.yaml', '.yml', '.toml',
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
      '.html', '.css', '.scss', '.sass', '.less',
      '.py', '.java', '.cpp', '.c', '.h', '.hpp',
      '.go', '.rs', '.php', '.rb', '.sh', '.zsh', '.bash',
      '.sql', '.xml', '.csv', '.log', '.ini', '.conf',
      '.dockerfile', '.gitignore', '.gitattributes',
    ],
    searchMode: 'fuzzy',
  }
  
  // 文件类型图标映射
  private static readonly FILE_ICONS: Record<string, string> = {
    '.js': '󰌞',
    '.ts': '󰛦',
    '.jsx': '󰜈',
    '.tsx': '󰜈',
    '.vue': '󰡄',
    '.svelte': '󰜈',
    '.html': '󰌝',
    '.css': '󰌜',
    '.scss': '󰌜',
    '.sass': '󰌜',
    '.less': '󰌜',
    '.py': '󰌠',
    '.java': '󰬷',
    '.go': '󰟓',
    '.rs': '󱘗',
    '.php': '󰌟',
    '.rb': '󰴭',
    '.md': '󰍔',
    '.txt': '󰈙',
    '.json': '󰘦',
    '.yaml': '󰈻',
    '.yml': '󰈻',
    '.xml': '󰗀',
    '.sql': '󰆼',
    '.log': '󰌱',
    '.conf': '󰒓',
    '.ini': '󰒓',
  }
  
  private fileCache = new Map<string, FileCompletionItem[]>()
  private cacheTimestamp = new Map<string, number>()
  private readonly CACHE_TTL = 5000 // 5秒缓存
  
  /**
   * 获取文件补全建议
   * 
   * @param query 用户输入的查询字符串
   * @param options 补全选项
   * @returns 文件补全建议列表
   */
  public async getCompletions(
    query: string,
    options: FileCompletionOptions = {},
  ): Promise<FileCompletionItem[]> {
    const opts = { ...FileCompletionService.DEFAULT_OPTIONS, ...options }
    
    try {
      // 解析查询路径
      const { dirPath, fileName } = this.parseQuery(query, opts.workingDirectory)
      
      // 获取目录文件列表（带缓存）
      const files = await this.getDirectoryFiles(dirPath, opts)
      
      // 过滤和排序
      const filtered = this.filterAndSort(files, fileName, opts)
      
      // 返回限制数量的结果
      return filtered.slice(0, opts.maxResults)
      
    } catch (_error) {
      debugLog(`文件补全失败: ${error}`)
      return []
    }
  }
  
  /**
   * 解析用户查询
   */
  private parseQuery(query: string, workingDir: string): { dirPath: string; fileName: string } {
    // 移除 @ 前缀（如果存在）
    const cleanQuery = query.startsWith('@') ? query.slice(1) : query
    
    if (!cleanQuery || cleanQuery === '/') {
      return {
        dirPath: workingDir,
        fileName: '',
      }
    }
    
    // 检查是否包含路径分隔符
    const lastSlashIndex = cleanQuery.lastIndexOf('/')
    
    if (lastSlashIndex === -1) {
      // 没有路径分隔符，在当前目录搜索
      return {
        dirPath: workingDir,
        fileName: cleanQuery,
      }
    }
    
    const dirPart = cleanQuery.substring(0, lastSlashIndex)
    const filePart = cleanQuery.substring(lastSlashIndex + 1)
    
    // 解析目录路径
    const absoluteDirPath = dirPart.startsWith('/') 
      ? dirPart 
      : join(workingDir, dirPart)
    
    return {
      dirPath: absoluteDirPath,
      fileName: filePart,
    }
  }
  
  /**
   * 获取目录文件列表（带缓存）
   */
  private async getDirectoryFiles(
    dirPath: string,
    options: Required<FileCompletionOptions>,
  ): Promise<FileCompletionItem[]> {
    // 检查缓存
    const now = Date.now()
    const cacheKey = dirPath
    const lastUpdate = this.cacheTimestamp.get(cacheKey) || 0
    
    if (now - lastUpdate < this.CACHE_TTL && this.fileCache.has(cacheKey)) {
      return this.fileCache.get(cacheKey)!
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const files: typeof FileCompletionItem[] = []
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        const relativePath = relative(options.workingDirectory, fullPath)
        
        // 跳过隐藏文件（如果配置不包含）
        if (!options.includeHidden && entry.name.startsWith('.')) {
          // 但保留一些重要的配置文件
          const importantFiles = ['.gitignore', '.gitattributes', '.env.example']
          if (!importantFiles.includes(entry.name)) {
            continue
          }
        }
        
        const isDirectory = entry.isDirectory()
        let size: number | undefined
        let readable = true
        
        if (!isDirectory) {
          try {
            const stats = await fs.stat(fullPath)
            size = stats.size
            
            // 检查文件扩展名是否被允许
            const ext = extname(entry.name).toLowerCase()
            if (ext && !options.allowedExtensions.includes(ext)) {
              continue
            }
          } catch {
            readable = false
          }
        }
        
        files.push({
          name: entry.name,
          fullPath,
          relativePath: relativePath || entry.name,
          type: isDirectory ? 'directory' : 'file',
          extension: isDirectory ? undefined : extname(entry.name).toLowerCase(),
          size,
          readable,
          priority: 0, // 将在过滤阶段计算
        })
      }
      
      // 更新缓存
      this.fileCache.set(cacheKey, files)
      this.cacheTimestamp.set(cacheKey, now)
      
      return files
      
    } catch (_error) {
      debugLog(`读取目录失败: ${dirPath} - ${error}`)
      return []
    }
  }
  
  /**
   * 过滤和排序文件
   */
  private filterAndSort(
    files: typeof FileCompletionItem[],
    query: string,
    options: Required<FileCompletionOptions>,
  ): typeof FileCompletionItem[] {
    if (!query) {
      // 没有查询时，返回所有文件，目录优先
      return files
        .map(file => ({ ...file, priority: file.type === 'directory' ? 1 : 0 }))
        .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    }
    
    const lowerQuery = query.toLowerCase()
    
    return files
      .map(file => {
        const fileName = file.name.toLowerCase()
        let priority = 0
        
        // 精确匹配
        if (fileName === lowerQuery) {
          priority = 100
        }
        // 前缀匹配
        else if (fileName.startsWith(lowerQuery)) {
          priority = 80
        }
        // 模糊匹配
        else if (options.searchMode === 'fuzzy' && this.fuzzyMatch(fileName, lowerQuery)) {
          priority = 60
        }
        // 包含匹配
        else if (fileName.includes(lowerQuery)) {
          priority = 40
        }
        // 不匹配
        else {
          return null
        }
        
        // 目录加分
        if (file.type === 'directory') {
          priority += 10
        }
        
        // 常用文件类型加分
        if (file.extension && ['.md', '.txt', '.json', '.js', '.ts'].includes(file.extension)) {
          priority += 5
        }
        
        return { ...file, priority }
      })
      .filter((file): file is FileCompletionItem => file !== null)
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
  }
  
  /**
   * 模糊匹配算法
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIndex = 0
    
    for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
      if (text[i] === pattern[patternIndex]) {
        patternIndex++
      }
    }
    
    return patternIndex === pattern.length
  }
  
  /**
   * 获取文件图标
   */
  public getFileIcon(item: typeof FileCompletionItem): string {
    if (item.type === 'directory') {
      return '󰉋' // 目录图标
    }
    
    return FileCompletionService.FILE_ICONS[item.extension || ''] || '󰈙' // 默认文件图标
  }
  
  /**
   * 格式化文件大小
   */
  public formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size}B`
    } else if (size < 1024 * 1024) {
      return `${Math.round(size / 1024 * 10) / 10}KB`
    } else {
      return `${Math.round(size / (1024 * 1024) * 10) / 10}MB`
    }
  }
  
  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.fileCache.clear()
    this.cacheTimestamp.clear()
  }
}

// 导出单例实例
export const fileCompletionService = new FileCompletionService()