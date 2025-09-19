import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { TodoManager } from '../../tools/TodoManager.js'
import { TodoStatus, TodoPriority } from '../../types/Todo.js'

// 全局 TodoManager 实例 - 基于会话ID
let globalTodoManager: TodoManager | null = null

function getTodoManager(sessionId?: string): TodoManager {
  // 如果没有提供 sessionId，使用默认的固定 sessionId
  const effectiveSessionId = sessionId || 'default-session'
  
  if (!globalTodoManager || globalTodoManager.getStorageInfo().sessionId !== effectiveSessionId) {
    globalTodoManager = new TodoManager(effectiveSessionId)
  }
  return globalTodoManager
}

// /todo add 命令
export const todoAddCommand: SlashCommand = {
  type: 'local',
  name: 'todo-add',
  description: '添加新任务到待办列表',
  aliases: ['todo', 'add-todo'],
  usage: '/todo add <任务内容> [优先级]',
  examples: [
    '/todo add 实现用户登录功能',
    '/todo add 修复数据库连接问题 high',
    '/todo add 更新文档 low'
  ],
  
  userFacingName: () => '添加任务',
  
  async call(_args: string, _context: AgentContext): Promise<string> {
    if (!_args.trim()) {
      return '错误: 请提供任务内容。用法: /todo add <任务内容> [优先级]'
    }

    const parts = _args.trim().split(' ')
    const priority = parts[parts.length - 1]?.toLowerCase()
    let content: string
    let taskPriority: TodoPriority = TodoPriority.MEDIUM

    // 解析优先级
    if (['high', 'medium', 'low'].includes(priority)) {
      taskPriority = priority as TodoPriority
      content = parts.slice(0, -1).join(' ')
    } else {
      content = _args.trim()
    }

    // 生成 activeForm
    const activeForm = content.startsWith('实现') ? content.replace('实现', '正在实现') :
                      content.startsWith('修复') ? content.replace('修复', '正在修复') :
                      content.startsWith('创建') ? content.replace('创建', '正在创建') :
                      content.startsWith('更新') ? content.replace('更新', '正在更新') :
                      content.startsWith('删除') ? content.replace('删除', '正在删除') :
                      `正在处理：${content}`

    const todoManager = getTodoManager(context.sessionId)
    const newTodo = await todoManager.addTodo(content, activeForm, taskPriority)

    return `✅ 任务已添加：\n• ID: ${newTodo.id}\n• 内容: ${newTodo.content}\n• 优先级: ${newTodo.priority}\n• 状态: ${newTodo.status}`
  }
}

// /todo list 命令
export const todoListCommand: SlashCommand = {
  type: 'local-jsx',
  name: 'todo-list',
  description: '显示所有待办任务',
  aliases: ['todos', 'list-todos'],
  usage: '/todo list [状态]',
  examples: [
    '/todo list',
    '/todo list pending',
    '/todo list completed'
  ],

  userFacingName: () => '任务列表',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const todoManager = getTodoManager(context.sessionId)
    const status = _args.trim().toLowerCase() as TodoStatus

    let todos
    if (status && Object.values(TodoStatus).includes(status)) {
      todos = await todoManager.getTodosByStatus(status)
    } else {
      todos = await todoManager.getAllTodos()
    }

    const stats = await todoManager.getStats()

    // 返回 JSON 格式给 JSX 渲染器
    return JSON.stringify({
      type: 'todo-list',
      data: { todos, stats, filter: status || 'all' }
    })
  }
}

// /todo update 命令
export const todoUpdateCommand: SlashCommand = {
  type: 'local',
  name: 'todo-update',
  description: '更新任务状态',
  aliases: ['todo-status', 'update-todo'],
  usage: '/todo update <ID> <状态>',
  examples: [
    '/todo update todo-123 in_progress',
    '/todo update todo-456 completed',
    '/todo update todo-789 pending'
  ],

  userFacingName: () => '更新任务',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const parts = _args.trim().split(' ')
    if (parts.length !== 2) {
      return '错误: 用法 /todo update <ID> <状态>\n可用状态: pending, in_progress, completed'
    }

    const [id, statusStr] = parts
    const status = statusStr as TodoStatus

    if (!Object.values(TodoStatus).includes(status)) {
      return `错误: 无效状态 "${statusStr}"\n可用状态: pending, in_progress, completed`
    }

    const todoManager = getTodoManager(context.sessionId)
    const updatedTodo = await todoManager.updateTodoStatus(id, status)

    if (!updatedTodo) {
      return `错误: 未找到 ID 为 "${id}" 的任务`
    }

    const statusEmoji = {
      [TodoStatus.PENDING]: '⭕',
      [TodoStatus.IN_PROGRESS]: '⏳', 
      [TodoStatus.COMPLETED]: '✅'
    }

    return `${statusEmoji[status]} 任务状态已更新：\n• ${updatedTodo.content}\n• 状态: ${updatedTodo.status}`
  }
}

// /todo remove 命令
export const todoRemoveCommand: SlashCommand = {
  type: 'local',
  name: 'todo-remove',
  description: '删除任务',
  aliases: ['todo-delete', 'remove-todo'],
  usage: '/todo remove <ID>',
  examples: ['/todo remove todo-123'],

  userFacingName: () => '删除任务',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const id = _args.trim()
    if (!id) {
      return '错误: 请提供任务 ID。用法: /todo remove <ID>'
    }

    const todoManager = getTodoManager(context.sessionId)
    const todo = await todoManager.getTodoById(id)
    
    if (!todo) {
      return `错误: 未找到 ID 为 "${id}" 的任务`
    }

    const success = await todoManager.removeTodo(id)
    if (success) {
      return `🗑️ 任务已删除：${todo.content}`
    } else {
      return `错误: 删除任务失败`
    }
  }
}

// /todo stats 命令
export const todoStatsCommand: SlashCommand = {
  type: 'local',
  name: 'todo-stats',
  description: '显示任务统计信息',
  aliases: ['todo-progress'],
  usage: '/todo stats',

  userFacingName: () => '任务统计',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const todoManager = getTodoManager(context.sessionId)
    const report = await todoManager.getProgressReport()

    let result = `📊 任务统计报告\n\n`
    result += `总任务: ${report.stats.total}\n`
    result += `待处理: ${report.stats.pending}\n`
    result += `进行中: ${report.stats.inProgress}\n`
    result += `已完成: ${report.stats.completed}\n`
    result += `完成率: ${report.stats.completionRate}%\n\n`

    if (report.currentTask) {
      result += `🔥 当前任务: ${report.currentTask.content}\n\n`
    }

    if (report.nextTasks.length > 0) {
      result += `📋 接下来的任务:\n`
      report.nextTasks.forEach((task, index) => {
        result += `${index + 1}. ${task.content}\n`
      })
      result += `\n`
    }

    if (report.recentCompleted.length > 0) {
      result += `✅ 最近完成:\n`
      report.recentCompleted.forEach((task, index) => {
        result += `${index + 1}. ${task.content}\n`
      })
    }

    return result
  }
}

// /todo clear 命令
export const todoClearCommand: SlashCommand = {
  type: 'local',
  name: 'todo-clear',
  description: '清空所有任务',
  usage: '/todo clear',

  userFacingName: () => '清空任务',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const todoManager = getTodoManager(context.sessionId)
    await todoManager.clearAllTodos()
    return '🧹 所有任务已清空'
  }
}

// /todo start 命令 - 开始任务
export const todoStartCommand: SlashCommand = {
  type: 'local',
  name: 'todo-start',
  description: '开始执行任务',
  usage: '/todo start <ID>',
  examples: ['/todo start todo-123'],

  userFacingName: () => '开始任务',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const id = _args.trim()
    if (!id) {
      return '错误: 请提供任务 ID。用法: /todo start <ID>'
    }

    const todoManager = getTodoManager(context.sessionId)
    const todo = await todoManager.startTask(id)

    if (!todo) {
      return `错误: 无法开始任务 "${id}"，请检查 ID 是否正确或任务状态`
    }

    return `🚀 开始任务：${todo.content}\n状态已更改为：${todo.status}`
  }
}

// /todo done 命令 - 完成任务
export const todoDoneCommand: SlashCommand = {
  type: 'local',
  name: 'todo-done',
  description: '完成任务',
  usage: '/todo done <ID>',
  examples: ['/todo done todo-123'],

  userFacingName: () => '完成任务',

  async call(_args: string, _context: AgentContext): Promise<string> {
    const id = _args.trim()
    if (!id) {
      return '错误: 请提供任务 ID。用法: /todo done <ID>'
    }

    const todoManager = getTodoManager(context.sessionId)
    const todo = await todoManager.completeTask(id)

    if (!todo) {
      return `错误: 无法完成任务 "${id}"，请检查 ID 是否正确`
    }

    return `✅ 任务已完成：${todo.content}`
  }
}

// 导出所有 Todo 命令
export const todoCommands = [
  todoAddCommand,
  todoListCommand,
  todoUpdateCommand,
  todoRemoveCommand,
  todoStatsCommand,
  todoClearCommand,
  todoStartCommand,
  todoDoneCommand
]