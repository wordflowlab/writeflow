import React from 'react'
import { Box, Text } from 'ink'

interface ReadRendererProps {
  fileName: string
  content: string
  lineNumbers?: boolean
  maxLines?: number
  highlightLines?: number[]
}

export function ReadRenderer({ 
  fileName, 
  content, 
  lineNumbers = true,
  maxLines = 50,
  highlightLines = []
}: ReadRendererProps) {
  const lines = content.split('\n')
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines
  const hasMoreLines = lines.length > displayLines.length

  const getLineNumberWidth = (): number => {
    return lines.length.toString().length
  }

  const isHighlighted = (lineIndex: number): boolean => {
    return highlightLines.includes(lineIndex + 1)
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* 文件头部 */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>📄 {fileName}</Text>
        <Text color="gray"> ({lines.length} 行)</Text>
      </Box>

      {/* 文件内容 */}
      <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="gray">
        {displayLines.map((line, index) => (
          <Box key={index} flexDirection="row">
            {/* 行号 */}
            {lineNumbers && (
              <Text 
                color={isHighlighted(index) ? 'yellow' : 'gray'}
                dimColor={!isHighlighted(index)}
              >
                {(index + 1).toString().padStart(getLineNumberWidth(), ' ')}→
              </Text>
            )}
            
            {/* 内容 */}
            <Text 
              color={isHighlighted(index) ? 'yellow' : 'white'}
              backgroundColor={isHighlighted(index) ? 'gray' : undefined}
            >
              {line}
            </Text>
          </Box>
        ))}
        
        {/* 截断提示 */}
        {hasMoreLines && (
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              ... 省略 {lines.length - displayLines.length} 行
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}