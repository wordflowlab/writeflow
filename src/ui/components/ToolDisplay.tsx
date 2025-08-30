import React from 'react'
import { Box, Text } from 'ink'

interface ToolExecution {
  toolName: string
  parameters: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: any
  error?: string
  startTime?: Date
  endTime?: Date
  progress?: number
}

interface ToolDisplayProps {
  executions: ToolExecution[]
  showProgress?: boolean
}

export function ToolDisplay({ executions, showProgress = true }: ToolDisplayProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'running':
        return '🔄'
      case 'completed':
        return '✅'
      case 'error':
        return '❌'
      default:
        return '•'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'yellow'
      case 'running':
        return 'blue'
      case 'completed':
        return 'green'
      case 'error':
        return 'red'
      default:
        return 'gray'
    }
  }

  const formatDuration = (execution: ToolExecution): string => {
    if (!execution.startTime) return ''
    const endTime = execution.endTime || new Date()
    const duration = endTime.getTime() - execution.startTime.getTime()
    return `${duration}ms`
  }

  const formatParameters = (params: Record<string, any>): string => {
    const entries = Object.entries(params)
    if (entries.length === 0) return ''
    
    return entries
      .slice(0, 3) // 只显示前3个参数
      .map(([key, value]) => {
        const str = typeof value === 'string' ? value : JSON.stringify(value)
        return `${key}: ${str.length > 30 ? str.substring(0, 30) + '...' : str}`
      })
      .join(', ')
  }

  const renderProgressBar = (progress: number): React.ReactNode => {
    const width = 20
    const filled = Math.round((progress / 100) * width)
    const empty = width - filled
    
    return (
      <Box flexDirection="row">
        <Text color="cyan">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
        <Text color="cyan"> {progress}%</Text>
      </Box>
    )
  }

  if (executions.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>🔧 工具执行状态</Text>
      
      {executions.map((execution, index) => (
        <Box key={index} flexDirection="column" marginLeft={2} marginBottom={1}>
          {/* 工具头部信息 */}
          <Box flexDirection="row">
            <Text color={getStatusColor(execution.status)}>
              {getStatusIcon(execution.status)}
            </Text>
            <Text bold color="white"> {execution.toolName}</Text>
            <Text color="gray"> ({formatDuration(execution)})</Text>
          </Box>

          {/* 参数显示 */}
          {Object.keys(execution.parameters).length > 0 && (
            <Box marginLeft={2}>
              <Text color="gray">
                参数: {formatParameters(execution.parameters)}
              </Text>
            </Box>
          )}

          {/* 进度条 */}
          {execution.status === 'running' && 
           showProgress && 
           execution.progress !== undefined && (
            <Box marginLeft={2}>
              {renderProgressBar(execution.progress)}
            </Box>
          )}

          {/* 错误信息 */}
          {execution.error && (
            <Box marginLeft={2} paddingX={1} borderStyle="round" borderColor="red">
              <Text color="red">错误: {execution.error}</Text>
            </Box>
          )}

          {/* 结果预览 */}
          {execution.result && execution.status === 'completed' && (
            <Box marginLeft={2}>
              <Text color="green">
                ✓ 执行完成
                {typeof execution.result === 'string' && execution.result.length > 100 
                  ? ` (${execution.result.length} 字符)`
                  : ''
                }
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}