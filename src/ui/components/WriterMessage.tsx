import { Box, Text } from 'ink'
import React from 'react'
import { getTheme } from '../../utils/theme'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { RichTextRenderer, SimpleRichText } from './RichTextRenderer.js'
import { ToolExecutionDisplay, ToolExecutionProgress,ToolExecutionInfo } from './ToolExecutionDisplay.js'

// Re-export for convenience
export type { ToolExecutionInfo }

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

function WriterMessage({
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

function AssistantResponseMessage({
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


// 工具执行消息组件 - 类似 Claude Code 的显示效果
export function ToolExecutionMessage({
  executions,
  title = '',
  progressTitle = '',
  addMargin = true,
}: {
  executions: ToolExecutionInfo[]
  title?: string
  progressTitle?: string
  addMargin?: boolean
  showDetails?: boolean
}) {
  const theme = getTheme()
  const { columns } = useTerminalSize()

  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      <Box minWidth={3} width={3}>
        <Text color={theme.claude}>   </Text>
      </Box>
      
      <Box flexDirection="column" width={columns - 4}>
        {/* 主标题 - 只有在有有意义的标题时才显示 */}
        {title && title.trim().length > 0 && (
          <Box flexDirection="row" alignItems="center" marginBottom={1}>
            <Text color={theme.info}>●</Text>
            <Box marginLeft={1}>
              <Text color={theme.text}>{title}</Text>
            </Box>
          </Box>
        )}
        
        {/* 工具执行进度 */}
        <ToolExecutionProgress 
          executions={executions}
          title={progressTitle}
        />
      </Box>
    </Box>
  )
}

// AI 响应处理消息 - 增强版本，支持工具执行状态
export function EnhancedAssistantMessage({ 
  content, 
  executions = [],
  addMargin = true,
  showToolProgress = false 
}: { 
  content: string
  executions?: ToolExecutionInfo[]
  addMargin?: boolean
  showToolProgress?: boolean
}) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  // 检测消息类型
  const isProcessing = content.includes('预处理请求') || content.includes('分析内容')
  const isToolExecution = content.includes('开始实时 AI 处理') || executions.length > 0
  const isError = content.includes('错误:') || content.includes('Error')

  // 🚀 动态提取标题，避免硬编码重复
  const extractTitle = (text: string): string => {
    // 尝试从内容中提取进度消息作为标题
    const progressMatch = text.match(/(预处理请求和分析内容\.\.\.|开始实时.*?处理.*?\.\.\.|AI响应生成中.*?\.\.\.)/)
    if (progressMatch) {
      return progressMatch[1]
    }
    // 不显示无意义的兜底标题
    return ""
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* 如果是工具执行相关，显示专门的工具执行界面 */}
      {isToolExecution && showToolProgress && (
        <ToolExecutionMessage
          executions={executions}
          title={extractTitle(content)}
          addMargin={addMargin}
        />
      )}
      
      {/* 显示常规响应内容 */}
      {!isToolExecution && (
        <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
          <Box minWidth={3} width={3}>
            <Text color={theme.claude}>   </Text>
          </Box>
          
          <Box flexDirection="column" width={columns - 4}>
            <Box width="100%">
              <RichTextRenderer 
                content={content}
                wrap={true}
                preserveWhitespace={true}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// 工具状态更新消息
export function ToolStatusMessage({
  toolName,
  status,
  message,
  duration,
  addMargin = true,
  toolInput
}: {
  toolName: string
  status: 'started' | 'completed' | 'failed'
  message?: string
  duration?: number
  addMargin?: boolean
  toolInput?: any
}) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  const execution: ToolExecutionInfo = {
    id: `${toolName}-${status}-${Date.now()}`,
    toolName,
    status: status === 'started' ? 'running' : status === 'completed' ? 'completed' : 'failed',
    message,
    duration,
    input: toolInput || {}
  }
  
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
      <Box minWidth={3} width={3}>
        <Text color={theme.dimText}>   </Text>
      </Box>
      
      <Box flexDirection="column" width={columns - 4}>
        <ToolExecutionDisplay execution={execution} compact={true} />
      </Box>
    </Box>
  )
}
