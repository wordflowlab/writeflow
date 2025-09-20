// Query 系统 - WriteFlow 适配版本
export interface Message {
  id?: string
  type: 'user' | 'assistant' | 'system' | 'thinking'
  message: {
    content: string | Array<{ type: string, text?: string }>
  }
  timestamp?: Date
}

export interface AssistantMessage extends Message {
  type: 'assistant'
}

export interface ProgressMessage extends Message {
  toolUseID: string
  siblingToolUseIDs: Set<string>
  content: Message
}

export interface BinaryFeedbackResult {
  choice: 'left' | 'right'
  reasoning?: string
}

export async function* query(
  messages: Message[],
  systemPrompt: string, _context: string,
  canUseTool: any,
  options: any,
  getBinaryFeedbackResponse?: any
): AsyncGenerator<Message, void, unknown> {
  // 简化的查询实现，后续将集成到 WriteFlow 的 AI 系统
  const response: Message = {
    id: `ai-${Date.now()}`,
    type: 'assistant',
    message: {
      content: '您好！我是WriteFlow AI写作助手。新的架构正在构建中，请稍候...'
    },
    timestamp: new Date()
  }
  
  yield response
}