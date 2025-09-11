/**
 * 内容块渲染器
 * 专门处理不同类型内容块的格式化和色彩显示
 */

import chalk from 'chalk'
import { highlight } from 'cli-highlight'
import type { 
  ContentBlock, 
  TextBlock, 
  ToolUseBlock, 
  ToolResultBlock, 
  LongContentBlock
} from '../../types/UIMessage.js'
import { 
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
  isLongContentBlock,
  getBlockText
} from '../../types/UIMessage.js'
import type { CollapsibleContentType } from '../../types/CollapsibleContent.js'
import { getTheme } from '../../utils/theme.js'

// 渲染选项
export interface ContentBlockRenderOptions {
  theme?: 'light' | 'dark'
  maxWidth?: number
  showLineNumbers?: boolean
  enableColors?: boolean
  compact?: boolean
  showMetadata?: boolean
}

// 渲染结果
export interface RenderedContentBlock {
  content: string
  hasColors: boolean
  estimatedLines: number
  renderTime: number
}

/**
 * 内容块渲染器类
 */
export class ContentBlockRenderer {
  private options: Required<ContentBlockRenderOptions>
  private theme: any

  constructor(options: ContentBlockRenderOptions = {}) {
    this.options = {
      theme: options.theme || 'dark',
      maxWidth: options.maxWidth || (process.stdout.columns || 80) - 4,
      showLineNumbers: options.showLineNumbers ?? false,
      enableColors: options.enableColors ?? true,
      compact: options.compact ?? false,
      showMetadata: options.showMetadata ?? false
    }
    this.theme = getTheme()
  }

  /**
   * 渲染单个内容块
   */
  renderBlock(block: ContentBlock): RenderedContentBlock {
    const startTime = Date.now()
    
    if (!this.options.enableColors) {
      return {
        content: getBlockText(block),
        hasColors: false,
        estimatedLines: getBlockText(block).split('\n').length,
        renderTime: Date.now() - startTime
      }
    }

    let rendered: string
    
    switch (block.type) {
      case 'text':
        rendered = this.renderTextBlock(block)
        break
      case 'tool_use':
        rendered = this.renderToolUseBlock(block)
        break
      case 'tool_result':
        rendered = this.renderToolResultBlock(block)
        break
      case 'thinking':
        rendered = this.renderThinkingBlock(block)
        break
      case 'long_content':
        rendered = this.renderLongContentBlock(block)
        break
      default:
        rendered = getBlockText(block)
    }

    return {
      content: rendered,
      hasColors: this.options.enableColors,
      estimatedLines: rendered.split('\n').length,
      renderTime: Date.now() - startTime
    }
  }

  /**
   * 渲染文本块
   */
  private renderTextBlock(block: TextBlock): string {
    const text = block.text
    
    // 检测是否包含代码
    if (this.isCodeContent(text)) {
      return this.renderCodeContent(text)
    }
    
    // 检测是否是错误信息
    if (this.isErrorContent(text)) {
      return this.renderErrorContent(text)
    }
    
    // 普通文本渲染
    return this.wrapText(text)
  }

  /**
   * 渲染工具使用块
   */
  private renderToolUseBlock(block: ToolUseBlock): string {
    const parts = []
    
    // 工具名称和图标
    const icon = this.getToolIcon(block.name)
    const header = chalk.cyan.bold(`${icon} ${block.name}`)
    parts.push(header)
    
    // 工具参数（如果不是紧凑模式）
    if (!this.options.compact && block.input) {
      const inputStr = typeof block.input === 'string' 
        ? block.input 
        : JSON.stringify(block.input, null, 2)
      
      if (inputStr.length > 100) {
        // 长参数进行格式化
        const formatted = this.formatToolInput(inputStr)
        parts.push(chalk.gray('参数:'))
        parts.push(formatted)
      } else {
        parts.push(chalk.gray(`参数: ${inputStr}`))
      }
    }
    
    return parts.join('\n')
  }

  /**
   * 渲染工具结果块
   */
  private renderToolResultBlock(block: ToolResultBlock): string {
    const content = typeof block.content === 'string' 
      ? block.content 
      : JSON.stringify(block.content, null, 2)
    
    if (block.is_error) {
      return this.renderErrorContent(content)
    }
    
    // 成功结果
    const icon = chalk.green('✅')
    const header = chalk.green.bold(`${icon} 执行结果`)
    
    if (this.isCodeContent(content)) {
      return `${header}\n${this.renderCodeContent(content)}`
    }
    
    return `${header}\n${this.wrapText(content)}`
  }

  /**
   * 渲染思考块
   */
  private renderThinkingBlock(block: any): string {
    const icon = chalk.yellow('💭')
    const header = chalk.yellow.bold(`${icon} AI 思考过程`)
    const content = chalk.gray(this.wrapText(block.content))
    
    return `${header}\n${content}`
  }

  /**
   * 渲染长内容块
   */
  private renderLongContentBlock(block: LongContentBlock): string {
    const parts = []
    
    // 标题和类型图标
    const icon = this.getContentTypeIcon(block.contentType)
    const typeLabel = this.getContentTypeLabel(block.contentType)
    
    let header = `${icon} ${typeLabel}`
    if (block.title) {
      header += `: ${block.title}`
    }
    
    parts.push(chalk.cyan.bold(header))
    
    // 元数据（如果启用）
    if (this.options.showMetadata && block.renderMetadata) {
      const meta = []
      meta.push(`${block.renderMetadata.estimatedLines} 行`)
      if (block.renderMetadata.language) {
        meta.push(block.renderMetadata.language)
      }
      if (block.renderMetadata.filePath) {
        meta.push(block.renderMetadata.filePath)
      }
      
      parts.push(chalk.gray(`(${meta.join(' · ')})`))
    }
    
    // 内容渲染
    const content = this.renderContentByType(block.content, block.contentType)
    parts.push(content)
    
    return parts.join('\n')
  }

  /**
   * 根据内容类型渲染内容
   */
  private renderContentByType(content: string, type: CollapsibleContentType): string {
    switch (type) {
      case 'code-block':
        return this.renderCodeContent(content)
      case 'error-message':
        return this.renderErrorContent(content)
      case 'file-content':
        return this.renderFileContent(content)
      case 'tool-execution':
        return this.renderToolOutput(content)
      case 'analysis-result':
        return this.renderAnalysisContent(content)
      default:
        return this.wrapText(content)
    }
  }

  /**
   * 渲染代码内容
   */
  private renderCodeContent(content: string): string {
    try {
      // 尝试语法高亮
      const highlighted = highlight(content, {
        language: this.detectLanguage(content),
        theme: this.options.theme === 'light' ? 'github' : 'monokai'
      })
      
      if (this.options.showLineNumbers) {
        return this.addLineNumbers(highlighted)
      }
      
      return highlighted
    } catch (error) {
      // 高亮失败，返回原始内容
      return chalk.blue(content)
    }
  }

  /**
   * 渲染错误内容
   */
  private renderErrorContent(content: string): string {
    const icon = chalk.red('❌')
    const lines = content.split('\n')
    
    return lines.map((line, index) => {
      if (index === 0) {
        return `${icon} ${chalk.red.bold(line)}`
      }
      return chalk.red(line)
    }).join('\n')
  }

  /**
   * 渲染文件内容
   */
  private renderFileContent(content: string): string {
    const icon = chalk.blue('📄')
    
    // 如果内容看起来像代码，进行语法高亮
    if (this.isCodeContent(content)) {
      return `${icon} 文件内容:\n${this.renderCodeContent(content)}`
    }
    
    return `${icon} 文件内容:\n${this.wrapText(content)}`
  }

  /**
   * 渲染工具输出
   */
  private renderToolOutput(content: string): string {
    const lines = content.split('\n')
    
    return lines.map(line => {
      // 高亮特殊行
      if (line.startsWith('✅') || line.includes('成功')) {
        return chalk.green(line)
      }
      if (line.startsWith('❌') || line.includes('错误') || line.includes('失败')) {
        return chalk.red(line)
      }
      if (line.startsWith('⚠️') || line.includes('警告')) {
        return chalk.yellow(line)
      }
      
      return line
    }).join('\n')
  }

  /**
   * 渲染分析内容
   */
  private renderAnalysisContent(content: string): string {
    const icon = chalk.cyan('📊')
    
    // 尝试检测结构化内容
    if (content.includes('```') || content.includes('|')) {
      return `${icon} 分析结果:\n${this.renderCodeContent(content)}`
    }
    
    return `${icon} 分析结果:\n${this.wrapText(content)}`
  }

  /**
   * 格式化工具输入参数
   */
  private formatToolInput(input: string): string {
    try {
      // 尝试解析为 JSON 并格式化
      const parsed = JSON.parse(input)
      const formatted = JSON.stringify(parsed, null, 2)
      return chalk.gray(formatted)
    } catch {
      // 不是 JSON，直接返回
      return chalk.gray(input)
    }
  }

  /**
   * 文本换行处理
   */
  private wrapText(text: string, indent: string = ''): string {
    const words = text.split(' ')
    const lines = []
    let currentLine = indent
    
    words.forEach(word => {
      if (currentLine.length + word.length + 1 > this.options.maxWidth) {
        lines.push(currentLine)
        currentLine = indent + word
      } else {
        currentLine += (currentLine === indent ? '' : ' ') + word
      }
    })
    
    if (currentLine.length > indent.length) {
      lines.push(currentLine)
    }
    
    return lines.join('\n')
  }

  /**
   * 添加行号
   */
  private addLineNumbers(content: string): string {
    const lines = content.split('\n')
    const maxLineNum = lines.length
    const lineNumWidth = maxLineNum.toString().length
    
    return lines.map((line, index) => {
      const lineNum = (index + 1).toString().padStart(lineNumWidth, ' ')
      return chalk.gray(`${lineNum} │ `) + line
    }).join('\n')
  }

  /**
   * 检测内容是否为代码
   */
  private isCodeContent(content: string): boolean {
    const codeIndicators = [
      'function', 'const', 'let', 'var', 'class', 'interface', 'type',
      'import', 'export', 'require', 'def', 'if', 'for', 'while',
      '{', '}', '(', ')', '[', ']', '=>', ':', ';', '//', '/*', '*/'
    ]
    
    const lines = content.trim().split('\n')
    if (lines.length < 2) return false
    
    const codeLineCount = lines.filter(line => 
      codeIndicators.some(indicator => line.includes(indicator))
    ).length
    
    return codeLineCount / lines.length > 0.3
  }

  /**
   * 检测内容是否为错误信息
   */
  private isErrorContent(content: string): boolean {
    const errorIndicators = ['error', '错误', 'exception', 'failed', '失败', 'warning', '警告']
    const lowerContent = content.toLowerCase()
    
    return errorIndicators.some(indicator => lowerContent.includes(indicator))
  }

  /**
   * 检测编程语言
   */
  private detectLanguage(content: string): string {
    if (content.includes('function') || content.includes('const ') || content.includes('=>')) {
      return 'javascript'
    }
    if (content.includes('def ') || content.includes('import ')) {
      return 'python'
    }
    if (content.includes('interface') || content.includes('type ')) {
      return 'typescript'
    }
    if (content.includes('<?php')) {
      return 'php'
    }
    if (content.includes('#include') || content.includes('int main')) {
      return 'cpp'
    }
    
    return 'text'
  }

  /**
   * 获取工具图标
   */
  private getToolIcon(toolName: string): string {
    const iconMap: Record<string, string> = {
      'Read': '📖',
      'Write': '✏️',
      'Edit': '✂️',
      'Bash': '⚡',
      'Grep': '🔍',
      'Glob': '📁',
      'todo_write': '📝',
      'todo_read': '📋',
      'exit_plan_mode': '🚪'
    }
    
    return iconMap[toolName] || '🔧'
  }

  /**
   * 获取内容类型图标
   */
  private getContentTypeIcon(type: CollapsibleContentType): string {
    const iconMap: Record<CollapsibleContentType, string> = {
      'tool-execution': '🔧',
      'tool-output': '🔧',
      'code-block': '📝',
      'code': '📝',
      'file-content': '📄',
      'error-message': '❌',
      'error': '❌',
      'analysis-result': '📊',
      'analysis': '📊',
      'long-text': '📄',
      'text': '📄',
      'bash-output': '⚡',
      'creative-content': '✍️',
      'creative-writing': '🎭',
      'article': '📰',
      'novel': '📖'
    }
    
    return iconMap[type] || '📄'
  }

  /**
   * 获取内容类型标签
   */
  private getContentTypeLabel(type: CollapsibleContentType): string {
    const labelMap: Record<CollapsibleContentType, string> = {
      'tool-execution': '工具执行',
      'tool-output': '工具输出',
      'code-block': '代码块',
      'code': '代码',
      'file-content': '文件内容',
      'error-message': '错误信息',
      'error': '错误',
      'analysis-result': '分析结果',
      'analysis': '分析',
      'long-text': '长文本',
      'text': '文本',
      'bash-output': '命令输出',
      'creative-content': '创作内容',
      'creative-writing': '创意写作',
      'article': '文章',
      'novel': '小说'
    }
    
    return labelMap[type] || '内容'
  }

  /**
   * 更新渲染选项
   */
  updateOptions(options: Partial<ContentBlockRenderOptions>): void {
    this.options = { ...this.options, ...options }
  }
}

// 全局渲染器实例
let globalRenderer: ContentBlockRenderer | null = null

/**
 * 获取全局内容块渲染器
 */
export function getContentBlockRenderer(options?: ContentBlockRenderOptions): ContentBlockRenderer {
  if (!globalRenderer) {
    globalRenderer = new ContentBlockRenderer(options)
  } else if (options) {
    globalRenderer.updateOptions(options)
  }
  return globalRenderer
}

/**
 * 快速渲染内容块
 */
export function renderContentBlock(
  block: ContentBlock, 
  options?: ContentBlockRenderOptions
): RenderedContentBlock {
  const renderer = getContentBlockRenderer(options)
  return renderer.renderBlock(block)
}