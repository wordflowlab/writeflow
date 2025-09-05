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
        return highlight(code, { language })
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

// 专门用于行内代码的组件
export function InlineCode({ code }: { code: string }) {
  const theme = getTheme()
  
  return (
    <Text color={theme.codeBlock} bold>
      {code}
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
        <Text color={theme.dimText} dimColor>
          {language}
        </Text>
      )}
      <HighlightedCode code={code} language={language} />
    </>
  )
}