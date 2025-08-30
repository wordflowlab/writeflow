import React from 'react'
import { Box, Text } from 'ink'
import { MessageRenderer } from './MessageRenderer.js'
import { UIMessage } from '../types/index.js'

interface MessageListProps {
  messages: UIMessage[]
  maxVisible?: number
  showScrollIndicator?: boolean
}

export function MessageList({ 
  messages, 
  maxVisible = 20, 
  showScrollIndicator = true 
}: MessageListProps) {
  // 显示最近的消息
  const visibleMessages = messages.slice(-maxVisible)
  const hasMoreMessages = messages.length > maxVisible

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* 滚动指示器 */}
      {hasMoreMessages && showScrollIndicator && (
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            ↑ 共 {messages.length} 条消息，显示最近 {maxVisible} 条
          </Text>
        </Box>
      )}

      {/* 消息列表 */}
      <Box flexDirection="column">
        {visibleMessages.map(message => (
          <MessageRenderer key={message.id} message={message} />
        ))}
      </Box>
    </Box>
  )
}