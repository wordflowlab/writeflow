import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { RewriteOptions, AIWritingConfig } from '../../types/writing.js'
import { getTool } from '../index.js'

/**
 * ContentRewriter 工具
 * 智能内容改写工具
 */
export class ContentRewriterTool implements WritingTool {
  name = 'content_rewriter'
  description = '智能改写文章内容'
  securityLevel = 'ai-powered' as const

  // 使用导入的 readTool 实例

  constructor(private config: AIWritingConfig) {}

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        content,
        filePath,
        style,
        tone = 'professional',
        keepStructure = false,
        preserveLength = false,
        targetAudience = '通用读者'
      } = input as {
        content?: string
        filePath?: string
        style: 'popular' | 'formal' | 'technical' | 'academic' | 'marketing' | 'narrative'
        tone?: 'professional' | 'casual' | 'friendly' | 'authoritative'
        keepStructure?: boolean
        preserveLength?: boolean
        targetAudience?: string
      }

      if (content === undefined && !filePath) {
        return {
          success: false,
          error: '必须提供内容或文件路径'
        }
      }

      if (!style) {
        return {
          success: false,
          error: '缺少改写风格参数'
        }
      }

      // 获取原始内容
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
        if (!readResult.success) {
          return {
            success: false,
            error: `读取文件失败: ${readResult.error}`
          }
        }
        originalContent = this.extractContentFromRead(readResult.content!)
      } else {
        originalContent = content!
      }

      // 验证内容长度
      if (originalContent.trim().length === 0) {
        return {
          success: false,
          error: '内容为空，无法进行改写'
        }
      }

      // 构建改写选项
      const rewriteOptions: RewriteOptions = {
        style,
        tone,
        keepStructure,
        preserveLength,
        targetAudience
      }

      // 执行改写
      const rewrittenContent = await this.rewriteContent(originalContent, rewriteOptions)

      return {
        success: true,
        content: rewrittenContent,
        metadata: {
          originalLength: originalContent.length,
          rewrittenLength: rewrittenContent.length,
          compressionRatio: rewrittenContent.length / originalContent.length,
          style,
          tone,
          rewriteOptions,
          rewrittenAt: new Date().toISOString()
        }
      }

    } catch (error) {
      return {
        success: false,
        error: `内容改写失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 改写内容
   */
  private async rewriteContent(content: string, options: RewriteOptions): Promise<string> {
    const systemPrompt = this.buildRewriteSystemPrompt(options)
    const userPrompt = this.buildRewriteUserPrompt(content, options)

    // 模拟 AI 改写
    // 在实际实现中会调用 Anthropic API
    return this.simulateRewrite(content, options)
  }

  /**
   * 构建改写系统提示词
   */
  private buildRewriteSystemPrompt(options: RewriteOptions): string {
    const styleDescriptions = {
      popular: '通俗易懂，适合大众读者，使用简单直白的语言',
      formal: '正式严谨，商务场合使用，语言规范专业',
      technical: '技术专业，面向技术人员，保留专业术语',
      academic: '学术规范，符合论文标准，严谨客观',
      marketing: '营销导向，具有说服力，生动吸引人',
      narrative: '故事化表达，生动有趣，情节性强'
    }

    const toneDescriptions = {
      professional: '专业严肃，保持客观中立',
      casual: '轻松随意，亲近自然',
      friendly: '友好热情，平易近人',
      authoritative: '权威可信，展现专业性'
    }

    return `你是一个专业的内容改写助手，擅长将文本改写为不同风格和语调。

改写要求：
- 风格：${styleDescriptions[options.style]}
- 语调：${toneDescriptions[options.tone || 'professional']}
- 目标读者：${options.targetAudience}
- 保持结构：${options.keepStructure ? '是' : '否'}
- 保持长度：${options.preserveLength ? '是' : '否'}

改写原则：
1. 保持核心信息和主要观点不变
2. 调整语言风格和表达方式
3. 优化句式结构，提高可读性
4. 确保逻辑清晰，表达流畅
5. 适当调整专业术语的使用程度
6. 保持原文的信息密度和价值

${options.keepStructure ? '请保持原文的段落结构和组织方式。' : '可以重新组织段落结构以提高可读性。'}
${options.preserveLength ? '请尽量保持与原文相近的长度。' : '可以根据需要调整文本长度。'}`
  }

  /**
   * 构建改写用户提示词
   */
  private buildRewriteUserPrompt(content: string, options: RewriteOptions): string {
    return `请将以下内容改写为${this.getStyleName(options.style)}风格：

原文内容：
${content}

改写要求：
1. 保持核心信息和主要观点不变
2. 调整语言风格为：${this.getStyleName(options.style)}
3. 优化句式结构，提高可读性
4. 确保逻辑清晰，表达流畅
5. 适当调整专业术语的使用程度
6. 保持原文的信息密度和价值

请提供改写后的完整内容。`
  }

  /**
   * 获取风格中文名称
   */
  private getStyleName(style: RewriteOptions['style']): string {
    const styleNames = {
      popular: '通俗易懂',
      formal: '正式严谨',
      technical: '技术专业',
      academic: '学术规范',
      marketing: '营销导向',
      narrative: '故事化'
    }
    return styleNames[style]
  }

  /**
   * 模拟改写（实际实现中会调用 AI API）
   */
  private simulateRewrite(content: string, options: RewriteOptions): string {
    // 这里提供一个简化的模拟改写
    const lines = content.split('\n')
    let rewritten = lines.map(line => {
      if (line.trim() === '') return line

      // 根据风格进行简单的文本转换
      switch (options.style) {
        case 'popular':
          return line
            .replace(/因此/g, '所以')
            .replace(/然而/g, '但是')
            .replace(/此外/g, '另外')
            .replace(/综上所述/g, '总的来说')

        case 'formal':
          return line
            .replace(/但是/g, '然而')
            .replace(/所以/g, '因此')
            .replace(/另外/g, '此外')
            .replace(/总的来说/g, '综上所述')

        case 'technical':
          // 保持技术术语，增加精确性
          return line
            .replace(/方案/g, '解决方案')
            .replace(/方法/g, '技术方案')
            .replace(/问题/g, '技术难题')
            .replace(/优化/g, '技术优化')

        case 'marketing':
          return line
            .replace(/好的/g, '卓越的')
            .replace(/很好的/g, '卓越的')
            .replace(/有效的/g, '高效的')
            .replace(/可以/g, '能够')
            .replace(/帮助/g, '助您')
            .replace(/助力/g, '助您')

        case 'academic':
          return line
            .replace(/这个/g, '该')
            .replace(/很好/g, '表现良好')
            .replace(/可以/g, '能够')
            .replace(/方法/g, '研究表明该方法')

        default:
          return line
      }
    })

    return rewritten.join('\n')
  }

  /**
   * 提取读取结果中的实际内容
   */
  private extractContentFromRead(numberedContent: string): string {
    return numberedContent
      .split('\n')
      .map(line => {
        // 移除行号前缀（格式：空格+行号+→）
        const match = line.match(/^\s*\d+→(.*)$/)
        return match ? match[1] : line
      })
      .join('\n')
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { content, filePath, style } = input as {
      content?: string
      filePath?: string
      style?: string
    }

    // 必须有内容或文件路径
    if (!content && !filePath) return false

    // 必须有改写风格
    if (!style) return false

    // 验证风格是否有效
    const validStyles = ['popular', 'formal', 'technical', 'academic', 'marketing', 'narrative']
    return validStyles.includes(style)
  }
}