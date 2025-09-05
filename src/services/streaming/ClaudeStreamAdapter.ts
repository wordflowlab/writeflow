import { StreamAdapter, StreamChunk, StreamAdapterConfig } from './StreamAdapter.js'

/**
 * Claude 流式事件类型
 */
type ClaudeEventType = 
  | 'message_start'
  | 'content_block_start'
  | 'content_block_delta'
  | 'content_block_stop'
  | 'message_delta'
  | 'message_stop'
  | 'ping'
  | 'error'

/**
 * Claude 内容块增量
 */
interface ClaudeContentBlockDelta {
  type: 'content_block_delta'
  index: number
  delta: {
    type: 'text_delta' | 'input_json_delta' | 'thinking_delta' | 'signature_delta'
    text?: string
    partial_json?: string
    thinking?: string
    signature?: string
  }
}

/**
 * Claude 消息增量
 */
interface ClaudeMessageDelta {
  type: 'message_delta'
  delta: {
    stop_reason?: string
    stop_sequence?: string | null
  }
  usage?: {
    output_tokens: number
  }
}

/**
 * Claude 消息开始
 */
interface ClaudeMessageStart {
  type: 'message_start'
  message: {
    id: string
    type: 'message'
    role: 'assistant'
    content: any[]
    model: string
    stop_reason: string | null
    stop_sequence: string | null
    usage: {
      input_tokens: number
      output_tokens: number
    }
  }
}

/**
 * Claude 错误响应
 */
interface ClaudeErrorResponse {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

/**
 * Claude 流式适配器
 * 
 * 处理 Anthropic Claude 格式的 SSE 流：
 * - event: content_block_delta
 * - data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "文本"}}
 */
export class ClaudeStreamAdapter extends StreamAdapter {
  private messageId: string = ''
  private totalInputTokens: number = 0
  private totalOutputTokens: number = 0

  constructor(config?: Partial<StreamAdapterConfig>) {
    super(config)
  }

  /**
   * 解析 Claude 流式数据
   */
  parseStream(data: string): StreamChunk[] {
    const chunks: StreamChunk[] = []
    
    // 按行分割，查找事件和数据对
    const lines = data.split('\n')
    let currentEvent: string | null = null
    let currentData: string | null = null
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (!trimmed || trimmed.startsWith(':')) {
        // 跳过空行和注释行
        continue
      }
      
      if (trimmed.startsWith('event: ')) {
        currentEvent = trimmed.substring(7) // 移除 'event: '
      } else if (trimmed.startsWith('data: ')) {
        currentData = trimmed.substring(6) // 移除 'data: '
        
        // 当有事件和数据时处理
        if (currentEvent && currentData) {
          const chunk = this.parseEventData(currentEvent, currentData)
          if (chunk) {
            chunks.push(chunk)
          }
          
          // 重置状态
          currentEvent = null
          currentData = null
        }
      }
    }
    
    return chunks
  }

  /**
   * 解析具体的事件和数据
   */
  private parseEventData(event: string, data: string): StreamChunk | null {
    try {
      const parsed = JSON.parse(data)
      
      switch (event as ClaudeEventType) {
        case 'message_start':
          return this.handleMessageStart(parsed as ClaudeMessageStart)
          
        case 'content_block_delta':
          return this.handleContentBlockDelta(parsed as ClaudeContentBlockDelta)
          
        case 'message_delta':
          return this.handleMessageDelta(parsed as ClaudeMessageDelta)
          
        case 'message_stop':
          return this.handleMessageStop()
          
        case 'ping':
          // Ping 事件不产生内容
          return null
          
        case 'error':
          return this.handleClaudeError(parsed as ClaudeErrorResponse)
          
        default:
          // 未知事件类型
          return null
      }
    } catch (error) {
      return {
        content: '',
        done: false,
        error: `Failed to parse Claude event: ${error}`,
        raw: { event, data }
      }
    }
  }

  /**
   * 处理消息开始事件
   */
  private handleMessageStart(data: ClaudeMessageStart): StreamChunk | null {
    this.messageId = data.message.id
    this.totalInputTokens = data.message.usage.input_tokens
    this.totalOutputTokens = data.message.usage.output_tokens
    
    // message_start 不产生内容，只设置状态
    return null
  }

  /**
   * 处理内容块增量事件
   */
  private handleContentBlockDelta(data: ClaudeContentBlockDelta): StreamChunk {
    let content = ''
    let reasoning = ''
    
    switch (data.delta.type) {
      case 'text_delta':
        content = data.delta.text || ''
        break
        
      case 'thinking_delta':
        reasoning = data.delta.thinking || ''
        break
        
      case 'input_json_delta':
        // 工具调用的 JSON 输入
        content = data.delta.partial_json || ''
        break
        
      case 'signature_delta':
        // 签名验证，通常不显示给用户
        break
    }
    
    return {
      content,
      done: false,
      reasoning: reasoning || undefined,
      raw: data
    }
  }

  /**
   * 处理消息增量事件
   */
  private handleMessageDelta(data: ClaudeMessageDelta): StreamChunk | null {
    // 更新token使用统计
    if (data.usage) {
      this.totalOutputTokens += data.usage.output_tokens
    }
    
    // message_delta 通常只包含metadata，不产生内容
    return null
  }

  /**
   * 处理消息结束事件
   */
  private handleMessageStop(): StreamChunk {
    return {
      content: '',
      done: true,
      usage: {
        promptTokens: this.totalInputTokens,
        completionTokens: this.totalOutputTokens,
        totalTokens: this.totalInputTokens + this.totalOutputTokens
      },
      raw: { type: 'message_stop' }
    }
  }

  /**
   * 处理 Claude 错误事件
   */
  private handleClaudeError(data: ClaudeErrorResponse): StreamChunk {
    return {
      content: '',
      done: true,
      error: `${data.error.type}: ${data.error.message}`,
      raw: data
    }
  }

  /**
   * 检查是否为流结束标识
   */
  isStreamEnd(data: string): boolean {
    return data.includes('event: message_stop') || data.includes('event: error')
  }
}

/**
 * 便捷工厂函数
 */
export function createClaudeStreamAdapter(config?: Partial<StreamAdapterConfig>): ClaudeStreamAdapter {
  return new ClaudeStreamAdapter(config)
}