import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import { MessageRenderer } from './MessageRenderer.js'
import { UIMessage } from '../types/index.js'

interface MessageListProps {
  messages: UIMessage[]
  maxVisible?: number
  showScrollIndicator?: boolean
}

export const MessageList = React.memo(function MessageList({ 
  messages, 
  maxVisible = 20, 
  showScrollIndicator = true 
}: MessageListProps) {
  // 使用useMemo缓存计算结果，避免重复计算
  const { visibleMessages, hasMoreMessages } = useMemo(() => {
    const visible = messages.slice(-maxVisible)
    const hasMore = messages.length > maxVisible
    return { visibleMessages: visible, hasMoreMessages: hasMore }
  }, [messages, maxVisible])

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
})