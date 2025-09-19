import { z } from 'zod'
import { EnhancedWritingTool, ToolInput, ToolResult, ToolContext, PermissionResult, ToolConfig } from '../../types/tool.js'
import { promises as fs, readdirSync } from 'fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'path'

// 输入参数架构
const LsToolInputSchema = z.object({
  path: z.string().optional().describe('要列出的目录路径（绝对路径）'),
  recursive: z.boolean().optional().default(false).describe('是否递归列出子目录'),
  showHidden: z.boolean().optional().default(false).describe('是否显示隐藏文件'),
  maxDepth: z.number().min(1).max(10).optional().default(3).describe('递归最大深度'),
  maxFiles: z.number().min(1).max(2000).optional().default(1000).describe('最大文件数量限制')
})

type LsToolInput = z.infer<typeof LsToolInputSchema>

// 最大限制常量
const MAX_FILES = 1000
const MAX_DISPLAY_LINES = 50
const TRUNCATED_MESSAGE = `目录包含超过 ${MAX_FILES} 个文件。仅显示前 ${MAX_FILES} 个文件和目录：\n\n`

// 文件树节点类型
type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: TreeNode[]
}

/**
 * LsTool - 增强版目录列表工具
 * 支持递归遍历、树形显示、权限检查和安全过滤
 */
export class LsTool implements EnhancedWritingTool {
  name = 'Ls'
  description = '增强版目录列表工具。支持递归遍历、树形显示、权限检查。适用于项目结构浏览和文件查找。'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'
  
  config: ToolConfig = {
    readOnly: true,
    concurrencySafe: true,
    requiresPermission: true,
    timeout: 30000,
    category: 'system'
  }

  /**
   * 主要执行方法
   */
  async execute(input: ToolInput): Promise<ToolResult> {
    const startTime = Date.now()
    
    try {
      const { path: inputPath, recursive, showHidden, maxDepth, maxFiles } = this.validateAndParseInput(input)
      
      // 确定目标路径
      const targetPath = inputPath ? (isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath)) : process.cwd()
      
      // 权限检查
      if (!await this.hasReadPermission(targetPath)) {
        return {
          success: false,
          error: `没有读取目录的权限: ${targetPath}`
        }
      }
      
      // 列出文件
      const files = recursive
        ? this.listDirectoryRecursive(targetPath, process.cwd(), maxDepth || 3, showHidden || false)
        : await this.listDirectory(targetPath, showHidden || false)
      
      // 检查文件数量限制
      const limitedFiles = files.slice(0, maxFiles || MAX_FILES)
      const wasTruncated = files.length > (maxFiles || MAX_FILES)
      
      // 创建文件树
      const tree = recursive ? this.createFileTree(limitedFiles, targetPath) : null
      
      // 生成输出
      const content = recursive && tree
        ? this.printTree(tree, targetPath)
        : this.printSimpleList(limitedFiles, targetPath)
      
      const duration = Date.now() - startTime
      const finalContent = wasTruncated
        ? `${TRUNCATED_MESSAGE}${content}\n\n⚠️ 共有 ${files.length} 个文件，已截断显示`
        : content
      
      // 添加安全提醒
      const safetyWarning = this.generateSafetyWarning(limitedFiles)
      
      return {
        success: true,
        content: finalContent,
        metadata: {
          toolName: this.name,
          targetPath,
          totalFiles: files.length,
          displayedFiles: limitedFiles.length,
          wasTruncated,
          recursive,
          duration,
          safetyWarning
        }
      }

    } catch (_error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        error: `列出目录失败: ${(error as Error).message}`,
        metadata: {
          duration,
          error: (error as Error).message
        }
      }
    }
  }

  /**
   * 获取专用提示词
   */
  async getPrompt(options?: { safeMode?: boolean }): Promise<string> {
    return `Ls 工具用于列出目录内容，提供灵活的文件浏览功能：

主要功能：
- 基本目录列表（非递归）
- 递归目录遍历（支持深度控制）
- 树形结构显示
- 隐藏文件显示控制
- 大目录智能截断
- 文件安全性检测

使用示例：
1. 列出当前目录: { "path": "." }
2. 递归列出: { "path": "./src", "recursive": true }
3. 显示隐藏文件: { "showHidden": true }
4. 限制深度: { "recursive": true, "maxDepth": 2 }
5. 限制文件数: { "maxFiles": 500 }

注意事项：
- 路径参数推荐使用绝对路径
- 大目录会自动截断以提高性能
- 会检测可能的恶意文件并给出警告
- 优先使用 Glob 和 Grep 工具进行精确搜索`
  }

  /**
   * 权限验证
   */
  async validatePermission(input: ToolInput, context?: ToolContext): Promise<PermissionResult> {
    const { path: inputPath } = this.validateAndParseInput(input)
    const targetPath = inputPath ? (isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath)) : process.cwd()
    
    if (!await this.hasReadPermission(targetPath)) {
      return {
        granted: false,
        reason: `需要读取目录的权限: ${targetPath}`
      }
    }
    
    return {
      granted: true,
      reason: '目录读取是安全操作'
    }
  }

  /**
   * 结果渲染
   */
  renderResult(result: ToolResult): string {
    if (result.metadata?.safetyWarning) {
      return `${result.content}\n\n${result.metadata.safetyWarning}`
    }
    return result.content || '目录列表完成'
  }

  /**
   * 输入验证
   */
  async validateInput(input: ToolInput): Promise<boolean> {
    try {
      LsToolInputSchema.parse(input)
      return true
    } catch {
      return false
    }
  }

  /**
   * 验证并解析输入
   */
  private validateAndParseInput(input: ToolInput): LsToolInput {
    return LsToolInputSchema.parse(input)
  }

  /**
   * 检查读取权限
   */
  private async hasReadPermission(path: string): Promise<boolean> {
    try {
      await fs.access(path, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * 列出单个目录
   */
  private async listDirectory(targetPath: string, showHidden: boolean): Promise<string[]> {
    const entries = await fs.readdir(targetPath, { withFileTypes: true })
    const results: string[] = []
    
    for (const entry of entries) {
      if (!showHidden && this.shouldSkip(entry.name)) {
        continue
      }
      
      const fullPath = join(targetPath, entry.name)
      const relativePath = relative(process.cwd(), fullPath)
      
      if (entry.isDirectory()) {
        results.push(relativePath + sep)
      } else {
        results.push(relativePath)
      }
    }
    
    return results.sort()
  }

  /**
   * 递归列出目录
   */
  private listDirectoryRecursive(
    initialPath: string,
    cwd: string,
    maxDepth: number,
    showHidden: boolean,
    currentDepth = 0
  ): string[] {
    const results: string[] = []
    
    if (currentDepth >= maxDepth) {
      return results
    }
    
    const queue = [{ path: initialPath, depth: currentDepth }]
    
    while (queue.length > 0 && results.length < MAX_FILES) {
      const { path: currentPath, depth } = queue.shift()!
      
      if (depth >= maxDepth || this.shouldSkip(basename(currentPath))) {
        continue
      }
      
      // 添加目录本身（除了初始路径）
      if (currentPath !== initialPath) {
        results.push(relative(cwd, currentPath) + sep)
      }
      
      let children
      try {
        children = readdirSync(currentPath, { withFileTypes: true })
      } catch (_error) {
        // 权限错误或其他IO错误，跳过
        continue
      }
      
      for (const child of children) {
        if (!showHidden && this.shouldSkip(child.name)) {
          continue
        }
        
        const childPath = join(currentPath, child.name)
        
        if (child.isDirectory()) {
          if (depth + 1 < maxDepth) {
            queue.push({ path: childPath, depth: depth + 1 })
          }
        } else {
          results.push(relative(cwd, childPath))
          if (results.length >= MAX_FILES) {
            break
          }
        }
      }
    }
    
    return results.sort()
  }

  /**
   * 创建文件树结构
   */
  private createFileTree(sortedPaths: string[], rootPath: string): TreeNode[] {
    const root: TreeNode[] = []
    
    for (const path of sortedPaths) {
      const parts = path.split(sep)
      let currentLevel = root
      let currentPath = ''
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!
        if (!part) {
          continue // 跳过空部分（目录末尾的斜杠）
        }
        
        currentPath = currentPath ? `${currentPath}${sep}${part}` : part
        const isLastPart = i === parts.length - 1
        const isDirectory = path.endsWith(sep) || !isLastPart
        
        const existingNode = currentLevel.find(node => node.name === part)
        
        if (existingNode) {
          currentLevel = existingNode.children || []
        } else {
          const newNode: TreeNode = {
            name: part,
            path: currentPath,
            type: isDirectory ? 'directory' : 'file'
          }
          
          if (isDirectory) {
            newNode.children = []
          }
          
          currentLevel.push(newNode)
          currentLevel = newNode.children || []
        }
      }
    }
    
    return root
  }

  /**
   * 打印树形结构
   */
  private printTree(tree: TreeNode[], rootPath: string, level = 0, prefix = ''): string {
    let result = ''
    
    // 添加根路径
    if (level === 0) {
      result += `📁 ${rootPath}${sep}\n`
      prefix = '  '
    }
    
    for (let i = 0; i < tree.length; i++) {
      const node = tree[i]!
      const isLast = i === tree.length - 1
      const connector = isLast ? '└─' : '├─'
      const icon = node.type === 'directory' ? '📁' : this.getFileIcon(node.name)
      
      result += `${prefix}${connector} ${icon} ${node.name}${node.type === 'directory' ? sep : ''}\n`
      
      // 递归打印子节点
      if (node.children && node.children.length > 0) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ')
        result += this.printTree(node.children, '', level + 1, childPrefix)
      }
    }
    
    return result
  }

  /**
   * 打印简单列表
   */
  private printSimpleList(files: string[], rootPath: string): string {
    if (files.length === 0) {
      return `📁 ${rootPath}\n\n(空目录)`
    }
    
    let result = `📁 ${rootPath}\n\n`
    
    files.forEach(file => {
      const isDirectory = file.endsWith(sep)
      const icon = isDirectory ? '📁' : this.getFileIcon(basename(file))
      const name = isDirectory ? file : basename(file)
      result += `${icon} ${name}\n`
    })
    
    return result
  }

  /**
   * 获取文件图标
   */
  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    // 代码文件
    if (['ts', 'js', 'tsx', 'jsx', 'vue', 'py', 'java', 'cpp', 'c', 'rs', 'go'].includes(ext || '')) {
      return '💻'
    }
    
    // 配置文件
    if (['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config'].includes(ext || '')) {
      return '⚙️'
    }
    
    // 文档文件
    if (['md', 'txt', 'doc', 'docx', 'pdf', 'rtf'].includes(ext || '')) {
      return '📝'
    }
    
    // 图片文件
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) {
      return '🖼️'
    }
    
    // 压缩文件
    if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext || '')) {
      return '📦'
    }
    
    // 可执行文件
    if (['exe', 'app', 'deb', 'rpm', 'dmg'].includes(ext || '')) {
      return '🚀'
    }
    
    // 默认文件
    return '📄'
  }

  /**
   * 判断是否应该跳过文件/目录
   */
  private shouldSkip(name: string): boolean {
    // 跳过以点开头的隐藏文件（除了当前目录）
    if (name !== '.' && name.startsWith('.')) {
      return true
    }
    
    // 跳过常见的临时和缓存目录
    const skipPatterns = [
      'node_modules',
      '__pycache__',
      '.git',
      '.svn',
      '.hg',
      'build',
      'dist',
      'target',
      '.cache'
    ]
    
    return skipPatterns.some(pattern => name.includes(pattern))
  }

  /**
   * 生成安全警告
   */
  private generateSafetyWarning(files: string[]): string {
    const suspiciousFiles = files.filter(file => {
      const name = basename(file).toLowerCase()
      return (
        name.includes('password') ||
        name.includes('secret') ||
        name.includes('key') ||
        name.includes('token') ||
        name.endsWith('.pem') ||
        name.endsWith('.key') ||
        name.includes('credential')
      )
    })
    
    if (suspiciousFiles.length > 0) {
      return `⚠️ 安全提醒: 发现可能包含敏感信息的文件：\n${suspiciousFiles.slice(0, 5).map(f => `  - ${f}`).join('\n')}${suspiciousFiles.length > 5 ? '\n  ...' : ''}\n\n请确保不要意外暴露敏感信息。`
    }
    
    return ''
  }
}

