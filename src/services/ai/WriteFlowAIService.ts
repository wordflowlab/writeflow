/**
 * WriteFlow AI 服务
 * 专为写作场景优化的 AI 服务
 */

import { getGlobalConfig, ModelProfile } from '../../utils/config.js'
import { getModelManager } from '../models/ModelManager.js'
import { logError } from '../../utils/log.js'
import { getTool } from '../../tools/index.js'
import { AgentContext } from '../../types/agent.js'
import { ToolUseContext } from '../../Tool.js'

export interface AIRequest {
  prompt: string
  systemPrompt?: string
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
  allowedTools?: string[]
  enableToolCalls?: boolean
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
  toolCalls?: ToolCall[]
  hasToolInteraction?: boolean
}

export interface ToolCall {
  toolName: string
  parameters: any
  callId: string
}

export interface ToolExecutionResult {
  toolName: string
  callId: string
  result: string
  success: boolean
  error?: string
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

      // 如果启用了工具调用，处理工具交互
      if (request.enableToolCalls && request.allowedTools && request.allowedTools.length > 0) {
        response = await this.processToolInteractions(response, request)
      }

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
   * 调用 DeepSeek API - 支持原生 function calling
   */
  private async callDeepSeekAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile, ['DEEPSEEK_API_KEY'])
    if (!apiKey) {
      throw new Error('缺少 DeepSeek API 密钥')
    }
    
    const url = profile.baseURL || 'https://api.deepseek.com/chat/completions'
    
    // 如果启用了工具调用，则使用多轮对话机制
    if (request.enableToolCalls && request.allowedTools && request.allowedTools.length > 0) {
      return await this.callDeepSeekWithTools(url, apiKey, profile, request)
    }
    
    // 标准调用（无工具）
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

  /**
   * 调用 DeepSeek API 的工具调用版本 - 多轮对话
   */
  private async callDeepSeekWithTools(url: string, apiKey: string, profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const messages = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    // 转换工具定义
    const tools = await this.convertToolsToDeepSeekFormat(request.allowedTools!)
    
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let conversationHistory = ''
    let maxIterations = 5
    let iteration = 0
    let consecutiveFailures = 0
    const maxConsecutiveFailures = 2

    while (iteration < maxIterations) {
      console.log(`🔄 AI 正在思考和执行...`)
      
      const payload: any = {
        model: profile.modelName,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: request.maxTokens || profile.maxTokens,
        temperature: request.temperature || 0.3,
        stream: false
      }

      const response: any = await fetch(url, {
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

      const data: any = await response.json()
      const message: any = data.choices?.[0]?.message
      
      totalInputTokens += data.usage?.prompt_tokens || 0
      totalOutputTokens += data.usage?.completion_tokens || 0

      // 如果AI没有调用工具，则对话结束
      if (!message.tool_calls || message.tool_calls.length === 0) {
        conversationHistory += message.content
        
        return {
          content: conversationHistory,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens
          },
          cost: this.calculateCost({ prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens }, profile.provider),
          duration: 0,
          model: profile.modelName,
          hasToolInteraction: iteration > 0
        }
      }

      // AI 调用了工具，添加 AI 消息到对话历史
      messages.push(message)
      
      // 执行工具调用
      let currentRoundHasFailures = false
      for (const toolCall of message.tool_calls) {
        console.log(`🔧 [${toolCall.function.name}] 正在执行...`)
        conversationHistory += `\nAI: [调用 ${toolCall.function.name} 工具] 正在执行...\n`
        
        try {
          const toolResult = await this.executeDeepSeekToolCall(toolCall)
          
          if (toolResult.success) {
            console.log(`✅ [${toolCall.function.name}] ${toolResult.result}`)
            conversationHistory += `${toolCall.function.name}工具: ${toolResult.result}\n`
            consecutiveFailures = 0 // 重置连续失败计数
          } else {
            console.log(`❌ [${toolCall.function.name}] ${toolResult.error}`)
            conversationHistory += `${toolCall.function.name}工具: ${toolResult.error}\n`
            currentRoundHasFailures = true
          }
          
          // 将工具执行结果添加到消息历史
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.success ? toolResult.result : toolResult.error || '执行失败'
          })
        } catch (error) {
          const errorMsg = `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`
          console.log(`❌ [${toolCall.function.name}] ${errorMsg}`)
          conversationHistory += `${toolCall.function.name}工具: ${errorMsg}\n`
          currentRoundHasFailures = true
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: errorMsg
          })
        }
      }

      // 检查连续失败
      if (currentRoundHasFailures) {
        consecutiveFailures++
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.log(`⚠️  连续失败 ${consecutiveFailures} 次，终止工具调用`)
          return {
            content: conversationHistory + '\n系统提示：连续工具调用失败，请检查参数格式和工具使用方法。',
            usage: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens
            },
            cost: this.calculateCost({ prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens }, profile.provider),
            duration: 0,
            model: profile.modelName,
            hasToolInteraction: true
          }
        }
      }
      
      iteration++
    }

    // 超过最大迭代次数
    return {
      content: conversationHistory + '\n[系统] 对话已达到最大轮次限制',
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens
      },
      cost: this.calculateCost({ prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens }, profile.provider),
      duration: 0,
      model: profile.modelName,
      hasToolInteraction: true
    }
  }

  /**
   * 转换工具定义为 DeepSeek API 格式
   * 使用工具的 prompt() 方法获取详细描述和参数 schema
   */
  private async convertToolsToDeepSeekFormat(allowedTools: string[]): Promise<any[]> {
    const tools = []
    
    for (const toolName of allowedTools) {
      const tool = getTool(toolName)
      if (!tool) continue

      try {
        // 获取工具的完整描述
        const description = await tool.prompt?.({ safeMode: false }) || await tool.description()
        
        // 从 Zod schema 生成 JSON schema
        const parameters = this.zodSchemaToJsonSchema(tool.inputSchema)

        tools.push({
          type: 'function',
          function: {
            name: tool.name,
            description,
            parameters
          }
        })
      } catch (error) {
        console.warn(`Failed to convert tool ${toolName} to DeepSeek format:`, error)
        // 使用基础描述作为后备
        const basicDescription = await tool.description()
        tools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: basicDescription,
            parameters: {
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: true
            }
          }
        })
      }
    }

    return tools
  }

  /**
   * 将 Zod schema 转换为 JSON Schema
   */
  private zodSchemaToJsonSchema(zodSchema: any): any {
    // 简化的 Zod 到 JSON Schema 转换
    // 在实际项目中，建议使用 zod-to-json-schema 库
    const shape = zodSchema._def?.shape?.()
    if (!shape) {
      return {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      }
    }

    const properties: any = {}
    const required: string[] = []

    for (const [key, zodType] of Object.entries(shape)) {
      const fieldSchema = this.zodTypeToJsonSchema(zodType as any)
      properties[key] = fieldSchema
      
      // 检查是否是必需字段
      if (!(zodType as any)._def?.optional) {
        required.push(key)
      }
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    }
  }

  /**
   * 将 Zod 类型转换为 JSON Schema 字段
   */
  private zodTypeToJsonSchema(zodType: any): any {
    const typeName = zodType._def.typeName
    
    switch (typeName) {
      case 'ZodString':
        return {
          type: 'string',
          description: zodType.description || ''
        }
      case 'ZodNumber':
        return {
          type: 'number', 
          description: zodType.description || ''
        }
      case 'ZodBoolean':
        return {
          type: 'boolean',
          description: zodType.description || ''
        }
      case 'ZodOptional':
        return this.zodTypeToJsonSchema(zodType._def.innerType)
      case 'ZodDefault':
        const innerSchema = this.zodTypeToJsonSchema(zodType._def.innerType)
        innerSchema.default = zodType._def.defaultValue()
        return innerSchema
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodTypeToJsonSchema(zodType._def.type),
          description: zodType.description || ''
        }
      default:
        return {
          type: 'string',
          description: zodType.description || ''
        }
    }
  }

  /**
   * 安全的 JSON 解析，处理转义字符问题
   */
  private safeJSONParse(jsonStr: string): any {
    try {
      return JSON.parse(jsonStr)
    } catch (error) {
      console.log(`🔧 尝试修复 JSON 格式...`)
      
      // 尝试修复常见的 JSON 转义问题
      let fixedJson = jsonStr
        // 修复换行符
        .replace(/\\n/g, '\\\\n')
        // 修复制表符
        .replace(/\\t/g, '\\\\t')
        // 修复回车符
        .replace(/\\r/g, '\\\\r')
        // 修复反斜杠
        .replace(/\\\\/g, '\\\\\\\\')
        // 修复单独的引号转义
        .replace(/\\"/g, '\\\\"')
      
      try {
        return JSON.parse(fixedJson)
      } catch (retryError) {
        // 最后尝试：移除问题字符并重新解析
        try {
          const cleanJson = jsonStr
            .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
            .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // 修复无效转义
          
          return JSON.parse(cleanJson)
        } catch (finalError) {
          throw new Error(`JSON 解析失败 - 原始错误: ${error instanceof Error ? error.message : '未知'}, 重试错误: ${retryError instanceof Error ? retryError.message : '未知'}, 最终错误: ${finalError instanceof Error ? finalError.message : '未知'}`)
        }
      }
    }
  }

  /**
   * 执行 DeepSeek API 的工具调用
   */
  private async executeDeepSeekToolCall(toolCall: any): Promise<ToolExecutionResult> {
    const { name: toolName, arguments: argsStr } = toolCall.function
    
    // 安全的 JSON 解析
    let args: any
    try {
      args = this.safeJSONParse(argsStr)
      console.log(`🔧 [${toolName}] 解析参数:`, JSON.stringify(args, null, 2))
    } catch (parseError) {
      console.error(`❌ [${toolName}] JSON 解析失败，原始字符串:`, argsStr)
      return {
        toolName,
        callId: toolCall.id,
        result: '',
        success: false,
        error: `工具调用参数 JSON 解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`
      }
    }

    const tool = getTool(toolName)
    if (!tool) {
      return {
        toolName,
        callId: toolCall.id,
        result: '',
        success: false,
        error: `工具 ${toolName} 不存在`
      }
    }

    // 验证工具参数
    try {
      if (tool.validateInput) {
        const validationResult = await tool.validateInput(args)
        if (!validationResult.result) {
          return {
            toolName,
            callId: toolCall.id,
            result: '',
            success: false,
            error: `工具参数验证失败: ${validationResult.message}`
          }
        }
      }
    } catch (validationError) {
      console.warn(`[${toolName}] 参数验证失败:`, validationError)
      // 继续执行，但记录警告
    }

    try {
      const toolContext: ToolUseContext = {
        messageId: `deepseek-${toolCall.id}`,
        agentId: 'deepseek-ai',
        safeMode: false,
        abortController: new AbortController(),
        readFileTimestamps: {},
        options: {
          verbose: true,
          safeMode: false,
          messageLogName: 'deepseek-ai'
        }
      }

      const generator = tool.call(args, toolContext)
      const { value } = await generator.next()
      const result = value?.data || value

      return {
        toolName,
        callId: toolCall.id,
        result: this.formatToolResult(result, toolName),
        success: true
      }
    } catch (error) {
      return {
        toolName,
        callId: toolCall.id,
        result: '',
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 格式化工具执行结果
   */
  private formatToolResult(result: any, toolName: string): string {
    if (typeof result === 'string') {
      return result
    }
    
    if (toolName === 'Write' && result?.success) {
      return `文件已成功写入 ${result.filePath} (${result.bytesWritten} 字节)`
    }
    
    if (toolName === 'Read' && result?.content) {
      return `文件内容已读取，长度: ${result.content.length} 字符`
    }
    
    if (toolName === 'Bash' && typeof result === 'object') {
      return result.output || result.stdout || JSON.stringify(result)
    }
    
    return JSON.stringify(result)
  }

  /**
   * 处理工具交互 (旧版本，已被 DeepSeek 原生支持替代)
   */
  private async processToolInteractions(response: AIResponse, request: AIRequest): Promise<AIResponse> {
    let currentContent = response.content
    let iterationCount = 0
    const maxIterations = 3 // 防止无限循环

    while (iterationCount < maxIterations) {
      // 检测工具调用
      const toolCalls = this.detectToolCalls(currentContent, request.allowedTools!)
      
      if (toolCalls.length === 0) {
        // 没有工具调用，结束处理
        break
      }

      console.log(`🔧 检测到 ${toolCalls.length} 个工具调用`)
      
      // 执行工具调用
      const toolResults: ToolExecutionResult[] = []
      for (const toolCall of toolCalls) {
        const result = await this.executeToolCall(toolCall)
        toolResults.push(result)
        
        // 显示工具执行过程
        if (result.success) {
          console.log(`✅ [${result.toolName}] ${result.result}`)
        } else {
          console.log(`❌ [${result.toolName}] ${result.error}`)
        }
      }

      // 将工具结果集成到响应中
      currentContent = this.integrateToolResults(currentContent, toolResults)
      response.hasToolInteraction = true
      
      iterationCount++
    }

    response.content = currentContent
    return response
  }

  /**
   * 检测工具调用
   */
  private detectToolCalls(content: string, allowedTools: string[]): ToolCall[] {
    const toolCalls: ToolCall[] = []
    
    // 检测格式：Write("filename", "content")
    for (const toolName of allowedTools) {
      const regex = new RegExp(`${toolName}\\s*\\(\\s*"([^"]+)"(?:\\s*,\\s*"([^"]*)")?\\s*\\)`, 'gi')
      let match
      
      while ((match = regex.exec(content)) !== null) {
        const callId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        toolCalls.push({
          toolName,
          parameters: {
            file_path: match[1],
            content: match[2] || ''
          },
          callId
        })
      }
    }
    
    return toolCalls
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(toolCall: ToolCall): Promise<ToolExecutionResult> {
    try {
      const tool = getTool(toolCall.toolName)
      if (!tool) {
        return {
          toolName: toolCall.toolName,
          callId: toolCall.callId,
          result: '',
          success: false,
          error: `工具 ${toolCall.toolName} 不存在`
        }
      }

      // 创建工具执行上下文
      const toolContext: ToolUseContext = {
        messageId: `ai-${toolCall.callId}`,
        agentId: 'ai-service',
        safeMode: false,
        abortController: new AbortController(),
        readFileTimestamps: {},
        options: {
          verbose: true,
          safeMode: false,
          messageLogName: 'ai-service'
        }
      }

      // 执行工具 - 使用 call 方法
      const generator = tool.call(toolCall.parameters, toolContext)
      const { value } = await generator.next()
      
      const result = value?.data || value

      return {
        toolName: toolCall.toolName,
        callId: toolCall.callId,
        result: typeof result === 'string' ? result : JSON.stringify(result),
        success: true
      }
    } catch (error) {
      return {
        toolName: toolCall.toolName,
        callId: toolCall.callId,
        result: '',
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 将工具结果集成到内容中
   */
  private integrateToolResults(content: string, results: ToolExecutionResult[]): string {
    let updatedContent = content
    
    for (const result of results) {
      if (result.success) {
        // 在工具调用位置显示执行结果
        const toolCallPattern = new RegExp(`${result.toolName}\\s*\\([^)]+\\)`, 'gi')
        updatedContent = updatedContent.replace(toolCallPattern, (match) => {
          return `${match}\n✅ [工具执行完成] ${result.result}`
        })
      } else {
        // 显示错误信息
        const toolCallPattern = new RegExp(`${result.toolName}\\s*\\([^)]+\\)`, 'gi')
        updatedContent = updatedContent.replace(toolCallPattern, (match) => {
          return `${match}\n❌ [工具执行失败] ${result.error}`
        })
      }
    }
    
    return updatedContent
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