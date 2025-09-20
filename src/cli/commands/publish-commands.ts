import { SlashCommand } from '../../types/command.js'
import type { ToolUseContext } from '../../Tool.js'
import { AgentContext } from '../../types/agent.js'
import { getTool } from '../../tools/index.js'

/**
 * 发布相关命令实现
 */
export const publishCommands: SlashCommand[] = [
  {
    type: 'prompt',
    name: 'publish',
    description: '发布到平台',
    aliases: ['发布', 'pub'],
    usage: '/publish <平台> <文件路径> [选项]',
    examples: [
      '/publish wechat ./articles/tech-article.md',
      '/publish zhihu ./articles/analysis.md --tags=AI,技术',
      '/publish medium ./articles/english-post.md --lang=en'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      const parts = _args.trim().split(' ')
      
      if (parts.length < 2) {
        throw new Error('请提供平台名称和文件路径')
      }
      
      const [platform, filePath, ...options] = parts
      const tags = extractOption(options, 'tags') || ''
      const language = extractOption(options, 'lang') || 'zh'
      
      const supportedPlatforms = ['wechat', 'zhihu', 'medium', 'github', 'notion']
      
      if (!supportedPlatforms.includes(platform)) {
        throw new Error(`不支持的平台: ${platform}。支持的平台: ${supportedPlatforms.join(', ')}`)
      }
      
      // 首先读取文件内容
      let fileContent = ''
      if (filePath.startsWith('./') || filePath.startsWith('/')) {
        try {
          // 使用新的 ReadTool
          const readTool = getTool('Read')
          if (!readTool) {
            throw new Error('Read 工具不可用')
          }
          
          const context = {
            abortController: new AbortController(),
            readFileTimestamps: {},
            options: { verbose: false, safeMode: true }
          }
          
          const callResult = readTool.call({ file_path: filePath }, { ..._context, abortController: new AbortController(), readFileTimestamps: new Map() } as unknown as ToolUseContext)
          let result = null
          
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
          
          if (result && result.success && result.content) {
            // 提取实际内容（去除行号前缀）
            fileContent = result.content
              .split('\n')
              .map((line: string) => {
                const match = line.match(/^\s*\d+→(.*)$/)
                return match ? match[1] : line
              })
              .join('\n')
          } else {
            throw new Error(`无法读取文件: ${(result as any)?.error || '未知错误'}`)
          }
        } catch (_error) {
          throw new Error(`读取文件失败: ${(_error as Error).message}`)
        }
      } else {
        fileContent = filePath // 直接内容
      }
      
      return `请将以下内容转换并发布到 ${platform} 平台：

原始内容：
${fileContent}

发布参数：
- 目标平台：${platform}
- 标签：${tags || '无'}
- 语言：${language}

请执行以下步骤：
1. 分析源文件内容和格式
2. 根据 ${platform} 平台特性进行格式转换
3. 优化标题和摘要
4. 添加适合的标签和分类
5. 生成发布预览
6. 提供发布建议和注意事项

平台特殊要求：
${getPlatformRequirements(platform)}

请提供转换后的内容和发布指导。`
    },
    
    allowedTools: ['read_article', 'wechat_converter', 'zhihu_converter', 'medium_converter'],
    progressMessage: '正在准备发布内容',
    userFacingName: () => 'publish'
  },

  {
    type: 'prompt', 
    name: 'format',
    description: '格式转换',
    aliases: ['格式', '转换', 'convert'],
    usage: '/format <目标格式> <文件路径>',
    examples: [
      '/format markdown ./articles/draft.docx',
      '/format html ./articles/article.md',
      '/format pdf ./articles/report.md'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      const parts = _args.trim().split(' ')
      
      if (parts.length < 2) {
        throw new Error('请提供目标格式和文件路径')
      }
      
      const [targetFormat, filePath, ...options] = parts
      const preserveStyle = extractOption(options, 'preserve-style') === 'true'
      const outputPath = extractOption(options, 'output') || ''
      
      const supportedFormats = ['markdown', 'html', 'pdf', 'docx', 'txt', 'json']
      
      if (!supportedFormats.includes(targetFormat.toLowerCase())) {
        throw new Error(`不支持的格式: ${targetFormat}。支持的格式: ${supportedFormats.join(', ')}`)
      }
      
      // 读取文件内容
      let fileContent = ''
      let sourceFormat = 'unknown'
      if (filePath.startsWith('./') || filePath.startsWith('/')) {
        try {
          // 使用新的 ReadTool
          const readTool = getTool('Read')
          if (!readTool) {
            throw new Error('Read 工具不可用')
          }
          
          const context = {
            abortController: new AbortController(),
            readFileTimestamps: {},
            options: { verbose: false, safeMode: true }
          }
          
          const callResult = readTool.call({ file_path: filePath }, { ..._context, abortController: new AbortController(), readFileTimestamps: new Map() } as unknown as ToolUseContext)
          let result = null
          
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
          
          if (result && result.success && result.content) {
            // 提取实际内容（去除行号前缀）
            fileContent = result.content
              .split('\n')
              .map((line: string) => {
                const match = line.match(/^\s*\d+→(.*)$/)
                return match ? match[1] : line
              })
              .join('\n')
            
            sourceFormat = (result && (result as any).metadata as any)?.format || 'unknown'
          } else {
            throw new Error(`无法读取文件: ${(result as any)?.error || '未知错误'}`)
          }
        } catch (_error) {
          throw new Error(`读取文件失败: ${(_error as Error).message}`)
        }
      } else {
        fileContent = filePath // 直接内容
      }
      
      return `请将以下内容从 ${sourceFormat} 格式转换为 ${targetFormat} 格式：

原始内容：
${fileContent}

转换参数：
- 源格式：${sourceFormat}
- 目标格式：${targetFormat}
- 保持样式：${preserveStyle ? '是' : '否'}
- 输出路径：${outputPath || '自动生成'}

请执行以下步骤：
1. 分析源文件格式和内容结构
2. 根据目标格式要求进行转换
3. 保持内容结构和层次关系
4. 优化格式特定的显示效果
5. 验证转换结果的完整性

格式要求：
${getFormatRequirements(targetFormat)}

请提供转换后的完整内容。`
    },
    
    allowedTools: ['read_article', 'write_article', 'format_converter'],
    progressMessage: '正在转换文件格式',
    userFacingName: () => 'format'
  }
]

// 辅助函数：提取选项参数
function extractOption(options: string[], optionName: string): string | undefined {
  for (const option of options) {
    if (option.startsWith(`--${optionName}=`)) {
      return option.split('=')[1]
    }
  }
  return undefined
}

// 辅助函数：获取平台要求
function getPlatformRequirements(platform: string): string {
  const requirements = {
    wechat: `- 标题不超过64字符
- 摘要控制在200字以内
- 图片使用居中对齐
- 避免使用外部链接
- 使用微信公众号格式的段落间距`,
    
    zhihu: `- 标题简洁有力，突出核心价值
- 开头包含吸引人的话题引入
- 合理使用加粗、斜体等格式
- 添加相关标签提高曝光
- 结尾可加入互动引导`,
    
    medium: `- 英文内容，语法正确
- 使用 Medium 的标准格式
- 添加合适的 subtitle
- 包含引人入胜的开头段落
- 使用分段和列表提高可读性`,
    
    github: `- 使用 GitHub Flavored Markdown
- 包含目录结构（TOC）
- 代码块使用正确的语言标识
- 添加徽章和链接
- 遵循开源项目文档规范`,
    
    notion: `- 使用 Notion 的块格式
- 支持嵌套页面结构
- 合理使用数据库和表格
- 添加图标和封面图
- 利用 Notion 的协作功能`
  }
  
  return requirements[platform as keyof typeof requirements] || '标准格式要求'
}

// 辅助函数：获取格式要求
function getFormatRequirements(format: string): string {
  const requirements = {
    markdown: `- 使用标准 Markdown 语法
- 标题使用 # 层级结构
- 代码块使用 \`\`\` 包围
- 链接使用 [text](url) 格式
- 列表使用 - 或 1. 格式`,
    
    html: `- 生成语义化的 HTML 结构
- 包含适当的 meta 标签
- 使用 CSS 类和样式
- 确保可访问性标准
- 包含响应式设计考虑`,
    
    pdf: `- 适合打印的页面布局
- 合理的字体和间距
- 包含页眉页脚
- 目录和书签导航
- 高质量的图片处理`,
    
    docx: `- Microsoft Word 兼容格式
- 使用标准样式和格式
- 保持文档结构层次
- 支持图片和表格
- 包含元数据信息`,
    
    txt: `- 纯文本格式，无格式化
- 使用空行分隔段落
- 保持80字符行宽
- ASCII 字符兼容
- 去除所有标记语法`,
    
    json: `- 结构化数据格式
- 包含元数据字段
- 内容分段存储
- 支持搜索和索引
- 保持数据完整性`
  }
  
  return requirements[format as keyof typeof requirements] || '标准格式要求'
}