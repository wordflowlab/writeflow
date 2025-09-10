import React from 'react'
import { Box, Text } from 'ink'
import { Todo, TodoStatus } from '../../types/Todo.js'
import type { TodoStats } from '../../types/Todo.js'
import { AnimatedTaskIcon } from './AnimatedTaskIcon.js'
import { AnimatedText } from './AnimatedText.js'

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
function ExpandedView({ todos, stats, status, elapsedSeconds }: { 
  todos: Todo[], 
  stats: TodoStats,
  status?: 'idle' | 'working' | 'thinking' | 'executing',
  elapsedSeconds?: number
}) {
  const [currentColor, setCurrentColor] = React.useState('yellow')
  
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
    ? `正在创建 ${inProgressTask.content}...`
    : `Todos (${stats.completed}/${stats.total}) • ctrl+t to hide`

  // 模拟 token 计数（实际应该从外部传入）
  const tokenCount = Math.floor(Math.random() * 500) + 100

  return (
    <Box flexDirection="column">
      {/* 头部 - 统一星星 + 随机文字颜色 */}
      <Box flexDirection="row">
        {inProgressTask && (
          <AnimatedTaskIcon 
            isActive={true} 
            color={currentColor}
          />
        )}
        <Box marginLeft={inProgressTask ? 1 : 0}>
          <AnimatedText
            text={headerText}
            isAnimated={!!inProgressTask}
            onColorChange={setCurrentColor}
            elapsedSeconds={elapsedSeconds || 0}
            tokenCount={inProgressTask ? tokenCount : 0}
          />
        </Box>
      </Box>
      
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
  // Claude Code 风格：无 TODO 时完全不显示
  if (stats.total === 0) {
    return null
  }

  if (!isVisible) {
    return <CollapsedView stats={stats} />
  }

  return (
    <ExpandedView 
      todos={todos} 
      stats={stats}
      status={status}
      elapsedSeconds={elapsedSeconds}
    />
  )
}