import { Box, Text } from 'ink'
import React from 'react'
import { getTheme } from '../../utils/theme'
import { useTerminalSize } from '../../hooks/useTerminalSize'

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
  
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      {/* Message indicator */}
      <Box minWidth={3} width={3}>
        <Text color={isUser ? theme.secondaryText : theme.text}>
          {isUser ? ' > ' : '   '}
        </Text>
      </Box>
      
      {/* Message content */}
      <Box flexDirection="column" width={columns - 4}>
        {/* Message header with mode and timestamp */}
        {(showMode || showTimestamp) && (
          <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
            {showMode && message.mode && (
              <Text color={MODE_COLORS[message.mode]} dimColor>
                {MODE_ICONS[message.mode]} {message.mode.toUpperCase()}
              </Text>
            )}
            {showTimestamp && message.timestamp && (
              <Text dimColor>
                {message.timestamp.toLocaleTimeString()}
              </Text>
            )}
          </Box>
        )}
        
        {/* Message text */}
        <Text 
          color={isUser ? theme.secondaryText : theme.text}
          wrap="wrap"
        >
          {message.content}
        </Text>
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
  
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      <Box minWidth={3} width={3}>
        <Text color={theme.text}>   </Text>
      </Box>
      
      <Box flexDirection="column" width={columns - 4}>
        {isThinking && (
          <Box flexDirection="row" marginBottom={1}>
            <Text color={theme.claude}>🤔 </Text>
            <Text color={theme.claude}>AI 正在思考...</Text>
          </Box>
        )}
        
        <Text 
          color={isError ? theme.error : theme.text}
          wrap="wrap"
        >
          {content}
        </Text>
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
    info: theme.secondaryText,
    success: theme.success,
    warning: '#ff9500',
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
        <Text color={colors[type]} wrap="wrap">
          {content}
        </Text>
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
          <Text color={theme.secondaryText} dimColor>
            {label}
          </Text>
        )}
      </Box>
    </Box>
  )
}