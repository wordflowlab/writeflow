import React from 'react'
import { Box, Text } from 'ink'
import { RichTextRenderer } from './RichTextRenderer.js'

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
        return <Text color="yellow">○</Text>
      case 'running':
        return <Text color="blue">○</Text>
      case 'completed':
        return <Text color="green">●</Text>
      case 'error':
        return <Text color="red">●</Text>
      default:
        return <Text color="gray">○</Text>
    }
  }

  const formatParameters = (params: Record<string, any>): string => {
    return Object.entries(params)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join(', ')
  }

  // 智能渲染工具结果
  const renderToolResult = (): React.ReactNode => {
    if (!execution.result) return null

    // 如果结果有 resultForAssistant 字段（工具已格式化的输出），优先使用
    if (execution.result.resultForAssistant && typeof execution.result.resultForAssistant === 'string') {
      return (
        <Box marginLeft={2} flexDirection="column">
          <Text color="green">结果:</Text>
          <RichTextRenderer
            content={execution.result.resultForAssistant}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      )
    }

    // 根据工具类型提供专门的渲染
    switch (execution.toolName) {
      case 'Read':
        return renderReadToolResult()
      case 'Write':
      case 'Edit':
        return renderFileOperationResult()
      case 'Bash':
        return renderBashResult()
      case 'Grep':
      case 'Glob':
        return renderSearchResult()
      default:
        // 尝试智能检测内容类型
        return renderGenericResult()
    }
  }

  // ReadTool 结果专门渲染
  const renderReadToolResult = (): React.ReactNode => {
    const result = execution.result
    if (result.contentPreview) {
      return (
        <Box marginLeft={2} flexDirection="column">
          <Text color="green">📄 {result.message || '文件内容'}:</Text>
          <RichTextRenderer
            content={result.contentPreview}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      )
    }
    return renderGenericResult()
  }

  // 文件操作结果渲染
  const renderFileOperationResult = (): React.ReactNode => {
    const result = execution.result
    let message = '操作完成'

    if (result.message) {
      message = result.message
    } else if (result.filePath) {
      message = `文件: ${result.filePath}`
    }

    return (
      <Box marginLeft={2} flexDirection="column">
        <Text color="green">✅ {message}</Text>
        {result.changes && (
          <Text color="gray">修改: {result.changes}</Text>
        )}
      </Box>
    )
  }

  // Bash命令结果渲染
  const renderBashResult = (): React.ReactNode => {
    const result = execution.result
    return (
      <Box marginLeft={2} flexDirection="column">
        <Text color="green">⚡ 命令执行完成</Text>
        {result.output && (
          <RichTextRenderer
            content={result.output}
            wrap={true}
            preserveWhitespace={true}
          />
        )}
        {result.exitCode !== undefined && result.exitCode !== 0 && (
          <Text color="red">退出码: {result.exitCode}</Text>
        )}
      </Box>
    )
  }

  // 搜索结果渲染
  const renderSearchResult = (): React.ReactNode => {
    const result = execution.result
    let message = '搜索完成'

    if (result.files && Array.isArray(result.files)) {
      message = `找到 ${result.files.length} 个匹配项`
    } else if (result.matches) {
      message = `找到 ${result.matches} 个匹配项`
    }

    return (
      <Box marginLeft={2} flexDirection="column">
        <Text color="green">🔍 {message}</Text>
        {result.preview && (
          <RichTextRenderer
            content={result.preview}
            wrap={true}
            preserveWhitespace={true}
          />
        )}
      </Box>
    )
  }

  // 通用结果渲染 - 尝试智能检测和格式化
  const renderGenericResult = (): React.ReactNode => {
    const result = execution.result

    // 检测是否为字符串内容
    if (typeof result === 'string') {
      return (
        <Box marginLeft={2} flexDirection="column">
          <Text color="green">结果:</Text>
          <RichTextRenderer
            content={result}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      )
    }

    // 检测是否有文本内容字段
    const textFields = ['content', 'output', 'text', 'message', 'description']
    for (const field of textFields) {
      if (result[field] && typeof result[field] === 'string') {
        return (
          <Box marginLeft={2} flexDirection="column">
            <Text color="green">结果:</Text>
            <RichTextRenderer
              content={result[field]}
              wrap={true}
              preserveWhitespace={true}
            />
          </Box>
        )
      }
    }

    // 最后回退到JSON，但提供更好的格式
    const jsonStr = JSON.stringify(result, null, 2)
    const isSmallObject = jsonStr.length < 200 && Object.keys(result).length <= 5

    return (
      <Box marginLeft={2} flexDirection="column">
        <Text color="green">结果:</Text>
        {isSmallObject ? (
          <Text color="gray">{JSON.stringify(result)}</Text>
        ) : (
          <RichTextRenderer
            content={`\`\`\`json\n${jsonStr}\n\`\`\``}
            wrap={true}
            preserveWhitespace={true}
          />
        )}
      </Box>
    )
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
      {execution.result && renderToolResult()}

      {/* 错误显示 */}
      {execution.error && (
        <Box marginLeft={2}>
          <Text color="red">错误: {execution.error}</Text>
        </Box>
      )}
    </Box>
  )
}