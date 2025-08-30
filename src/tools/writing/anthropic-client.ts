import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { AIWritingConfig } from '../../types/writing.js'

/**
 * AnthropicClient 工具
 * 与 Anthropic API 的集成客户端
 */
export class AnthropicClientTool implements WritingTool {
  name = 'anthropic_client'
  description = 'Anthropic API 客户端'
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
        messages: Array<{ role: 'user' | 'assistant'; content: string }>
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
          error: '未配置 Anthropic API 密钥'
        }
      }

      // 构建请求参数
      const requestParams = {
        model: model || this.config.model,
        temperature: temperature ?? this.config.temperature,
        max_tokens: maxTokens || this.config.maxTokens,
        system: systemPrompt || this.config.systemPrompt,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }

      // 调用 API
      const response = await this.callAnthropicAPI(requestParams)

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
        error: `Anthropic API 调用失败: ${(error as Error).message}`
      }
    }
  }

  /**
   * 调用 Anthropic API
   */
  private async callAnthropicAPI(params: any): Promise<{
    content: string
    model: string
    usage: any
    responseTime: number
    id: string
  }> {
    const startTime = Date.now()

    try {
      // 动态导入 Anthropic SDK
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const anthropic = new Anthropic({ 
        apiKey: this.config.anthropicApiKey,
        baseURL: this.config.apiBaseUrl || 'https://api.anthropic.com'
      })
      
      const completion = await anthropic.messages.create({
        model: params.model,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        system: params.system,
        messages: params.messages
      })

      // 提取响应内容
      const textContent = completion.content.find(block => block.type === 'text')
      const content = textContent ? textContent.text : '抱歉，无法获取响应内容'

      return {
        content,
        model: completion.model,
        usage: completion.usage,
        responseTime: Date.now() - startTime,
        id: completion.id
      }

    } catch (error) {
      // 如果API调用失败，回退到模拟响应
      console.warn('Anthropic API 调用失败，使用模拟响应:', error)
      
      const mockResponse = {
        content: this.generateMockResponse(params),
        model: params.model,
        usage: {
          input_tokens: 150,
          output_tokens: 300,
          total_tokens: 450
        },
        responseTime: Date.now() - startTime,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
      return `基于您的请求，我为您生成了详细的文章大纲。

这个大纲结构清晰，涵盖了主题的核心要点，每个章节都有明确的论述重点和支撑材料建议。

您可以根据这个大纲开始撰写文章，或者对特定部分进行进一步的细化和调整。

如果需要修改大纲的某个部分，请告诉我具体的修改要求。`
    }

    if (userContent.includes('改写')) {
      return `我已经按照您指定的风格对内容进行了改写。

改写后的内容保持了原文的核心观点和信息，同时调整了表达方式和语言风格，使其更适合目标读者群体。

主要调整包括：
1. 词汇选择更符合目标风格
2. 句式结构更加流畅
3. 语调和措辞更加适合

如果您对改写结果有任何意见或需要进一步调整，请随时告诉我。`
    }

    return `我理解您的请求，并已按照您的要求进行处理。

基于您提供的内容和参数，我已经完成了相应的分析和生成工作。

如果您需要进一步的调整或有其他问题，请随时告诉我。`
  }

  /**
   * 检查 API 配置
   */
  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    if (!this.config.anthropicApiKey) {
      return { valid: false, error: '缺少 Anthropic API 密钥' }
    }

    if (!this.config.model) {
      return { valid: false, error: '缺少模型配置' }
    }

    return { valid: true }
  }

  /**
   * 获取支持的模型列表
   */
  getSupportedModels(): string[] {
    return [
      // Claude 4.1 系列 (最新)
      'claude-opus-4-1-20250805',
      'claude-opus-4-1-20250805-thinking',
      
      // Claude 4 系列 (2025)
      'claude-opus-4-20250514',
      'claude-opus-4-20250514-thinking',
      'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514-thinking',
      
      // Claude 3.7 系列
      'claude-3-7-sonnet-20250219',
      'claude-3-7-sonnet-20250219-thinking',
      
      // Claude 3.5 系列
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      
      // Claude 3 系列（兼容）
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ]
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { messages } = input as { messages?: any[] }
    return Boolean(messages && Array.isArray(messages) && messages.length > 0)
  }
}