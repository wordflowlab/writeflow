import React from 'react'
import { Box, Text } from 'ink'
import { UIMessage, InputMode } from '../types/index.js'

interface MessageRendererProps {
  message: UIMessage
}

export function MessageRenderer({ message }: MessageRendererProps) {
  const getMessagePrefix = () => {
    switch (message.type) {
      case 'user':
        if (message.mode === InputMode.Bash) {
          return <Text color="yellow">! </Text>
        }
        if (message.mode === InputMode.Memory) {
          return <Text color="blue"># </Text>
        }
        return <Text color="cyan">› </Text>
      case 'assistant':
        return <Text color="green">✓ </Text>
      case 'system':
        return <Text color="gray">• </Text>
      default:
        return null
    }
  }

  const getContentColor = () => {
    switch (message.type) {
      case 'user':
        return 'white'
      case 'assistant':
        return 'green'
      case 'system':
        return 'gray'
      default:
        return 'white'
    }
  }

  return (
    <Box flexDirection="row" marginBottom={1}>
      {getMessagePrefix()}
      <Text color={getContentColor()}>
        {message.content}
      </Text>
    </Box>
  )
}