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
  
  // 状态指示器
  const getStatusIndicator = () => {
    if (isErrored) return '❌'
    if (isInProgress) return '⏳'
    if (isUnresolved) return '⏸️'
    return '✅'
  }
  
  // 状态颜色
  const getStatusColor = () => {
    if (isErrored) return theme.error
    if (isInProgress) return theme.warning
    if (isUnresolved) return theme.dimText
    return theme.success
  }
  
  // 工具使用消息渲染
  const renderToolUseMessage = () => {
    if (!tool) {
      return `🔧 调用工具: ${block.name}`
    }
    
    try {
      // 使用工具名称显示
      const displayName = (tool as any).userFacingName?.() || block.name
      return `🔧 ${displayName}`
    } catch (error) {
      return `🔧 ${block.name} 工具执行中`
    }
  }

  return (
    <Box
      flexDirection="row"
      marginTop={addMargin ? 1 : 0}
      marginBottom={1}
    >
      <Text color="gray" dimColor>&nbsp;&nbsp;⎿ &nbsp;</Text>
      
      <Box flexDirection="row" alignItems="center">
        <Text color={getStatusColor()}>
          {getStatusIndicator()}
        </Text>
        
        <Box marginLeft={1}>
          <Text color={getStatusColor()}>
            {renderToolUseMessage()}
          </Text>
        </Box>
        
        {/* 显示工具输入参数（仅在 debug 模式下） */}
        {debug && (
          <Box marginLeft={2}>
            <Text color="gray" dimColor>
              {JSON.stringify(block.input)}
            </Text>
          </Box>
        )}
      </Box>
      
      {/* 显示时间信息 */}
      {verbose && durationMs > 0 && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            {durationMs}ms
          </Text>
        </Box>
      )}
    </Box>
  )
}