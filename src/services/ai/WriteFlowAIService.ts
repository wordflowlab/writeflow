/**
 * WriteFlow AI 服务
 * 专为写作场景优化的 AI 服务
 */

import { getGlobalConfig, ModelProfile } from '../../utils/config.js'
import { getModelManager } from '../models/ModelManager.js'
import { getModelCapabilities } from '../models/modelCapabilities.js'
import { logError } from '../../utils/log.js'
import { 
  getTool, 
  getToolOrchestrator, 
  getPermissionManager,
  getAvailableTools,
  executeToolQuick,
  ToolExecutionStatus,
  type ToolExecutionResult,
  type WriteFlowTool
} from '../../tools/index.js'
import { AgentContext } from '../../types/agent.js'
import { ToolUseContext } from '../../Tool.js'
import { getStreamingService, StreamingService, StreamingRequest } from '../streaming/StreamingService.js'
import { getResponseStateManager } from '../streaming/ResponseStateManager.js'
import { getProviderAdapter } from './providers/index.js'
import { emitReminderEvent } from '../SystemReminderService.js'
import { startStreamingProgress, stopStreamingProgress } from '../streaming/ProgressIndicator.js'
import { getOutputFormatter } from '../../ui/utils/outputFormatter.js'
import { parseAIResponse, parseStreamingChunk, type ParsedResponse } from './ResponseParser.js'
import type { ContentBlock } from '../../types/UIMessage.js'

export interface AIRequest {
  prompt: string
  systemPrompt?: string
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
  onToken?: (chunk: string) => void
  allowedTools?: string[]
  enableToolCalls?: boolean
}

export interface AIResponse {
  content: string
  contentBlocks?: ContentBlock[]  // 新增：结构化内容块
  usage: {
    inputTokens: number
    outputTokens: number
  }
  cost: number
  duration: number
  model: string
  toolCalls?: ToolCall[]
  hasToolInteraction?: boolean
  streamingStats?: {
    duration: number
    tokenCount: number
    tokensPerSecond: number
    startTime: number
    endTime: number
  }
}

export interface ToolCall {
  toolName: string
  parameters: any
  callId: string
}

export interface AIToolExecutionResult {
  toolName: string
  callId: string
  result: string
  success: boolean
  error?: string
}

/**
 * WriteFlow AI 服务类 - 集成增强工具系统
 */
export class WriteFlowAIService {
  private modelManager = getModelManager()
  private toolOrchestrator = getToolOrchestrator()
  private permissionManager = getPermissionManager()
  private providerAdapter = getProviderAdapter(undefined)
  
  /**
   * 处理 AI 请求（支持流式和非流式）
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    // 如果请求流式处理，委托给流式服务
    if (request.stream) {
      return this.processStreamingRequest(request)
    }
    
    return this.processNonStreamingRequest(request)
  }

  /**
   * 过滤 DeepSeek 等模型在文本中内联暴露的工具标记
   * 清理形如 <｜tool▁calls▁begin｜> ... <｜tool▁calls▁end｜> 以及单个 <｜tool▁...｜>
   */
  private sanitizeLLMArtifacts(text: string | undefined): string {
    return this.providerAdapter.sanitizeText(text || '')
  }

  /**
   * 从文本中提取 DeepSeek 的内联工具调用，返回清理后的文本与解析出的调用
   */
  private extractInlineToolCalls(text: string) {
    return this.providerAdapter.extractInlineToolCalls(text)
  }
  
  /**
   * 处理流式 AI 请求 - 简化版本，直接处理而不依赖复杂的 StreamingService
   */
  async processStreamingRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    
    try {
      // 离线模式下直接回退到非流式处理
      if (process.env.WRITEFLOW_AI_OFFLINE === 'true') {
        return this.processNonStreamingRequest({ ...request, stream: false })
      }
      
      // 从请求或环境变量获取模型名称
      const modelName = request.model || process.env.AI_MODEL || this.getDefaultModelName()
      if (!modelName) {
        console.warn('没有指定模型，回退到非流式处理')
        return this.processNonStreamingRequest({ ...request, stream: false })
      }
      
      // 根据模型名称创建临时的模型配置
      const modelProfile = this.createTempModelProfile(modelName)
      if (!modelProfile) {
        console.warn(`不支持的模型: ${modelName}，回退到非流式处理`)
        return this.processNonStreamingRequest({ ...request, stream: false })
      }
      
      // 检查模型是否支持流式
      const capabilities = getModelCapabilities(modelName)
      if (!capabilities.supportsStreaming) {
        console.warn(`模型 ${modelName} 不支持流式，回退到非流式处理`)
        return this.processNonStreamingRequest({ ...request, stream: false })
      }
      
      // 直接调用对应的 API 进行流式处理
      this.providerAdapter = getProviderAdapter(modelProfile.provider)
      switch (modelProfile.provider) {
        case 'deepseek':
          return await this.callDeepSeekAPI(modelProfile, request)
        case 'anthropic':
        case 'bigdream':
          return await this.callAnthropicAPI(modelProfile, request)
        case 'openai':
        case "custom-openai":
        case "custom":
          return await this.callOpenAIAPI(modelProfile, request)
        case 'kimi':
          return await this.callKimiAPI(modelProfile, request)
        default:
          console.warn(`不支持流式的提供商: ${modelProfile.provider}，回退到非流式处理`)
          return this.processNonStreamingRequest({ ...request, stream: false })
      }
      
    } catch (error) {
      logError('流式 AI 请求处理失败', error)
      
      // 标记流式响应错误（如果有活跃的流式会话）
      const responseManager = getResponseStateManager()
      const activeStats = responseManager.getActiveStreamingStats()
      if (activeStats.activeStreams > 0) {
        // 找到可能的流式会话并标记错误
        console.warn(`发现 ${activeStats.activeStreams} 个活跃流式会话，标记为错误状态`)
      }
      
      // 回退到非流式处理，明确设置 stream: false 防止递归
      console.warn('流式处理失败，回退到非流式处理')
      return this.processNonStreamingRequest({ ...request, stream: false })
    }
  }
  
  /**
   * 处理非流式 AI 请求
   */
  async processNonStreamingRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()

    try {
      // 离线/降级模式（本地无网或无 Key 时可用）
      if (process.env.WRITEFLOW_AI_OFFLINE === 'true') {
        const content = `【离线模式】无法访问外部模型，已返回模拟回复。\n\n要点: ${request.prompt.slice(0, 120)}${request.prompt.length > 120 ? '...' : ''}`
        const parsedResponse = parseAIResponse(content)
        return {
          content,
          contentBlocks: parsedResponse.content,
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
      this.providerAdapter = getProviderAdapter(modelProfile.provider)

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
        case 'custom-openai':
          response = await this.callOpenAIAPI(modelProfile, request)
          break
        case 'custom':
          // 对于完全自定义提供商，暂时回退到 OpenAI兼容格式
          // 未来可以扩展支持完全自定义的API格式
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

      // 清理可能残留的内联标记（按 provider 适配器）
      response.content = this.providerAdapter.sanitizeText(response.content)
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
    
    const payload: any = {
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
    // Anthropic 也支持流式
    if (request.stream) {
      payload.stream = true
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
    
    if (request.stream) {
      return await this.handleAnthropicStreamingResponse(response, profile, request)
    }

    const data = await response.json()
    
    const rawContent = data.content?.[0]?.text || '无响应内容'
    const parsedResponse = parseAIResponse(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: parsedResponse.content,
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
   * 处理 Anthropic SSE 流式响应
   * 事件类型参见官方：message_start/content_block_start/content_block_delta/.../message_delta/message_stop
   */
  private async handleAnthropicStreamingResponse(response: Response, profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    if (!response.body) throw new Error('Response body is null')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let content = ''

    const responseManager = getResponseStateManager()
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    responseManager.startStreaming(streamId)
    const isInteractiveUI = (global as any).WRITEFLOW_INTERACTIVE === true
    const useConsoleProgress = typeof request.onToken !== 'function' && !isInteractiveUI
    if (useConsoleProgress) {
      startStreamingProgress({ style: 'claude', showDuration: true, showTokens: true, showInterruptHint: true })
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr || dataStr === '[DONE]') continue
          try {
            const evt = JSON.parse(dataStr)
            // content_block_delta 携带文本增量
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta?.text) {
              const deltaText = evt.delta.text as string
              content += deltaText
              const estimated = Math.ceil(content.length / 4)
              responseManager.updateStreamingProgress(streamId, { tokenCount: estimated, characterCount: content.length, chunkSize: deltaText.length, contentType: 'text' })
              if (typeof request.onToken === 'function') {
                try { request.onToken(deltaText) } catch {}
              } else if (!isInteractiveUI) {
                process.stdout.write(deltaText)
              }
            }
          } catch {
            // 忽略解析失败
          }
        }
      }
    } finally {
      reader.releaseLock()
      if (useConsoleProgress) stopStreamingProgress()
    }

    const finalTokens = Math.ceil(content.length / 4)
    const stats = responseManager.completeStreaming(streamId, finalTokens)
    const parsedResponse = parseAIResponse(content)

    return {
      content,
      contentBlocks: parsedResponse.content,
      usage: { inputTokens: 0, outputTokens: finalTokens },
      cost: 0,
      duration: stats.duration,
      model: profile.modelName,
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
      stream: request.stream || false
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
    
    // 如果是流式请求，处理流式响应
    if (request.stream) {
      return await this.handleStreamingResponse(response, profile, request)
    }
    
    // 非流式处理
    const data = await response.json()
    
    const rawContent = data.choices?.[0]?.message?.content || '无响应内容'
    const parsedResponse = parseAIResponse(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: parsedResponse.content,
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
   * 处理流式响应
   */
  private async handleStreamingResponse(response: Response, profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let content = ''
    let usage = { inputTokens: 0, outputTokens: 0 }
    let pipeClosed = false
    
    // 获取响应状态管理器并开始流式跟踪（在交互式 UI 下禁用控制台输出）
    const responseManager = getResponseStateManager()
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    responseManager.startStreaming(streamId)
    const isInteractiveUI = (global as any).WRITEFLOW_INTERACTIVE === true
    const useConsoleProgress = typeof request.onToken !== 'function' && !isInteractiveUI
    if (useConsoleProgress) {
      startStreamingProgress({ style: 'claude', showTokens: true, showDuration: true, showInterruptHint: true })
    }
    
    // 监听管道关闭事件
    process.stdout.on('error', (error) => {
      if ((error as any).code === 'EPIPE') {
        pipeClosed = true
      }
    })
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          if (dataStr === '[DONE]') continue
          try {
            const data = JSON.parse(dataStr)
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              content += delta
              const estimatedTokens = Math.ceil(content.length / 4)
              responseManager.updateStreamingProgress(streamId, { tokenCount: estimatedTokens, characterCount: content.length, chunkSize: delta.length, contentType: 'text' })
              if (typeof request.onToken === 'function') {
                try { request.onToken(delta) } catch {}
              } else if (!isInteractiveUI && !process.stdout.destroyed && !pipeClosed) {
                try {
                  const canWrite = process.stdout.write(delta)
                  if (!canWrite) process.stdout.once('drain', () => {})
                } catch {
                  pipeClosed = true
                }
              }
            }
            if (data.usage) {
              usage.inputTokens = data.usage.prompt_tokens || 0
              usage.outputTokens = data.usage.completion_tokens || 0
            }
          } catch {
            // 忽略解析失败
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    
    // 完成流式响应并获取统计信息
    const finalTokenCount = usage.outputTokens || Math.ceil(content.length / 4)
    const streamingStats = responseManager.completeStreaming(streamId, finalTokenCount)
    const parsedResponse = parseAIResponse(content)
    
    // 停止进度指示器（仅控制台模式）
    if (useConsoleProgress) {
      stopStreamingProgress()
    }
    
    // 在流式处理完成后，提供格式化后的最终输出
    if (useConsoleProgress) {
      try {
        const formatter = getOutputFormatter({
          enableColors: process.stdout.isTTY,
          theme: process.env.WRITEFLOW_THEME === 'light' ? 'light' : 'dark'
        })
        const formatted = formatter.formatStreamOutput(content, { maxWidth: 80 })
        if (formatted.hasCodeBlocks && formatted.codeBlockCount > 0) {
          process.stderr.write(`\n${formatter.formatSuccess(`包含 ${formatted.codeBlockCount} 个代码块的内容已输出`)}\n`)
        }
      } catch (formatError) {
        console.warn(`最终格式化失败: ${formatError}`)
      }
    }
    
    return {
      content,
      contentBlocks: parsedResponse.content,
      usage,
      cost: this.calculateCost({
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens
      }, profile.provider),
      duration: streamingStats.duration,
      model: profile.modelName,
      // 添加流式性能统计（可选）
      streamingStats: {
        duration: streamingStats.duration,
        tokenCount: finalTokenCount,
        tokensPerSecond: streamingStats.tokensPerSecond,
        startTime: streamingStats.startTime,
        endTime: streamingStats.endTime
      }
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
    
    const payload: any = {
      model: profile.modelName,
      messages,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3,
    }
    if (request.stream) payload.stream = true
    
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
    if (request.stream) {
      return await this.handleStreamingResponse(response, profile, request)
    }

    const data = await response.json()
    
    const rawContent = data.choices?.[0]?.message?.content || '无响应内容'
    const parsedResponse = parseAIResponse(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: parsedResponse.content,
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
    
    const payload: any = {
      model: profile.modelName,
      messages,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3,
    }
    if (request.stream) payload.stream = true
    
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
    if (request.stream) {
      return await this.handleStreamingResponse(response, profile, request)
    }

    const data = await response.json()
    
    const rawContent = data.choices?.[0]?.message?.content || '无响应内容'
    const parsedResponse = parseAIResponse(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: parsedResponse.content,
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
   * 获取默认模型名称
   */
  private getDefaultModelName(): string {
    // 优先使用 AI_MODEL 环境变量
    if (process.env.AI_MODEL) {
      return process.env.AI_MODEL
    }
    
    // 其次使用 API_PROVIDER 推断模型
    const provider = process.env.API_PROVIDER
    switch (provider) {
      case 'deepseek':
        return 'deepseek-chat'
      case 'qwen3':
        return 'qwen-turbo'
      case 'glm4.5':
        return 'glm-4-flash'
      case 'anthropic':
        return 'claude-3-sonnet-20240229'
      case 'openai':
        return 'gpt-3.5-turbo'
      case 'kimi':
        return 'moonshot-v1-8k'
      default:
        // 最后检查有哪些 API Key 可用，智能选择默认模型
        if (process.env.DEEPSEEK_API_KEY) return 'deepseek-chat'
        if (process.env.ANTHROPIC_API_KEY) return 'claude-3-sonnet-20240229'
        if (process.env.OPENAI_API_KEY) return 'gpt-3.5-turbo'
        if (process.env.KIMI_API_KEY) return 'moonshot-v1-8k'
        if (process.env.GLM_API_KEY) return 'glm-4-flash'
        
        return 'deepseek-chat' // 最终默认使用 DeepSeek
    }
  }

  /**
   * 根据模型名称创建临时的模型配置
   */
  private createTempModelProfile(modelName: string): ModelProfile | null {
    // 根据模型名称推断提供商
    let provider: string
    let baseURL: string | undefined
    
    if (modelName.includes('deepseek')) {
      provider = 'deepseek'
      baseURL = 'https://api.deepseek.com/v1/chat/completions'
    } else if (modelName.includes('claude') || modelName.includes('anthropic')) {
      provider = 'anthropic'
      baseURL = 'https://api.anthropic.com/v1/messages'
    } else if (modelName.includes('gpt') || modelName.includes('openai')) {
      provider = 'openai'
      baseURL = 'https://api.openai.com/v1/chat/completions'
    } else if (modelName.includes('moonshot') || modelName.includes('kimi')) {
      provider = 'kimi'
      baseURL = 'https://api.moonshot.cn/v1/chat/completions'
    } else if (modelName.includes('qwen')) {
      provider = 'openai' // Qwen 使用 OpenAI 兼容协议
      baseURL = process.env.API_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    } else if (modelName.includes('glm')) {
      provider = 'openai' // GLM 使用 OpenAI 兼容协议
      baseURL = process.env.API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
    } else {
      // 根据环境变量推断
      provider = process.env.API_PROVIDER || 'deepseek'
      baseURL = process.env.API_BASE_URL
    }

    // 创建临时的模型配置
    const profile: ModelProfile = {
      name: `temp-${modelName}`,
      provider: provider as any,
      modelName: modelName,
      baseURL: baseURL,
      apiKey: this.getAPIKeyForProvider(provider),
      maxTokens: 4000,
      contextLength: 128000,
      isActive: true
    }

    // 验证 API 密钥是否可用
    if (!profile.apiKey) {
      console.warn(`找不到 ${provider} 的 API 密钥`)
      return null
    }

    return profile
  }

  /**
   * 根据提供商获取 API 密钥
   */
  private getAPIKeyForProvider(provider: string): string {
    const envKeys = {
      anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      deepseek: ['DEEPSEEK_API_KEY'],
      openai: ['OPENAI_API_KEY'],
      kimi: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
      qwen: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
      glm: ['GLM_API_KEY', 'ZHIPUAI_API_KEY']
    }

    const keys = envKeys[provider as keyof typeof envKeys] || []
    for (const key of keys) {
      const value = process.env[key]
      if (value) return value
    }

    return ''
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
    
    // 如果没有工具或工具为空，回退到标准调用
    if (!tools || tools.length === 0) {
      return await this.callDeepSeekAPI(profile, { ...request, enableToolCalls: false, allowedTools: undefined })
    }
    
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let conversationHistory = ''
    let maxIterations = 5
    let iteration = 0
    let consecutiveFailures = 0
    const maxConsecutiveFailures = 2
    let lastRoundHadTodoUpdate = false

    while (iteration < maxIterations) {
      console.log(`🔄 AI 正在思考和执行...`)
      
      const payload: any = {
        model: profile.modelName,
        messages,
        tools: lastRoundHadTodoUpdate ? [] : tools,
        tool_choice: lastRoundHadTodoUpdate ? 'none' : 'auto',
        max_tokens: request.maxTokens || profile.maxTokens,
        temperature: request.temperature || 0.3,
        // 注意：带工具调用的流式响应是 SSE，包含 `data:` 前缀，
        // 这里统一关闭流式，改为一次性 JSON，避免解析报错。
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

      let data: any
      try {
        data = await response.json()
      } catch (e) {
        // 某些网关可能仍返回 SSE，这里兜底读取文本并尝试提取最后一个 data: JSON
        const text = await response.text()
        const lines = text.split(/\n/).map((l: string) => l.trim()).filter(Boolean)
        const lastData = [...lines].reverse().find((l: string) => l.startsWith('data:'))
        if (!lastData) throw e
        const jsonStr = lastData.replace(/^data:\s*/, '')
        data = JSON.parse(jsonStr)
      }
      const message: any = data.choices?.[0]?.message
      // 处理 DeepSeek 内联工具标记（若存在）
      if (message && typeof message.content === 'string' && message.content.includes('tool▁')) {
        const inline = this.extractInlineToolCalls(message.content)
        message.content = inline.cleaned
        if (inline.calls.length > 0) {
          message.tool_calls = (message.tool_calls || []).concat(
            inline.calls.map((c: any) => ({
              type: 'function',
              id: `inline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              function: {
                name: c.name,
                arguments: JSON.stringify(c.args)
              }
            }))
          )
        }
      }
      
      totalInputTokens += data.usage?.prompt_tokens || 0
      totalOutputTokens += data.usage?.completion_tokens || 0

      // 如果AI没有调用工具，则对话结束
      if (!message.tool_calls || message.tool_calls.length === 0) {
        conversationHistory += this.sanitizeLLMArtifacts(message.content)

        // 若上一轮刚进行了 todo_* 更新，这一轮是正文生成：
        // 1) 自动将当前 in_progress 置为 completed
        // 2) 若输出文本足够完整（长度阈值），将剩余 pending 也标记为 completed（避免一次性完成的场景进度不同步）
        if (lastRoundHadTodoUpdate) {
          try {
            const { TodoManager } = await import('../../tools/TodoManager.js')
            const mgr = new TodoManager(process.env.WRITEFLOW_SESSION_ID)
            const current = await mgr.getCurrentTask()
            let changed = false
            if (current) {
              await mgr.completeTask(current.id)
              changed = true
            }
            // 如果文本较长，认为本轮完成了主要工作，批量同步剩余待处理为完成
            const substantial = (message.content || '').length >= 800 || conversationHistory.length >= 1200
            if (substantial) {
              const all = await mgr.getAllTodos()
              const pendingIds = all.filter(t => t.status === 'pending').map(t => t.id)
              if (pendingIds.length > 0) {
                await mgr.batchUpdateStatus(pendingIds, 'completed' as any)
                changed = true
              }
            }
            if (changed) emitReminderEvent('todo:changed', { agentId: 'deepseek-ai' })
          } catch (e) {
            console.warn('⚠️ 自动完成当前任务失败:', (e as Error)?.message)
          }
        }
        
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
      let currentRoundHasTodoUpdate = false
      for (const toolCall of message.tool_calls) {
        console.log(`🔧 [${toolCall.function.name}] 正在执行...`)
        // 过滤TODO工具的执行信息，不添加到conversation history中
        if (!toolCall.function.name.includes('todo')) {
          conversationHistory += `\nAI: [调用 ${toolCall.function.name} 工具] 正在执行...\n`
        }
        
        try {
          const toolResult = await this.executeDeepSeekToolCall(toolCall)
          
          if (toolResult.success) {
            console.log(`✅ [${toolCall.function.name}] ${toolResult.result}`)
            // 过滤TODO工具结果，不添加到conversation history中
            if (!toolCall.function.name.includes('todo')) {
              conversationHistory += `${toolCall.function.name}工具: ${toolResult.result}\n`
            }
            consecutiveFailures = 0 // 重置连续失败计数
            if (toolCall.function.name.startsWith('todo_')) {
              currentRoundHasTodoUpdate = true
            }
          } else {
            console.log(`❌ [${toolCall.function.name}] ${toolResult.error}`)
            // TODO工具的错误也不添加到conversation history中
            if (!toolCall.function.name.includes('todo')) {
              conversationHistory += `${toolCall.function.name}工具: ${toolResult.error}\n`
            }
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
      // 若本轮成功更新了 todo_*，下一轮禁用工具并强制正文生成
      if (currentRoundHasTodoUpdate) {
        lastRoundHadTodoUpdate = true
        messages.push({
          role: 'user',
          content: '已更新任务列表。现在请根据当前任务直接生成正文内容，不要再调用任何工具。请开始写作。'
        })
      } else {
        lastRoundHadTodoUpdate = false
      }

      iteration++
    }

    // 超过最大迭代次数
    return {
      content: conversationHistory + '\n[系统] 对话达到轮次上限。请继续直接生成正文内容。',
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
   * 转换工具定义为 DeepSeek API 格式 - 使用新的工具系统
   * 优先考虑权限和可用性检查
   */
  private async convertToolsToDeepSeekFormat(allowedTools: string[]): Promise<any[]> {
    const tools = []
    
    // 如果没有允许的工具，直接返回空数组
    if (!allowedTools || allowedTools.length === 0) {
      return []
    }
    
    // 获取当前可用的工具（考虑权限）
    const availableTools = this.toolOrchestrator.getAvailableTools()
    const availableToolNames = new Set(availableTools.map(t => t.name))
    
    for (const toolName of allowedTools) {
      // 检查工具是否在允许的工具列表中
      // 内置兼容: 一些写作域工具（如 todo_*、exit_plan_mode）未接入编排器
      // 这里直接提供最小 JSON-Schema 描述，避免控制台出现噪音日志并允许模型原生函数调用。
      if (!availableToolNames.has(toolName)) {
        if (toolName === 'todo_write') {
          tools.push({
            type: 'function',
            function: {
              name: 'todo_write',
              description: '仅用于进度追踪的后台工具，更新任务状态。重要：调用此工具后必须继续执行用户请求的主要任务（如写故事、文章等）。此工具不替代实际内容生成。',
              parameters: {
                type: 'object',
                properties: {
                  todos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        content: { type: 'string' },
                        activeForm: { type: 'string' },
                        status: { type: 'string', enum: ['pending','in_progress','completed'] },
                        priority: { type: 'string', enum: ['high','medium','low'] }
                      },
                      required: ['id','content','activeForm','status']
                    }
                  }
                },
                required: ['todos']
              }
            }
          })
          continue
        }
        if (toolName === 'todo_read') {
          tools.push({
            type: 'function',
            function: {
              name: 'todo_read',
              description: '读取当前任务列表并返回 JSON。',
              parameters: { type: 'object', properties: {}, additionalProperties: false }
            }
          })
          continue
        }
        if (toolName === 'exit_plan_mode') {
          tools.push({
            type: 'function',
            function: {
              name: 'exit_plan_mode',
              description: '退出计划模式，恢复正常对话。',
              parameters: { type: 'object', properties: { plan: { type: 'string' } }, required: [] }
            }
          })
          continue
        }
        console.warn(`工具 ${toolName} 不在可用工具列表中，跳过`)
        continue
      }
      
      const tool = this.toolOrchestrator.getTool(toolName)
      if (!tool) continue

      try {
        // 获取工具的完整描述
        const description = await tool.prompt?.({ safeMode: false }) || await tool.description()
        
        // 生成 JSON schema - 使用工具的内置方法
        let parameters: any
        if (tool.inputJSONSchema) {
          parameters = tool.inputJSONSchema
        } else {
          // 回退到传统转换方法
          parameters = this.zodSchemaToJsonSchema(tool.inputSchema)
        }

        tools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: `${description}\n\n权限级别: ${tool.isReadOnly() ? '只读' : '可写'}\n并发安全: ${tool.isConcurrencySafe() ? '是' : '否'}`,
            parameters
          }
        })
        
        console.log(`✅ 工具 ${toolName} 已添加到 API 调用中`)
      } catch (error) {
        console.warn(`转换工具 ${toolName} 到 DeepSeek 格式失败:`, error)
        
        // 使用基础描述作为后备
        try {
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
          console.log(`⚠️  工具 ${toolName} 使用基础格式添加`)
        } catch (fallbackError) {
          console.error(`工具 ${toolName} 完全转换失败:`, fallbackError)
        }
      }
    }

    if (tools.length > 0) {
      console.log(`🔧 共转换 ${tools.length} 个工具供 AI 使用`)
    }

    return tools
  }

  /**
   * 将 Zod schema 转换为 JSON Schema
   */
  private zodSchemaToJsonSchema(zodSchema: any): any {
    // 简化的 Zod 到 JSON Schema 转换
    // 在实际项目中，建议使用 zod-to-json-schema 库
    const shape = zodSchema._def?.shape
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
   * 执行 DeepSeek API 的工具调用 - 使用新的工具编排器
   */
  private async executeDeepSeekToolCall(toolCall: any): Promise<AIToolExecutionResult> {
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

    try {
      // 创建工具执行上下文
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

      // 若编排器没有注册该工具，直接走旧域工具执行
      if (!this.toolOrchestrator.getTool(toolName)) {
        const legacy = await this.executeLegacyTool(toolName, args)
        if (legacy) {
          return {
            toolName,
            callId: toolCall.id,
            result: legacy.result,
            success: legacy.success,
            error: legacy.error
          }
        }
      }

      // 使用工具编排器执行工具调用
      const executionResult = await this.toolOrchestrator.executeTool({
        toolName,
        input: args,
        context: toolContext,
        priority: 5 // 中等优先级
      })

      // 转换为旧格式的结果（兼容性）
      if (executionResult.status === ToolExecutionStatus.COMPLETED) {
        return {
          toolName,
          callId: toolCall.id,
          result: this.formatToolResult(executionResult.result, toolName),
          success: true
        }
      } else {
        // 如果是未找到之类的错误，退回旧域工具执行
        if (executionResult.error?.message?.includes('未找到') || executionResult.error?.message?.includes('not found')) {
          const legacy = await this.executeLegacyTool(toolName, args)
          if (legacy) {
            return {
              toolName,
              callId: toolCall.id,
              result: legacy.result,
              success: legacy.success,
              error: legacy.error
            }
          }
        }
        return {
          toolName,
          callId: toolCall.id,
          result: '',
          success: false,
          error: executionResult.error?.message || '工具执行失败'
        }
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
      const toolResults: AIToolExecutionResult[] = []
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
  private async executeToolCall(toolCall: ToolCall): Promise<AIToolExecutionResult> {
    try {
      const tool = getTool(toolCall.toolName)
      if (!tool) {
        // 兼容旧域写作工具（todo_* 等）——直接调用工具实现
        const legacy = await this.executeLegacyTool(toolCall.toolName, toolCall.parameters)
        if (legacy) return { toolName: toolCall.toolName, callId: toolCall.callId, ...legacy }

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
   * 直接执行旧域工具（未注册到编排器）
   */
  private async executeLegacyTool(toolName: string, params: any): Promise<{ result: string; success: boolean; error?: string } | null> {
    try {
      // 统一会话 ID，确保与 UI/CLI 使用同一个 Todo 存储
      const sessionId = process.env.WRITEFLOW_SESSION_ID
      const { TodoManager } = await import('../../tools/TodoManager.js')
      const sharedManager = new TodoManager(sessionId)

      if (toolName === 'todo_write') {
        const { TodoWriteTool } = await import('../../tools/writing/TodoWriteTool.js')
        const tool = new TodoWriteTool(sharedManager)
        const res = await tool.execute(params, { agentId: 'ai-service', abortController: new AbortController(), options: { verbose: false } })
        return { result: res.content || '', success: res.success, error: res.success ? undefined : (res as any).error }
      }
      if (toolName === 'todo_read') {
        const { TodoReadTool } = await import('../../tools/writing/TodoReadTool.js')
        const tool = new TodoReadTool(sharedManager)
        const res = await tool.execute(params, { agentId: 'ai-service', abortController: new AbortController(), options: { verbose: false } })
        return { result: res.content || '', success: res.success, error: res.success ? undefined : (res as any).error }
      }
      if (toolName === 'exit_plan_mode') {
        // 简化处理：返回固定消息，交由上层解析
        return { result: '已退出计划模式', success: true }
      }
      return null
    } catch (error) {
      return { result: '', success: false, error: (error as Error).message }
    }
  }

  /**
   * 将工具结果集成到内容中
   */
  private integrateToolResults(content: string, results: AIToolExecutionResult[]): string {
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
