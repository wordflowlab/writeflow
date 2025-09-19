import { OpenAIStreamAdapter } from './OpenAIStreamAdapter.js'
import { StreamAdapterConfig } from './StreamAdapter.js'
import { StreamChunk } from './StreamAdapter.js'

/**
 * DeepSeek 扩展响应数据结构
 * 基于 OpenAI 格式，但添加了 reasoning_content 字段
 */
interface DeepSeekStreamResponse {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      content?: string
      role?: string
      reasoning_content?: string  // DeepSeek 特有的推理内容
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_cache_hit_tokens?: number    // DeepSeek 缓存命中统计
    prompt_cache_miss_tokens?: number   // DeepSeek 缓存未命中统计
  }
}

/**
 * DeepSeek 流式适配器
 * 
 * 继承自 OpenAIStreamAdapter，添加对 reasoning_content 的支持
 * DeepSeek 使用 OpenAI 兼容的 SSE 格式，但扩展了推理内容字段
 */
export class DeepSeekStreamAdapter extends OpenAIStreamAdapter {
  constructor(config?: Partial<StreamAdapterConfig>) {
    super(config)
  }

  /**
   * 重写解析方法以支持 DeepSeek 特有字段
   */
  parseStream(data: string): StreamChunk[] {
    const chunks: StreamChunk[] = []
    
    // 按行分割处理
    const lines = data.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (!trimmed || trimmed.startsWith(':')) {
        // 跳过空行和注释行
        continue
      }
      
      if (trimmed === 'data: [DONE]') {
        chunks.push({
          content: '',
          done: true,
          raw: trimmed
        })
        continue
      }
      
      if (trimmed.startsWith('data: ')) {
        try {
          const jsonStr = trimmed.substring(6) // 移除 'data: '
          const response: DeepSeekStreamResponse = JSON.parse(jsonStr)
          
          // 提取内容和推理内容
          const choice = response.choices?.[0]
          if (choice) {
            const content = choice.delta?.content || ''
            const reasoning = choice.delta?.reasoning_content || ''
            const isDone = choice.finish_reason !== null
            
            // 构建扩展的使用统计信息
            const usage = response.usage ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
              // DeepSeek 特有的缓存统计
              ...(response.usage.prompt_cache_hit_tokens !== undefined && {
                cacheHitTokens: response.usage.prompt_cache_hit_tokens
              }),
              ...(response.usage.prompt_cache_miss_tokens !== undefined && {
                cacheMissTokens: response.usage.prompt_cache_miss_tokens
              })
            } : undefined

            chunks.push({
              content,
              done: isDone,
              reasoning: reasoning || undefined,  // DeepSeek 推理内容
              raw: response,
              usage
            })
          }
        } catch (_error) {
          // 解析错误，创建错误块
          chunks.push({
            content: '',
            done: false,
            error: `Failed to parse DeepSeek response: ${error}`,
            raw: trimmed
          })
        }
      }
    }
    
    return chunks
  }

  /**
   * 处理 DeepSeek 特定的错误格式
   * 继承自父类但可能有特殊的错误处理逻辑
   */
  protected handleDeepSeekError(data: string): StreamChunk | null {
    try {
      if (data.startsWith('data: ')) {
        const jsonStr = data.substring(6)
        const response = JSON.parse(jsonStr)
        
        // DeepSeek 可能有特殊的错误格式
        if (response.error) {
          return {
            content: '',
            done: true,
            error: `DeepSeek API Error: ${response.error.message || response.error}`,
            raw: response
          }
        }

        // 检查是否为 DeepSeek 特定的错误类型
        if (response.choices && response.choices[0]?.finish_reason === 'insufficient_system_resource') {
          return {
            content: '',
            done: true,
            error: 'DeepSeek system resource insufficient, please try again later',
            raw: response
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
    
    return null
  }

  /**
   * 重写 processData 以处理 DeepSeek 特定逻辑
   */
  public processData(rawData: string): void {
    // 检查 DeepSeek 特定错误响应
    const errorChunk = this.handleDeepSeekError(rawData)
    if (errorChunk) {
      this.emit('chunk', errorChunk)
      return
    }
    
    // 调用父类处理逻辑
    super.processData(rawData)
  }

  /**
   * 获取 DeepSeek 特有的状态信息
   */
  public getDeepSeekStatus(): {
    connected: boolean
    bufferSize: number
    config: StreamAdapterConfig
    supportsCaching: boolean
    supportsReasoning: boolean
  } {
    const baseStatus = this.getStatus()
    return {
      ...baseStatus,
      supportsCaching: true,      // DeepSeek 支持缓存
      supportsReasoning: true     // DeepSeek 支持推理内容
    }
  }
}

/**
 * 便捷工厂函数
 */
export function createDeepSeekStreamAdapter(config?: Partial<StreamAdapterConfig>): DeepSeekStreamAdapter {
  return new DeepSeekStreamAdapter(config)
}