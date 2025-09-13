/**
 * 色彩层次系统 - 采用现代化的视觉设计
 * 提供错落有致的排版和层次化颜色方案
 */

import chalk from 'chalk'

export interface ColorScheme {
  // 主要颜色
  primary: string
  secondary: string
  accent: string
  
  // 文本层次
  title: string
  heading: string
  text: string
  dim: string
  
  // 状态颜色
  success: string
  warning: string
  error: string
  info: string
  
  // 特殊元素
  code: string
  codeBlock: string
  link: string
  quote: string
  
  // 边框和分隔
  border: string
  separator: string
  
  // 工具相关
  toolName: string
  toolSuccess: string
  toolError: string
}

/**
 * WriteFlow 默认配色方案 - 采用现代化的优秀设计
 */
export const defaultColorScheme: ColorScheme = {
  // 主要颜色 - 紫色系（品牌色）
  primary: '#8B5CF6',     // 紫色
  secondary: '#A78BFA',   // 浅紫色
  accent: '#F59E0B',      // 金色强调
  
  // 文本层次 - 灰度渐变
  title: '#FFFFFF',       // 纯白（最高层次）
  heading: '#E5E7EB',     // 浅灰（标题）
  text: '#D1D5DB',        // 中灰（正文）
  dim: '#9CA3AF',         // 暗灰（次要信息）
  
  // 状态颜色 - 语义化
  success: '#10B981',     // 绿色
  warning: '#F59E0B',     // 橙色
  error: '#EF4444',       // 红色
  info: '#3B82F6',        // 蓝色
  
  // 特殊元素
  code: '#A78BFA',        // 浅紫（行内代码）
  codeBlock: '#6B7280',   // 深灰（代码块背景）
  link: '#60A5FA',        // 蓝色（链接）
  quote: '#9CA3AF',       // 暗灰（引用）
  
  // 边框和分隔
  border: '#374151',      // 深灰边框
  separator: '#4B5563',   // 分隔线
  
  // 工具相关
  toolName: '#8B5CF6',    // 紫色（工具名）
  toolSuccess: '#10B981', // 绿色（成功）
  toolError: '#EF4444',   // 红色（错误）
}

/**
 * Chalk 样式工厂 - 将颜色方案转换为 chalk 样式
 */
export function createChalkStyles(scheme: ColorScheme = defaultColorScheme) {
  return {
    // 主要样式
    primary: chalk.hex(scheme.primary),
    secondary: chalk.hex(scheme.secondary),
    accent: chalk.hex(scheme.accent),
    
    // 文本层次
    title: chalk.hex(scheme.title).bold,
    heading: chalk.hex(scheme.heading).bold,
    text: chalk.hex(scheme.text),
    dim: chalk.hex(scheme.dim),
    
    // 状态样式
    success: chalk.hex(scheme.success),
    warning: chalk.hex(scheme.warning),
    error: chalk.hex(scheme.error),
    info: chalk.hex(scheme.info),
    
    // 特殊元素样式
    code: chalk.hex(scheme.code),
    codeBlock: chalk.hex(scheme.codeBlock),
    link: chalk.hex(scheme.link).underline,
    quote: chalk.hex(scheme.quote).italic,
    
    // 边框样式
    border: chalk.hex(scheme.border),
    separator: chalk.hex(scheme.separator),
    
    // 工具样式
    toolName: chalk.hex(scheme.toolName).bold,
    toolSuccess: chalk.hex(scheme.success).bold,
    toolError: chalk.hex(scheme.error).bold,
    
    // 组合样式
    successBold: chalk.hex(scheme.success).bold,
    errorBold: chalk.hex(scheme.error).bold,
    warningBold: chalk.hex(scheme.warning).bold,
    infoBold: chalk.hex(scheme.info).bold,
    
    // 层次化样式组合
    h1: chalk.hex(scheme.title).bold.underline,
    h2: chalk.hex(scheme.heading).bold,
    h3: chalk.hex(scheme.text).bold,
    
    // 特殊格式
    highlight: chalk.hex(scheme.accent).bold,
    muted: chalk.hex(scheme.dim).italic,
    
    // 工具执行相关
    toolHeader: chalk.hex(scheme.toolName).bold,
    toolParam: chalk.hex(scheme.secondary),
    toolResult: chalk.hex(scheme.text),
    toolProgress: chalk.hex(scheme.info),
  }
}

/**
 * 内容类型颜色映射 - 基于内容分析器的类型
 */
export function getContentTypeColor(type: string): string {
  const styles = createChalkStyles()
  switch (type) {
    case 'tool-execution':
    case 'tool-output':
      return defaultColorScheme.toolName
    case 'code-block':
    case 'code':
      return defaultColorScheme.code
    case 'file-content':
      return defaultColorScheme.text
    case 'error-message':
    case 'error':
      return defaultColorScheme.error
    case 'bash-output':
      return defaultColorScheme.code
    case 'long-text':
    case 'text':
      return defaultColorScheme.text
    case 'analysis-result':
    case 'analysis':
      return defaultColorScheme.info
    default:
      return defaultColorScheme.text
  }
}

/**
 * 工具状态颜色映射
 */
export function getToolStatusColor(status: string, styles = createChalkStyles()) {
  switch (status) {
    case 'executing':
    case 'running':
      return styles.toolProgress
    case 'success':
    case 'completed':
      return styles.toolSuccess
    case 'error':
    case 'failed':
      return styles.toolError
    case 'warning':
      return styles.warning
    default:
      return styles.text
  }
}

/**
 * 创建层次化的文本格式器
 */
export class HierarchicalFormatter {
  private styles: ReturnType<typeof createChalkStyles>
  
  constructor(scheme?: ColorScheme) {
    this.styles = createChalkStyles(scheme)
  }
  
  /**
   * 格式化标题层次
   */
  title(text: string, level: 1 | 2 | 3 = 1): string {
    switch (level) {
      case 1:
        return this.styles.h1(text)
      case 2:
        return this.styles.h2(text)
      case 3:
        return this.styles.h3(text)
    }
  }
  
  /**
   * 格式化工具相关信息
   */
  tool(name: string, status?: string): string {
    const formattedName = this.styles.toolHeader(name)
    if (status) {
      const statusColor = getToolStatusColor(status, this.styles)
      return `${formattedName} ${statusColor(status)}`
    }
    return formattedName
  }
  
  /**
   * 格式化参数信息
   */
  param(key: string, value: string): string {
    return `${this.styles.dim(key)}: ${this.styles.toolParam(value)}`
  }
  
  /**
   * 格式化代码内容
   */
  code(content: string, inline: boolean = false): string {
    return inline ? this.styles.code(content) : this.styles.codeBlock(content)
  }
  
  /**
   * 格式化分隔符
   */
  separator(char: string = '─', length: number = 40): string {
    return this.styles.separator(char.repeat(length))
  }
  
  /**
   * 格式化进度信息
   */
  progress(current: number, total: number, description?: string): string {
    const percentage = Math.round((current / total) * 100)
    const progress = `[${current}/${total}] ${percentage}%`
    const formatted = this.styles.toolProgress(progress)
    
    if (description) {
      return `${formatted} ${this.styles.dim(description)}`
    }
    return formatted
  }
  
  /**
   * 格式化文件路径
   */
  path(filePath: string): string {
    // 高亮文件名，路径用暗色
    const parts = filePath.split('/')
    const fileName = parts.pop() || ''
    const dirPath = parts.join('/')
    
    if (dirPath) {
      return `${this.styles.dim(dirPath + '/')}${this.styles.accent(fileName)}`
    }
    return this.styles.accent(fileName)
  }
  
  /**
   * 格式化列表项
   */
  listItem(content: string, level: number = 0, bullet: string = '•'): string {
    const indent = '  '.repeat(level)
    const bulletColor = level === 0 ? this.styles.primary : this.styles.secondary
    return `${indent}${bulletColor(bullet)} ${content}`
  }
}

/**
 * 全局格式器实例
 */
export const formatter = new HierarchicalFormatter()

/**
 * 快捷格式化函数
 */
export const format = {
  title: (text: string, level?: 1 | 2 | 3) => formatter.title(text, level),
  tool: (name: string, status?: string) => formatter.tool(name, status),
  param: (key: string, value: string) => formatter.param(key, value),
  code: (content: string, inline?: boolean) => formatter.code(content, inline),
  separator: (char?: string, length?: number) => formatter.separator(char, length),
  progress: (current: number, total: number, desc?: string) => formatter.progress(current, total, desc),
  path: (filePath: string) => formatter.path(filePath),
  listItem: (content: string, level?: number, bullet?: string) => formatter.listItem(content, level, bullet),
  
  // 快捷样式
  success: createChalkStyles().success,
  error: createChalkStyles().error,
  warning: createChalkStyles().warning,
  info: createChalkStyles().info,
  dim: createChalkStyles().dim,
  highlight: createChalkStyles().highlight,
  
  // 新增流式消息格式化支持
  bold: createChalkStyles().heading,
  italic: createChalkStyles().quote,
  keyword: createChalkStyles().primary,
}