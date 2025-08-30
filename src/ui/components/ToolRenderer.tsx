import React from 'react'
import { Box, Text } from 'ink'

interface ToolExecutionData {
  toolName: string
  parameters: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: any
  error?: string
  startTime?: Date
  endTime?: Date
}

interface ToolRendererProps {
  execution: ToolExecutionData
}

export function ToolRenderer({ execution }: ToolRendererProps) {
  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'pending':
        return <Text color="yellow">⏳</Text>
      case 'running':
        return <Text color="blue">🔄</Text>
      case 'completed':
        return <Text color="green">✅</Text>
      case 'error':
        return <Text color="red">❌</Text>
      default:
        return <Text color="gray">•</Text>
    }
  }

  const formatParameters = (params: Record<string, any>): string => {
    return Object.entries(params)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ')
  }

  const getExecutionTime = (): string => {
    if (!execution.startTime) return ''
    const endTime = execution.endTime || new Date()
    const duration = endTime.getTime() - execution.startTime.getTime()
    return ` (${duration}ms)`
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* 工具头部 */}
      <Box flexDirection="row">
        {getStatusIndicator(execution.status)}
        <Text bold color="cyan"> {execution.toolName}</Text>
        <Text color="gray">{getExecutionTime()}</Text>
      </Box>

      {/* 参数显示 */}
      {Object.keys(execution.parameters).length > 0 && (
        <Box marginLeft={2}>
          <Text color="gray">参数: {formatParameters(execution.parameters)}</Text>
        </Box>
      )}

      {/* 结果显示 */}
      {execution.result && (
        <Box marginLeft={2} flexDirection="column">
          <Text color="green">结果:</Text>
          <Text>{JSON.stringify(execution.result, null, 2)}</Text>
        </Box>
      )}

      {/* 错误显示 */}
      {execution.error && (
        <Box marginLeft={2}>
          <Text color="red">错误: {execution.error}</Text>
        </Box>
      )}
    </Box>
  )
}