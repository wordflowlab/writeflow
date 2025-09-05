import { 
  StreamAdapter, 
  StreamAdapterConfig, 
  ProviderType, 
  AdapterFactory 
} from './StreamAdapter.js'
import { OpenAIStreamAdapter } from './OpenAIStreamAdapter.js'
import { ClaudeStreamAdapter } from './ClaudeStreamAdapter.js'
import { DeepSeekStreamAdapter } from './DeepSeekStreamAdapter.js'
import { GeminiStreamAdapter } from './GeminiStreamAdapter.js'
import { ZhipuStreamAdapter } from './ZhipuStreamAdapter.js'
import { 
  UniversalOpenAIAdapter, 
  createZhipuAdapter, 
  createKimiAdapter, 
  createQwenAdapter 
} from './UniversalOpenAIAdapter.js'

/**
 * 流式适配器工厂
 * 
 * 根据提供商类型创建相应的流式适配器实例
 * 支持自动检测和手动指定提供商类型
 */
export class StreamAdapterFactory implements AdapterFactory {
  
  /**
   * 创建流式适配器
   * 
   * @param provider 提供商类型
   * @param config 适配器配置
   * @returns 对应的流式适配器实例
   */
  create(provider: ProviderType, config?: Partial<StreamAdapterConfig>): StreamAdapter {
    switch (provider) {
      case ProviderType.OPENAI:
        return new OpenAIStreamAdapter(config)
        
      case ProviderType.ANTHROPIC:
        return new ClaudeStreamAdapter(config)
        
      case ProviderType.DEEPSEEK:
        return new DeepSeekStreamAdapter(config)
        
      case ProviderType.GEMINI:
        return new GeminiStreamAdapter(config)
        
      case ProviderType.ZHIPU:
        return new ZhipuStreamAdapter(config)
        
      case ProviderType.KIMI:
        return createKimiAdapter(config)
        
      case ProviderType.QWEN:
        return createQwenAdapter(config)
        
      default:
        throw new Error(`Unsupported provider type: ${provider}`)
    }
  }

  /**
   * 根据模型名称自动检测提供商类型
   * 
   * @param modelName 模型名称
   * @returns 检测到的提供商类型
   */
  static detectProvider(modelName: string): ProviderType {
    const model = modelName.toLowerCase()
    
    // OpenAI 模型检测
    if (model.includes('gpt') || 
        model.includes('o1') || 
        model.includes('davinci') ||
        model.includes('curie') ||
        model.includes('ada') ||
        model.includes('babbage')) {
      return ProviderType.OPENAI
    }
    
    // Anthropic Claude 模型检测
    if (model.includes('claude')) {
      return ProviderType.ANTHROPIC
    }
    
    // DeepSeek 模型检测
    if (model.includes('deepseek')) {
      return ProviderType.DEEPSEEK
    }
    
    // Gemini 模型检测
    if (model.includes('gemini') ||
        model.includes('bard') ||
        model.includes('palm')) {
      return ProviderType.GEMINI
    }
    
    // 智谱 AI (GLM) 模型检测
    if (model.includes('glm') ||
        model.includes('charglm') ||
        model.includes('zhipu')) {
      return ProviderType.ZHIPU
    }
    
    // Kimi/Moonshot 模型检测
    if (model.includes('moonshot') ||
        model.includes('kimi')) {
      return ProviderType.KIMI
    }
    
    // Qwen 模型检测
    if (model.includes('qwen') ||
        model.includes('qwen2') ||
        model.includes('qwen-turbo') ||
        model.includes('qwen-plus') ||
        model.includes('qwen-max')) {
      return ProviderType.QWEN
    }
    
    // 默认返回 OpenAI （因为很多兼容 OpenAI 格式）
    return ProviderType.OPENAI
  }

  /**
   * 根据模型名称自动创建适配器
   * 
   * @param modelName 模型名称
   * @param config 适配器配置
   * @returns 对应的流式适配器实例
   */
  static createFromModel(modelName: string, config?: Partial<StreamAdapterConfig>): StreamAdapter {
    const factory = new StreamAdapterFactory()
    const provider = StreamAdapterFactory.detectProvider(modelName)
    return factory.create(provider, config)
  }

  /**
   * 根据 API 响应内容检测提供商
   * 
   * @param responseData 响应数据样本
   * @returns 检测到的提供商类型
   */
  static detectProviderFromResponse(responseData: string): ProviderType {
    const data = responseData.toLowerCase()
    
    // Anthropic Claude 特征检测
    if (data.includes('event: content_block_delta') ||
        data.includes('event: message_start') ||
        data.includes('event: message_stop')) {
      return ProviderType.ANTHROPIC
    }
    
    // DeepSeek 特征检测 (包含 reasoning_content)
    if (data.includes('reasoning_content') ||
        data.includes('prompt_cache_hit_tokens')) {
      return ProviderType.DEEPSEEK
    }
    
    // Gemini 特征检测
    if (data.includes('candidates') &&
        data.includes('usageMetadata') &&
        !data.includes('data: ')) {
      return ProviderType.GEMINI
    }
    
    // OpenAI 特征检测 (默认)
    if (data.includes('data: ') &&
        (data.includes('choices') || data.includes('[DONE]'))) {
      return ProviderType.OPENAI
    }
    
    // 如果无法检测，默认 OpenAI
    return ProviderType.OPENAI
  }

  /**
   * 获取支持的提供商列表
   * 
   * @returns 支持的提供商类型数组
   */
  static getSupportedProviders(): ProviderType[] {
    return [
      ProviderType.OPENAI,
      ProviderType.ANTHROPIC,
      ProviderType.DEEPSEEK,
      ProviderType.GEMINI,
      ProviderType.ZHIPU,
      ProviderType.KIMI,
      ProviderType.QWEN
    ]
  }

  /**
   * 获取提供商的默认配置
   * 
   * @param provider 提供商类型
   * @returns 默认配置
   */
  static getDefaultConfig(provider: ProviderType): Partial<StreamAdapterConfig> {
    const baseConfig: Partial<StreamAdapterConfig> = {
      bufferSize: 8192,
      reconnectAttempts: 3,
      timeout: 30000
    }

    switch (provider) {
      case ProviderType.OPENAI:
        return {
          ...baseConfig,
          parseStrategy: 'incremental'
        }
        
      case ProviderType.ANTHROPIC:
        return {
          ...baseConfig,
          parseStrategy: 'incremental',
          bufferSize: 4096  // Claude 事件较小
        }
        
      case ProviderType.DEEPSEEK:
        return {
          ...baseConfig,
          parseStrategy: 'incremental',
          bufferSize: 16384  // 支持更大的推理内容
        }
        
      case ProviderType.GEMINI:
        return {
          ...baseConfig,
          parseStrategy: 'buffered',  // Gemini 可能发送大块JSON
          bufferSize: 32768,
          timeout: 60000  // Gemini 可能需要更长时间
        }
        
      case ProviderType.ZHIPU:
        return {
          ...baseConfig,
          parseStrategy: 'incremental'
        }
        
      case ProviderType.KIMI:
        return {
          ...baseConfig,
          parseStrategy: 'incremental'
        }
        
      case ProviderType.QWEN:
        return {
          ...baseConfig,
          parseStrategy: 'incremental'
        }
        
      default:
        return baseConfig
    }
  }

  /**
   * 验证提供商和模型的兼容性
   * 
   * @param provider 提供商类型
   * @param modelName 模型名称
   * @returns 是否兼容
   */
  static validateCompatibility(provider: ProviderType, modelName: string): boolean {
    const detectedProvider = StreamAdapterFactory.detectProvider(modelName)
    return provider === detectedProvider
  }
}

/**
 * 全局工厂实例（单例）
 */
export const streamAdapterFactory = new StreamAdapterFactory()

/**
 * 便捷函数：创建流式适配器
 */
export function createStreamAdapter(
  provider: ProviderType, 
  config?: Partial<StreamAdapterConfig>
): StreamAdapter {
  return streamAdapterFactory.create(provider, config)
}

/**
 * 便捷函数：从模型名称创建流式适配器
 */
export function createStreamAdapterFromModel(
  modelName: string, 
  config?: Partial<StreamAdapterConfig>
): StreamAdapter {
  return StreamAdapterFactory.createFromModel(modelName, config)
}

/**
 * 便捷函数：自动检测并创建适配器
 */
export function createAutoStreamAdapter(
  modelNameOrResponse: string,
  config?: Partial<StreamAdapterConfig>
): StreamAdapter {
  // 尝试作为模型名称检测
  let provider = StreamAdapterFactory.detectProvider(modelNameOrResponse)
  
  // 如果检测结果是默认值，尝试作为响应内容检测
  if (provider === ProviderType.OPENAI && modelNameOrResponse.includes('{')) {
    provider = StreamAdapterFactory.detectProviderFromResponse(modelNameOrResponse)
  }
  
  return streamAdapterFactory.create(provider, config)
}