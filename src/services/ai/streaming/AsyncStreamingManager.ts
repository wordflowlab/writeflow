/**
 * 异步流式管理器 - 采用 AsyncGenerator 流式架构模式
 * 将传统 SSE 流重构为结构化的消息流处理系统
 */

import { getMessageLogger } from '../messaging/MessageManager.js'
import { getProgressManager } from '../tools/ProgressManager.js'

/**
 * 流式消息类型定义 - 采用标准的消息分类
 */
export type StreamMessage = 
  | AIResponseMessage 
  | ToolExecutionMessage 
  | ProgressMessage 
  | ErrorMessage 
  | SystemMessage

export interface AIResponseMessage {
  type: 'ai_response'
  content: string
  delta?: string
  isComplete?: boolean
  metadata?: {
    model?: string
    tokensUsed?: number
    duration?: number
  }
}

export interface ToolExecutionMessage {
  type: 'tool_execution'
  toolName: string
  executionId: string
  status: 'starting' | 'running' | 'completed' | 'failed'
  progress?: number
  currentStep?: string
  result?: any
  error?: string
}

export interface ProgressMessage {
  type: 'progress'
  stage: string
  message: string
  progress?: number
  details?: any
}

export interface ErrorMessage {
  type: 'error'
  message: string
  error?: Error
  context?: any
}

export interface SystemMessage {
  type: 'system'
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: number
}

/**
 * 流式处理配置
 */
export interface StreamingOptions {
  enableProgress?: boolean
  enableToolExecution?: boolean
  enableFormatting?: boolean
  enableInterruption?: boolean
  maxRetries?: number
  timeout?: number
}

/**
 * 异步流式管理器 - 现代化的消息流处理
 */
export class AsyncStreamingManager {
  private messageLogger = getMessageLogger()
  private progressManager = getProgressManager()
  private activeStreams = new Map<string, AbortController>()

  /**
   * 主要的流式处理函数 - 返回 AsyncGenerator
   * 这是 AsyncGenerator 架构的核心：每个消息都通过 yield 逐步发送
   */
  async* processStreamingRequest(
    request: any,
    options: StreamingOptions = {}
  ): AsyncGenerator<StreamMessage, void, unknown> {
    const streamId = this.generateStreamId()
    const abortController = new AbortController()
    this.activeStreams.set(streamId, abortController)

    try {
      yield {
        type: 'system',
        level: 'info',
        message: '开始处理AI请求',
        timestamp: Date.now()
      } as SystemMessage

      // 模拟分阶段处理 - 采用渐进式流式处理
      yield* this.processAIResponse(request, streamId, abortController, options)

      // 如果有工具调用，处理工具执行
      if (options.enableToolExecution) {
        yield* this.processToolExecutions(request, streamId, abortController, options)
      }

      yield {
        type: 'system',
        level: 'info', 
        message: 'AI请求处理完成',
        timestamp: Date.now()
      } as SystemMessage

    } catch (_error) {
      yield {
        type: '_error',
        message: `流式处理错误: ${error instanceof Error ? error.message : String(error)}`,
        error: error as Error,
        context: { streamId, request }
      } as ErrorMessage
    } finally {
      this.activeStreams.delete(streamId)
    }
  }

  /**
   * AI响应处理 - 逐块发送格式化内容
   */
  private async* processAIResponse(
    request: any,
    streamId: string,
    abortController: AbortController,
    options: StreamingOptions
  ): AsyncGenerator<StreamMessage, void, unknown> {
    const startTime = Date.now()

    yield {
      type: 'progress',
      stage: 'ai_processing',
      message: '正在生成AI响应...',
      progress: 0
    } as ProgressMessage

    // 模拟AI响应的分块接收 - 实际实现需要连接到真实的AI服务
    const mockResponseChunks = [
      '## 分析结果\n\n',
      '根据您的需求，我建议采用以下方案：\n\n',
      '### 第一步：环境准备\n',
      '```bash\n',
      'npm install --save-dev typescript\n',
      '```\n\n',
      '### 第二步：配置文件\n',
      '创建 `tsconfig.json` 文件...\n\n'
    ]

    let fullContent = ''
    for (let i = 0; i < mockResponseChunks.length; i++) {
      if (abortController.signal.aborted) {
        break
      }

      const chunk = mockResponseChunks[i]
      fullContent += chunk

      yield {
        type: 'ai_response',
        content: fullContent,
        delta: chunk,
        isComplete: i === mockResponseChunks.length - 1,
        metadata: {
          model: 'deepseek',
          tokensUsed: Math.ceil(fullContent.length / 4)
        }
      } as AIResponseMessage

      yield {
        type: 'progress',
        stage: 'ai_processing',
        message: `AI响应生成中... (${i + 1}/${mockResponseChunks.length})`,
        progress: ((i + 1) / mockResponseChunks.length) * 100
      } as ProgressMessage

      // 模拟流式延迟
      await this.delay(100)
    }

    const duration = Date.now() - startTime
    yield {
      type: 'ai_response',
      content: fullContent,
      isComplete: true,
      metadata: {
        model: 'deepseek',
        tokensUsed: Math.ceil(fullContent.length / 4),
        duration
      }
    } as AIResponseMessage
  }

  /**
   * 工具执行处理 - 展示工具执行过程
   */
  private async* processToolExecutions(
    request: any,
    streamId: string,
    abortController: AbortController,
    options: StreamingOptions
  ): AsyncGenerator<StreamMessage, void, unknown> {
    // 模拟工具执行 - 实际应该来自 ToolOrchestrator
    const mockTools = [
      { name: 'Read', file: 'package.json' },
      { name: 'Edit', changes: 3 }
    ]

    for (const tool of mockTools) {
      if (abortController.signal.aborted) {
        break
      }

      const executionId = this.generateExecutionId()

      yield {
        type: 'tool_execution',
        toolName: tool.name,
        executionId,
        status: 'starting',
        currentStep: `准备执行 ${tool.name} 工具`
      } as ToolExecutionMessage

      yield {
        type: 'tool_execution',
        toolName: tool.name,
        executionId,
        status: 'running',
        progress: 50,
        currentStep: `${tool.name} 执行中...`
      } as ToolExecutionMessage

      // 模拟工具执行时间
      await this.delay(500)

      yield {
        type: 'tool_execution',
        toolName: tool.name,
        executionId,
        status: 'completed',
        progress: 100,
        result: `${tool.name} 执行成功`,
        currentStep: `${tool.name} 已完成`
      } as ToolExecutionMessage
    }
  }

  /**
   * 中断流式处理
   */
  stopStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId)
    if (controller) {
      controller.abort()
      this.activeStreams.delete(streamId)
      
      this.messageLogger.systemInfo(
        `流式处理已中断: ${streamId}`,
        { category: 'user_interrupt' }
      )
    }
  }

  /**
   * 获取活跃的流
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys())
  }

  /**
   * 生成流ID
   */
  private generateStreamId(): string {
    return `async_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 全局实例
let globalAsyncStreamingManager: AsyncStreamingManager | null = null

/**
 * 获取全局异步流式管理器实例
 */
export function getAsyncStreamingManager(): AsyncStreamingManager {
  if (!globalAsyncStreamingManager) {
    globalAsyncStreamingManager = new AsyncStreamingManager()
  }
  return globalAsyncStreamingManager
}

/**
 * 便捷函数：开始异步流式处理
 */
export async function* startAsyncStreaming(
  request: any,
  options?: StreamingOptions
): AsyncGenerator<StreamMessage, void, unknown> {
  yield* getAsyncStreamingManager().processStreamingRequest(request, options)
}