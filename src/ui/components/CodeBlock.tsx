/**
 * WriteFlow CodeBlock 组件
 * 基于 Ink 的代码块显示组件
 */

import React from 'react'
import { Text, Box } from 'ink'
import { formatCode } from '../utils/codeFormatter.js'
import { figures } from '../constants/figures.js'

export interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  startLine?: number
  maxWidth?: number
  theme?: 'light' | 'dark'
  title?: string
  filename?: string
  showBorder?: boolean
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  showLineNumbers = true,
  startLine = 1,
  maxWidth,
  theme = 'dark',
  title,
  filename,
  showBorder = true
}) => {
  if (!code.trim()) {
    return null
  }

  const formatted = formatCode(code, {
    language,
    showLineNumbers,
    startLine,
    maxWidth,
    theme
  })

  const borderColor = theme === 'dark' ? 'gray' : 'blackBright'
  const headerColor = theme === 'dark' ? 'cyan' : 'blue'

  return (
    <Box flexDirection="column" marginY={1}>
      {/* 头部：文件名或标题 */}
      {(title || filename) && (
        <Box marginBottom={1}>
          <Text color={headerColor}>
            {figures.codeblock} {title || filename}
          </Text>
        </Box>
      )}

      {/* 代码块 */}
      <Box flexDirection="column">
        {showBorder ? (
          <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1}>
            <Text>{formatted.content}</Text>
          </Box>
        ) : (
          <Text>{formatted.content}</Text>
        )}
        
        {/* 底部信息：语言和行数 */}
        {formatted.language !== 'text' && (
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              {formatted.language} · {formatted.lineCount} lines
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

