import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { parseContent, ParsedContent, detectContentType } from '../../utils/contentParser.js'
import { InlineCode, CodeBlock } from './HighlightedCode.js'
import { getTheme } from '../../utils/theme.js'

interface RichTextRendererProps {
  content: string
  wrap?: boolean
  preserveWhitespace?: boolean
}

/**
 * 富文本渲染器 - WriteFlow 的核心文本显示组件
 * 支持 Markdown 语法、代码高亮和多层次颜色显示
 */
export function RichTextRenderer({ 
  content, 
  wrap = true,
  preserveWhitespace = true 
}: RichTextRendererProps) {
  const theme = getTheme()
  
  // 解析内容为结构化数据
  const parsedContent = useMemo(() => {
    if (!content || content.trim().length === 0) {
      return []
    }

    const contentType = detectContentType(content)
    
    // 如果内容很简单（纯文本），直接返回
    if (contentType === 'text' && !content.includes('\n')) {
      return [{
        type: 'text',
        content: content,
        color: theme.text
      }]
    }

    // 否则进行完整的 Markdown 解析
    return parseContent(content, { preserveWhitespace })
  }, [content, preserveWhitespace, theme])

  // 渲染单个内容片段
  const renderContentPiece = (piece: ParsedContent, index: number) => {
    const { type, content: text, color, style = {}, language } = piece

    // 处理空内容
    if (!text || text.length === 0) {
      return null
    }

    // 根据内容类型分配更鲜明的颜色
    const getTypeColor = () => {
      switch (type) {
        case 'heading': 
          return theme.info  // 使用鲜明的蓝色作为标题
        case 'strong': 
          return theme.warning  // 使用橙色强调粗体
        case 'em': 
          return theme.claude   // 使用品牌绿色强调斜体
        case 'link': 
          return theme.info     // 链接使用蓝色
        case 'blockquote': 
          return theme.dimText  // 引用使用稍微暗一些但仍清晰的灰色
        case 'list_item': 
          return theme.text     // 列表项使用正常文本颜色
        default: 
          return color || theme.text
      }
    }

    // 应用样式属性，使用增强的颜色
    const textProps = {
      color: getTypeColor(),
      bold: style.bold || type === 'strong',
      italic: style.italic || type === 'em',
      underline: style.underline || type === 'link',
      dimColor: style.dim,
      wrap: wrap ? 'wrap' as const : undefined
    }

    switch (type) {
      case 'code':
        // 代码块
        return (
          <Box key={index} flexDirection="column">
            <CodeBlock 
              code={text}
              language={language}
              showLanguage={false}
            />
          </Box>
        )

      case 'codespan':
        // 行内代码
        return <InlineCode key={index} code={text} />

      case 'heading':
        // 标题
        return (
          <Box key={index} flexDirection="column" marginY={1}>
            <Text {...textProps}>
              {text}
            </Text>
          </Box>
        )

      case 'blockquote':
        // 引用
        return (
          <Box key={index} flexDirection="column" marginLeft={2}>
            <Text {...textProps}>
              {text}
            </Text>
          </Box>
        )

      case 'list_item':
        // 列表项
        return (
          <Box key={index} flexDirection="row">
            <Text {...textProps}>
              {text}
            </Text>
          </Box>
        )

      case 'hr':
        // 分隔线
        return (
          <Box key={index} flexDirection="column" marginY={1}>
            <Text {...textProps}>
              {text}
            </Text>
          </Box>
        )

      case 'image':
        // 图像占位符
        return (
          <Text key={index} {...textProps}>
            {text}
          </Text>
        )

      case 'link':
        // 链接
        return (
          <Text key={index} {...textProps}>
            {text}
          </Text>
        )

      case 'paragraph':
      case 'text':
      case 'strong':
      case 'em':
      default:
        // 普通文本、段落、强调等 - 处理换行符
        if (text.includes('\n')) {
          return (
            <Box key={index} flexDirection="column">
              {text.split('\n').map((line, lineIndex) => (
                <Text key={lineIndex} {...textProps}>
                  {line}
                </Text>
              ))}
            </Box>
          )
        }
        return (
          <Text key={index} {...textProps}>
            {text}
          </Text>
        )
    }
  }

  // 如果没有解析内容，显示原始文本 - 处理换行符
  if (parsedContent.length === 0) {
    if (content.includes('\n')) {
      return (
        <Box flexDirection="column">
          {content.split('\n').map((line, index) => (
            <Text key={index} color={theme.text} wrap={wrap ? 'wrap' : undefined}>
              {line}
            </Text>
          ))}
        </Box>
      )
    }
    return (
      <Text color={theme.text} wrap={wrap ? 'wrap' : undefined}>
        {content}
      </Text>
    )
  }

  // 渲染解析后的内容
  return (
    <Box flexDirection="column" width="100%">
      {parsedContent.map(renderContentPiece).filter(Boolean)}
    </Box>
  )
}

/**
 * 简化的富文本组件 - 用于不需要复杂布局的场景
 */
export function SimpleRichText({ content }: { content: string }) {
  const theme = getTheme()
  
  // 对于简单内容，只进行基本的处理
  const hasMarkdown = content.includes('`') || content.includes('**') || content.includes('*') || content.includes('#')
  
  if (!hasMarkdown) {
    return (
      <Text color={theme.text}>
        {content}
      </Text>
    )
  }

  return (
    <RichTextRenderer 
      content={content} 
      wrap={true}
      preserveWhitespace={true}
    />
  )
}

