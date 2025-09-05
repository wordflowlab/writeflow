/**
 * WriteFlow 流式 AI 服务
 * 集成新的流式 UI 组件系统
 */

import { WriteFlowAIService, AIRequest, AIResponse } from './WriteFlowAIService.js'
import { getStreamingPipeline, StreamingPipeline, createStreamProcessor } from '../../ui/utils/streamingPipeline.js'
import { getOutputFormatter } from '../../ui/utils/outputFormatter.js'

export interface StreamingAIRequest extends AIRequest {
  streamId?: string
  useNewStreaming?: boolean
  enableRealTimeFormatting?: boolean
  renderDelay?: number
  chunkSize?: number
}

export interface StreamingAIResponse extends AIResponse {
  streamId?: string
  streamingMetrics?: {
    totalChunks: number
    averageChunkSize: number
    formatTime: number
    renderTime: number
  }
}

/**
 * 增强版流式 AI 服务
 * 集成新的流式输出管道和 UI 组件
 */
export class StreamingAIService extends WriteFlowAIService {
  private streamingPipeline: StreamingPipeline
  private activeStreams = new Map<string, any>()

  constructor() {
    super()
    this.streamingPipeline = getStreamingPipeline({
      theme: process.env.WRITEFLOW_THEME === 'light' ? 'light' : 'dark',
      enableColors: process.stdout.isTTY,
      enableDoubleBuffer: true,
      renderDelay: 100,
      bufferTimeout: 500
    })
  }

  /**
   * 处理增强的流式 AI 请求
   */
  async processStreamingRequest(request: StreamingAIRequest): Promise<StreamingAIResponse> {
    // 如果不使用新的流式系统，回退到原版本
    if (!request.useNewStreaming) {
      const response = await super.processStreamingRequest(request)
      return response as StreamingAIResponse
    }

    return this.processNewStreamingRequest(request)
  }

  /**
   * 使用新的流式系统处理请求
   */
  private async processNewStreamingRequest(request: StreamingAIRequest): Promise<StreamingAIResponse> {
    const startTime = Date.now()
    const streamId = request.streamId || `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // 创建流式处理器
      const processor = createStreamProcessor(streamId, {
        theme: 'dark',
        renderDelay: request.renderDelay || 50,
        chunkSize: request.chunkSize || 30,
        enableDoubleBuffer: true,
        onChunk: (chunk) => {
          if (request.enableRealTimeFormatting) {
            this.handleRealtimeFormatting(chunk, streamId)
          }
        },
        onComplete: (buffer) => {
          this.handleStreamComplete(buffer, streamId)
        }
      })

      this.activeStreams.set(streamId, processor)

      // 调用原始的流式处理，但拦截输出
      const response = await this.callStreamingWithInterception(request, processor)

      return {
        ...response,
        streamId,
        streamingMetrics: {
          totalChunks: this.getStreamMetrics(streamId).chunkCount,
          averageChunkSize: this.getStreamMetrics(streamId).averageChunkSize,
          formatTime: this.getStreamMetrics(streamId).formatTime,
          renderTime: Date.now() - startTime
        }
      }

    } catch (error) {
      console.error(`流式 AI 请求失败 [${streamId}]:`, error)
      
      // 清理流
      this.cleanupStream(streamId)
      
      // 回退到非流式处理
      const fallbackResponse = await super.processNonStreamingRequest({ ...request, stream: false })
      return fallbackResponse as StreamingAIResponse
    }
  }

  /**
   * 拦截流式调用并使用新的流式系统
   */
  private async callStreamingWithInterception(
    request: StreamingAIRequest, 
    processor: { addChunk: (chunk: string) => void; complete: () => void }
  ): Promise<AIResponse> {
    
    // 临时劫持 process.stdout.write 来捕获流式输出
    const originalWrite = process.stdout.write.bind(process.stdout)
    let capturedContent = ''
    let chunkCount = 0
    
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      const content = chunk.toString()
      capturedContent += content
      chunkCount++
      
      // 将内容添加到新的流式处理器
      processor.addChunk(content)
      
      // 如果需要，继续输出到真实的控制台
      if (request.enableRealTimeFormatting) {
        // 使用新系统的格式化输出，暂时不输出到控制台
        return true
      } else {
        // 保持原始输出
        return originalWrite(chunk, encoding, callback)
      }
    }

    try {
      // 调用原始的流式处理
      const response = await super.processStreamingRequest(request)
      
      // 完成流处理
      processor.complete()
      
      return {
        ...response,
        content: capturedContent || response.content
      }
      
    } finally {
      // 恢复原始的 stdout.write
      process.stdout.write = originalWrite
    }
  }

  /**
   * 处理实时格式化
   */
  private handleRealtimeFormatting(chunk: any, streamId: string): void {
    try {
      const formatter = getOutputFormatter({
        theme: process.env.WRITEFLOW_THEME === 'light' ? 'light' : 'dark',
        enableColors: process.stdout.isTTY
      })

      // 基于块类型进行不同的格式化
      switch (chunk.type) {
        case 'code':
          // 代码块的实时语法高亮
          this.handleCodeChunk(chunk, formatter)
          break
        case 'markdown':
          // Markdown 的实时渲染
          this.handleMarkdownChunk(chunk, formatter)
          break
        default:
          // 普通文本
          this.handleTextChunk(chunk, formatter)
      }

    } catch (error) {
      console.warn(`实时格式化失败 [${streamId}]:`, error)
    }
  }

  /**
   * 处理代码块
   */
  private handleCodeChunk(chunk: any, formatter: any): void {
    // 使用 StreamingCodeBlock 组件的逻辑
    // 这里暂时简化处理
    const formattedChunk = formatter.formatStreamOutput(chunk.content)
    if (formattedChunk.hasCodeBlocks) {
      process.stdout.write(formattedChunk.content)
    }
  }

  /**
   * 处理 Markdown 块
   */
  private handleMarkdownChunk(chunk: any, formatter: any): void {
    // 使用 StreamingMarkdown 组件的逻辑
    const formattedChunk = formatter.formatStreamOutput(chunk.content)
    process.stdout.write(formattedChunk.content)
  }

  /**
   * 处理文本块
   */
  private handleTextChunk(chunk: any, formatter: any): void {
    // 直接输出文本，保持流式效果
    process.stdout.write(chunk.content)
  }

  /**
   * 处理流完成
   */
  private handleStreamComplete(buffer: any, streamId: string): void {
    try {
      const formatter = getOutputFormatter({
        theme: process.env.WRITEFLOW_THEME === 'light' ? 'light' : 'dark',
        enableColors: process.stdout.isTTY
      })

      // 最终格式化完整内容
      const finalFormatted = formatter.formatStreamOutput(buffer.content)
      
      // 输出完成提示
      if (finalFormatted.hasCodeBlocks) {
        process.stderr.write(`\n${formatter.formatSuccess(`✨ 包含 ${finalFormatted.codeBlockCount} 个代码块的内容已完成渲染`)}\n`)
      }

      // 清理流
      this.cleanupStream(streamId)
      
    } catch (error) {
      console.warn(`流完成处理失败 [${streamId}]:`, error)
    }
  }

  /**
   * 获取流的统计信息
   */
  private getStreamMetrics(streamId: string) {
    const streamStatus = this.streamingPipeline.getStreamStatus(streamId)
    if (!streamStatus) {
      return {
        chunkCount: 0,
        averageChunkSize: 0,
        formatTime: 0
      }
    }

    return {
      chunkCount: Math.ceil(streamStatus.content.length / 30), // 估算块数
      averageChunkSize: 30,
      formatTime: Date.now() - streamStatus.lastUpdate
    }
  }

  /**
   * 清理流资源
   */
  private cleanupStream(streamId: string): void {
    this.activeStreams.delete(streamId)
    this.streamingPipeline.terminateStream(streamId)
  }

  /**
   * 批量处理多个流式请求
   */
  async processMultipleStreams(requests: StreamingAIRequest[]): Promise<StreamingAIResponse[]> {
    const responses: Promise<StreamingAIResponse>[] = []

    for (const request of requests) {
      responses.push(this.processStreamingRequest(request))
    }

    return Promise.all(responses)
  }

  /**
   * 获取活动流的状态
   */
  getActiveStreamStatus(): {
    activeStreams: number
    totalStreams: number
    pipelineStats: any
  } {
    return {
      activeStreams: this.activeStreams.size,
      totalStreams: this.streamingPipeline.getActiveStreams().length,
      pipelineStats: this.streamingPipeline.getStats()
    }
  }

  /**
   * 终止所有活动流
   */
  terminateAllStreams(): void {
    for (const [streamId] of this.activeStreams) {
      this.cleanupStream(streamId)
    }
    this.streamingPipeline.cleanup()
  }

  /**
   * 更新流式处理选项
   */
  updateStreamingOptions(options: {
    theme?: 'light' | 'dark'
    renderDelay?: number
    chunkSize?: number
    enableDoubleBuffer?: boolean
  }): void {
    this.streamingPipeline.updateOptions(options)
  }
}

// 全局增强服务实例
let globalStreamingAIService: StreamingAIService | null = null

/**
 * 获取全局增强流式 AI 服务
 */
export function getStreamingAIService(): StreamingAIService {
  if (!globalStreamingAIService) {
    globalStreamingAIService = new StreamingAIService()
  }
  return globalStreamingAIService
}

/**
 * 快速流式 AI 请求函数
 */
export async function streamAI(
  prompt: string, 
  options?: Partial<StreamingAIRequest>
): Promise<StreamingAIResponse> {
  const service = getStreamingAIService()
  return service.processStreamingRequest({
    prompt,
    stream: true,
    useNewStreaming: true,
    enableRealTimeFormatting: true,
    ...options
  })
}

/**
 * 便捷函数：使用新流式系统的 AI 请求
 */
export async function askAIWithStreaming(
  prompt: string,
  options?: {
    streamId?: string
    renderDelay?: number
    enableRealTimeFormatting?: boolean
    theme?: 'light' | 'dark'
  }
): Promise<string> {
  const response = await streamAI(prompt, options)
  return response.content
}