import { z } from 'zod'
import { readdirSync, statSync, readFileSync } from 'fs'
import { resolve, join, relative, extname } from 'path'
import { ToolBase } from '../../ToolBase.js'
import { ToolUseContext } from '../../../Tool.js'
import { PROMPT } from './prompt.js'

// 输入参数架构
const GrepToolInputSchema = z.object({
  pattern: z.string().describe('搜索的正则表达式模式'),
  path: z.string().optional().describe('搜索路径，默认为当前工作目录'),
  glob: z.string().optional().describe('文件过滤模式，如 "*.js", "*.{ts,tsx}"'),
  type: z.string().optional().describe('文件类型过滤，如 "js", "py", "rust"'),
  output_mode: z.enum(['content', 'files_with_matches', 'count']).default('files_with_matches').describe('输出模式'),
  head_limit: z.number().optional().describe('限制输出行数/条目数'),
  '-i': z.boolean().optional().describe('忽略大小写'),
  '-n': z.boolean().optional().describe('显示行号（仅 content 模式）'),
  '-A': z.number().optional().describe('显示匹配后的行数（仅 content 模式）'),
  '-B': z.number().optional().describe('显示匹配前的行数（仅 content 模式）'),
  '-C': z.number().optional().describe('显示匹配前后的行数（仅 content 模式）'),
  multiline: z.boolean().optional().default(false).describe('多行匹配模式'),
})

type GrepToolInput = z.infer<typeof GrepToolInputSchema>

interface GrepMatch {
  file: string
  line: number
  content: string
  matchStart: number
  matchEnd: number
}

interface GrepFileResult {
  file: string
  matches: GrepMatch[]
  totalMatches: number
}

interface GrepToolOutput {
  pattern: string
  searchPath: string
  files: GrepFileResult[]
  totalFiles: number
  totalMatches: number
  outputMode: string
  message: string
}

/**
 * GrepTool - 内容搜索工具
 * 参考 Claude Code Grep 工具实现，基于 ripgrep 功能
 */
export class GrepTool extends ToolBase<typeof GrepToolInputSchema, GrepToolOutput> {
  name = 'Grep'
  inputSchema = GrepToolInputSchema

  async description(): Promise<string> {
    return '在文件内容中搜索文本模式。支持正则表达式、文件过滤、多种输出格式。基于 ripgrep 功能实现，但使用纯 JavaScript。'
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

  needsPermissions(_input?: GrepToolInput): boolean {
    return false
  }

  async *call(
    input: GrepToolInput,
    context: ToolUseContext,
  ): AsyncGenerator<{ type: 'result'; data: GrepToolOutput; resultForAssistant?: string }, void, unknown> {
    yield* this.executeWithErrorHandling(async function* (this: GrepTool) {
      // 1. 参数处理
      const pattern = input.pattern.trim()
      const searchPath = input.path ? resolve(input.path) : process.cwd()
      
      if (!pattern) {
        throw new Error('搜索模式不能为空')
      }

      // 2. 创建正则表达式
      const regexFlags = 'g' + (input['-i'] ? 'i' : '') + (input.multiline ? 'ms' : '')
      let regex: RegExp
      try {
        regex = new RegExp(pattern, regexFlags)
      } catch (error) {
        throw new Error(`无效的正则表达式: ${error instanceof Error ? error.message : String(error)}`)
      }

      // 3. 获取要搜索的文件列表
      const filesToSearch = this.getFilesToSearch(searchPath, input.glob, input.type)

      // 4. 执行搜索
      const results: GrepFileResult[] = []
      let totalMatches = 0

      for (const file of filesToSearch) {
        try {
          const fileResult = this.searchInFile(file, regex, input)
          if (fileResult.matches.length > 0) {
            results.push(fileResult)
            totalMatches += fileResult.totalMatches
          }
        } catch (error) {
          // 忽略无法读取的文件
          continue
        }
      }

      // 5. 应用限制
      let limitedResults = results
      if (input.head_limit) {
        if (input.output_mode === 'content') {
          // 限制总的匹配行数
          limitedResults = this.limitContentResults(results, input.head_limit)
        } else {
          // 限制文件数量
          limitedResults = results.slice(0, input.head_limit)
        }
      }

      // 6. 构建结果
      const message = this.buildMessage(results, limitedResults, totalMatches, input)

      const result: GrepToolOutput = {
        pattern,
        searchPath,
        files: limitedResults,
        totalFiles: results.length,
        totalMatches,
        outputMode: input.output_mode,
        message,
      }

      // 7. 生成 AI 可读的结果
      const resultForAssistant = this.formatResultForAssistant(result, input)

      yield {
        type: 'result' as const,
        data: result,
        resultForAssistant,
      }

    }.bind(this), this.name)
  }

  renderResultForAssistant(output: GrepToolOutput): string {
    return this.formatResultForAssistant(output, {} as GrepToolInput)
  }

  renderToolUseMessage(
    input: GrepToolInput,
    options: { verbose: boolean },
  ): string {
    const pathInfo = input.path ? ` 在 ${input.path}` : ''
    const filterInfo = input.glob ? ` (${input.glob})` : input.type ? ` (*.${input.type})` : ''
    const patternInfo = options.verbose ? ` 模式: "${input.pattern}"` : ''
    return `正在搜索内容${pathInfo}${filterInfo}${patternInfo}`
  }

  userFacingName(): string {
    return 'Grep'
  }

  // 获取要搜索的文件列表
  private getFilesToSearch(basePath: string, globPattern?: string, fileType?: string): string[] {
    const files: string[] = []

    const traverse = (currentPath: string) => {
      try {
        const entries = readdirSync(currentPath)
        
        for (const entry of entries) {
          const fullPath = join(currentPath, entry)
          const stats = statSync(fullPath)

          if (stats.isDirectory()) {
            // 跳过某些目录
            if (this.shouldSkipDirectory(entry)) {
              continue
            }
            traverse(fullPath)
          } else if (stats.isFile()) {
            // 检查文件是否应该被搜索
            if (this.shouldSearchFile(fullPath, globPattern, fileType)) {
              files.push(fullPath)
            }
          }
        }
      } catch (error) {
        // 忽略无法读取的目录
      }
    }

    const stats = statSync(basePath)
    if (stats.isFile()) {
      if (this.shouldSearchFile(basePath, globPattern, fileType)) {
        files.push(basePath)
      }
    } else {
      traverse(basePath)
    }

    return files
  }

  // 检查是否应该跳过目录
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'coverage', 'target',
      '__pycache__', '.pytest_cache',
      '.vscode', '.idea'
    ]
    return skipDirs.includes(dirName) || dirName.startsWith('.')
  }

  // 检查文件是否应该被搜索
  private shouldSearchFile(filePath: string, globPattern?: string, fileType?: string): boolean {
    // 检查文件类型
    if (fileType) {
      const ext = extname(filePath).substring(1)
      if (!this.matchesFileType(ext, fileType)) {
        return false
      }
    }

    // 检查 glob 模式
    if (globPattern) {
      const relativePath = relative(process.cwd(), filePath)
      if (!this.matchesGlobPattern(relativePath, globPattern)) {
        return false
      }
    }

    // 检查是否为文本文件
    return this.isTextFile(filePath)
  }

  // 检查文件类型匹配
  private matchesFileType(ext: string, fileType: string): boolean {
    const typeMap: { [key: string]: string[] } = {
      'js': ['js', 'jsx', 'mjs', 'cjs'],
      'ts': ['ts', 'tsx'],
      'py': ['py', 'pyi', 'pyw'],
      'rust': ['rs'],
      'go': ['go'],
      'java': ['java'],
      'cpp': ['cpp', 'cc', 'cxx', 'c++', 'c', 'h', 'hpp'],
      'cs': ['cs'],
      'php': ['php'],
      'rb': ['rb'],
      'sh': ['sh', 'bash', 'zsh', 'fish'],
      'html': ['html', 'htm'],
      'css': ['css', 'scss', 'sass', 'less'],
      'json': ['json'],
      'xml': ['xml'],
      'yaml': ['yaml', 'yml'],
      'md': ['md', 'markdown'],
      'txt': ['txt'],
    }

    const extensions = typeMap[fileType] || [fileType]
    return extensions.includes(ext.toLowerCase())
  }

  // 检查 glob 模式匹配（简化版）
  private matchesGlobPattern(path: string, pattern: string): boolean {
    // 简化的 glob 匹配
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    const regex = new RegExp('^' + regexPattern + '$', 'i')
    return regex.test(path)
  }

  // 检查是否为文本文件
  private isTextFile(filePath: string): boolean {
    const textExtensions = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
      '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      '.sql', '.sh', '.bat', '.ps1',
      '.json', '.yaml', '.yml', '.toml', '.ini', '.env',
      '.xml', '.csv', '.tsv',
      '.md', '.rst', '.txt', '.log',
    ])

    const ext = extname(filePath).toLowerCase()
    return textExtensions.has(ext) || ext === ''
  }

  // 在文件中搜索
  private searchInFile(filePath: string, regex: RegExp, input: GrepToolInput): GrepFileResult {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const matches: GrepMatch[] = []

    if (input.multiline) {
      // 多行搜索
      let match
      while ((match = regex.exec(content)) !== null) {
        const beforeContent = content.substring(0, match.index)
        const lineNumber = beforeContent.split('\n').length
        
        matches.push({
          file: filePath,
          line: lineNumber,
          content: match[0],
          matchStart: match.index,
          matchEnd: match.index + match[0].length,
        })

        if (!regex.global) break
      }
    } else {
      // 按行搜索
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        let match
        while ((match = regex.exec(line)) !== null) {
          matches.push({
            file: filePath,
            line: i + 1,
            content: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          })

          if (!regex.global) break
        }
        // 重置全局正则
        if (regex.global) regex.lastIndex = 0
      }
    }

    return {
      file: filePath,
      matches,
      totalMatches: matches.length,
    }
  }

  // 限制内容结果
  private limitContentResults(results: GrepFileResult[], limit: number): GrepFileResult[] {
    const limitedResults: GrepFileResult[] = []
    let totalLines = 0

    for (const result of results) {
      if (totalLines >= limit) break

      const remainingLines = limit - totalLines
      const limitedMatches = result.matches.slice(0, remainingLines)
      
      limitedResults.push({
        ...result,
        matches: limitedMatches,
        totalMatches: limitedMatches.length,
      })

      totalLines += limitedMatches.length
    }

    return limitedResults
  }

  // 构建消息
  private buildMessage(
    allResults: GrepFileResult[],
    limitedResults: GrepFileResult[],
    totalMatches: number,
    input: GrepToolInput,
  ): string {
    const parts = [`找到 ${totalMatches} 处匹配，分布在 ${allResults.length} 个文件中`]

    if (limitedResults.length < allResults.length) {
      parts.push(`（显示前 ${limitedResults.length} 个文件）`)
    }

    if (input.head_limit && input.output_mode === 'content') {
      const shownMatches = limitedResults.reduce((sum, r) => sum + r.matches.length, 0)
      if (shownMatches < totalMatches) {
        parts.push(`（显示前 ${shownMatches} 处匹配）`)
      }
    }

    return parts.join(' ')
  }

  // 格式化结果给 AI
  private formatResultForAssistant(output: GrepToolOutput, input: GrepToolInput): string {
    if (output.totalMatches === 0) {
      return `未找到匹配模式 "${output.pattern}" 的内容`
    }

    const lines = [output.message, '']

    switch (output.outputMode) {
      case 'files_with_matches':
        lines.push('匹配的文件:')
        output.files.forEach(file => {
          const relativePath = relative(output.searchPath, file.file)
          lines.push(`  ${relativePath} (${file.totalMatches} 处匹配)`)
        })
        break

      case 'content':
        output.files.forEach(file => {
          const relativePath = relative(output.searchPath, file.file)
          lines.push(`${relativePath}:`)
          
          file.matches.forEach(match => {
            const lineNum = input['-n'] ? `${match.line}: ` : ''
            lines.push(`  ${lineNum}${match.content}`)
          })
          lines.push('')
        })
        break

      case 'count':
        lines.push('匹配统计:')
        output.files.forEach(file => {
          const relativePath = relative(output.searchPath, file.file)
          lines.push(`  ${relativePath}: ${file.totalMatches}`)
        })
        break
    }

    return lines.join('\n')
  }
}