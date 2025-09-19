import { Box, Text } from 'ink'
import { getTheme } from '../../utils/theme.js'
import { CollapsibleContent } from './CollapsibleContent.js'

export interface ToolExecutionInfo {
  id: string
  toolName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  progress?: number
  duration?: number
  details?: string
  input?: any
  path?: string
  lineCount?: number
}

interface ToolExecutionDisplayProps {
  execution: ToolExecutionInfo
  showDetails?: boolean
  compact?: boolean
}

/**
 * 工具执行状态显示组件
 * 类似 Claude Code 的工具执行界面
 */
export function ToolExecutionDisplay({
  execution,
  showDetails = false,
  compact = false
}: ToolExecutionDisplayProps) {
  const theme = getTheme()
  
  // 状态指示器和颜色 - 使用简单圆点
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '○'
      case 'running': return '○'
      case 'completed': return '●'
      case 'failed': return '●'
      default: return '○'
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.dimText
      case 'running': return theme.warning
      case 'completed': return theme.success
      case 'failed': return theme.error
      default: return theme.text
    }
  }
  
  // 格式化工具参数显示 - 符合期望格式
  const formatToolWithParams = (toolName: string, input?: any): string => {
    // 直接使用工具名，不进行中文转换
    switch (toolName.toLowerCase()) {
      case 'glob':
        return input?.pattern ? `Glob(${input.pattern})` : 'Glob'
      case 'grep':
      case 'search':
        const parts = []
        if (input?.pattern) parts.push(`pattern: "${input.pattern}"`)
        if (input?.path) parts.push(`path: "${input.path}"`)
        if (input?.output_mode) parts.push(`output_mode: "${input.output_mode}"`)
        if (input?.glob) parts.push(`glob: "${input.glob}"`)
        return parts.length > 0 ? `${toolName}(${parts.join(', ')})` : toolName
      case 'read':
        return input?.path ? `Read(${input.path})` : 'Read'
      case 'write':
        return input?.file_path ? `Write(${input.file_path})` : 'Write'
      case 'edit':
        return input?.file_path ? `Edit(${input.file_path})` : 'Edit'
      case 'bash':
        const cmd = input?.command || input?.cmd
        return cmd ? `Bash(${cmd.slice(0, 50)}${cmd.length > 50 ? '...' : ''})` : 'Bash'
      default:
        // 对于其他工具，尝试显示主要参数
        const mainParam = input?.path || input?.file_path || input?.pattern || input?.query
        return mainParam ? `${toolName}(${mainParam})` : toolName
    }
  }
  
  const renderHeader = () => (
    <Box flexDirection="row" alignItems="center">
      <Text color={getStatusColor(execution.status)}>
        {getStatusIcon(execution.status)}
      </Text>
      <Text color={getStatusColor(execution.status)}> {formatToolWithParams(execution.toolName, execution.input)}</Text>
      {execution.duration && execution.status === 'completed' && (
        <Box marginLeft={1}>
          <Text color={theme.dimText}>
            ({execution.duration}ms)
          </Text>
        </Box>
      )}
    </Box>
  )

  const renderDetails = () => {
    if (!showDetails || !execution.details) return null
    return (
      <Box marginLeft={4} marginTop={1}>
        <CollapsibleContent
          id={`tool-exec-${execution.id}`}
          content={execution.details}
          contentType="tool-output"
          autoCollapse={true}
          showPreview={true}
          previewLines={6}
          shortcuts={{ toggle: 'Ctrl+R' }}
        />
      </Box>
    )
  }

  if (compact) {
    return (
      <Box flexDirection="column">
        {renderHeader()}
        {execution.message && (
          <Box marginLeft={3}>
            <Text color={theme.dimText}>
              {execution.message}
            </Text>
          </Box>
        )}
        {renderDetails()}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {/* 工具头部信息 */}
      <Box>
        <Text color={theme.dimText}>  ├─ </Text>
        <Box>{renderHeader()}</Box>
      </Box>
      
      {/* 状态消息 */}
      {execution.message && (
        <Box marginLeft={4}>
          <Text color={theme.dimText}>
            {execution.message}
          </Text>
        </Box>
      )}

      {renderDetails()}
      
      {/* 输入参数（调试模式） */}
      {showDetails && execution.input && (
        <Box marginLeft={4} marginTop={1}>
          <Text color={theme.dimText} dimColor>
            输入: {JSON.stringify(execution.input, null, 2)}
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * 工具执行进度组件
 * 显示整体工具执行进度
 */
interface ToolExecutionProgressProps {
  executions: ToolExecutionInfo[]
  title?: string
}

export function ToolExecutionProgress({
  executions,
  title = "工具执行进度"
}: ToolExecutionProgressProps) {
  const theme = getTheme()
  
  const completed = executions.filter(e => e.status === 'completed').length
  const failed = executions.filter(e => e.status === 'failed').length
  const running = executions.filter(e => e.status === 'running').length
  const total = executions.length
  
  if (total === 0) return null
  
  return (
    <Box flexDirection="column" marginY={1}>
      {/* 标题 */}
      <Box flexDirection="row" alignItems="center">
        <Text color={theme.text} bold>● {title}</Text>
        <Box marginLeft={1}>
          <Text color={theme.dimText}>
            ({completed}/{total} 完成)
          </Text>
        </Box>
      </Box>
      
      {/* 执行列表 */}
      <Box flexDirection="column" marginLeft={2}>
        {executions.map((execution, index) => (
          <ToolExecutionDisplay
            key={execution.id || `${execution.toolName}-${index}`}
            execution={execution}
            compact={false}
            showDetails={!!execution.details}
          />
        ))}
      </Box>
      
      {/* 状态总结 */}
      {(failed > 0 || running > 0) && (
        <Box marginLeft={2} marginTop={1}>
          {failed > 0 && (
            <Text color={theme.error}>
              ❌ {failed} 个工具执行失败
            </Text>
          )}
          {running > 0 && (
            <Text color={theme.warning}>
              ⚙️ {running} 个工具正在执行
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
