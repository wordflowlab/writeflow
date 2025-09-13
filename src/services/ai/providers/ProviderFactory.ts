/**
 * AI 提供商工厂 - 简化版本
 * 统一管理和创建所有 AI 提供商实例
 */

export type ProviderName = 
  | 'anthropic' 
  | 'bigdream' 
  | 'deepseek' 
  | 'openai' 
  | 'kimi' 
  | 'qwen' 
  | 'glm'
  | 'custom'
  | 'custom-openai'

/**
 * 简化的提供商接口
 */
export interface AIProvider {
  getProviderName(): string
  processRequest(request: any, profile: any): Promise<any>
  processStreamingRequest(request: any, profile: any): Promise<any>
}

// 导入真实的提供商实现
import { createDeepSeekProvider } from './DeepSeekProvider.js'
import { createAnthropicProvider } from './AnthropicProvider.js'
import { createOpenAIProvider } from './OpenAIProvider.js'

/**
 * 简化的提供商实现 (用于暂未实现的提供商)
 */
class SimpleProvider implements AIProvider {
  constructor(private name: string) {}
  
  getProviderName(): string {
    return this.name
  }
  
  async processRequest(request: any, profile: any): Promise<any> {
    throw new Error(`提供商 ${this.name} 暂未实现`)
  }
  
  async processStreamingRequest(request: any, profile: any): Promise<any> {
    throw new Error(`提供商 ${this.name} 暂未实现`)
  }
}

/**
 * 提供商实例缓存
 */
const providerInstances = new Map<ProviderName, AIProvider>()

/**
 * 根据提供商名称创建提供商实例
 */
export function createProvider(providerName: ProviderName): AIProvider {
  // 检查缓存
  const cached = providerInstances.get(providerName)
  if (cached) {
    return cached
  }

  let provider: AIProvider

  // 创建对应的提供商实例
  switch (providerName) {
    case 'deepseek':
      provider = createDeepSeekProvider()
      break
    case 'anthropic':
      provider = createAnthropicProvider()
      break
    case 'openai':
      provider = createOpenAIProvider()
      break
    case 'kimi':
    case 'qwen':
    case 'glm':
    case 'custom':
    case 'custom-openai':
      // 这些提供商使用 OpenAI 兼容协议，复用 OpenAI 提供商
      provider = createOpenAIProvider()
      break
    case 'bigdream':
    default:
      // 暂未实现的提供商使用 SimpleProvider
      provider = new SimpleProvider(providerName)
      break
  }
  
  // 缓存实例
  providerInstances.set(providerName, provider)
  return provider
}

/**
 * 根据模型名称推断提供商
 */
export function inferProviderFromModel(modelName: string): ProviderName {
  const lowerModel = modelName.toLowerCase()

  // 优先检查 custom 提供商（避免被其他关键词覆盖）
  if (lowerModel.includes('custom')) {
    // 区分 custom 和 custom-openai
    if (lowerModel.includes('openai')) {
      return 'custom-openai'
    }
    return 'custom'
  }

  if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
    return 'anthropic'
  } else if (lowerModel.includes('deepseek')) {
    return 'deepseek'
  } else if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
    return 'openai'
  } else if (lowerModel.includes('moonshot') || lowerModel.includes('kimi')) {
    return 'kimi'
  } else if (lowerModel.includes('qwen')) {
    return 'qwen'
  } else if (lowerModel.includes('glm')) {
    return 'glm'
  }

  // 根据环境变量推断
  const envProvider = process.env.API_PROVIDER as ProviderName
  if (envProvider && isValidProviderName(envProvider)) {
    return envProvider
  }

  // 检查是否配置了自定义提供商环境变量
  if (process.env.CUSTOM_BASE_URL || process.env.CUSTOM_API_KEY) {
    return 'custom'
  }

  // 默认返回 deepseek
  return 'deepseek'
}

/**
 * 检查是否为有效的提供商名称
 */
function isValidProviderName(name: string): name is ProviderName {
  return ['anthropic', 'bigdream', 'deepseek', 'openai', 'kimi', 'qwen', 'glm', 'custom', 'custom-openai'].includes(name)
}

/**
 * 获取所有支持的提供商名称
 */
export function getSupportedProviders(): ProviderName[] {
  return ['anthropic', 'bigdream', 'deepseek', 'openai', 'kimi', 'qwen', 'glm', 'custom', 'custom-openai']
}

/**
 * 清除提供商实例缓存
 */
export function clearProviderCache(): void {
  providerInstances.clear()
}