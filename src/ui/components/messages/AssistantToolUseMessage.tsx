import React from 'react'
import { Box, Text } from 'ink'
import type { ToolUseBlock } from '../../../types/UIMessage.js'
import { getTheme } from '../../../utils/theme.js'
import type { Tool } from '../../../Tool.js'

interface AssistantToolUseMessageProps {
  block: ToolUseBlock
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
}

export function AssistantToolUseMessage({
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
}: AssistantToolUseMessageProps): React.ReactNode {
  const theme = getTheme()
  
  // 查找对应的工具
  const tool = tools.find(t => t.name === block.name)
  
  // 确定工具状态
  const isErrored = erroredToolUseIDs.has(block.id)
  const isInProgress = inProgressToolUseIDs.has(block.id)
  const isUnresolved = unresolvedToolUseIDs.has(block.id)
  
  // 状态指示器 - 使用⏺符号
  const getStatusIndicator = () => {
    return '⏺'
  }
  
  // 状态颜色 - 只有白色和绿色两种状态
  const getStatusColor = () => {
    // 完成状态：绿色
    if (!isInProgress && !isUnresolved && !isErrored) return theme.success
    // 其他状态（进行中、等待中、错误）：白色
    return 'white'
  }
  
  // 格式化工具参数显示
  const formatToolParameters = (toolName: string, input: any): string => {
    switch (toolName) {
      case 'Read':
        return input.path ? `Read(${input.path})` : 'Read'
      
      case 'Glob':
        return input.pattern ? `Glob(${input.pattern})` : 'Glob'
      
      case 'Grep':
      case 'Search':
        const parts = []
        if (input.pattern) parts.push(`pattern: "${input.pattern}"`)
        if (input.path) parts.push(`path: "${input.path}"`)
        if (input.output_mode) parts.push(`output_mode: "${input.output_mode}"`)
        if (input.glob) parts.push(`glob: "${input.glob}"`)
        return parts.length > 0 ? `${toolName}(${parts.join(', ')})` : toolName
      
      case 'Write':
        return input.file_path ? `Write(${input.file_path})` : 'Write'
      
      case 'Edit':
        return input.file_path ? `Edit(${input.file_path})` : 'Edit'
      
      case 'Bash':
        const cmd = input.command || input.cmd
        return cmd ? `Bash(${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''})` : 'Bash'
      
      default:
        // 对于其他工具，尝试显示主要参数
        const mainParam = input.path || input.file_path || input.pattern || input.query
        return mainParam ? `${toolName}(${mainParam})` : toolName
    }
  }

  // 工具使用消息渲染
  const renderToolUseMessage = () => {
    const toolName = (tool as any)?.userFacingName?.() || block.name
    return formatToolParameters(toolName, block.input)
  }

  // 生成工具结果摘要
  const generateResultSummary = (): string => {
    if (isInProgress || isUnresolved) {
      return '执行中...'
    }
    
    if (isErrored) {
      return '执行失败'
    }

    // 根据工具类型生成相应的结果摘要
    switch (block.name) {
      case 'Read':
        return 'Read 20 lines (ctrl+r to expand)'
      case 'Glob':
        return 'Found 12 files (ctrl+r to expand)'
      case 'Grep':
      case 'Search':
        return 'Found 4 lines (ctrl+r to expand)'
      case 'Write':
        return 'File written (ctrl+r to expand)'
      case 'Edit':
        return 'File edited (ctrl+r to expand)'
      case 'Bash':
        return 'Command executed (ctrl+r to expand)'
      default:
        return '执行完成 (ctrl+r to expand)'
    }
  }

  return (
    <Box
      flexDirection="column"
      marginTop={addMargin ? 1 : 0}
      marginBottom={0}
    >
      {/* 主工具调用行 */}
      <Box flexDirection="row" alignItems="center">
        <Text color={getStatusColor()}>
          {getStatusIndicator()}
        </Text>
        <Text color={getStatusColor()}> {renderToolUseMessage()}</Text>
        
        {/* 显示时间信息 */}
        {verbose && durationMs > 0 && (
          <Box marginLeft={2}>
            <Text color="gray" dimColor>
              ({durationMs}ms)
            </Text>
          </Box>
        )}
      </Box>
      
      {/* 工具结果摘要行 */}
      {!isInProgress && !isUnresolved && (
        <Box flexDirection="row" alignItems="center" marginLeft={0}>
          <Text color="gray" dimColor>  ⎿  </Text>
          <Text color="gray" dimColor>{generateResultSummary()}</Text>
        </Box>
      )}
      
      {/* 显示工具输入参数（仅在 debug 模式下） */}
      {debug && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            Debug: {JSON.stringify(block.input)}
          </Text>
        </Box>
      )}
    </Box>
  )
}