import React from 'react'
import { Box } from 'ink'
import type { 
  UIMessage, 
  UserMessage, 
  AssistantMessage, 
  NormalizedMessage,
  ContentBlock,
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
  isThinkingBlock
} from '../../../types/UIMessage.js'
import { AssistantTextMessage } from './AssistantTextMessage.js'
import { AssistantToolUseMessage } from './AssistantToolUseMessage.js'
import { UserTextMessage } from './UserTextMessage.js'
import type { Tool } from '../../../Tool.js'

interface MessageProps {
  message: UserMessage | AssistantMessage
  messages: NormalizedMessage[]
  addMargin: boolean
  tools: Tool[]
  verbose: boolean
  debug: boolean
  erroredToolUseIDs: Set<string>
  inProgressToolUseIDs: Set<string>
  unresolvedToolUseIDs: Set<string>
  shouldAnimate: boolean
  shouldShowDot: boolean
  width?: number | string
}

export function Message({
  message,
  messages,
  addMargin,
  tools,
  verbose,
  debug,
  erroredToolUseIDs,
  inProgressToolUseIDs,
  unresolvedToolUseIDs,
  shouldAnimate,
  shouldShowDot,
  width,
}: MessageProps): React.ReactNode {
  // 助手消息
  if (message.type === 'assistant') {
    return (
      <Box flexDirection="column" width="100%">
        {message.message.content.map((block, index) => (
          <AssistantBlock
            key={index}
            block={block}
            costUSD={message.costUSD}
            durationMs={message.durationMs}
            addMargin={addMargin && index === 0}
            tools={tools}
            debug={debug}
            verbose={verbose}
            erroredToolUseIDs={erroredToolUseIDs}
            inProgressToolUseIDs={inProgressToolUseIDs}
            unresolvedToolUseIDs={unresolvedToolUseIDs}
            shouldAnimate={shouldAnimate}
            shouldShowDot={shouldShowDot}
            width={width}
          />
        ))}
      </Box>
    )
  }

  // 用户消息
  const content = typeof message.message.content === 'string' 
    ? message.message.content 
    : ''

  return (
    <Box flexDirection="column" width="100%">
      <UserTextMessage
        text={content}
        addMargin={addMargin}
      />
    </Box>
  )
}

// 助手消息块组件
interface AssistantBlockProps {
  block: ContentBlock
  costUSD: number
  durationMs: number
  addMargin: boolean
  tools: Tool[]
  debug: boolean
  verbose: boolean
  erroredToolUseIDs: Set<string>
  inProgressToolUseIDs: Set<string>
  unresolvedToolUseIDs: Set<string>
  shouldAnimate: boolean
  shouldShowDot: boolean
  width?: number | string
}

function AssistantBlock({
  block,
  costUSD,
  durationMs,
  addMargin,
  tools,
  debug,
  verbose,
  erroredToolUseIDs,
  inProgressToolUseIDs,
  unresolvedToolUseIDs,
  shouldAnimate,
  shouldShowDot,
  width,
}: AssistantBlockProps): React.ReactNode {
  switch (block.type) {
    case 'text':
      return (
        <AssistantTextMessage
          block={block}
          costUSD={costUSD}
          durationMs={durationMs}
          addMargin={addMargin}
          shouldShowDot={shouldShowDot}
          debug={debug}
          verbose={verbose}
          width={width}
        />
      )
    
    case 'tool_use':
      return (
        <AssistantToolUseMessage
          block={block}
          costUSD={costUSD}
          durationMs={durationMs}
          addMargin={addMargin}
          tools={tools}
          debug={debug}
          verbose={verbose}
          erroredToolUseIDs={erroredToolUseIDs}
          inProgressToolUseIDs={inProgressToolUseIDs}
          unresolvedToolUseIDs={unresolvedToolUseIDs}
          shouldAnimate={shouldAnimate}
          shouldShowDot={shouldShowDot}
        />
      )
    
    case 'tool_result':
      // 工具结果通常不在助手消息中显示，而是在用户消息中
      return null
    
    case 'thinking':
      // 思考过程可以选择性显示
      if (!debug) return null
      
      return (
        <Box flexDirection="row" marginTop={addMargin ? 1 : 0}>
          <Box marginLeft={2}>
            <AssistantTextMessage
              block={{ type: 'text', text: `💭 ${block.content}` }}
              costUSD={costUSD}
              durationMs={durationMs}
              addMargin={false}
              shouldShowDot={false}
              debug={debug}
              verbose={verbose}
              width={width}
            />
          </Box>
        </Box>
      )
    
    default:
      console.warn(`Unknown block type: ${(block as any).type}`)
      return null
  }
}