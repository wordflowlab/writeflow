// WriteFlow 内容解析器 - 基于 Markdown tokens 实现丰富的终端渲染
import { marked, Token } from 'marked'
import { highlight, supportsLanguage } from 'cli-highlight'
import { getTheme } from './theme.js'

export interface ParsedContent {
  type: string
  content: string
  color?: string
  style?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    dim?: boolean
  }
  language?: string
}

export interface ContentParserOptions {
  preserveWhitespace?: boolean
  maxDepth?: number
}

/**
 * 解析文本内容为结构化的渲染对象
 */
export function parseContent(
  content: string, 
  options: ContentParserOptions = {}
): ParsedContent[] {
  const { preserveWhitespace = true, maxDepth = 10 } = options
  
  try {
    const tokens = marked.lexer(content)
    return tokens.map(token => formatToken(token, 0, maxDepth)).flat()
  } catch (error) {
    console.error('内容解析错误:', error)
    // 如果解析失败，返回原始文本
    return [{
      type: 'text',
      content: content,
      color: getTheme().text
    }]
  }
}

/**
 * 格式化单个 token 为渲染对象
 */
function formatToken(
  token: Token, 
  depth = 0, 
  maxDepth = 10,
  listDepth = 0,
  orderedListNumber: number | null = null
): ParsedContent[] {
  if (depth > maxDepth) {
    return [{
      type: 'text',
      content: 'content',
      color: getTheme().text
    }]
  }

  const theme = getTheme()

  switch (token.type) {
    case 'heading': {
      const headingText = (token.tokens ?? [])
        .map(t => formatToken(t, depth + 1, maxDepth))
        .flat()
        .map(p => p.content)
        .join('')

      return [{
        type: 'heading',
        content: headingText + '\n\n',
        color: theme.claude,
        style: {
          bold: true,
          italic: token.depth === 1,
          underline: token.depth === 1,
          dim: token.depth > 2
        }
      }]
    }

    case 'code': {
      // 代码块
      const language = token.lang || 'text'
      let highlightedCode: string

      try {
        if (language && supportsLanguage(language)) {
          highlightedCode = highlight(token.text, { language })
        } else {
          highlightedCode = token.text // 原始代码，无高亮
        }
      } catch (error) {
        console.error('代码高亮失败:', error)
        highlightedCode = token.text
      }

      return [{
        type: 'code',
        content: highlightedCode + '\n',
        color: theme.codeBlock,
        language
      }]
    }

    case 'codespan': {
      // 行内代码
      return [{
        type: 'codespan',
        content: token.text,
        color: theme.codeBlock,
        style: { bold: true }
      }]
    }

    case 'blockquote': {
      const quoteText = (token.tokens ?? [])
        .map(t => formatToken(t, depth + 1, maxDepth))
        .flat()
        .map(p => p.content)
        .join('')

      return [{
        type: 'blockquote',
        content: quoteText,
        color: theme.quote,
        style: { italic: true, dim: true }
      }]
    }

    case 'list': {
      return token.items
        .map((item: Token, index: number) =>
          formatToken(
            item,
            depth + 1,
            maxDepth,
            listDepth,
            token.ordered ? (token.start || 1) + index : null
          )
        )
        .flat()
    }

    case 'list_item': {
      const itemText = (token.tokens ?? [])
        .map(t => formatToken(t, depth + 1, maxDepth, listDepth + 1, orderedListNumber))
        .flat()
        .map(p => p.content)
        .join('')

      const indent = '  '.repeat(listDepth)
      const marker = orderedListNumber === null ? '- ' : `${orderedListNumber}. `

      return [{
        type: 'list_item',
        content: `${indent}${marker}${itemText}`,
        color: theme.text
      }]
    }

    case 'paragraph': {
      const paragraphText = (token.tokens ?? [])
        .map(t => formatToken(t, depth + 1, maxDepth))
        .flat()
        .map(p => p.content)
        .join('')

      return [{
        type: 'paragraph',
        content: paragraphText + '\n',
        color: theme.text
      }]
    }

    case 'strong': {
      const strongText = (token.tokens ?? [])
        .map(t => formatToken(t, depth + 1, maxDepth))
        .flat()
        .map(p => p.content)
        .join('')

      return [{
        type: 'strong',
        content: strongText,
        color: theme.text,
        style: { bold: true }
      }]
    }

    case 'em': {
      const emText = (token.tokens ?? [])
        .map(t => formatToken(t, depth + 1, maxDepth))
        .flat()
        .map(p => p.content)
        .join('')

      return [{
        type: 'em',
        content: emText,
        color: theme.text,
        style: { italic: true }
      }]
    }

    case 'link': {
      return [{
        type: 'link',
        content: token.href,
        color: theme.info,
        style: { underline: true }
      }]
    }

    case 'image': {
      return [{
        type: 'image',
        content: `[图像: ${token.title || token.text || 'image'}: ${token.href}]`,
        color: theme.dimText,
        style: { dim: true }
      }]
    }

    case 'hr': {
      return [{
        type: 'hr',
        content: '---\n',
        color: theme.dimText,
        style: { dim: true }
      }]
    }

    case 'space': {
      return [{
        type: 'space',
        content: '\n',
        color: theme.text
      }]
    }

    case 'text': {
      // 如果有子tokens，递归处理
      if (token.tokens && token.tokens.length > 0) {
        return token.tokens
          .map(t => formatToken(t, depth + 1, maxDepth))
          .flat()
      }

      return [{
        type: 'text',
        content: token.text || '',
        color: theme.text
      }]
    }

    default: {
      // 处理未知类型的token
      const fallbackContent = (token as any).raw || (token as any).text || ''
      return [{
        type: 'unknown',
        content: fallbackContent,
        color: theme.text
      }]
    }
  }
}

/**
 * 检测内容类型的简单工具函数
 */
export function detectContentType(content: string): string {
  if (content.includes('```')) return 'markdown'
  if (content.includes('# ') || content.includes('## ')) return 'markdown'
  if (content.includes('- ') || content.includes('1. ')) return 'markdown'
  if (content.includes('> ')) return 'markdown'
  return 'text'
}

/**
 * 提取代码块信息
 */
export function extractCodeBlocks(content: string): Array<{language: string, code: string}> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const matches = []
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    matches.push({
      language: match[1] || 'text',
      code: match[2].trim()
    })
  }

  return matches
}