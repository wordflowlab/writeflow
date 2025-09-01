import React from 'react'
import { Box, Text } from 'ink'
import { Todo, TodoStatus, TodoPriority } from '../../types/Todo.js'
import type { TodoStats } from '../../types/Todo.js'

interface TodoListData {
  todos: Todo[]
  stats: TodoStats
  filter: string
}

interface TodoListRendererProps {
  data: TodoListData
}

// 状态图标映射 - 复刻 Claude Code 的视觉风格
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

// 单个 Todo 项组件 - 参考 Claude Code 的 JJ1 组件
function TodoItem({ 
  todo, 
  isCurrent = false,
  verbose = false 
}: { 
  todo: Todo; 
  isCurrent?: boolean; 
  verbose?: boolean 
}) {
  const statusColor = StatusColors[todo.status]
  const statusIcon = StatusIcons[todo.status]
  const priorityIcon = PriorityIcons[todo.priority]

  return (
    <Box flexDirection="row" marginBottom={verbose ? 1 : 0}>
      {/* 状态图标 */}
      <Text color={statusColor} bold>
        {statusIcon}
      </Text>
      
      {/* 优先级图标 */}
      <Box marginLeft={1}>
        <Text>{priorityIcon}</Text>
      </Box>

      {/* 任务内容 */}
      <Box flexDirection="column" marginLeft={1} flexGrow={1}>
        <Text 
          color={statusColor}
          strikethrough={todo.status === TodoStatus.COMPLETED}
          bold={isCurrent || todo.status === TodoStatus.IN_PROGRESS}
        >
          {todo.content}
        </Text>
        
        {verbose && (
          <Box flexDirection="column" marginLeft={2}>
            <Text color="gray" dimColor>
              ID: {todo.id.split('-').pop()}
            </Text>
            <Text color="gray" dimColor>
              进行状态: {todo.activeForm}
            </Text>
            <Text color="gray" dimColor>
              创建时间: {todo.createdAt.toLocaleDateString()}
            </Text>
            {todo.status === TodoStatus.COMPLETED && (
              <Text color="green" dimColor>
                完成时间: {todo.updatedAt.toLocaleDateString()}
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

// 统计信息组件
function TodoStats({ stats }: { stats: TodoStats }) {
  const progressBar = '█'.repeat(Math.floor(stats.completionRate / 10)) + 
                     '░'.repeat(10 - Math.floor(stats.completionRate / 10))

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1} marginBottom={1}>
      <Text color="blue" bold>📊 任务统计</Text>
      
      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        <Text>总计: <Text color="white" bold>{stats.total}</Text></Text>
        <Text>待处理: <Text color="gray" bold>{stats.pending}</Text></Text>
        <Text>进行中: <Text color="yellow" bold>{stats.inProgress}</Text></Text>
        <Text>已完成: <Text color="green" bold>{stats.completed}</Text></Text>
      </Box>
      
      <Box flexDirection="row" alignItems="center" marginTop={1}>
        <Text>完成率: </Text>
        <Text color="cyan">{progressBar}</Text>
        <Box marginLeft={1}>
          <Text color="white" bold>{stats.completionRate}%</Text>
        </Box>
      </Box>
    </Box>
  )
}

// 主渲染组件 - 参考 Claude Code 的 ka0 组件
export function TodoListRenderer({ data }: TodoListRendererProps) {
  const { todos, stats, filter } = data

  if (todos.length === 0) {
    return (
      <Box flexDirection="column">
        <TodoStats stats={stats} />
        <Box justifyContent="center" padding={2}>
          <Text color="gray" dimColor>
            📝 待办列表为空
            {filter !== 'all' && ` (筛选: ${filter})`}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            使用 "/todo add &lt;任务内容&gt;" 来添加新任务
          </Text>
        </Box>
      </Box>
    )
  }

  // 按状态分组显示
  const pendingTodos = todos.filter(t => t.status === TodoStatus.PENDING)
  const inProgressTodos = todos.filter(t => t.status === TodoStatus.IN_PROGRESS)
  const completedTodos = todos.filter(t => t.status === TodoStatus.COMPLETED)

  return (
    <Box flexDirection="column">
      <TodoStats stats={stats} />

      {filter === 'all' && (
        <>
          {/* 进行中的任务 */}
          {inProgressTodos.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="yellow" bold>⏳ 进行中 ({inProgressTodos.length})</Text>
              {inProgressTodos.map(todo => (
                <TodoItem key={todo.id} todo={todo} isCurrent={true} verbose={false} />
              ))}
            </Box>
          )}

          {/* 待处理的任务 */}
          {pendingTodos.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text color="gray" bold>⭕ 待处理 ({pendingTodos.length})</Text>
              {pendingTodos.slice(0, 5).map(todo => (
                <TodoItem key={todo.id} todo={todo} verbose={false} />
              ))}
              {pendingTodos.length > 5 && (
                <Box marginLeft={2}>
                  <Text color="gray" dimColor>
                    ... 还有 {pendingTodos.length - 5} 个待处理任务
                  </Text>
                </Box>
              )}
            </Box>
          )}

          {/* 已完成的任务 */}
          {completedTodos.length > 0 && (
            <Box flexDirection="column">
              <Text color="green" bold>✅ 已完成 ({completedTodos.length})</Text>
              {completedTodos.slice(0, 3).map(todo => (
                <TodoItem key={todo.id} todo={todo} verbose={false} />
              ))}
              {completedTodos.length > 3 && (
                <Box marginLeft={2}>
                  <Text color="gray" dimColor>
                    ... 还有 {completedTodos.length - 3} 个已完成任务
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </>
      )}

      {/* 筛选模式显示 */}
      {filter !== 'all' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="blue" bold>
              📋 {filter === 'pending' ? '待处理' : filter === 'in_progress' ? '进行中' : '已完成'}任务
            </Text>
          </Box>
          {todos.map(todo => (
            <TodoItem key={todo.id} todo={todo} verbose={true} />
          ))}
        </Box>
      )}

      {/* 操作提示 */}
      <Box marginTop={2} borderStyle="round" borderColor="gray" padding={1}>
        <Box flexDirection="column">
          <Text color="gray" bold>💡 快捷操作：</Text>
          <Text color="gray" dimColor>• /todo start &lt;ID&gt; - 开始任务</Text>
          <Text color="gray" dimColor>• /todo done &lt;ID&gt; - 完成任务</Text>
          <Text color="gray" dimColor>• /todo stats - 查看统计</Text>
        </Box>
      </Box>
    </Box>
  )
}