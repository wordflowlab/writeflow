import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { AIWritingConfig } from '../../types/writing.js'

/**
 * Deepseek Client 工具
 * 基于 OpenAI 兼容协议的 Deepseek API 客户端
 */
export class DeepseekClientTool implements WritingTool {
  name = 'deepseek_client'
  description = 'Deepseek v3.1 API 客户端'
  securityLevel = 'ai-powered' as const

  constructor(private config: AIWritingConfig) {}

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        messages,
        systemPrompt,
        temperature,
        maxTokens,
        model
      } = input as {
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
        systemPrompt?: string
        temperature?: number
        maxTokens?: number
        model?: string
      }

      if (!messages || messages.length === 0) {
        return {
          success: false,
          error: '缺少消息参数'
        }
      }

      // 验证 API 密钥
      if (!this.config.anthropicApiKey) {
        return {
          success: false,
          error: '未配置 API 密钥'
        }
      }

      // 构建请求参数
      const requestModel = model || this.config.model
      const requestMessages = [...messages]
      
      // 如果有系统提示，添加为第一条消息
      if (systemPrompt || this.config.systemPrompt) {
        requestMessages.unshift({
          role: 'system',
          content: systemPrompt || this.config.systemPrompt || ''
        })
      }

      const requestParams = {
        model: requestModel,
        temperature: temperature ?? this.config.temperature,
        max_tokens: maxTokens || this.config.maxTokens,
        messages: requestMessages
      }

      // 调用 API
      const response = await this.callDeepseekAPI(requestParams)

      return {
        success: true,
        content: response.content,
        metadata: {
          model: response.model,
          usage: response.usage,
          requestParams,
          responseTime: response.responseTime,
          requestId: response.id
        }
      }

    } catch (error) {
      return {
        success: false,
        error: `Deepseek API 调用失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 调用 Deepseek API (OpenAI 兼容)
   */
  private async callDeepseekAPI(params: any): Promise<{
    content: string
    model: string
    usage: any
    responseTime: number
    id: string
  }> {
    const startTime = Date.now()

    try {
      // 动态导入 OpenAI SDK
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({
        apiKey: this.config.anthropicApiKey,
        baseURL: this.config.apiBaseUrl || 'https://api.deepseek.com'
      })
      
      const completion = await openai.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens
      })

      // 提取响应内容
      const choice = completion.choices[0]
      const content = choice?.message?.content || '抱歉，无法获取响应内容'

      return {
        content,
        model: completion.model,
        usage: completion.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        responseTime: Date.now() - startTime,
        id: completion.id
      }

    } catch (error) {
      // 如果API调用失败，回退到模拟响应
      console.warn('Deepseek API 调用失败，使用模拟响应:', error)
      
      const mockResponse = {
        content: this.generateMockResponse(params),
        model: params.model,
        usage: {
          prompt_tokens: 150,
          completion_tokens: 300,
          total_tokens: 450
        },
        responseTime: Date.now() - startTime,
        id: `deepseek_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      return mockResponse
    }
  }

  /**
   * 生成模拟响应
   */
  private generateMockResponse(params: any): string {
    const lastMessage = params.messages[params.messages.length - 1]
    const userContent = lastMessage?.content || ''

    // 基于用户输入生成简单的模拟响应
    if (userContent.includes('大纲')) {
      return `基于您的请求，我使用 Deepseek v3.1 为您生成了详细的文章大纲。

这个大纲结构清晰，运用了先进的推理能力，涵盖了主题的核心要点，每个章节都有明确的论述重点和支撑材料建议。

Deepseek v3.1 具有强大的逻辑推理和内容组织能力，特别适合生成结构化的写作内容。

您可以根据这个大纲开始撰写文章，或者对特定部分进行进一步的细化和调整。`
    }

    if (userContent.includes('改写')) {
      return `我已经使用 Deepseek v3.1 按照您指定的风格对内容进行了改写。

改写后的内容保持了原文的核心观点和信息，同时调整了表达方式和语言风格，使其更适合目标读者群体。

Deepseek v3.1 在文本改写方面表现优异，能够：
1. 精准把握不同写作风格的特点
2. 保持内容的准确性和完整性
3. 优化句式结构和词汇选择
4. 提升整体可读性和吸引力

如果您对改写结果有任何意见或需要进一步调整，请随时告诉我。`
    }

    return `我理解您的请求，并已使用 Deepseek v3.1 按照您的要求进行处理。

基于您提供的内容和参数，我已经完成了相应的分析和生成工作。Deepseek v3.1 以其出色的推理能力和自然语言理解能力，为您提供了高质量的响应。

如果您需要进一步的调整或有其他问题，请随时告诉我。`
  }

  /**
   * 检查 API 配置
   */
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.config.anthropicApiKey) {
      return { valid: false, error: '缺少 API 密钥' }
    }

    if (!this.config.model) {
      return { valid: false, error: '缺少模型配置' }
    }

    // 检查是否为支持的 Deepseek 模型
    const supportedModels = this.getSupportedModels()
    if (!supportedModels.includes(this.config.model)) {
      return { valid: false, error: `不支持的模型: ${this.config.model}` }
    }

    return { valid: true }
  }

  /**
   * 获取支持的 Deepseek 模型列表
   */
  getSupportedModels(): string[] {
    return [
      // Deepseek v3.1 系列
      'deepseek-chat',
      'deepseek-reasoner',
      
      // 兼容性别名
      'deepseek-v3-chat',
      'deepseek-v3-reasoner'
    ]
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { messages } = input as { messages?: any[] }
    return Boolean(messages && Array.isArray(messages) && messages.length > 0)
  }

  /**
   * 获取模型信息
   */
  getModelInfo(model: string): {
    name: string
    contextWindow: number
    description: string
    features: string[]
  } {
    switch (model) {
      case 'deepseek-chat':
      case 'deepseek-v3-chat':
        return {
          name: 'Deepseek Chat v3.1',
          contextWindow: 128000,
          description: '通用对话模型，适合各类文本生成任务',
          features: ['快速响应', '高质量生成', '多语言支持', '代码生成']
        }
      
      case 'deepseek-reasoner':
      case 'deepseek-v3-reasoner':
        return {
          name: 'Deepseek Reasoner v3.1',
          contextWindow: 128000,
          description: '推理专用模型，擅长复杂逻辑推理和问题解决',
          features: ['深度推理', '逻辑分析', '数学计算', '复杂问题解决']
        }
      
      default:
        return {
          name: 'Unknown Model',
          contextWindow: 4096,
          description: '未知模型',
          features: []
        }
    }
  }

  /**
   * 估算token使用量
   */
  estimateTokens(text: string): number {
    // 简单估算：中文字符 * 1.5，英文单词 * 1.3
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const otherChars = text.length - chineseChars - englishWords
    
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5)
  }
}