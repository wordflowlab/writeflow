/**
 * WriteFlow 流式 AI 服务
 * 提供与现有 WriteFlowAIService 兼容的流式服务接口
 */

import EventEmitter from 'events'
import { AIRequest, AIResponse } from '../ai/WriteFlowAIService.js'
import { getStreamingService, StreamingRequest, StreamingResponse } from './StreamingService.js'
import { logError } from '../../utils/log.js'

/**
 * 流式 AI 服务事件
 */
export interface StreamingAIServiceEvents {
  chunk: [StreamingAIChunk]
  complete: [AIResponse]
  error: [Error]
}

/**
 * 流式数据块
 */
export interface StreamingAIChunk {
  content: string
  reasoning?: string
  delta: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens?: number
  }
  cost?: number
  model: string
  done: boolean
}

/**
 * 流式 AI 服务
 * 将流式适配器系统包装成与 WriteFlowAIService 兼容的接口
 */
export class StreamingAIService extends EventEmitter {
  private streamingService = getStreamingService()
  
  constructor() {
    super()
  }
  
  /**
   * 处理流式 AI 请求
   */
  async processStreamingRequest(request: AIRequest): Promise<void> {
    try {
      // 转换请求格式
      const streamingRequest: StreamingRequest = {
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        allowedTools: request.allowedTools,
        enableToolCalls: request.enableToolCalls
      }
      
      // 设置流式服务事件监听
      this.setupStreamingListeners()
      
      // 开始流式处理
      await this.streamingService.startStream(streamingRequest)
      
    } catch (error) {
      logError('流式 AI 请求处理失败', error)
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  }
  
  /**
   * 设置流式服务事件监听
   */
  private setupStreamingListeners(): void {
    let lastContent = ''
    
    this.streamingService.removeAllListeners()
    
    this.streamingService.on('chunk', (response: StreamingResponse) => {
      const delta = response.content.slice(lastContent.length)
      lastContent = response.content
      
      const chunk: StreamingAIChunk = {
        content: response.content,
        reasoning: response.reasoning,
        delta,
        usage: response.usage,
        cost: response.cost,
        model: response.model,
        done: response.done
      }
      
      this.emit('chunk', chunk)
    })
    
    this.streamingService.on('complete', (response: StreamingResponse) => {
      const aiResponse: AIResponse = {
        content: response.content,
        usage: {
          inputTokens: response.usage?.inputTokens || 0,
          outputTokens: response.usage?.outputTokens || 0
        },
        cost: response.cost || 0,
        duration: response.duration || 0,
        model: response.model,
        toolCalls: response.toolCalls,
        hasToolInteraction: response.toolCalls && response.toolCalls.length > 0
      }
      
      this.emit('complete', aiResponse)
      this.cleanup()
    })
    
    this.streamingService.on('error', (error: Error) => {
      this.emit('error', error)
      this.cleanup()
    })
  }
  
  /**
   * 停止流式处理
   */
  stopStreaming(): void {
    this.streamingService.stopStream()
    this.cleanup()
  }
  
  /**
   * 清理资源
   */
  private cleanup(): void {
    this.streamingService.removeAllListeners()
  }
}

// 全局服务实例
let globalStreamingAIService: StreamingAIService | null = null

/**
 * 获取全局流式 AI 服务实例
 */
export function getStreamingAIService(): StreamingAIService {
  if (!globalStreamingAIService) {
    globalStreamingAIService = new StreamingAIService()
  }
  return globalStreamingAIService
}

/**
 * 便捷的流式 AI 请求函数
 */
export async function askAIStream(
  prompt: string, 
  options?: Partial<AIRequest>
): Promise<StreamingAIService> {
  const service = getStreamingAIService()
  
  await service.processStreamingRequest({
    prompt,
    stream: true,
    ...options
  })
  
  return service
}

/**
 * 流式 AI 请求，返回完整响应的 Promise
 */
export async function askAIStreamComplete(
  prompt: string, 
  options?: Partial<AIRequest>
): Promise<AIResponse> {
  const service = getStreamingAIService()
  
  return new Promise<AIResponse>((resolve, reject) => {
    const onComplete = (response: AIResponse) => {
      service.removeListener('complete', onComplete)
      service.removeListener('error', onError)
      resolve(response)
    }
    
    const onError = (error: Error) => {
      service.removeListener('complete', onComplete)
      service.removeListener('error', onError)
      reject(error)
    }
    
    service.on('complete', onComplete)
    service.on('error', onError)
    
    service.processStreamingRequest({
      prompt,
      stream: true,
      ...options
    }).catch(reject)
  })
}