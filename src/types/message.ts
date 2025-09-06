export interface Message {
  id: string
  type: MessageType
  priority: number
  payload: any
  timestamp: number
  source: string
  deadline?: number
}

export enum MessageType {
  UserInput = 'user_input',
  AgentResponse = 'agent_response',
  ToolInvocation = 'tool_invocation', 
  SystemNotification = 'system_notification',
  TaskAssignment = 'task_assignment',
  SlashCommand = 'slash_command',
  ContextUpdate = 'context_update',
  
  // TODO Queue 相关消息类型
  TodoPlan = 'todo_plan',           // 任务规划阶段
  TodoExecute = 'todo_execute',     // 任务执行请求
  TodoUpdate = 'todo_update',       // 任务状态更新
  TodoComplete = 'todo_complete',   // 任务完成通知
  TodoSummary = 'todo_summary'      // 任务总结生成
}

export enum MessagePriority {
  Critical = 100,
  High = 80,
  Normal = 50,
  Low = 20,
  Background = 10
}

export interface QueueMetrics {
  queueSize: number
  totalCapacity: number
  throughput: number
  backpressureActive: boolean
  averageLatency: number
  messagesProcessed: number
}