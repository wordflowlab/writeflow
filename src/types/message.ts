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
  ContextUpdate = 'context_update'
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