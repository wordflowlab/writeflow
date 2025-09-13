import { debugLog, logError, logWarn, infoLog } from '../../../utils/log.js'

/**

 * 消息管理器 - 采用标准架构的消息分类机制
 * 提供统一的消息处理、分类和展示系统
 */

import { format } from '../../../utils/colorScheme.js'

export enum MessageType {
  // 系统级消息
  SYSTEM_INFO = 'system_info',
  SYSTEM_WARNING = 'system_warning', 
  SYSTEM_ERROR = 'system_error',
  
  // AI处理消息
  AI_THINKING = 'ai_thinking',
  AI_RESPONSE = 'ai_response',
  AI_ERROR = 'ai_error',
  
  // 工具执行消息
  TOOL_START = 'tool_start',
  TOOL_PROGRESS = 'tool_progress',
  TOOL_SUCCESS = 'tool_success',
  TOOL_ERROR = 'tool_error',
  
  // 用户交互消息
  USER_INPUT = 'user_input',
  USER_FEEDBACK = 'user_feedback',
  
  // 调试和诊断消息
  DEBUG = 'debug',
  TRACE = 'trace'
}

export enum MessagePriority {
  CRITICAL = 1,    // 必须显示的关键信息
  HIGH = 2,        // 重要信息
  NORMAL = 3,      // 普通信息
  LOW = 4,         // 详细信息
  DEBUG = 5        // 调试信息
}

export interface Message {
  id: string
  type: MessageType
  priority: MessagePriority
  content: string
  timestamp: number
  metadata?: {
    toolName?: string
    executionId?: string
    duration?: number
    category?: string
    tags?: string[]
  }
  source?: string
}

export interface MessageDisplayOptions {
  showTimestamp?: boolean
  showSource?: boolean
  showPriority?: boolean
  minPriority?: MessagePriority
  maxMessages?: number
  groupByType?: boolean
  enableColors?: boolean
  compactMode?: boolean
}

/**
 * 消息管理器 - 现代流式的分类展示
 */
export class MessageManager {
  private messages: Message[] = []
  private displayOptions: Required<MessageDisplayOptions>
  private messageCounter = 0

  constructor(options: MessageDisplayOptions = {}) {
    this.displayOptions = {
      showTimestamp: options.showTimestamp ?? false,
      showSource: options.showSource ?? false,
      showPriority: options.showPriority ?? false,
      minPriority: options.minPriority ?? MessagePriority.NORMAL,
      maxMessages: options.maxMessages ?? 100,
      groupByType: options.groupByType ?? false,
      enableColors: options.enableColors ?? true,
      compactMode: options.compactMode ?? true
    }
  }

  /**
   * 记录消息
   */
  log(
    type: MessageType,
    content: string,
    priority: MessagePriority = MessagePriority.NORMAL,
    metadata?: Message['metadata'],
    source?: string
  ): string {
    const message: Message = {
      id: `msg_${++this.messageCounter}`,
      type,
      priority,
      content,
      timestamp: Date.now(),
      metadata,
      source
    }

    this.messages.push(message)

    // 限制消息数量
    if (this.messages.length > this.displayOptions.maxMessages) {
      this.messages.shift()
    }

    // 立即显示消息（如果优先级足够）
    if (priority <= this.displayOptions.minPriority) {
      this.displayMessage(message)
    }

    return message.id
  }

  /**
   * 显示消息 - 现代流式的分类展示
   */
  private displayMessage(message: Message): void {
    const formatted = this.formatMessage(message)
    
    // 根据消息类型选择输出方式
    switch (message.type) {
      case MessageType.SYSTEM_ERROR:
      case MessageType.AI_ERROR:
      case MessageType.TOOL_ERROR:
        logError(formatted)
        break
      
      case MessageType.SYSTEM_WARNING:
        logWarn(formatted)
        break
      
      case MessageType.DEBUG:
      case MessageType.TRACE:
        if (process.env.DEBUG) {
          console.debug(formatted)
        }
        break
      
      default:
        debugLog(formatted)
        break
    }
  }

  /**
   * 格式化消息 - 采用现代化的视觉层次
   */
  private formatMessage(message: Message): string {
    const parts: string[] = []

    // 1. 消息图标和类型
    const icon = this.getMessageIcon(message.type)
    const typeLabel = this.getTypeLabel(message.type)

    if (this.displayOptions.enableColors) {
      const coloredIcon = this.colorizeMessageIcon(icon, message.type)
      parts.push(coloredIcon)
      
      if (!this.displayOptions.compactMode) {
        const coloredType = this.colorizeMessageType(typeLabel, message.type)
        parts.push(coloredType)
      }
    } else {
      parts.push(icon)
      if (!this.displayOptions.compactMode) {
        parts.push(typeLabel)
      }
    }

    // 2. 消息内容
    let content = message.content
    if (this.displayOptions.enableColors) {
      content = this.colorizeMessageContent(content, message.type)
    }
    parts.push(content)

    // 3. 元数据信息
    const metadata = this.formatMetadata(message)
    if (metadata) {
      parts.push(metadata)
    }

    // 4. 时间戳
    if (this.displayOptions.showTimestamp) {
      const timestamp = new Date(message.timestamp).toLocaleTimeString()
      const formattedTime = this.displayOptions.enableColors 
        ? format.dim(`(${timestamp})`)
        : `(${timestamp})`
      parts.push(formattedTime)
    }

    return parts.join(' ')
  }

  /**
   * 获取消息图标
   */
  private getMessageIcon(type: MessageType): string {
    const iconMap: Record<MessageType, string> = {
      [MessageType.SYSTEM_INFO]: 'ℹ️',
      [MessageType.SYSTEM_WARNING]: '⚠️',
      [MessageType.SYSTEM_ERROR]: '❌',
      
      [MessageType.AI_THINKING]: '🤔',
      [MessageType.AI_RESPONSE]: '🤖',
      [MessageType.AI_ERROR]: '💥',
      
      [MessageType.TOOL_START]: '🔧',
      [MessageType.TOOL_PROGRESS]: '⚡',
      [MessageType.TOOL_SUCCESS]: '✅',
      [MessageType.TOOL_ERROR]: '❌',
      
      [MessageType.USER_INPUT]: '👤',
      [MessageType.USER_FEEDBACK]: '💬',
      
      [MessageType.DEBUG]: '🐛',
      [MessageType.TRACE]: '🔍'
    }
    
    return iconMap[type] || '📝'
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: MessageType): string {
    const labelMap: Record<MessageType, string> = {
      [MessageType.SYSTEM_INFO]: '[系统]',
      [MessageType.SYSTEM_WARNING]: '[系统警告]',
      [MessageType.SYSTEM_ERROR]: '[系统错误]',
      
      [MessageType.AI_THINKING]: '[AI思考]',
      [MessageType.AI_RESPONSE]: '[AI响应]',
      [MessageType.AI_ERROR]: '[AI错误]',
      
      [MessageType.TOOL_START]: '[工具开始]',
      [MessageType.TOOL_PROGRESS]: '[工具进度]',
      [MessageType.TOOL_SUCCESS]: '[工具成功]',
      [MessageType.TOOL_ERROR]: '[工具错误]',
      
      [MessageType.USER_INPUT]: '[用户输入]',
      [MessageType.USER_FEEDBACK]: '[用户反馈]',
      
      [MessageType.DEBUG]: '[调试]',
      [MessageType.TRACE]: '[跟踪]'
    }
    
    return labelMap[type] || '[消息]'
  }

  /**
   * 为消息图标着色
   */
  private colorizeMessageIcon(icon: string, type: MessageType): string {
    switch (type) {
      case MessageType.SYSTEM_ERROR:
      case MessageType.AI_ERROR:
      case MessageType.TOOL_ERROR:
        return format.error(icon)
      
      case MessageType.SYSTEM_WARNING:
        return format.warning(icon)
      
      case MessageType.TOOL_SUCCESS:
        return format.success(icon)
      
      case MessageType.AI_THINKING:
      case MessageType.AI_RESPONSE:
        return format.info(icon)
      
      case MessageType.DEBUG:
      case MessageType.TRACE:
        return format.dim(icon)
      
      default:
        return icon
    }
  }

  /**
   * 为消息类型着色
   */
  private colorizeMessageType(typeLabel: string, type: MessageType): string {
    switch (type) {
      case MessageType.SYSTEM_ERROR:
      case MessageType.AI_ERROR:
      case MessageType.TOOL_ERROR:
        return format.error(typeLabel)
      
      case MessageType.SYSTEM_WARNING:
        return format.warning(typeLabel)
      
      case MessageType.TOOL_SUCCESS:
        return format.success(typeLabel)
      
      case MessageType.DEBUG:
      case MessageType.TRACE:
        return format.dim(typeLabel)
      
      default:
        return format.dim(typeLabel)
    }
  }

  /**
   * 为消息内容着色
   */
  private colorizeMessageContent(content: string, type: MessageType): string {
    switch (type) {
      case MessageType.SYSTEM_ERROR:
      case MessageType.AI_ERROR:
      case MessageType.TOOL_ERROR:
        return format.error(content)
      
      case MessageType.SYSTEM_WARNING:
        return format.warning(content)
      
      case MessageType.TOOL_SUCCESS:
        return format.success(content)
      
      case MessageType.DEBUG:
      case MessageType.TRACE:
        return format.dim(content)
      
      default:
        return content
    }
  }

  /**
   * 格式化元数据
   */
  private formatMetadata(message: Message): string | null {
    if (!message.metadata) return null

    const parts: string[] = []

    if (message.metadata.toolName) {
      parts.push(`工具:${message.metadata.toolName}`)
    }

    if (message.metadata.duration !== undefined) {
      parts.push(`耗时:${message.metadata.duration}ms`)
    }

    if (message.metadata.category) {
      parts.push(`分类:${message.metadata.category}`)
    }

    if (parts.length === 0) return null

    const metadataText = parts.join(' ')
    return this.displayOptions.enableColors 
      ? format.dim(`(${metadataText})`)
      : `(${metadataText})`
  }

  /**
   * 批量显示消息摘要
   */
  displaySummary(): void {
    const summary = this.generateMessageSummary()
    debugLog('\n' + (this.displayOptions.enableColors 
      ? format.title('📊 消息摘要', 2)
      : '📊 消息摘要'))
    debugLog(summary)
  }

  /**
   * 生成消息摘要
   */
  private generateMessageSummary(): string {
    const typeCounts = new Map<MessageType, number>()
    const priorityCounts = new Map<MessagePriority, number>()

    this.messages.forEach(msg => {
      typeCounts.set(msg.type, (typeCounts.get(msg.type) || 0) + 1)
      priorityCounts.set(msg.priority, (priorityCounts.get(msg.priority) || 0) + 1)
    })

    const lines: string[] = []
    
    // 按类型统计
    lines.push('按类型分布:')
    for (const [type, count] of typeCounts.entries()) {
      const icon = this.getMessageIcon(type)
      const label = this.getTypeLabel(type)
      lines.push(`  ${icon} ${label}: ${count}`)
    }

    lines.push('')

    // 按优先级统计
    lines.push('按优先级分布:')
    for (const [priority, count] of priorityCounts.entries()) {
      const label = this.getPriorityLabel(priority)
      lines.push(`  ${label}: ${count}`)
    }

    return lines.join('\n')
  }

  /**
   * 获取优先级标签
   */
  private getPriorityLabel(priority: MessagePriority): string {
    const labelMap: Record<MessagePriority, string> = {
      [MessagePriority.CRITICAL]: '🚨 关键',
      [MessagePriority.HIGH]: '🔥 重要',
      [MessagePriority.NORMAL]: '📝 普通',
      [MessagePriority.LOW]: '💭 详细',
      [MessagePriority.DEBUG]: '🐛 调试'
    }
    
    return labelMap[priority] || '未知'
  }

  /**
   * 清理消息历史
   */
  clear(): void {
    this.messages = []
  }

  /**
   * 获取消息列表
   */
  getMessages(filter?: {
    type?: MessageType
    priority?: MessagePriority
    since?: number
    limit?: number
  }): Message[] {
    let filtered = [...this.messages]

    if (filter?.type) {
      filtered = filtered.filter(msg => msg.type === filter.type)
    }

    if (filter?.priority !== undefined) {
      filtered = filtered.filter(msg => msg.priority <= filter.priority!)
    }

    if (filter?.since !== undefined) {
      filtered = filtered.filter(msg => msg.timestamp >= filter.since!)
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit)
    }

    return filtered
  }

  /**
   * 更新显示选项
   */
  updateDisplayOptions(options: Partial<MessageDisplayOptions>): void {
    Object.assign(this.displayOptions, options)
  }
}

// 便捷的消息记录函数
export class MessageLogger {
  constructor(private messageManager: MessageManager) {}

  // 系统消息
  systemInfo(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.SYSTEM_INFO, message, MessagePriority.NORMAL, metadata, 'system')
  }

  systemWarning(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.SYSTEM_WARNING, message, MessagePriority.HIGH, metadata, 'system')
  }

  systemError(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.SYSTEM_ERROR, message, MessagePriority.CRITICAL, metadata, 'system')
  }

  // AI消息
  aiThinking(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.AI_THINKING, message, MessagePriority.LOW, metadata, 'ai')
  }

  aiResponse(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.AI_RESPONSE, message, MessagePriority.HIGH, metadata, 'ai')
  }

  aiError(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.AI_ERROR, message, MessagePriority.CRITICAL, metadata, 'ai')
  }

  // 工具消息
  toolStart(message: string, toolName: string, executionId?: string): string {
    return this.messageManager.log(
      MessageType.TOOL_START, 
      message, 
      MessagePriority.NORMAL, 
      { toolName, executionId, category: 'execution' }, 
      'tool'
    )
  }

  toolProgress(message: string, toolName: string, executionId?: string): string {
    return this.messageManager.log(
      MessageType.TOOL_PROGRESS, 
      message, 
      MessagePriority.LOW, 
      { toolName, executionId, category: 'execution' }, 
      'tool'
    )
  }

  toolSuccess(message: string, toolName: string, duration?: number, executionId?: string): string {
    return this.messageManager.log(
      MessageType.TOOL_SUCCESS, 
      message, 
      MessagePriority.NORMAL, 
      { toolName, duration, executionId, category: 'result' }, 
      'tool'
    )
  }

  toolError(message: string, toolName: string, executionId?: string): string {
    return this.messageManager.log(
      MessageType.TOOL_ERROR, 
      message, 
      MessagePriority.HIGH, 
      { toolName, executionId, category: 'error' }, 
      'tool'
    )
  }

  // 调试消息
  debug(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.DEBUG, message, MessagePriority.DEBUG, metadata, 'debug')
  }

  trace(message: string, metadata?: Message['metadata']): string {
    return this.messageManager.log(MessageType.TRACE, message, MessagePriority.DEBUG, metadata, 'trace')
  }
}

// 全局实例
let globalMessageManager: MessageManager | null = null
let globalMessageLogger: MessageLogger | null = null

/**
 * 获取全局消息管理器实例
 */
export function getMessageManager(): MessageManager {
  if (!globalMessageManager) {
    globalMessageManager = new MessageManager({
      enableColors: true,
      compactMode: true,
      minPriority: MessagePriority.NORMAL
    })
  }
  return globalMessageManager
}

/**
 * 获取全局消息记录器实例
 */
export function getMessageLogger(): MessageLogger {
  if (!globalMessageLogger) {
    globalMessageLogger = new MessageLogger(getMessageManager())
  }
  return globalMessageLogger
}