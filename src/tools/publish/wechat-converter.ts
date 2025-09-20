import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { WeChatFormat, PlatformConfig } from '../../types/publish.js'
import { getTool } from '../index.js'

/**
 * WeChatConverter 工具
 * 微信公众号格式转换工具
 */
export class WeChatConverterTool implements WritingTool {
  name = 'wechat_converter'
  description = '转换内容为微信公众号格式'
  securityLevel = 'ai-powered' as const

  // 使用导入的 readTool 实例

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        content,
        filePath,
        config = {},
        autoFormat = true,
        imageStyle = 'tech'
      } = input as {
        content?: string
        filePath?: string
        config?: PlatformConfig
        autoFormat?: boolean
        imageStyle?: string
      }

      // 获取内容
      let originalContent: string
      if (filePath) {
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
        const callResult = readTool.call({ file_path: filePath }, context)
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
          return { success: false, error: `读取文件失败: ${(readResult as any)?.error || '未知错误'}` }
        }
        originalContent = this.extractContent(readResult.content!)
      } else if (content) {
        originalContent = content
      } else {
        return { success: false, error: '必须提供内容或文件路径' }
      }

      // 转换为微信格式
      const wechatFormat = await this.convertToWeChatFormat(
        originalContent, 
        { autoFormat, imageStyle, ...config }
      )

      return {
        success: true,
        content: this.formatForDisplay(wechatFormat),
        metadata: {
          wechatFormat,
          originalLength: originalContent.length,
          convertedLength: wechatFormat.content.length,
          convertedAt: new Date().toISOString()
        }
      }

    } catch (_error) {
      return {
        success: false,
        error: `微信格式转换失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 转换为微信公众号格式
   */
  private async convertToWeChatFormat(
    content: string, 
    options: { autoFormat: boolean; imageStyle: string; [key: string]: any }
  ): Promise<WeChatFormat> {
    
    // 提取标题
    const title = this.extractTitle(content)
    
    // 处理内容格式
    let formattedContent = content
    
    if (options.autoFormat) {
      formattedContent = this.applyWeChatFormatting(content)
    }

    // 提取和处理图片
    const images = this.extractAndProcessImages(content, options.imageStyle)
    
    // 生成标签
    const tags = this.generateTags(content)
    
    // 生成摘要
    const summary = this.generateSummary(content)

    return {
      title,
      content: formattedContent,
      images,
      tags,
      summary
    }
  }

  /**
   * 提取标题
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n')
    
    // 查找第一个标题
    for (const line of lines) {
      const h1Match = line.match(/^#\s+(.+)$/)
      if (h1Match) {
        return h1Match[1].trim()
      }
    }

    // 如果没有找到标题，使用第一行非空内容
    for (const line of lines) {
      if (line.trim()) {
        return line.trim().substring(0, 50) + (line.length > 50 ? '...' : '')
      }
    }

    return '无标题文章'
  }

  /**
   * 应用微信格式化
   */
  private applyWeChatFormatting(content: string): string {
    let formatted = content

    // 标题样式优化
    formatted = formatted.replace(/^# (.+)$/gm, '# 📝 $1')
    formatted = formatted.replace(/^## (.+)$/gm, '## 🔸 $1')
    formatted = formatted.replace(/^### (.+)$/gm, '### ▪️ $1')

    // 添加段落间距
    formatted = formatted.replace(/\n\n/g, '\n\n&nbsp;\n\n')

    // 强调文本样式
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '**🔥 $1**')
    
    // 代码块样式
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, 
      '```$1\n💻 代码示例:\n$2```')

    // 列表项优化
    formatted = formatted.replace(/^- (.+)$/gm, '• $1')
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '📌 $1')

    // 添加结尾
    formatted += '\n\n---\n\n🔔 **关注我们，获取更多精彩内容！**'

    return formatted
  }

  /**
   * 提取和处理图片
   */
  private extractAndProcessImages(content: string, imageStyle: string) {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const images = []
    let match

    while ((match = imageRegex.exec(content)) !== null) {
      images.push({
        src: match[2],
        alt: match[1] || '图片',
        caption: match[1] || undefined,
        position: 'center' as const
      })
    }

    return images
  }

  /**
   * 生成标签
   */
  private generateTags(content: string): string[] {
    const tags = new Set<string>()
    
    // 技术相关关键词
    const techKeywords = ['AI', '人工智能', '机器学习', '深度学习', '算法', '数据科学', '编程', '技术', '开发', '架构']
    
    techKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        tags.add(keyword)
      }
    })

    // 限制标签数量
    return Array.from(tags).slice(0, 8)
  }

  /**
   * 生成摘要
   */
  private generateSummary(content: string): string {
    // 提取前两段作为摘要
    const paragraphs = content.split('\n\n').filter(p => p.trim() && !p.startsWith('#'))
    const summary = paragraphs.slice(0, 2).join('\n\n')
    
    // 限制摘要长度
    if (summary.length > 200) {
      return summary.substring(0, 197) + '...'
    }
    
    return summary || '本文深入探讨了相关主题的重要观点和实践经验。'
  }

  /**
   * 格式化显示结果
   */
  private formatForDisplay(wechatFormat: WeChatFormat): string {
    let output = `# 微信公众号格式转换结果\n\n`
    
    output += `## 标题\n${wechatFormat.title}\n\n`
    
    output += `## 摘要\n${wechatFormat.summary}\n\n`
    
    output += `## 标签\n${wechatFormat.tags.join('、')}\n\n`
    
    if (wechatFormat.images.length > 0) {
      output += `## 图片 (${wechatFormat.images.length}张)\n`
      wechatFormat.images.forEach((img, index) => {
        output += `${index + 1}. ${img.alt} - ${img.src}\n`
      })
      output += `\n`
    }
    
    output += `## 格式化内容\n${wechatFormat.content}\n`

    return output
  }

  /**
   * 提取读取内容
   */
  private extractContent(numberedContent: string): string {
    return numberedContent
      .split('\n')
      .map(line => {
        const match = line.match(/^\s*\d+→(.*)$/)
        return match ? match[1] : line
      })
      .join('\n')
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { content, filePath } = input as { content?: string; filePath?: string }
    return Boolean(content || filePath)
  }
}