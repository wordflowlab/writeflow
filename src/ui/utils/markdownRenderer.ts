import { debugLog, logError, logWarn, infoLog } from '../../utils/log.js'

/**


 * WriteFlow Markdown 渲染器
 * 基于 Claude Code 风格的终端 Markdown 渲染
 */

import { marked, Token } from 'marked'
import chalk from 'chalk'
import { formatCode, formatInlineCode } from './codeFormatter.js'
import { figures } from '../constants/figures.js'

export interface MarkdownRenderOptions {
  maxWidth?: number
  theme?: 'light' | 'dark'
  showCodeLineNumbers?: boolean
  preserveCodeBlocks?: boolean
}

/**
 * 渲染 Markdown 为终端格式
 */
export function renderMarkdown(content: string, options: MarkdownRenderOptions = {}): string {
  const {
    maxWidth = process.stdout.columns - 2,
    theme = 'dark',
    showCodeLineNumbers = true,
    preserveCodeBlocks = false
  } = options

  try {
    // 解析 Markdown
    const tokens = marked.lexer(content)
    
    // 渲染每个 token
    const rendered = tokens.map(token => renderToken(token, {
      maxWidth,
      theme,
      showCodeLineNumbers,
      preserveCodeBlocks
    })).join('')

    return rendered.trim()
  } catch (error) {
    logWarn(`Markdown 渲染失败: ${error}`)
    return formatInlineCode(content)
  }
}

/**
 * 渲染单个 token
 */
function renderToken(token: Token, options: MarkdownRenderOptions, depth = 0): string {
  const { maxWidth = 80, theme = 'dark', showCodeLineNumbers = true } = options
  const indent = '  '.repeat(depth)

  switch (token.type) {
    case 'heading':
      return renderHeading(token, theme)

    case 'paragraph':
      const paragraphContent = renderTokens(token.tokens || [], options, depth)
      return wrapText(paragraphContent, maxWidth) + '\n\n'

    case 'code':
      return renderCodeBlock(token, { showCodeLineNumbers, theme }) + '\n'

    case 'blockquote':
      const quoteContent = renderTokens(token.tokens || [], options, depth)
      return renderBlockquote(quoteContent, theme)

    case 'list':
      return renderList(token, options, depth)

    case 'list_item':
      const itemContent = renderTokens(token.tokens || [], options, depth + 1)
      const bullet = token.task ? 
        (token.checked ? chalk.green(`${figures.tick} `) : chalk.red(`${figures.cross} `)) :
        chalk.dim(`${figures.bullet} `)
      return `${indent}${bullet}${itemContent.trim()}\n`

    case 'hr':
      return chalk.dim('─'.repeat(Math.min(maxWidth, 40))) + '\n\n'

    case 'table':
      return renderTable(token, theme, maxWidth)

    case 'text':
      if (token.tokens) {
        return renderTokens(token.tokens, options, depth)
      }
      return formatInlineCode(token.text)

    case 'strong':
      const boldContent = renderTokens(token.tokens || [], options, depth)
      return chalk.bold(boldContent)

    case 'em':
      const italicContent = renderTokens(token.tokens || [], options, depth)
      return chalk.italic(italicContent)

    case 'codespan':
      return chalk.blue.bgHex(theme === 'dark' ? '#1a1a1a' : '#f5f5f5')(` ${token.text} `)

    case 'link':
      return chalk.blue.underline(token.href)

    case 'image':
      return chalk.cyan(`[图片: ${token.title || token.text}]`)

    case 'space':
      return '\n'

    case 'html':
      // 简单处理 HTML 标签
      return token.text.replace(/<[^>]*>/g, '')

    default:
      return (token as any).text || ''
  }
}

/**
 * 渲染 token 数组
 */
function renderTokens(tokens: Token[], options: MarkdownRenderOptions, depth = 0): string {
  return tokens.map(token => renderToken(token, options, depth)).join('')
}

/**
 * 渲染标题
 */
function renderHeading(token: any, theme: 'light' | 'dark'): string {
  const content = renderTokens(token.tokens || [], { theme })
  
  switch (token.depth) {
    case 1:
      return chalk.bold.underline.cyan(content) + '\n\n'
    case 2:
      return chalk.bold.blue(content) + '\n\n'
    case 3:
      return chalk.bold.green(content) + '\n\n'
    case 4:
      return chalk.bold.yellow(content) + '\n\n'
    case 5:
      return chalk.bold.magenta(content) + '\n\n'
    case 6:
      return chalk.bold.red(content) + '\n\n'
    default:
      return chalk.bold(content) + '\n\n'
  }
}

/**
 * 渲染代码块
 */
function renderCodeBlock(token: any, options: { showCodeLineNumbers: boolean, theme: 'light' | 'dark' }): string {
  const { showCodeLineNumbers, theme } = options
  
  const formatted = formatCode(token.text, {
    language: token.lang || 'text',
    showLineNumbers: showCodeLineNumbers,
    theme
  })

  // 添加代码块框架
  const border = chalk.dim('─')
  const corner = chalk.dim('│')
  const lines = formatted.content.split('\n')
  
  const maxLineLength = Math.max(...lines.map(l => l.length))
  const borderLength = Math.max(0, Math.min(80, maxLineLength + 2) - 2)
  
  const framedLines = [
    chalk.dim(`┌${border.repeat(borderLength)}┐`),
    ...lines.map(line => `${corner} ${line}`),
    chalk.dim(`└${border.repeat(borderLength)}┘`)
  ]

  return framedLines.join('\n')
}

/**
 * 渲染引用块
 */
function renderBlockquote(content: string, theme: 'light' | 'dark'): string {
  const lines = content.trim().split('\n')
  const quoteMark = theme === 'dark' ? chalk.dim.blue('▏') : chalk.dim.gray('│')
  
  return lines.map(line => `${quoteMark} ${chalk.italic(line)}`).join('\n') + '\n\n'
}

/**
 * 渲染列表
 */
function renderList(token: any, options: MarkdownRenderOptions, depth = 0): string {
  const items = token.items.map((item: any, index: number) => {
    const itemOptions = { ...options }
    if (token.ordered) {
      const number = (token.start || 1) + index
      const numberStr = depth === 0 ? `${number}.` :
                       depth === 1 ? `${String.fromCharCode(97 + index)}.` :
                       `${['i', 'ii', 'iii', 'iv', 'v'][index] || (index + 1)}.`
      return renderTokens(item.tokens || [], itemOptions, depth).replace(
        figures.bullet,
        chalk.cyan(numberStr)
      )
    }
    return renderToken(item, itemOptions, depth)
  })
  
  return items.join('') + '\n'
}

/**
 * 渲染表格
 */
function renderTable(token: any, theme: 'light' | 'dark', maxWidth: number): string {
  if (!token.header || !token.rows) return ''

  const headers = token.header.map((cell: any) => 
    renderTokens(cell.tokens || [], { theme }).trim()
  )
  
  const rows = token.rows.map((row: any[]) => 
    row.map((cell: any) => renderTokens(cell.tokens || [], { theme }).trim())
  )

  // 计算列宽
  const columnWidths = headers.map((header: string, i: number) => {
    const headerWidth = header.length
    const maxRowWidth = Math.max(...rows.map((row: string[]) => row[i]?.length || 0))
    return Math.min(Math.max(headerWidth, maxRowWidth), Math.floor(maxWidth / headers.length) - 3)
  })

  // 渲染表格
  const border = chalk.dim('─')
  const vertical = chalk.dim('│')
  
  let table = ''
  
  // 表头
  table += chalk.dim('┌') + columnWidths.map((w: number) => border.repeat(w + 2)).join(chalk.dim('┬')) + chalk.dim('┐\n')
  table += vertical + ' ' + headers.map((header: string, i: number) => 
    chalk.bold(header.padEnd(columnWidths[i]))
  ).join(` ${vertical} `) + ` ${vertical}\n`
  
  // 分隔线
  table += chalk.dim('├') + columnWidths.map((w: number) => border.repeat(w + 2)).join(chalk.dim('┼')) + chalk.dim('┤\n')
  
  // 数据行
  rows.forEach((row: string[]) => {
    table += vertical + ' ' + row.map((cell: string, i: number) => 
      (cell || '').padEnd(columnWidths[i])
    ).join(` ${vertical} `) + ` ${vertical}\n`
  })
  
  // 底部边框
  table += chalk.dim('└') + columnWidths.map((w: number) => border.repeat(w + 2)).join(chalk.dim('┴')) + chalk.dim('┘\n\n')

  return table
}

/**
 * 文本换行
 */
function wrapText(text: string, maxWidth: number): string {
  if (!text || maxWidth <= 0) return text
  
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    if ((currentLine + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  
  if (currentLine) lines.push(currentLine)
  return lines.join('\n')
}