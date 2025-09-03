/**
 * WriteFlow AI 服务
 * 专为写作场景优化的 AI 服务
 */

import { getGlobalConfig, ModelProfile } from '../../utils/config.js'
import { getModelManager } from '../models/ModelManager.js'
import { logError } from '../../utils/log.js'

export interface AIRequest {
  prompt: string
  systemPrompt?: string
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface AIResponse {
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
  }
  cost: number
  duration: number
  model: string
}

/**
 * WriteFlow AI 服务类
 */
export class WriteFlowAIService {
  private modelManager = getModelManager()
  
  /**
   * 处理 AI 请求
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()

    try {
      // 离线/降级模式（本地无网或无 Key 时可用）
      if (process.env.WRITEFLOW_AI_OFFLINE === 'true') {
        const content = `【离线模式】无法访问外部模型，已返回模拟回复。\n\n要点: ${request.prompt.slice(0, 120)}${request.prompt.length > 120 ? '...' : ''}`
        return {
          content,
          usage: { inputTokens: 0, outputTokens: content.length },
          cost: 0,
          duration: Date.now() - startTime,
          model: 'offline-mock'
        }
      }

      // 获取模型配置
      const modelName = request.model || this.modelManager.getMainAgentModel()
      if (!modelName) {
        throw new Error('没有可用的模型配置')
      }

      const modelProfile = this.findModelProfile(modelName)
      if (!modelProfile) {
        throw new Error(`找不到模型配置: ${modelName}`)
      }

      // 根据提供商调用相应的 AI 服务
      let response: AIResponse

      switch (modelProfile.provider) {
        case 'anthropic':
        case 'bigdream':
          response = await this.callAnthropicAPI(modelProfile, request)
          break
        case 'deepseek':
          response = await this.callDeepSeekAPI(modelProfile, request)
          break
        case 'openai':
          response = await this.callOpenAIAPI(modelProfile, request)
          break
        case 'kimi':
          response = await this.callKimiAPI(modelProfile, request)
          break
        default:
          throw new Error(`不支持的提供商: ${modelProfile.provider}`)
      }

      // 计算持续时间
      response.duration = Date.now() - startTime

      return response

    } catch (error) {
      logError('AI 请求处理失败', error)

      const hint = `\n提示: \n- 请检查网络连通性或代理设置\n- 如需离线演示: export WRITEFLOW_AI_OFFLINE=true\n- 或正确设置 API_PROVIDER/AI_MODEL 及对应的 *API_KEY 环境变量\n- 可选 API_BASE_URL 覆盖默认网关`
      return {
        content: `处理请求时发生错误: ${error instanceof Error ? error.message : '未知错误'}${hint}`,
        usage: { inputTokens: 0, outputTokens: 0 },
        cost: 0,
        duration: Date.now() - startTime,
        model: request.model || 'unknown'
      }
    }
  }
  
  /**
   * 调用 Anthropic API
   */
  private async callAnthropicAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile, ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'])
    if (!apiKey) {
      throw new Error('缺少 Anthropic API 密钥')
    }
    
    const url = profile.baseURL || 'https://api.anthropic.com/v1/messages'
    
    const payload = {
      model: profile.modelName,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3,
      messages: [
        {
          role: 'user',
          content: request.prompt
        }
      ],
      ...(request.systemPrompt && { system: request.systemPrompt })
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Anthropic API 错误: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    return {
      content: data.content?.[0]?.text || '无响应内容',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      },
      cost: this.calculateCost(data.usage, profile.provider),
      duration: 0, // 将在外部设置
      model: profile.modelName
    }
  }
  
  /**
   * 调用 DeepSeek API
   */
  private async callDeepSeekAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile, ['DEEPSEEK_API_KEY'])
    if (!apiKey) {
      throw new Error('缺少 DeepSeek API 密钥')
    }
    
    const url = profile.baseURL || 'https://api.deepseek.com/chat/completions'
    
    const messages = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })
    
    const payload = {
      model: profile.modelName,
      messages,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3,
      stream: false
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    return {
      content: data.choices?.[0]?.message?.content || '无响应内容',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      cost: this.calculateCost(data.usage, profile.provider),
      duration: 0,
      model: profile.modelName
    }
  }
  
  /**
   * 调用 OpenAI API
   */
  private async callOpenAIAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile, ['OPENAI_API_KEY'])
    if (!apiKey) {
      throw new Error('缺少 OpenAI API 密钥')
    }
    
    const url = profile.baseURL || 'https://api.openai.com/v1/chat/completions'
    
    const messages = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })
    
    const payload = {
      model: profile.modelName,
      messages,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 错误: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    return {
      content: data.choices?.[0]?.message?.content || '无响应内容',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      cost: this.calculateCost(data.usage, profile.provider),
      duration: 0,
      model: profile.modelName
    }
  }
  
  /**
   * 调用 Kimi API
   */
  private async callKimiAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile, ['KIMI_API_KEY', 'MOONSHOT_API_KEY'])
    if (!apiKey) {
      throw new Error('缺少 Kimi API 密钥')
    }
    
    const url = profile.baseURL || 'https://api.moonshot.cn/v1/chat/completions'
    
    const messages = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })
    
    const payload = {
      model: profile.modelName,
      messages,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Kimi API 错误: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    
    return {
      content: data.choices?.[0]?.message?.content || '无响应内容',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      cost: this.calculateCost(data.usage, profile.provider),
      duration: 0,
      model: profile.modelName
    }
  }
  
  /**
   * 获取 API 密钥
   */
  private getAPIKey(profile: ModelProfile, envKeys: string[]): string | undefined {
    // 优先使用配置中的密钥
    if (profile.apiKey) {
      return profile.apiKey
    }
    
    // 从环境变量获取
    for (const key of envKeys) {
      const value = process.env[key]
      if (value) {
        return value
      }
    }
    
    return undefined
  }
  
  /**
   * 查找模型配置
   */
  private findModelProfile(modelName: string): ModelProfile | null {
    const profiles = this.modelManager.getAllProfiles()
    return profiles.find(p => p.modelName === modelName || p.name === modelName) || null
  }
  
  /**
   * 计算成本
   */
  private calculateCost(usage: any, provider: string): number {
    if (!usage) return 0
    
    // 简化的成本计算
    const inputTokens = usage.prompt_tokens || usage.input_tokens || 0
    const outputTokens = usage.completion_tokens || usage.output_tokens || 0
    
    // 基础费率（实际费率应该从模型配置中获取）
    const rates = {
      anthropic: { input: 0.000003, output: 0.000015 },
      deepseek: { input: 0.00000027, output: 0.0000011 },
      openai: { input: 0.0000025, output: 0.00001 },
      kimi: { input: 0.000001, output: 0.000002 },
      bigdream: { input: 0.000003, output: 0.000015 }
    }
    
    const rate = rates[provider as keyof typeof rates] || { input: 0, output: 0 }
    return inputTokens * rate.input + outputTokens * rate.output
  }
}

// 全局服务实例
let globalAIService: WriteFlowAIService | null = null

/**
 * 获取全局 AI 服务实例
 */
export function getWriteFlowAIService(): WriteFlowAIService {
  if (!globalAIService) {
    globalAIService = new WriteFlowAIService()
  }
  return globalAIService
}

/**
 * 快速 AI 请求函数
 */
export async function askAI(prompt: string, options?: Partial<AIRequest>): Promise<string> {
  const service = getWriteFlowAIService()
  const response = await service.processRequest({
    prompt,
    ...options
  })
  return response.content
}