import React from 'react'
import { Box, Text } from 'ink'
import { Todo, TodoStatus, TodoPriority } from '../../types/Todo.js'
import type { TodoStats } from '../../types/Todo.js'

interface MinimalTodoListProps {
  todos: Todo[]
  stats: TodoStats
  isVisible: boolean
  compact?: boolean
  showHints?: boolean
}

// 复选框样式映射 - Claude Code 风格
const CheckboxIcons = {
  [TodoStatus.PENDING]: '[ ]',
  [TodoStatus.IN_PROGRESS]: '[⏳]',
  [TodoStatus.COMPLETED]: '[✓]'
}

// 状态颜色映射
const StatusColors = {
  [TodoStatus.PENDING]: 'gray',
  [TodoStatus.IN_PROGRESS]: 'yellow',
  [TodoStatus.COMPLETED]: 'green'
} as const

// 优先级指示器（更细微）
const getPriorityIndicator = (priority: TodoPriority): string => {
  switch (priority) {
    case TodoPriority.HIGH: return '!'
    case TodoPriority.MEDIUM: return ''
    case TodoPriority.LOW: return ''
  }
}

// 单个 TODO 项 - 极简风格
function MinimalTodoItem({ 
  todo, 
  isFirst = false,
  isLast = false 
}: { 
  todo: Todo
  isFirst?: boolean
  isLast?: boolean
}) {
  const statusColor = StatusColors[todo.status]
  const checkbox = CheckboxIcons[todo.status]
  const priorityIndicator = getPriorityIndicator(todo.priority)
  const connector = isFirst ? '⎿' : (isLast ? '└' : '│')

  return (
    <Box flexDirection="row">
      <Text color="gray" dimColor>
        {connector}
      </Text>
      <Box marginLeft={1}>
        <Text color={statusColor}>
          {checkbox}
        </Text>
      </Box>
      <Box marginLeft={1}>
        <Text 
          color={statusColor}
          strikethrough={todo.status === TodoStatus.COMPLETED}
          bold={todo.status === TodoStatus.IN_PROGRESS}
        >
          {todo.content}{priorityIndicator}
        </Text>
      </Box>
    </Box>
  )
}

// 折叠状态 - 一行显示
function CollapsedTodoList({ stats, showHints = true }: { stats: TodoStats, showHints?: boolean }) {
  const pendingCount = stats.pending
  const inProgressCount = stats.inProgress
  const completedCount = stats.completed
  
  let statusText = ''
  if (inProgressCount > 0) {
    statusText += `${inProgressCount} 进行中`
  }
  if (pendingCount > 0) {
    if (statusText) statusText += '，'
    statusText += `${pendingCount} 待处理`
  }
  if (completedCount > 0 && !statusText) {
    statusText = `${completedCount} 已完成`
  }
  if (!statusText) {
    statusText = '暂无任务'
  }

  return (
    <Box flexDirection="row">
      <Text color="gray" dimColor>⎿</Text>
      <Box marginLeft={1}>
        <Text color="blue">
          共 {stats.total} 个任务（{statusText}）
        </Text>
      </Box>
      {showHints && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            · 按 Ctrl+T 展开
          </Text>
        </Box>
      )}
    </Box>
  )
}

// 展开状态 - 显示任务列表
function ExpandedTodoList({ todos, stats, compact, showHints = true }: { 
  todos: Todo[]
  stats: TodoStats
  compact?: boolean 
  showHints?: boolean
}) {
  // 按状态分组并排序
  const inProgressTodos = todos.filter(t => t.status === TodoStatus.IN_PROGRESS)
  const pendingTodos = todos.filter(t => t.status === TodoStatus.PENDING)
  const completedTodos = todos.filter(t => t.status === TodoStatus.COMPLETED)
  
  // 合并显示：进行中 → 待处理 → 最近完成
  const displayTodos = [
    ...inProgressTodos,
    ...pendingTodos.slice(0, compact ? 2 : 3),
    ...completedTodos.slice(0, compact ? 1 : 2)
  ]

  if (displayTodos.length === 0) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color="gray" dimColor>⎿</Text>
          <Box marginLeft={1}>
            <Text color="gray" dimColor>
              暂无任务。可使用 TodoWrite 工具添加任务。
            </Text>
          </Box>
        </Box>
        {showHints && (
          <Box flexDirection="row" marginTop={0}>
            <Text color="gray" dimColor> </Text>
            <Box marginLeft={1}>
              <Text color="gray" dimColor>
                按 Ctrl+T 收起
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {displayTodos.map((todo, index) => (
        <MinimalTodoItem
          key={todo.id}
          todo={todo}
          isFirst={index === 0}
          isLast={index === displayTodos.length - 1}
        />
      ))}
      
      {/* 省略提示 */}
      {(pendingTodos.length > (compact ? 2 : 3) || completedTodos.length > (compact ? 1 : 2)) && (
        <Box flexDirection="row">
          <Text color="gray" dimColor>│</Text>
          <Box marginLeft={1}>
            <Text color="gray" dimColor>
              ... 还有 {Math.max(0, pendingTodos.length - (compact ? 2 : 3)) + Math.max(0, completedTodos.length - (compact ? 1 : 2))} 项
            </Text>
          </Box>
        </Box>
      )}
      
      {/* 底部控制提示 */}
      {showHints && (
        <Box flexDirection="row">
          <Text color="gray" dimColor> </Text>
          <Box marginLeft={1}>
            <Text color="gray" dimColor>
              {stats.completed}/{stats.total} 已完成 · 按 Ctrl+T 收起
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// 主组件
export function MinimalTodoList({ 
  todos, 
  stats, 
  isVisible, 
  compact = false,
  showHints = true
}: MinimalTodoListProps) {
  if (!isVisible) {
    return <CollapsedTodoList stats={stats} showHints={showHints} />
  }

  return (
    <ExpandedTodoList 
      todos={todos} 
      stats={stats} 
      compact={compact}
      showHints={showHints}
    />
  )
}
