import React from 'react'
import { Box, Text } from 'ink'
import { Todo, TodoStatus } from '../../types/Todo.js'

interface TodoItemProps {
  todo: Todo
  compact?: boolean
}

export function TodoItem({ todo, compact = true }: TodoItemProps) {
  const getStatusSymbol = (status: TodoStatus): string => {
    switch (status) {
      case TodoStatus.COMPLETED:
        return '■'  // U+25A0 黑色正方形
      case TodoStatus.IN_PROGRESS:
        return '◐'  // U+25D0 左半黑圆
      case TodoStatus.PENDING:
        return '□'  // U+25A1 白色正方形
      default:
        return '□'
    }
  }

  return (
    <Text color="gray">
      {getStatusSymbol(todo.status)} {todo.content}
    </Text>
  )
}