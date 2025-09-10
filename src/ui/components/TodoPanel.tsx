import React from 'react'
import { Box, Text } from 'ink'
import { Todo, TodoStatus } from '../../types/Todo.js'
import type { TodoStats } from '../../types/Todo.js'

interface TodoPanelProps {
  todos: Todo[]
  stats: TodoStats
  isVisible: boolean
  onToggle: () => void
  compact?: boolean
  minimal?: boolean
  status?: 'idle' | 'working' | 'thinking' | 'executing'
  elapsedSeconds?: number
}

// Claude Code 风格的状态符号
function getStatusSymbol(status: TodoStatus): string {
  switch (status) {
    case TodoStatus.COMPLETED:
      return '■'  // 已完成 - 实心方块
    case TodoStatus.IN_PROGRESS:
      return '□'  // 进行中 - 空心方块（Claude Code 中进行中也用空心）
    case TodoStatus.PENDING:
      return '□'  // 待完成 - 空心方块
    default:
      return '□'
  }
}

// Claude Code 风格的树状结构渲染
function renderTodoTree(todos: Todo[]): React.ReactNode[] {
  if (todos.length === 0) return []
  
  return todos.map((todo, index) => {
    const isLast = index === todos.length - 1
    const treeSymbol = isLast ? '└' : '├'
    const statusSymbol = getStatusSymbol(todo.status)
    
    return (
      <Text key={todo.id} color="gray">
        {treeSymbol} {statusSymbol} {todo.content}
      </Text>
    )
  })
}

// 折叠状态显示
function CollapsedView({ stats }: { stats: TodoStats }) {
  const todoText = stats.total === 0 
    ? 'Todos (No todos)' 
    : `Todos (${stats.completed}/${stats.total})`
  
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text color="gray">
        📝 {todoText}
      </Text>
      <Text color="gray" dimColor>
        Ctrl+T to show
      </Text>
    </Box>
  )
}

// 展开状态显示 - Claude Code 风格
function ExpandedView({ todos, stats }: { todos: Todo[], stats: TodoStats }) {
  if (todos.length === 0) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text color="gray">
            📝 Todos (No todos)
          </Text>
          <Text color="gray" dimColor>
            Ctrl+T to hide
          </Text>
        </Box>
      </Box>
    )
  }

  // 找到当前进行中的任务作为主标题
  const inProgressTask = todos.find(t => t.status === TodoStatus.IN_PROGRESS)
  const headerText = inProgressTask 
    ? `正在创建 ${inProgressTask.content}... (esc to interrupt • ctrl+t to hide todos)`
    : `Todos (${stats.completed}/${stats.total}) • ctrl+t to hide`

  return (
    <Box flexDirection="column">
      {/* 头部 */}
      <Text color="yellow">
        ✱ {headerText}
      </Text>
      
      {/* TODO 树状列表 */}
      <Box flexDirection="column">
        {renderTodoTree(todos)}
      </Box>
    </Box>
  )
}

export function TodoPanel({ 
  todos, 
  stats, 
  isVisible, 
  compact = false, 
  minimal = false,
  status = 'idle', 
  elapsedSeconds = 0 
}: TodoPanelProps) {
  // 移除空状态完全隐藏的逻辑，让空状态也能正常显示

  if (!isVisible) {
    return <CollapsedView stats={stats} />
  }

  return (
    <ExpandedView 
      todos={todos} 
      stats={stats}
    />
  )
}