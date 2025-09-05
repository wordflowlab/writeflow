import { Box, Text } from 'ink'
import React from 'react'
import { getTheme } from '../../utils/theme'
import { useTerminalSize } from '../../hooks/useTerminalSize'
import { RichTextRenderer, SimpleRichText } from './RichTextRenderer.js'

interface Message {
  type: 'user' | 'assistant'
  content: string
  timestamp?: Date
  mode?: 'writing' | 'editing' | 'reviewing'
}

interface WriterMessageProps {
  message: Message
  addMargin?: boolean
  showTimestamp?: boolean
  showMode?: boolean
}

// Mode colors matching PromptInput
const MODE_COLORS = {
  writing: '#00ff87',
  editing: '#ff9500', 
  reviewing: '#007acc'
}

const MODE_ICONS = {
  writing: '✎',
  editing: '✏',
  reviewing: '👁'
}

export function WriterMessage({
  message,
  addMargin = true,
  showTimestamp = false,
  showMode = false
}: WriterMessageProps) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  const isUser = message.type === 'user'
  const isAssistant = message.type === 'assistant'
  
  // 使用主题中定义的消息专用颜色
  const textColor = isUser ? theme.userMessage : theme.assistantMessage
  const indicatorColor = isUser ? theme.dimText : theme.claude
  const indicator = isUser ? ' > ' : '   '
  
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      {/* Message indicator */}
      <Box minWidth={3} width={3}>
        <Text color={indicatorColor}>
          {indicator}
        </Text>
      </Box>
      
      {/* Message content */}
      <Box flexDirection="column" width={columns - 4}>
        {/* Message header with mode and timestamp */}
        {(showMode || showTimestamp) && (
          <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
            {showMode && message.mode && (
              <Text color={theme[message.mode]} dimColor>
                {MODE_ICONS[message.mode]} {message.mode.toUpperCase()}
              </Text>
            )}
            {showTimestamp && message.timestamp && (
              <Text color={theme.dimText}>
                {message.timestamp.toLocaleTimeString()}
              </Text>
            )}
          </Box>
        )}
        
        {/* Message text - 使用富文本渲染器 */}
        <Box width="100%">
          <RichTextRenderer 
            content={message.content}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    </Box>
  )
}

// Specialized components for different message types
export function UserPromptMessage({ 
  content, 
  addMargin = true,
  mode 
}: { 
  content: string
  addMargin?: boolean
  mode?: 'writing' | 'editing' | 'reviewing'
}) {
  const message: Message = {
    type: 'user',
    content,
    mode,
    timestamp: new Date()
  }
  
  return (
    <WriterMessage 
      message={message} 
      addMargin={addMargin}
      showMode={!!mode}
    />
  )
}

export function AssistantResponseMessage({ 
  content, 
  addMargin = true,
  showThinking = false 
}: { 
  content: string
  addMargin?: boolean
  showThinking?: boolean
}) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  // Handle different types of assistant responses
  const isThinking = showThinking && content.includes('思考中')
  const isError = content.startsWith('错误:') || content.includes('Error')
  const isProcessing = content.includes('处理中') || content.includes('生成中')
  
  // 根据消息类型选择颜色
  let messageColor = theme.assistantMessage
  if (isError) messageColor = theme.error
  else if (isProcessing) messageColor = theme.processing
  
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      <Box minWidth={3} width={3}>
        <Text color={theme.claude}>   </Text>
      </Box>
      
      <Box flexDirection="column" width={columns - 4}>
        {isThinking && (
          <Box flexDirection="row" marginBottom={1}>
            <Text color={theme.thinking}>🤔 </Text>
            <Text color={theme.thinking}>AI 正在思考...</Text>
          </Box>
        )}
        
        <Box width="100%">
          <RichTextRenderer 
            content={content}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    </Box>
  )
}

// Status message component for system messages
export function SystemMessage({ 
  content, 
  type = 'info',
  addMargin = true 
}: { 
  content: string
  type?: 'info' | 'success' | 'warning' | 'error'
  addMargin?: boolean
}) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  const colors = {
    info: theme.info,
    success: theme.success,
    warning: theme.warning,
    error: theme.error
  }
  
  const icons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗'
  }
  
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      <Box minWidth={3} width={3}>
        <Text color={colors[type]}> {icons[type]} </Text>
      </Box>
      
      <Box flexDirection="column" width={columns - 4}>
        <Box width="100%">
          <SimpleRichText content={content} />
        </Box>
      </Box>
    </Box>
  )
}

// Conversation separator
export function MessageSeparator({ label }: { label?: string }) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        borderColor={theme.secondaryBorder}
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop={true}
        width={columns - 2}
      >
        {label && (
          <Text color={theme.dimText}>
            {label}
          </Text>
        )}
      </Box>
    </Box>
  )
}