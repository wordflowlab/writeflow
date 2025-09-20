import { logWarn } from '../../utils/log.js'

/**


 * WriteFlow 代码格式化器
 * 基于 Claude Code 风格的语法高亮和格式化系统
 */

import { highlight, supportsLanguage } from 'cli-highlight'
import chalk from 'chalk'

export interface CodeFormatOptions {
  language?: string
  showLineNumbers?: boolean
  startLine?: number
  maxWidth?: number
  theme?: 'light' | 'dark'
}

export interface FormattedCode {
  content: string
  language: string
  lineCount: number
}

/**
 * 格式化代码块，支持语法高亮和行号
 */
export function formatCode(code: string, options: CodeFormatOptions = {}): FormattedCode {
  const {
    language = 'text',
    showLineNumbers = true,
    startLine = 1,
    maxWidth = process.stdout.columns - 4,
    theme = 'dark'
  } = options

  let highlightedCode = code
  let detectedLanguage = language

  try {
    // 自动检测语言
    if (language === 'auto') {
      detectedLanguage = detectLanguage(code)
    }

    // 应用语法高亮
    if (supportsLanguage(detectedLanguage)) {
      highlightedCode = highlight(code, { 
        language: detectedLanguage,
        theme: theme === 'dark' ? 'monokai' : 'github'
      })
    } else if (detectedLanguage !== 'text') {
      // 回退到通用语法高亮
      highlightedCode = highlight(code, { language: 'markdown' })
    }
  } catch (_error) {
    // 高亮失败时使用原始代码
    logWarn(`代码高亮失败: ${_error}`)
    highlightedCode = code
  }

  const lines = highlightedCode.split('\n')
  let formattedLines: string[] = []

  if (showLineNumbers) {
    const maxLineNumber = startLine + lines.length - 1
    const lineNumberWidth = maxLineNumber.toString().length

    formattedLines = lines.map((line, index) => {
      const lineNumber = (startLine + index).toString().padStart(lineNumberWidth)
      const lineNumberStyle = theme === 'dark' ? chalk.dim.gray : chalk.gray
      return `${lineNumberStyle(lineNumber)}→${line}`
    })
  } else {
    formattedLines = lines
  }

  // 应用最大宽度限制
  if (maxWidth && maxWidth > 0) {
    formattedLines = formattedLines.map(line => {
      if (line.length > maxWidth) {
        return line.slice(0, maxWidth - 3) + chalk.dim('...')
      }
      return line
    })
  }

  return {
    content: formattedLines.join('\n'),
    language: detectedLanguage,
    lineCount: lines.length
  }
}

/**
 * 简单的语言检测
 */
export function detectLanguage(code: string): string {
  const trimmed = code.trim()
  
  // JavaScript/TypeScript
  if (trimmed.includes('function') || trimmed.includes('=>') || 
      trimmed.includes('const ') || trimmed.includes('let ') || 
      trimmed.includes('var ') || trimmed.includes('import ')) {
    if (trimmed.includes('interface') || trimmed.includes(': string') || 
        trimmed.includes(': number') || trimmed.includes('type ')) {
      return 'typescript'
    }
    return 'javascript'
  }

  // JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // 不是有效的 JSON
    }
  }

  // Shell/Bash
  if (trimmed.startsWith('#!') || 
      trimmed.includes('#!/bin/bash') || 
      trimmed.includes('#!/bin/sh') ||
      /^[\w\-]+\s+\-/.test(trimmed) ||
      trimmed.includes('export ') ||
      trimmed.includes('echo ')) {
    return 'bash'
  }

  // Python
  if (trimmed.includes('def ') || 
      trimmed.includes('import ') || 
      trimmed.includes('from ') ||
      trimmed.includes('print(') ||
      /^\s*#\s/.test(trimmed)) {
    return 'python'
  }

  // Markdown
  if (trimmed.includes('# ') || 
      trimmed.includes('## ') ||
      trimmed.includes('```') ||
      trimmed.includes('* ') ||
      trimmed.includes('- ')) {
    return 'markdown'
  }

  // HTML/XML
  if (trimmed.includes('<') && trimmed.includes('>') &&
      (trimmed.includes('</') || trimmed.includes('/>'))) {
    return 'html'
  }

  // CSS
  if (trimmed.includes('{') && trimmed.includes('}') &&
      (trimmed.includes(':') && trimmed.includes(';'))) {
    return 'css'
  }

  // YAML
  if (trimmed.includes(':') && 
      (trimmed.includes('  ') || trimmed.includes('\t')) &&
      !trimmed.includes('{') && !trimmed.includes('(')) {
    return 'yaml'
  }

  // SQL
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(trimmed)) {
    return 'sql'
  }

  return 'text'
}

/**
 * 检测代码块模式并提取代码
 */
export function extractCodeBlocks(content: string): Array<{
  code: string
  language: string
  startIndex: number
  endIndex: number
}> {
  const codeBlocks: Array<{
    code: string
    language: string
    startIndex: number
    endIndex: number
  }> = []

  // 匹配三重反引号代码块
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      code: match[2],
      language: match[1] || 'text',
      startIndex: match.index,
      endIndex: match.index + match[0].length
    })
  }

  return codeBlocks
}

/**
 * 格式化内联代码
 */
export function formatInlineCode(text: string): string {
  // 处理内联代码 `code`
  return text.replace(/`([^`]+)`/g, (_, code) => {
    return chalk.blue.bgHex('#1a1a1a')(` ${code} `)
  })
}