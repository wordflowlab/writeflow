import React from 'react'
import { Box, Text } from 'ink'
import { UIMessage, InputMode } from '../types/index.js'
import { TodoListRenderer } from '../renderers/TodoListRenderer.js'

interface MessageRendererProps {
  message: UIMessage
}

export const MessageRenderer = React.memo(function MessageRenderer({ message }: MessageRendererProps) {
  // 处理 JSX 类型消息
  if (message.type === 'jsx' && message.jsx) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {message.jsx}
      </Box>
    )
  }

  // 处理结构化数据（如 todo-list）
  if (message.type === 'jsx' && message.data) {
    const { type, data } = JSON.parse(message.content)
    
    switch (type) {
      case 'todo-list':
        return (
          <Box flexDirection="column" marginBottom={1}>
            <TodoListRenderer data={data} />
          </Box>
        )
      default:
        // 未知类型，回退到普通文本渲染
        break
    }
  }

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
      case 'jsx':
        return <Text color="magenta">▶ </Text>
      case 'thinking':
        return <Text color="blue">🧠 </Text>
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
      case 'jsx':
        return 'magenta'
      case 'thinking':
        return 'blue'
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
})