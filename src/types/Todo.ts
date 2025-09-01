// Todo 数据结构定义 - 基于 Claude Code 分析

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress', 
  COMPLETED = 'completed'
}

export enum TodoPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface Todo {
  id: string
  content: string
  activeForm: string  // 进行中状态的描述
  status: TodoStatus
  priority: TodoPriority
  createdAt: Date
  updatedAt: Date
}

// 状态优先级映射 (参考 Claude Code qa0)
export const STATUS_PRIORITIES: Record<TodoStatus, number> = {
  [TodoStatus.COMPLETED]: 0,     // 已完成：最高优先级显示
  [TodoStatus.IN_PROGRESS]: 1,   // 进行中：中等优先级显示  
  [TodoStatus.PENDING]: 2        // 待处理：最低优先级显示
}

// 任务优先级映射 (参考 Claude Code Ma0)
export const TASK_PRIORITIES: Record<TodoPriority, number> = {
  [TodoPriority.HIGH]: 0,    // 高优先级
  [TodoPriority.MEDIUM]: 1,  // 中等优先级
  [TodoPriority.LOW]: 2      // 低优先级
}

// Todo 创建参数
export interface CreateTodoParams {
  content: string
  activeForm: string
  priority?: TodoPriority
}

// Todo 更新参数  
export interface UpdateTodoParams {
  id: string
  status?: TodoStatus
  content?: string
  activeForm?: string
  priority?: TodoPriority
}

// Todo 统计信息
export interface TodoStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  completionRate: number
}