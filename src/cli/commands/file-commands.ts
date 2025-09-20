import { SlashCommand } from '../../types/command.js'
import type { ToolUseContext } from '../../Tool.js'
import { AgentContext } from '../../types/agent.js'
import { getTool } from '../../tools/index.js'
import { promises as fs } from 'fs'
import { join, relative } from 'path'

/**
 * 文件操作命令实现
 */
export const fileCommands: SlashCommand[] = [
  {
    type: 'local',
    name: 'read',
    description: '读取文件内容',
    aliases: ['读取', '查看', 'cat'],
    usage: '/read <文件路径>',
    examples: [
      '/read ./articles/draft.md',
      '/read /Users/username/Documents/article.txt',
      '/read ./README.md'
    ],
    
    async call(_args: string, _context: AgentContext): Promise<string> {
      const filePath = _args.trim()
      
      if (!filePath) {
        return `请提供文件路径
        
使用方法: /read <文件路径>
示例: /read ./articles/draft.md`
      }
      
      try {
        // 使用新的 ReadTool
        const readTool = getTool('Read')
      if (!readTool) {
        throw new Error('Read 工具不可用')
      }
      
      // 创建工具上下文
      const context = {
        abortController: new AbortController(),
        readFileTimestamps: {},
        options: { verbose: false, safeMode: true }
      }
      
      // 调用新工具
      const callResult = readTool.call({ file_path: filePath }, { ..._context, abortController: new AbortController(), readFileTimestamps: new Map() } as unknown as ToolUseContext)
      let result = null
      
      // 处理异步生成器结果
      if (Symbol.asyncIterator in callResult) {
        for await (const output of callResult as any) {
          if (output.type === 'result') {
            result = {
              success: true,
              content: output.data?.content || output.resultForAssistant || ''
            }
            break
          }
        }
      } else {
        const output = await callResult
        result = {
          success: true,
          content: output?.content || ''
        }
      }
        
        if (!result || !result.success) {
          return `❌ 读取文件失败: ${(result as any)?.error || '未知错误'}
        
文件路径: ${filePath}
请检查文件是否存在和权限设置`
        }
        
        let output = `📄 读取文件: ${filePath}\n\n`
        
        // 显示文件内容
        if (result.content) {
          output += result.content
        }
        
        // 显示元数据
        if ((result as any).metadata) {
          const meta = (result as any).metadata
          output += `\n\n📊 文件信息:
- 大小: ${meta.size} bytes
- 行数: ${meta.lineCount}
- 字数: ${meta.wordCount}
- 格式: ${meta.format}
- 最后修改: ${new Date(meta.lastModified).toLocaleString()}`
        }
        
        // 显示警告
        if ((result as any).warnings && (result as any).warnings.length > 0) {
          output += `\n\n⚠️ 警告:\n${(result as any).warnings.map((w: any) => `- ${w}`).join('\n')}`
        }
        
        return output
        
      } catch (_error) {
        return `❌ 读取文件失败: ${(_error as Error).message}
        
文件路径: ${filePath}
请检查文件是否存在和权限设置`
      }
    },
    
    userFacingName: () => 'read'
  },

  {
    type: 'local',
    name: 'edit',
    description: '编辑文件',
    aliases: ['编辑', '修改', 'vim'],
    usage: '/edit <文件路径>',
    examples: [
      '/edit ./articles/draft.md',
      '/edit ./config/settings.json',
      '/edit ./README.md'
    ],
    
    async call(_args: string, _context: AgentContext): Promise<string> {
      const filePath = _args.trim()
      
      if (!filePath) {
        return `请提供文件路径
        
使用方法: /edit <文件路径>
示例: /edit ./articles/draft.md`
      }
      
      try {
        // 首先读取文件内容
        // 使用新的 ReadTool
        const readTool = getTool('Read')
        if (!readTool) {
          throw new Error('Read 工具不可用')
        }
        
        // 创建工具上下文
        const context = {
          abortController: new AbortController(),
          readFileTimestamps: {},
          options: { verbose: false, safeMode: true }
        }
        
        // 调用新工具
        const callResult = readTool.call({ file_path: filePath }, { ..._context, abortController: new AbortController(), readFileTimestamps: new Map() } as unknown as ToolUseContext)
        let readResult = null
        
        // 处理异步生成器结果
        if (Symbol.asyncIterator in callResult) {
          for await (const output of callResult as any) {
            if (output.type === 'result') {
              readResult = {
                success: true,
                content: output.data?.content || output.resultForAssistant || ''
              }
              break
            }
          }
        } else {
          const output = await callResult
          readResult = {
            success: true,
            content: output?.content || ''
          }
        }
        
        if (!readResult || !readResult.success) {
          return `❌ 无法读取文件: ${(readResult as any)?.error || '未知错误'}
        
文件路径: ${filePath}
请检查文件是否存在和权限设置`
        }
        
        return `📝 文件编辑模式: ${filePath}

📄 当前内容预览:
${readResult.content}

💡 编辑说明:
此功能显示文件内容供查看。要进行实际编辑，请：

1. 使用 WriteFlow 的 Write 工具创建新内容
2. 使用系统编辑器:
   - VS Code: code ${filePath}  
   - Vim: vim ${filePath}
   - Nano: nano ${filePath}

📊 文件信息:
${(readResult as any).metadata ? `- 大小: ${((readResult as any).metadata as any).size} bytes
- 行数: ${((readResult as any).metadata as any).lineCount}
- 字数: ${((readResult as any).metadata as any).wordCount}
- 格式: ${((readResult as any).metadata as any).format}` : '暂无元数据'}`
        
      } catch (_error) {
        return `❌ 编辑失败: ${(_error as Error).message}
        
文件路径: ${filePath}
请检查文件权限设置`
      }
    },
    
    userFacingName: () => 'edit'
  },

  {
    type: 'local',
    name: 'search',
    description: '搜索内容',
    aliases: ['搜索', '查找', 'find', 'grep'],
    usage: '/search <关键词> [文件路径]',
    examples: [
      '/search "function" ./src/',
      '/search "TODO" .',
      '/search "export" ./src/**/*.ts'
    ],
    
    async call(_args: string, _context: AgentContext): Promise<string> {
      const parts = _args.trim().split(' ')
      
      if (parts.length === 0 || !parts[0]) {
        return `请提供搜索关键词
        
使用方法: /search <关键词> [文件路径]
示例: 
  /search "function" ./src/
  /search "TODO" .
  /search "export" ./src/**/*.ts`
      }
      
      const keyword = parts[0].replace(/['"]/g, '') // 移除引号
      const searchPath = parts.slice(1).join(' ') || '.'
      
      try {
        const results = await searchInFiles(keyword, searchPath)
        
        if (results.length === 0) {
          return `🔍 搜索结果: "${keyword}"
          
搜索路径: ${searchPath}
❌ 未找到匹配内容

建议:
- 检查关键词拼写
- 尝试更宽泛的搜索词
- 检查文件路径是否正确`
        }
        
        let output = `🔍 搜索结果: "${keyword}"\n搜索路径: ${searchPath}\n找到 ${results.length} 个匹配项:\n\n`
        
        results.forEach((result: {file: string, line: number, content: string}, index: number) => {
          output += `📄 ${index + 1}. ${result.file}:${result.line}\n`
          output += `   ${result.content}\n\n`
        })
        
        if (results.length > 20) {
          output += `\n... 显示前 20 个结果，共 ${results.length} 个匹配项`
        }
        
        return output
        
      } catch (_error) {
        return `❌ 搜索失败: ${(_error as Error).message}
        
关键词: ${keyword}
搜索路径: ${searchPath}
请检查路径是否存在和权限设置`
      }
    },
    
    userFacingName: () => 'search'
  },

  {
    type: 'local',
    name: 'glob',
    description: '使用 glob 模式匹配文件和目录',
    aliases: ['文件匹配', '模式匹配', 'find'],
    usage: '/glob <模式> [路径]',
    examples: [
      '/glob *.ts',
      '/glob **/*.md',
      '/glob src/**/*.js ./src',
      '/glob *.json .'
    ],
    
    async call(_args: string, _context: AgentContext): Promise<string> {
      const parts = _args.trim().split(' ')
      
      if (parts.length === 0 || !parts[0]) {
        return `请提供 glob 模式
        
使用方法: /glob <模式> [路径]
示例: 
  /glob *.ts                    # 当前目录下的所有 .ts 文件
  /glob **/*.md                 # 递归查找所有 .md 文件
  /glob src/**/*.js ./src       # 在 ./src 目录下查找 .js 文件
  /glob *.{js,ts} .             # 查找 .js 和 .ts 文件`
      }
      
      const pattern = parts[0]
      const searchPath = parts.slice(1).join(' ') || process.cwd()
      
      try {
        // 使用新的 GlobTool
        const globTool = getTool('Glob')
        if (!globTool) {
          throw new Error('Glob 工具不可用')
        }
        
        // 创建工具上下文
        const context = {
          abortController: new AbortController(),
          readFileTimestamps: {},
          options: { verbose: true, safeMode: true }
        }
        
        // 调用新工具
        const callResult = globTool.call({ 
          pattern, 
          path: searchPath,
          max_depth: 10 
        }, { ..._context, abortController: new AbortController(), readFileTimestamps: new Map() } as unknown as ToolUseContext)
        let result = null
        
        // 处理异步生成器结果
        if (Symbol.asyncIterator in callResult) {
          for await (const output of callResult as any) {
            if (output.type === 'result') {
              result = {
                success: true,
                data: output.data,
                message: output.resultForAssistant
              }
              break
            } else if (output.type === 'error') {
              throw new Error(output.error?.message || output.message || '工具执行失败')
            }
          }
        } else {
          const output = await callResult
          result = {
            success: true,
            data: output,
            message: output?.resultForAssistant || ''
          }
        }
        
        if (!result || !result.success) {
          throw new Error((result as any)?.error || '未知错误')
        }
        
        // 格式化输出
        let output = `🔍 Glob 搜索: ${pattern}\n搜索路径: ${searchPath}\n\n`
        
        if (result.message) {
          output += result.message
        } else if (result.data?.matches) {
          const matches = result.data.matches
          if (matches.length === 0) {
            output += `❌ 未找到匹配项\n\n建议:\n- 检查模式是否正确\n- 检查路径是否存在\n- 尝试更宽泛的模式`
          } else {
            output += `找到 ${matches.length} 个匹配项:\n\n`
            
            // 按类型分组显示
            const files = matches.filter((m: any) => m.isFile)
            const dirs = matches.filter((m: any) => m.isDirectory)
            
            if (files.length > 0) {
              output += `📄 文件 (${files.length}):\n`
              files.slice(0, 20).forEach((file: any, index: number) => {
                const size = file.size ? ` (${formatFileSize(file.size)})` : ''
                output += `  ${index + 1}. ${file.relativePath}${size}\n`
              })
              if (files.length > 20) {
                output += `  ... 还有 ${files.length - 20} 个文件\n`
              }
              output += '\n'
            }
            
            if (dirs.length > 0) {
              output += `📁 目录 (${dirs.length}):\n`
              dirs.slice(0, 10).forEach((dir: any, index: number) => {
                output += `  ${index + 1}. ${dir.relativePath}/\n`
              })
              if (dirs.length > 10) {
                output += `  ... 还有 ${dirs.length - 10} 个目录\n`
              }
            }
          }
        }
        
        return output
        
      } catch (_error) {
        return `❌ Glob 搜索失败: ${(_error as Error).message}
        
模式: ${pattern}
搜索路径: ${searchPath}
请检查模式语法和路径设置

Glob 模式说明:
- * : 匹配除 / 外的任意字符
- ** : 递归匹配目录
- ? : 匹配单个字符
- [abc] : 匹配字符类
- {js,ts} : 匹配多个扩展名`
      }
    },
    
    userFacingName: () => 'glob'
  }
]

// 格式化文件大小的辅助函数
function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(1)
  return `${size}${sizes[i]}`
}

// 搜索方法实现
async function searchInFiles(keyword: string, searchPath: string): Promise<Array<{file: string, line: number, content: string}>> {
      const results: Array<{file: string, line: number, content: string}> = []
      
      const searchInFile = async (filePath: string): Promise<void> => {
        try {
          const content = await fs.readFile(filePath, 'utf8')
          const lines = content.split('\n')
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(keyword.toLowerCase())) {
              results.push({
                file: relative(process.cwd(), filePath),
                line: index + 1,
                content: line.trim()
              })
            }
          })
        } catch (_error) {
          // 跳过无法读取的文件
        }
      }
      
      const scanDirectory = async (dirPath: string): Promise<void> => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true })
          
          for (const entry of entries) {
            const fullPath = join(dirPath, entry.name)
            
            // 跳过隐藏文件和目录
            if (entry.name.startsWith('.')) continue
            
            // 跳过常见的忽略目录
            if (entry.isDirectory()) {
              if (['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
                continue
              }
              await scanDirectory(fullPath)
            } else if (entry.isFile()) {
              // 只搜索文本文件
              const textExtensions = ['.js', '.ts', '.jsx', '.tsx', '.md', '.txt', '.json', '.html', '.css', '.py', '.java', '.cpp', '.c', '.h']
              const hasTextExt = textExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))
              
              if (hasTextExt || !entry.name.includes('.')) {
                await searchInFile(fullPath)
              }
            }
          }
        } catch (_error) {
          // 跳过无法访问的目录
        }
      }
      
      try {
        const stat = await fs.stat(searchPath)
        if (stat.isFile()) {
          await searchInFile(searchPath)
        } else if (stat.isDirectory()) {
          await scanDirectory(searchPath)
        }
      } catch (_error) {
        throw new Error(`无法访问路径: ${searchPath}`)
      }
      
      // 限制结果数量避免输出过多
      return results.slice(0, 50)
}