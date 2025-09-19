import { StreamAdapter, StreamChunk, StreamAdapterConfig } from './StreamAdapter.js'

/**
 * 通用 OpenAI 兼容响应数据结构
 */
interface OpenAICompatibleResponse {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      content?: string
      role?: string
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

/**
 * 提供商特定配置
 */
export interface ProviderConfig {
  name: string
  baseURL?: string
  headers?: Record<string, string>
  errorField?: string
  customParser?: (data: string) => StreamChunk[]
}

/**
 * 通用 OpenAI 兼容流式适配器
 * 
 * 支持所有使用 OpenAI 兼容 API 格式的提供商:
 * - OpenAI
 * - 智谱 AI (GLM)
 * - Kimi/Moonshot
 * - Qwen/通义千问
 * - 其他 OpenAI 兼容服务
 * 
 * 流式格式:
 * - data: {"choices": [{"delta": {"content": "文本"}}]}
 * - data: [DONE]
 */
export class UniversalOpenAIAdapter extends StreamAdapter {
  private providerConfig: ProviderConfig

  constructor(config?: Partial<StreamAdapterConfig>, providerConfig?: ProviderConfig) {
    super(config)
    this.providerConfig = providerConfig || {
      name: 'openai',
      errorField: 'error'
    }
  }

  /**
   * 解析通用 OpenAI 兼容流式数据
   */
  parseStream(data: string): StreamChunk[] {
    // 如果有自定义解析器，使用自定义解析器
    if (this.providerConfig.customParser) {
      return this.providerConfig.customParser(data)
    }

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
          const response: OpenAICompatibleResponse = JSON.parse(jsonStr)
          
          // 提取内容
          const choice = response.choices?.[0]
          if (choice) {
            const content = choice.delta?.content || ''
            const isDone = choice.finish_reason !== null
            
            chunks.push({
              content,
              done: isDone,
              raw: response,
              usage: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
              } : undefined
            })
          }
        } catch (_error) {
          // 解析错误，创建错误块
          chunks.push({
            content: '',
            done: false,
            error: `Failed to parse ${this.providerConfig.name} response: ${error}`,
            raw: trimmed
          })
        }
      }
    }
    
    return chunks
  }

  /**
   * 检查是否为流结束标识
   */
  isStreamEnd(data: string): boolean {
    return data.trim() === 'data: [DONE]'
  }

  /**
   * 处理通用错误格式
   */
  private parseError(data: string): StreamChunk | null {
    try {
      if (data.startsWith('data: ')) {
        const jsonStr = data.substring(6)
        const response = JSON.parse(jsonStr)
        
        const errorField = this.providerConfig.errorField || 'error'
        if (response[errorField]) {
          const errorMessage = response[errorField].message || 
                              response[errorField] || 
                              `${this.providerConfig.name} API Error`
          
          return {
            content: '',
            done: true,
            error: errorMessage,
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
   * 重写 processData 以处理提供商特定逻辑
   */
  public processData(rawData: string): void {
    // 检查错误响应
    const errorChunk = this.parseError(rawData)
    if (errorChunk) {
      this.emit('chunk', errorChunk)
      return
    }
    
    // 调用父类处理逻辑
    super.processData(rawData)
  }

  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return this.providerConfig.name
  }

  /**
   * 设置提供商配置
   */
  setProviderConfig(config: ProviderConfig): void {
    this.providerConfig = config
  }
}

/**
 * 预定义的提供商配置
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    name: 'openai',
    baseURL: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey}'
    },
    errorField: 'error'
  },
  
  zhipu: {
    name: 'zhipu',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey}'
    },
    errorField: 'error'
  },
  
  kimi: {
    name: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey}'
    },
    errorField: 'error'
  },
  
  qwen: {
    name: 'qwen',
    baseURL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey}',
      'X-DashScope-SSE': 'enable'
    },
    errorField: 'error'
  },
  
  custom: {
    name: 'custom',
    baseURL: '', // 由环境变量或配置文件确定
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey}'
    },
    errorField: 'error'
  },
  
  'custom-openai': {
    name: 'custom-openai',
    baseURL: '', // 由环境变量或配置文件确定
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${apiKey}'
    },
    errorField: 'error'
  }
}

/**
 * 便捷工厂函数
 */
export function createUniversalOpenAIAdapter(
  providerName: keyof typeof PROVIDER_CONFIGS,
  config?: Partial<StreamAdapterConfig>
): UniversalOpenAIAdapter {
  const providerConfig = PROVIDER_CONFIGS[providerName]
  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${providerName}`)
  }
  
  return new UniversalOpenAIAdapter(config, providerConfig)
}

/**
 * 为特定提供商创建适配器的便捷函数
 */
export function createZhipuAdapter(config?: Partial<StreamAdapterConfig>): UniversalOpenAIAdapter {
  return createUniversalOpenAIAdapter('zhipu', config)
}

export function createKimiAdapter(config?: Partial<StreamAdapterConfig>): UniversalOpenAIAdapter {
  return createUniversalOpenAIAdapter('kimi', config)
}

export function createQwenAdapter(config?: Partial<StreamAdapterConfig>): UniversalOpenAIAdapter {
  return createUniversalOpenAIAdapter('qwen', config)
}

export function createCustomAdapter(config?: Partial<StreamAdapterConfig>): UniversalOpenAIAdapter {
  return createUniversalOpenAIAdapter('custom', config)
}

export function createCustomOpenAIAdapter(config?: Partial<StreamAdapterConfig>): UniversalOpenAIAdapter {
  return createUniversalOpenAIAdapter('custom-openai', config)
}