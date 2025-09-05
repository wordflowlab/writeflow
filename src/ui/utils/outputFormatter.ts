/**
 * WriteFlow 输出格式化管理器
 * 统一处理流式输出的格式化和显示
 */

import { renderMarkdown } from './markdownRenderer.js'
import { formatCode, extractCodeBlocks } from './codeFormatter.js'
import { createSimpleDiff, formatDiff } from './diffFormatter.js'
import { getThemeColors, getThemeManager } from '../theme/index.js'
import { figures } from '../constants/figures.js'

export interface OutputFormatOptions {
  theme?: 'light' | 'dark'
  maxWidth?: number
  showProgress?: boolean
  enableColors?: boolean
  lineNumbers?: boolean
}

export interface FormattedOutput {
  content: string
  hasCodeBlocks: boolean
  codeBlockCount: number
  renderTime: number
}

/**
 * 主输出格式化器
 */
export class OutputFormatter {
  private options: Required<OutputFormatOptions>

  constructor(options: OutputFormatOptions = {}) {
    this.options = {
      theme: options.theme || 'dark',
      maxWidth: options.maxWidth || process.stdout.columns - 4,
      showProgress: options.showProgress ?? true,
      enableColors: options.enableColors ?? true,
      lineNumbers: options.lineNumbers ?? true
    }
  }

  /**
   * 格式化流式输出内容
   */
  formatStreamOutput(content: string, options: Partial<OutputFormatOptions> = {}): FormattedOutput {
    const startTime = Date.now()
    const mergedOptions = { ...this.options, ...options }

    if (!mergedOptions.enableColors) {
      return {
        content,
        hasCodeBlocks: false,
        codeBlockCount: 0,
        renderTime: Date.now() - startTime
      }
    }

    try {
      // 检测代码块
      const codeBlocks = extractCodeBlocks(content)
      const hasCodeBlocks = codeBlocks.length > 0

      // 如果包含代码块，使用 Markdown 渲染器
      if (hasCodeBlocks) {
        const rendered = renderMarkdown(content, {
          maxWidth: mergedOptions.maxWidth,
          theme: mergedOptions.theme,
          showCodeLineNumbers: mergedOptions.lineNumbers
        })

        return {
          content: rendered,
          hasCodeBlocks: true,
          codeBlockCount: codeBlocks.length,
          renderTime: Date.now() - startTime
        }
      }

      // 检测是否是代码（无三重反引号包裹）
      if (this.isCodeContent(content)) {
        const formatted = formatCode(content, {
          language: 'auto',
          showLineNumbers: mergedOptions.lineNumbers,
          theme: mergedOptions.theme,
          maxWidth: mergedOptions.maxWidth
        })

        return {
          content: formatted.content,
          hasCodeBlocks: true,
          codeBlockCount: 1,
          renderTime: Date.now() - startTime
        }
      }

      // 普通文本使用 Markdown 渲染器
      const rendered = renderMarkdown(content, {
        maxWidth: mergedOptions.maxWidth,
        theme: mergedOptions.theme,
        showCodeLineNumbers: false
      })

      return {
        content: rendered,
        hasCodeBlocks: false,
        codeBlockCount: 0,
        renderTime: Date.now() - startTime
      }

    } catch (error) {
      console.warn(`输出格式化失败: ${error}`)
      return {
        content,
        hasCodeBlocks: false,
        codeBlockCount: 0,
        renderTime: Date.now() - startTime
      }
    }
  }

  /**
   * 格式化文件差异
   */
  formatFileDiff(oldContent: string, newContent: string, fileName: string): string {
    const diff = createSimpleDiff(oldContent, newContent, fileName)
    return formatDiff(diff, {
      theme: this.options.theme,
      maxWidth: this.options.maxWidth,
      showLineNumbers: this.options.lineNumbers
    })
  }

  /**
   * 格式化进度信息
   */
  formatProgress(message: string, progress?: { current: number; total: number }): string {
    if (!this.options.showProgress) return message

    const colors = this.getThemeColors()
    const icon = colors.progress(figures.spinner[Date.now() % figures.spinner.length])
    
    let progressText = message
    
    if (progress) {
      const percentage = Math.round((progress.current / progress.total) * 100)
      const progressBar = this.createProgressBar(percentage)
      progressText = `${message} ${progressBar} ${progress.current}/${progress.total}`
    }

    return `${icon} ${progressText}`
  }

  /**
   * 格式化错误信息
   */
  formatError(error: string | Error): string {
    const colors = this.getThemeColors()
    const errorMessage = error instanceof Error ? error.message : error
    
    return `${colors.error(figures.cross)} ${colors.error('错误:')} ${errorMessage}`
  }

  /**
   * 格式化成功信息
   */
  formatSuccess(message: string): string {
    const colors = this.getThemeColors()
    return `${colors.success(figures.tick)} ${message}`
  }

  /**
   * 格式化警告信息
   */
  formatWarning(message: string): string {
    const colors = this.getThemeColors()
    return `${colors.warning(figures.warning)} ${message}`
  }

  /**
   * 格式化文件操作
   */
  formatFileOperation(operation: 'create' | 'update' | 'delete', filePath: string): string {
    const colors = this.getThemeColors()
    
    let icon: string
    let color: any
    
    switch (operation) {
      case 'create':
        icon = figures.plus
        color = colors.success
        break
      case 'update':
        icon = figures.dot
        color = colors.info
        break
      case 'delete':
        icon = figures.cross
        color = colors.error
        break
    }

    return `${color(icon)} ${color(operation.toUpperCase())}: ${filePath}`
  }

  /**
   * 检测是否为代码内容
   */
  private isCodeContent(content: string): boolean {
    const codeIndicators = [
      'function', 'const', 'let', 'var', 'class', 'interface', 'type',
      'import', 'export', 'require', 'def', 'if', 'for', 'while',
      '{', '}', '(', ')', '[', ']', '=>', ':', ';'
    ]

    const lines = content.trim().split('\n')
    
    // 如果有多行且包含代码指示符
    if (lines.length > 1) {
      const codeLineCount = lines.filter(line => 
        codeIndicators.some(indicator => line.includes(indicator))
      ).length
      
      return codeLineCount / lines.length > 0.3 // 30% 的行包含代码指示符
    }

    return false
  }

  /**
   * 创建进度条
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width)
    const empty = width - filled
    
    const colors = this.getThemeColors()
    const filledBar = colors.progress('█'.repeat(filled))
    const emptyBar = colors.dim('░'.repeat(empty))
    
    return `[${filledBar}${emptyBar}] ${percentage}%`
  }

  /**
   * 获取主题颜色
   */
  private getThemeColors() {
    const themeManager = getThemeManager()
    
    // 如果指定了主题，临时切换
    if (this.options.theme && this.options.theme !== themeManager.getThemeName()) {
      const originalTheme = themeManager.getThemeName()
      themeManager.setTheme(this.options.theme)
      const colors = themeManager.getColors()
      themeManager.setTheme(originalTheme) // 恢复原主题
      
      return {
        success: colors.success,
        error: colors.error,
        warning: colors.warning,
        info: colors.info,
        progress: colors.progress,
        dim: colors.muted
      }
    }
    
    // 使用当前主题
    const colors = getThemeColors()
    return {
      success: colors.success,
      error: colors.error,
      warning: colors.warning,
      info: colors.info,
      progress: colors.progress,
      dim: colors.muted
    }
  }

  /**
   * 更新选项
   */
  updateOptions(options: Partial<OutputFormatOptions>): void {
    this.options = { ...this.options, ...options }
  }
}

// 全局格式化器实例
let globalFormatter: OutputFormatter | null = null

/**
 * 获取全局格式化器实例
 */
export function getOutputFormatter(options?: OutputFormatOptions): OutputFormatter {
  if (!globalFormatter) {
    globalFormatter = new OutputFormatter(options)
  } else if (options) {
    globalFormatter.updateOptions(options)
  }
  return globalFormatter
}