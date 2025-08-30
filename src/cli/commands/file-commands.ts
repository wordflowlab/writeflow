import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { ReadArticleTool } from '../../tools/base/read-article.js'
import { EditArticleTool } from '../../tools/base/edit-article.js'
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
    
    async call(args: string, _context: AgentContext): Promise<string> {
      const filePath = args.trim()
      
      if (!filePath) {
        return `请提供文件路径
        
使用方法: /read <文件路径>
示例: /read ./articles/draft.md`
      }
      
      try {
        const readTool = new ReadArticleTool()
        const result = await readTool.execute({ file_path: filePath })
        
        if (!result.success) {
          return `❌ 读取文件失败: ${result.error}
        
文件路径: ${filePath}
请检查文件是否存在和权限设置`
        }
        
        let output = `📄 读取文件: ${filePath}\n\n`
        
        // 显示文件内容
        if (result.content) {
          output += result.content
        }
        
        // 显示元数据
        if (result.metadata) {
          const meta = result.metadata as any
          output += `\n\n📊 文件信息:
- 大小: ${meta.size} bytes
- 行数: ${meta.lineCount}
- 字数: ${meta.wordCount}
- 格式: ${meta.format}
- 最后修改: ${new Date(meta.lastModified).toLocaleString()}`
        }
        
        // 显示警告
        if (result.warnings && result.warnings.length > 0) {
          output += `\n\n⚠️ 警告:\n${result.warnings.map(w => `- ${w}`).join('\n')}`
        }
        
        return output
        
      } catch (error) {
        return `❌ 读取文件失败: ${(error as Error).message}
        
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
    
    async call(args: string, _context: AgentContext): Promise<string> {
      const filePath = args.trim()
      
      if (!filePath) {
        return `请提供文件路径
        
使用方法: /edit <文件路径>
示例: /edit ./articles/draft.md`
      }
      
      try {
        // 首先读取文件内容
        const readTool = new ReadArticleTool()
        const readResult = await readTool.execute({ file_path: filePath })
        
        if (!readResult.success) {
          return `❌ 无法读取文件: ${readResult.error}
        
文件路径: ${filePath}
请检查文件是否存在和权限设置`
        }
        
        return `📝 文件编辑模式: ${filePath}

📄 当前内容预览:
${readResult.content}

💡 编辑说明:
此功能显示文件内容供查看。要进行实际编辑，请：

1. 使用 WriteArticle 工具创建新内容
2. 使用系统编辑器:
   - VS Code: code ${filePath}  
   - Vim: vim ${filePath}
   - Nano: nano ${filePath}

📊 文件信息:
${readResult.metadata ? `- 大小: ${(readResult.metadata as any).size} bytes
- 行数: ${(readResult.metadata as any).lineCount}
- 字数: ${(readResult.metadata as any).wordCount}
- 格式: ${(readResult.metadata as any).format}` : '暂无元数据'}`
        
      } catch (error) {
        return `❌ 编辑失败: ${(error as Error).message}
        
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
    
    async call(args: string, _context: AgentContext): Promise<string> {
      const parts = args.trim().split(' ')
      
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
        
      } catch (error) {
        return `❌ 搜索失败: ${(error as Error).message}
        
关键词: ${keyword}
搜索路径: ${searchPath}
请检查路径是否存在和权限设置`
      }
    },
    
    userFacingName: () => 'search'
  }
]

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
        } catch (error) {
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
        } catch (error) {
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
      } catch (error) {
        throw new Error(`无法访问路径: ${searchPath}`)
      }
      
      // 限制结果数量避免输出过多
      return results.slice(0, 50)
}