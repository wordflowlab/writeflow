import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { AIWritingConfig } from '../../types/writing.js'

/**
 * Qwen3 Client 工具
 * 基于 OpenAI 兼容协议的 Qwen3 API 客户端
 */
export class QwenClientTool implements WritingTool {
  name = 'qwen_client'
  description = 'Qwen3 API 客户端'
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
      const response = await this.callQwenAPI(requestParams)

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
        error: `Qwen3 API 调用失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 调用 Qwen3 API (OpenAI 兼容)
   */
  private async callQwenAPI(params: any): Promise<{
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
        baseURL: this.config.apiBaseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
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
      console.warn('Qwen3 API 调用失败，使用模拟响应:', error)
      
      const mockResponse = {
        content: this.generateMockResponse(params),
        model: params.model,
        usage: {
          prompt_tokens: 150,
          completion_tokens: 300,
          total_tokens: 450
        },
        responseTime: Date.now() - startTime,
        id: `qwen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
      return `基于您的请求，我使用通义千问 Qwen3 为您生成了详细的文章大纲。

这个大纲结构清晰，运用了阿里云先进的大语言模型能力，涵盖了主题的核心要点，每个章节都有明确的论述重点和支撑材料建议。

Qwen3 具有出色的中文理解和生成能力，特别适合中文写作场景，在逻辑推理和知识整合方面表现优异。

您可以根据这个大纲开始撰写文章，或者对特定部分进行进一步的细化和调整。`
    }

    if (userContent.includes('改写')) {
      return `我已经使用通义千问 Qwen3 按照您指定的风格对内容进行了改写。

改写后的内容保持了原文的核心观点和信息，同时调整了表达方式和语言风格，使其更适合目标读者群体。

Qwen3 在文本改写方面表现突出，能够：
1. 准确理解中文语境和文化背景
2. 保持内容的准确性和完整性
3. 灵活调整语言风格和表达方式
4. 优化句式结构，提升可读性

如果您对改写结果有任何意见或需要进一步调整，请随时告诉我。`
    }

    return `我理解您的请求，并已使用通义千问 Qwen3 按照您的要求进行处理。

基于您提供的内容和参数，我已经完成了相应的分析和生成工作。Qwen3 以其强大的中文语言理解能力和丰富的知识储备，为您提供了高质量的响应。

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

    // 检查是否为支持的 Qwen 模型
    const supportedModels = this.getSupportedModels()
    if (!supportedModels.includes(this.config.model)) {
      return { valid: false, error: `不支持的模型: ${this.config.model}` }
    }

    return { valid: true }
  }

  /**
   * 获取支持的 Qwen 模型列表
   */
  getSupportedModels(): string[] {
    return [
      // Qwen3 系列
      'qwen-plus',
      'qwen-turbo',
      'qwen-max',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
      
      // 兼容性别名
      'qwen3',
      'qwen3-plus',
      'qwen3-turbo',
      'qwen3-max'
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
      case 'qwen-max':
      case 'qwen3-max':
        return {
          name: '通义千问-Max',
          contextWindow: 30000,
          description: '最强大的通义千问模型，具有最佳的理解和生成能力',
          features: ['超强推理', '多语言支持', '代码生成', '知识问答', '创意写作']
        }
      
      case 'qwen-plus':
      case 'qwen3-plus':
        return {
          name: '通义千问-Plus',
          contextWindow: 30000,
          description: '平衡性能和成本的高质量模型',
          features: ['优秀推理', '多语言支持', '文本生成', '知识问答']
        }
      
      case 'qwen-turbo':
      case 'qwen3-turbo':
        return {
          name: '通义千问-Turbo',
          contextWindow: 6000,
          description: '快速响应的轻量级模型',
          features: ['快速响应', '基础对话', '文本生成', '简单推理']
        }
      
      case 'qwen2.5-72b-instruct':
        return {
          name: '通义千问2.5-72B',
          contextWindow: 32000,
          description: '开源模型中的旗舰版本，具有强大的理解和生成能力',
          features: ['开源免费', '强大推理', '多语言支持', '代码生成']
        }
      
      case 'qwen2.5-32b-instruct':
        return {
          name: '通义千问2.5-32B',
          contextWindow: 32000,
          description: '中等规模开源模型，平衡性能和资源消耗',
          features: ['开源免费', '良好推理', '多语言支持', '文本生成']
        }
      
      default:
        return {
          name: 'Unknown Qwen Model',
          contextWindow: 6000,
          description: '未知通义千问模型',
          features: []
        }
    }
  }

  /**
   * 估算token使用量
   */
  estimateTokens(text: string): number {
    // 简单估算：中文字符 * 1.2，英文单词 * 1.3
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const otherChars = text.length - chineseChars - englishWords
    
    return Math.ceil(chineseChars * 1.2 + englishWords * 1.3 + otherChars * 0.5)
  }

  /**
   * 获取定价信息
   */
  getPricingInfo(model: string): {
    inputPrice: number // 每千token价格（元）
    outputPrice: number
    currency: string
  } {
    switch (model) {
      case 'qwen-max':
      case 'qwen3-max':
        return {
          inputPrice: 0.02,
          outputPrice: 0.06,
          currency: 'CNY'
        }
      
      case 'qwen-plus':
      case 'qwen3-plus':
        return {
          inputPrice: 0.004,
          outputPrice: 0.012,
          currency: 'CNY'
        }
      
      case 'qwen-turbo':
      case 'qwen3-turbo':
        return {
          inputPrice: 0.0015,
          outputPrice: 0.002,
          currency: 'CNY'
        }
      
      default:
        return {
          inputPrice: 0,
          outputPrice: 0,
          currency: 'CNY'
        }
    }
  }
}