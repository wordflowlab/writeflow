import { z } from 'zod'
import { readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext } from '../../../Tool.js'
import { PROMPT } from './prompt.js'
import { debugLog } from '../../../utils/log.js'

// 输入参数架构
const GlobToolInputSchema = z.object({
  pattern: z.string().describe('文件匹配模式，支持 *, **, ? 等通配符'),
  path: z.string().optional().describe('搜索目录路径，默认为当前工作目录'),
  max_depth: z.number().int().positive().optional().describe('最大搜索深度，默认 10；超过则不再深入递归'),
})

type GlobToolInput = z.infer<typeof GlobToolInputSchema>

interface GlobToolOutput {
  pattern: string
  searchPath: string
  matches: Array<{
    path: string
    relativePath: string
    isFile: boolean
    isDirectory: boolean
    size?: number
    mtime?: Date
  }>
  totalMatches: number
  message: string
}

/**
 * GlobTool - 文件模式匹配工具
 * 参考 Claude Code Glob 工具实现
 */
export class GlobTool extends ToolBase<typeof GlobToolInputSchema, GlobToolOutput> {
  name = 'Glob'
  inputSchema = GlobToolInputSchema
  category = 'search' as const

  async description(): Promise<string> {
    return '使用 glob 模式匹配文件和目录。支持通配符：* (匹配除 / 外的任意字符)，** (递归匹配目录)，? (匹配单个字符)，[abc] (字符类)。按修改时间排序返回结果。'
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

  needsPermissions(_input?: GlobToolInput): boolean {
    return false // 文件搜索通常不需要特殊权限
  }

  async *call(
    input: GlobToolInput, _context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result' | 'progress' | 'error'; data?: GlobToolOutput; message?: string; progress?: number; error?: Error; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* (this: GlobTool) {
      debugLog(`[GlobTool] 开始执行，输入:`, input)
      // 1. 参数处理
      const pattern = input.pattern.trim()
      const searchPath = input.path ? resolve(input.path) : process.cwd()
      const maxDepth = Math.max(1, input.max_depth ?? 10)

      if (!pattern) {
        throw new Error('匹配模式不能为空')
      }

      // 2. 验证搜索路径
      try {
        const stats = statSync(searchPath)
        if (!stats.isDirectory()) {
          throw new Error(`搜索路径不是目录: ${searchPath}`)
        }
      } catch (_error) {
        if ((_error as any).code === 'ENOENT') {
          throw new Error(`搜索路径不存在: ${searchPath}`)
        }
        throw _error
      }

      // 3. 执行文件匹配（带性能保护）
      const maxResults = 1000
      const timeout = 30000 // 30秒
      const startTime = Date.now()
      
      debugLog(`[GlobTool] 开始搜索，模式: ${pattern}, 路径: ${searchPath}, 最大深度: ${maxDepth}`)
      
      const matches = this.globSearch(
        searchPath, 
        pattern, 
        '', 
        0, 
        maxDepth,
        maxResults,
        startTime,
        timeout
      )

      debugLog(`[GlobTool] 搜索完成，找到 ${matches.length} 个匹配项，耗时: ${Date.now() - startTime}ms`)

      // 4. 按修改时间排序
      try {
        matches.sort((a, b) => {
          if (a.mtime && b.mtime) {
            return b.mtime.getTime() - a.mtime.getTime()
          }
          return a.path.localeCompare(b.path)
        })
      } catch (sortError) {
        debugLog(`[GlobTool] 排序错误:`, sortError)
        // 排序失败不影响结果返回
      }

      // 5. 应用结果限制
      const limitedMatches = matches.slice(0, maxResults)
      const wasLimited = matches.length > maxResults

      // 6. 构建结果
      const message = wasLimited 
        ? `找到 ${matches.length} 个匹配项，显示前 ${maxResults} 个（按修改时间排序）`
        : `找到 ${matches.length} 个匹配项`

      const result: GlobToolOutput = {
        pattern,
        searchPath,
        matches: limitedMatches,
        totalMatches: matches.length,
        message,
      }

      // 7. 生成 AI 可读的结果
      const resultForAssistant = this.formatResultForAssistant(result, wasLimited)

      yield {
        type: 'result' as const,
        data: result,
        resultForAssistant,
      }

    }.bind(this), _context)
  }

  renderResultForAssistant(output: GlobToolOutput): string {
    return this.formatResultForAssistant(output, output.matches.length < output.totalMatches)
  }

  renderToolUseMessage(
    input: GlobToolInput,
    options: { verbose: boolean },
  ): string {
    const pathInfo = input.path ? ` 在 ${input.path}` : ''
    const patternInfo = options.verbose ? ` 模式: ${input.pattern}` : ''
    return `正在搜索文件${pathInfo}${patternInfo}`
  }

  userFacingName(): string {
    return 'Glob'
  }

  // 递归搜索文件（重写以提供更好的错误处理和性能保护）
  private globSearch(
    basePath: string,
    pattern: string,
    currentPath: string = '',
    depth: number = 0,
    maxDepth: number = 10,
    maxResults: number = 1000,
    startTime: number = Date.now(),
    timeout: number = 30000, // 30秒超时
  ): Array<{
    path: string
    relativePath: string
    isFile: boolean
    isDirectory: boolean
    size?: number
    mtime?: Date
  }> {
    const results: Array<{
      path: string
      relativePath: string
      isFile: boolean
      isDirectory: boolean
      size?: number
      mtime?: Date
    }> = []

    // 性能保护：检查执行时间
    if (Date.now() - startTime > timeout) {
      debugLog(`[GlobTool] 搜索超时，已运行 ${timeout}ms`)
      throw new Error(`搜索超时：模式 "${pattern}" 执行时间超过 ${timeout}ms`)
    }

    // 性能保护：检查结果数量限制
    if (results.length >= maxResults) {
      debugLog(`[GlobTool] 达到结果数量限制: ${maxResults}`)
      return results
    }

    const fullPath = currentPath ? join(basePath, currentPath) : basePath

    try {
      const entries = readdirSync(fullPath)

      // 跳过常见的大型目录以提升性能
      const skipDirs = new Set([
        'node_modules', '.git', '.svn', '.hg', 
        'dist', 'build', 'coverage', '.nyc_output',
        'target', 'bin', 'obj', '.cache'
      ])

      for (const entry of entries) {
        // 性能保护：再次检查时间和结果限制
        if (Date.now() - startTime > timeout) {
          debugLog(`[GlobTool] 搜索在文件遍历中超时`)
          throw new Error(`搜索超时：模式 "${pattern}" 执行时间超过 ${timeout}ms`)
        }
        
        if (results.length >= maxResults) {
          debugLog(`[GlobTool] 在文件遍历中达到结果数量限制`)
          break
        }

        const entryPath = currentPath ? join(currentPath, entry) : entry
        const fullEntryPath = join(basePath, entryPath)

        try {
          const stats = statSync(fullEntryPath)
          const isDirectory = stats.isDirectory()
          const isFile = stats.isFile()

          // 检查当前项是否匹配模式
          try {
            if (this.matchesPattern(entryPath, pattern)) {
              results.push({
                path: fullEntryPath,
                relativePath: entryPath,
                isFile,
                isDirectory,
                size: isFile ? stats.size : undefined,
                mtime: stats.mtime,
              })
            }
          } catch (matchError) {
            debugLog(`[GlobTool] 模式匹配错误: ${entryPath}`, matchError)
            // 模式匹配错误，跳过此项但继续处理其他项
            continue
          }

          // 递归搜索目录
          if (isDirectory && !skipDirs.has(entry)) {
            // 检查是否需要进入此目录
            if (depth < maxDepth && this.shouldRecurseIntoDirectory(entryPath, pattern)) {
              try {
                const subResults = this.globSearch(
                  basePath, 
                  pattern, 
                  entryPath, 
                  depth + 1, 
                  maxDepth,
                  maxResults,
                  startTime,
                  timeout
                )
                results.push(...subResults.slice(0, Math.max(0, maxResults - results.length)))
              } catch (subError) {
                debugLog(`[GlobTool] 递归搜索目录失败: ${entryPath}`, subError)
                // 子目录搜索失败，继续处理其他目录
                continue
              }
            }
          }
        } catch (_error) {
          debugLog(`[GlobTool] 无法访问文件/目录: ${fullEntryPath}`, (_error as Error).message)
          // 忽略无法访问的文件/目录，继续处理
          continue
        }
      }
    } catch (_error) {
      debugLog(`[GlobTool] 无法读取目录: ${fullPath}`, (_error as Error).message)
      // 目录无法读取，但不应该终止整个搜索
      // 只是记录错误并返回已找到的结果
    }

    return results
  }

  // 检查路径是否匹配模式
  private matchesPattern(path: string, pattern: string): boolean {
    // 简单的 glob 模式匹配实现
    // 支持 *, **, ?, [abc] 等基本模式

    // 转换 glob 模式为正则表达式
    const regexPattern = this.globToRegex(pattern)
    const regex = new RegExp(regexPattern, 'i') // 忽略大小写

    return regex.test(path.replace(/\\/g, '/')) // 统一使用 / 作为分隔符
  }

  // 检查是否应该递归进入目录
  private shouldRecurseIntoDirectory(dirPath: string, pattern: string): boolean {
    // 如果模式包含 **，则需要递归
    if (pattern.includes('**')) {
      return true
    }

    // 如果模式有更深的路径层次，则需要递归
    const patternParts = pattern.split('/')
    const dirParts = dirPath.split('/')

    return patternParts.length > dirParts.length
  }

  // 将 glob 模式转换为正则表达式（重写以避免灾难性回溯）
  private globToRegex(pattern: string): string {
    // 预处理特殊情况
    if (pattern === '**/*' || pattern === '**') {
      return '^.*$' // 匹配所有内容
    }
    
    // 分解模式以更好地处理 ** 和 *
    const parts = pattern.split('/')
    let regexParts: string[] = []
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      
      if (part === '**') {
        // ** 可以匹配零个或多个目录层级
        if (i === parts.length - 1) {
          // ** 在末尾，匹配所有剩余内容
          regexParts.push('.*')
        } else {
          // ** 在中间，匹配零个或多个目录
          regexParts.push('(?:[^/]+(?:/[^/]+)*)?')
        }
      } else if (part.includes('*') || part.includes('?') || part.includes('[')) {
        // 包含通配符的部分
        regexParts.push(this.simpleGlobToRegex(part))
      } else {
        // 普通字符串部分，需要转义特殊字符
        regexParts.push(this.escapeRegexChars(part))
      }
    }
    
    return '^' + regexParts.join('/') + '$'
  }
  
  // 处理简单的 glob 模式（不包含路径分隔符）
  private simpleGlobToRegex(pattern: string): string {
    let regex = ''
    let i = 0

    while (i < pattern.length) {
      const char = pattern[i]

      switch (char) {
        case '*':
          // * 匹配除 / 外的任意字符（使用占有量词避免回溯）
          regex += '[^/]*'
          i++
          break

        case '?':
          regex += '[^/]'
          i++
          break

        case '[':
          // 字符类 [abc]
          const closeIndex = pattern.indexOf(']', i)
          if (closeIndex !== -1) {
            regex += pattern.substring(i, closeIndex + 1)
            i = closeIndex + 1
          } else {
            regex += '\\['
            i++
          }
          break

        case '.':
        case '^':
        case '$':
        case '+':
        case '(':
        case ')':
        case '{':
        case '}':
        case '|':
        case '\\':
          // 转义正则表达式特殊字符
          regex += '\\' + char
          i++
          break

        default:
          regex += char
          i++
      }
    }

    return regex
  }
  
  // 转义正则表达式特殊字符
  private escapeRegexChars(str: string): string {
    return str.replace(/[.^$+(){}|\\[\]]/g, '\\$&')
  }

  // 格式化结果给 AI
  private formatResultForAssistant(output: GlobToolOutput, wasLimited: boolean): string {
    if (output.matches.length === 0) {
      return `未找到匹配模式 "${output.pattern}" 的文件或目录`
    }

    const lines = [
      output.message,
      '',
    ]

    // 按类型分组显示
    const files = output.matches.filter(m => m.isFile)
    const dirs = output.matches.filter(m => m.isDirectory)

    if (files.length > 0) {
      lines.push('文件:')
      files.slice(0, 20).forEach(file => {
        const sizeInfo = file.size ? ` (${this.formatFileSize(file.size)})` : ''
        lines.push(`  ${file.relativePath}${sizeInfo}`)
      })
      if (files.length > 20) {
        lines.push(`  ... 还有 ${files.length - 20} 个文件`)
      }
    }

    if (dirs.length > 0) {
      lines.push('目录:')
      dirs.slice(0, 10).forEach(dir => {
        lines.push(`  ${dir.relativePath}/`)
      })
      if (dirs.length > 10) {
        lines.push(`  ... 还有 ${dirs.length - 10} 个目录`)
      }
    }

    if (wasLimited) {
      lines.push('', '注意: 结果已被限制，如需查看更多结果请使用更具体的模式')
    }

    return lines.join('\n')
  }

  // 格式化文件大小
  private formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const size = (bytes / Math.pow(1024, i)).toFixed(1)
    return `${size}${sizes[i]}`
  }
}
