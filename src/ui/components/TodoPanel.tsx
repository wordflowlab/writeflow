import React from 'react'
import { Box, Text } from 'ink'
import { Todo, TodoStatus, TodoPriority } from '../../types/Todo.js'
import type { TodoStats } from '../../types/Todo.js'

interface TodoPanelProps {
  todos: Todo[]
  stats: TodoStats
  isVisible: boolean
  onToggle: () => void
  compact?: boolean
  status?: 'idle' | 'working' | 'thinking' | 'executing'
  elapsedSeconds?: number
}

// 状态图标映射
const StatusIcons = {
  [TodoStatus.PENDING]: '⭕',
  [TodoStatus.IN_PROGRESS]: '⏳',
  [TodoStatus.COMPLETED]: '✅'
}

// 状态颜色映射
const StatusColors = {
  [TodoStatus.PENDING]: 'gray',
  [TodoStatus.IN_PROGRESS]: 'yellow',
  [TodoStatus.COMPLETED]: 'green'
} as const

// 优先级图标映射
const PriorityIcons = {
  [TodoPriority.HIGH]: '🔴',
  [TodoPriority.MEDIUM]: '🟡',
  [TodoPriority.LOW]: '🟢'
}

// 紧凑模式的单个 Todo 项
function CompactTodoItem({ todo }: { todo: Todo }) {
  const statusColor = StatusColors[todo.status]
  const statusIcon = StatusIcons[todo.status]

  return (
    <Text color={statusColor}>
      {statusIcon} {todo.content.length > 30 ? todo.content.substring(0, 30) + '...' : todo.content}
    </Text>
  )
}

// 完整模式的单个 Todo 项
function FullTodoItem({ todo, isCurrent = false }: { todo: Todo; isCurrent?: boolean }) {
  const statusColor = StatusColors[todo.status]
  const statusIcon = StatusIcons[todo.status]
  const priorityIcon = PriorityIcons[todo.priority]

  return (
    <Box flexDirection="row" marginBottom={0}>
      <Text color={statusColor} bold>
        {statusIcon}
      </Text>
      
      <Box marginLeft={1}>
        <Text>{priorityIcon}</Text>
      </Box>

      <Box marginLeft={1} flexGrow={1}>
        <Text 
          color={statusColor}
          strikethrough={todo.status === TodoStatus.COMPLETED}
          bold={isCurrent || todo.status === TodoStatus.IN_PROGRESS}
        >
          {todo.content}
        </Text>
      </Box>
    </Box>
  )
}

// 折叠状态显示
function CollapsedView({ stats, status = 'idle', elapsedSeconds = 0 }: { stats: TodoStats, status?: 'idle' | 'working' | 'thinking' | 'executing', elapsedSeconds?: number }) {
  const pendingCount = stats.pending
  const inProgressCount = stats.inProgress
  
  let statusText = ''
  if (inProgressCount > 0) {
    statusText += `${inProgressCount} in progress`
  }
  if (pendingCount > 0) {
    if (statusText) statusText += ', '
    statusText += `${pendingCount} pending`
  }
  if (!statusText && stats.completed > 0) {
    statusText = 'All completed'
  }
  if (!statusText) {
    statusText = 'No todos'
  }

  const statusLabel = status === 'working' || status === 'executing' ? 'working' : (status === 'thinking' ? 'thinking' : '')
  const timerText = statusLabel ? ` (${elapsedSeconds}s • Esc to interrupt)` : ''
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text color="blue">📝 Todos ({statusText}){statusLabel ? ` · ${statusLabel}${timerText}` : ''}</Text>
      <Text color="gray" dimColor>{'   '}Ctrl+T to show</Text>
    </Box>
  )
}

// 展开状态显示
function ExpandedView({ 
  todos, 
  stats, 
  compact,
  status = 'idle',
  elapsedSeconds = 0
}: { 
  todos: Todo[]
  stats: TodoStats
  compact?: boolean,
  status?: 'idle' | 'working' | 'thinking' | 'executing',
  elapsedSeconds?: number
}) {
  // 按状态分组
  const inProgressTodos = todos.filter(t => t.status === TodoStatus.IN_PROGRESS)
  const pendingTodos = todos.filter(t => t.status === TodoStatus.PENDING)
  const completedTodos = todos.filter(t => t.status === TodoStatus.COMPLETED)

  // Header 文案：与截图风格一致
  const current = inProgressTodos[0]
  const statusLabel = status === 'working' || status === 'executing' ? 'working' : (status === 'thinking' ? 'thinking' : '')
  const timerText = statusLabel ? ` (${elapsedSeconds}s • Esc to interrupt · ctrl+t to hide todos)` : ''
  const headerText = current
    ? `正在创建  ${current.content}…  (esc to interrupt · ctrl+t to hide todos)`
    : (statusLabel ? `${statusLabel}${timerText}`
      : `Todos (${stats.completed}/${stats.total} completed) · ctrl+t to hide`)

  if (todos.length === 0) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
          <Text color="blue" bold>📝 Todos (none)</Text>
          <Text color="gray" dimColor>Ctrl+T to hide</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <Text color="yellow" bold>* {headerText}</Text>
      </Box>

      {/* Progress Bar */}
      {/* Progress 简化为一行，避免撑高与输入框间距 */}
      {stats.total > 0 && (
        <Box marginBottom={0}>
          <Text color="gray" dimColor>
            progress {stats.completed}/{stats.total} · {stats.completionRate}%
          </Text>
        </Box>
      )}

      {/* Current Task (In Progress) */}
      {inProgressTodos.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          <Text color="yellow" bold>⏳ In Progress ({inProgressTodos.length})</Text>
          {inProgressTodos.map(todo => (
            <Box key={todo.id} marginLeft={1}>
              {compact ? 
                <CompactTodoItem todo={todo} /> : 
                <FullTodoItem todo={todo} isCurrent={true} />
              }
            </Box>
          ))}
        </Box>
      )}

      {/* Next Tasks (Pending) */}
      {pendingTodos.length > 0 && (
        <Box flexDirection="column" marginBottom={completedTodos.length > 0 ? 0 : 0}>
          <Text color="gray" bold>⭕ Up Next ({pendingTodos.length})</Text>
          {pendingTodos.slice(0, compact ? 2 : 3).map(todo => (
            <Box key={todo.id} marginLeft={1}>
              {compact ? 
                <CompactTodoItem todo={todo} /> : 
                <FullTodoItem todo={todo} />
              }
            </Box>
          ))}
          {pendingTodos.length > (compact ? 2 : 3) && (
            <Box marginLeft={1}>
              <Text color="gray" dimColor>
                ... and {pendingTodos.length - (compact ? 2 : 3)} more
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Recent Completions */}
      {completedTodos.length > 0 && !compact && (
        <Box flexDirection="column">
          <Text color="green" bold>✅ Recently Completed ({completedTodos.length})</Text>
          {completedTodos.slice(0, 2).map(todo => (
            <Box key={todo.id} marginLeft={1}>
              <FullTodoItem todo={todo} />
            </Box>
          ))}
          {completedTodos.length > 2 && (
            <Box marginLeft={1}>
              <Text color="gray" dimColor>
                ... and {completedTodos.length - 2} more completed
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

export function TodoPanel({ todos, stats, isVisible, compact = false, status = 'idle', elapsedSeconds = 0 }: TodoPanelProps) {
  if (!isVisible) {
    return <CollapsedView stats={stats} status={status} elapsedSeconds={elapsedSeconds} />
  }

  return (
    <ExpandedView 
      todos={todos} 
      stats={stats} 
      compact={compact}
      status={status}
      elapsedSeconds={elapsedSeconds}
    />
  )
}
