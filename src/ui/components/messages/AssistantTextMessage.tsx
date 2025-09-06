import React from 'react'
import { Box, Text } from 'ink'
import type { TextBlock } from '../../../types/UIMessage.js'
import { getTheme } from '../../../utils/theme.js'
import { useTerminalSize } from '../../../hooks/useTerminalSize.js'
import { RichTextRenderer } from '../RichTextRenderer.js'

interface AssistantTextMessageProps {
  block: TextBlock
  costUSD: number
  durationMs: number
  addMargin: boolean
  shouldShowDot: boolean
  debug: boolean
  verbose?: boolean
  width?: number | string
}

export function AssistantTextMessage({
  block,
  costUSD,
  durationMs,
  addMargin,
  shouldShowDot,
  debug,
  verbose,
  width,
}: AssistantTextMessageProps): React.ReactNode {
  const { columns } = useTerminalSize()
  const theme = getTheme()
  
  // 如果文本为空，不渲染
  if (!block.text || !block.text.trim()) {
    return null
  }

  // 检查是否是错误消息
  const isError = block.text.startsWith('错误:') || block.text.includes('Error')
  
  // 检查是否是中断消息
  if (block.text === 'Interrupted by user' || block.text.includes('中断')) {
    return (
      <Box flexDirection="row" marginTop={addMargin ? 1 : 0}>
        <Text color="gray" dimColor>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text color={theme.error}>{block.text}</Text>
      </Box>
    )
  }

  return (
    <Box
      alignItems="flex-start"
      flexDirection="row"
      justifyContent="space-between"
      marginTop={addMargin ? 1 : 0}
      width="100%"
    >
      <Box flexDirection="row">
        {shouldShowDot && (
          <Box minWidth={2}>
            <Text color={theme.text}>●</Text>
          </Box>
        )}
        <Box 
          flexDirection="column" 
          width={width || columns - 6}
        >
          <RichTextRenderer 
            content={block.text}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
      
      {/* 成本和时间信息（仅在 verbose 模式下显示） */}
      {verbose && (costUSD > 0 || durationMs > 0) && (
        <Box flexDirection="column" alignItems="flex-end">
          {costUSD > 0 && (
            <Text color="gray" dimColor>
              ${costUSD.toFixed(4)}
            </Text>
          )}
          {durationMs > 0 && (
            <Text color="gray" dimColor>
              {durationMs}ms
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}