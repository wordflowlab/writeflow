import React, { useMemo } from 'react'
import { Text } from 'ink'
import { highlight, supportsLanguage } from 'cli-highlight'
import { getTheme } from '../../utils/theme.js'

interface HighlightedCodeProps {
  code: string
  language?: string
  inline?: boolean
}

export function HighlightedCode({ 
  code, 
  language = 'text', 
  inline = false 
}: HighlightedCodeProps) {
  const theme = getTheme()
  
  const highlightedCode = useMemo(() => {
    try {
      // 检查语言是否被支持
      if (language && supportsLanguage(language)) {
        // 使用默认高亮，但通过 CSS 样式优化颜色显示
        return highlight(code, { 
          language,
          // 使用内置的 'atom-one-dark' 主题获得更好的对比度
          theme: 'atom-one-dark'
        })
      } else {
        // 如果语言不支持，使用默认的代码块颜色
        return code
      }
    } catch (error) {
      console.error(`语法高亮失败 (${language}):`, error)
      // 发生错误时返回原始代码
      return code
    }
  }, [code, language, theme])

  return (
    <Text color={inline ? theme.codeBlock : undefined}>
      {highlightedCode}
    </Text>
  )
}

// 专门用于行内代码的组件 - 增强可见性
export function InlineCode({ code }: { code: string }) {
  const theme = getTheme()
  
  return (
    <Text color={theme.codeBlock} bold backgroundColor="#333333">
      {` ${code} `}
    </Text>
  )
}

// 代码块组件（多行代码）
export function CodeBlock({ 
  code, 
  language = 'text',
  showLanguage = false 
}: { 
  code: string
  language?: string
  showLanguage?: boolean 
}) {
  const theme = getTheme()
  
  return (
    <>
      {showLanguage && language !== 'text' && (
        <Text color={theme.info} backgroundColor="#333333" bold>
          {` ${language} `}
        </Text>
      )}
      <HighlightedCode code={code} language={language} />
    </>
  )
}