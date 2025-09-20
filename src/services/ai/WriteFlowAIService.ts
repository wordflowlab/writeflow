// ModelProfile interface
interface ModelProfile {
  id: string
  name: string
  provider: string
  contextWindow?: number
  maxOutputTokens?: number
}

/**
 * WriteFlow AI 服务 - 重构版本
 * 专为写作场景优化的 AI 服务协调器
 * 
 * 职责：
 * - 请求预处理和增强
 * - 提供商路由和协调
 * - 响应后处理和格式化
 * - 错误处理和回退
 */

import { getModelManager } from '../models/ModelManager.js'
import { debugLog, logError, logWarn } from '../../utils/log.js'
// 工具管理模块
import { 
  getToolExecutionManager,
  setupToolEnvironment,
  type ToolAnalysisResult
} from './tools/index.js'
import { ToolExecutionStatus } from '../../tools/ToolOrchestrator.js'
import { getMessageLogger } from './messaging/MessageManager.js'
import { getInteractiveExecutionManager } from './interaction/InteractiveExecutionManager.js'

// 内容处理模块
import {
  getContentProcessor,
  type ContentProcessingOptions
} from './content/index.js'

// 流式处理模块
import {
  getStreamingManager,
  getResponseHandler,
  type StreamingManagerOptions,
  type ResponseHandlerOptions
} from './streaming/index.js'

// 新的异步流式处理模块
import {
  getAsyncStreamingManager,
  startAsyncStreaming,
  type StreamMessage
} from './streaming/AsyncStreamingManager.js'

// 提供商系统
import { 
  createProvider, 
  inferProviderFromModel
} from './providers/ProviderFactory.js'

// UI 显示模块
import {
  getStreamingDisplay,
  displayMessageStream
} from '../../ui/components/StreamingDisplay.js'

// 保留的核心导入
import type { 
  ContentBlock 
} from '../../types/UIMessage.js'
import { parseAIResponse } from './ResponseParser.js'
import { generateOptimizedSystemPrompt } from '../../tools/SystemPromptOptimizer.js'
import { getContextManager } from '../ContextManager.js'

// 权限确认系统
import { 
  getPermissionConfirmationService, 
  PermissionRequest, 
  PermissionResponse 
} from '../PermissionConfirmationService.js'


// 兼容性类型 - 保持现有接口不变
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
  enableSmartAnalysis?: boolean
  taskContext?: string
  autoGenerateSystemPrompt?: boolean
  onToolUpdate?: (toolName: string, status: string, message?: string) => void
}

export interface AIResponse {
  content: string
  contentBlocks?: ContentBlock[]
  usage: {
    inputTokens: number
    outputTokens: number
  }
  cost: number
  duration: number
  model: string
  toolCalls?: ToolCall[]
  hasToolInteraction?: boolean
  toolCallsProcessed?: boolean
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
 * WriteFlow AI 服务类 - 重构版本（协调器模式）
 * 
 * 从原来的 2000+ 行缩减到约 400 行，主要职责：
 * 1. 请求预处理和增强
 * 2. 提供商路由
 * 3. 响应后处理
 * 4. 错误处理和回退
 */
export class WriteFlowAIService {
  private modelManager = getModelManager()
  private toolExecutionManager = getToolExecutionManager()
  private contentProcessor = getContentProcessor()
  private streamingManager = getStreamingManager()
  private responseHandler = getResponseHandler()
  private contextManager = getContextManager()
  private messageLogger = getMessageLogger()
  private interactiveManager = getInteractiveExecutionManager()
  private permissionService = getPermissionConfirmationService()
  
  /**
   * 处理 AI 请求（支持流式和非流式）
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    // 🌟 如果启用了流式处理，使用优化的流式实现
    if (request.stream && request.onToken) {
      debugLog('🌊 使用优化流式处理...')
      
      // 🚀 优化字符串处理：使用数组拼接减少内存开销
      const contentChunks: string[] = []
      let finalResponse: AIResponse | null = null
      
      // 🚀 流量控制：限制处理频率，防止UI阻塞
      let lastProcessTime = 0
      const MIN_PROCESS_INTERVAL = 8 // 最小8ms间隔
      let pendingChunks: string[] = []
      
      // 处理流式消息
      for await (const message of this.processAsyncStreamingRequest(request)) {
        // 检查是否是字符级增量消息
        if ((message as any).type === 'character_delta') {
          const delta = (message as any).delta
          if (delta && request.onToken) {
            contentChunks.push(delta)
            pendingChunks.push(delta)
            
            // 流量控制：批量处理避免高频调用
            const now = Date.now()
            if (now - lastProcessTime >= MIN_PROCESS_INTERVAL || pendingChunks.length >= 5) {
              request.onToken(pendingChunks.join(''))
              pendingChunks = []
              lastProcessTime = now
            }
          }
        } else if (message.type === 'progress') {
          // 🚀 处理进度消息 - 关键修复：确保Progress消息到达用户界面
          const progressMsg = message as any
          if (progressMsg.message && request.onToken) {
            // 处理剩余的挂起chunks先
            if (pendingChunks.length > 0) {
              request.onToken(pendingChunks.join(''))
              pendingChunks = []
            }
            // 立即推送Progress消息
            request.onToken(progressMsg.message)
            debugLog('📋 [WriteFlowAIService] 推送Progress消息:', progressMsg.message.substring(0, 50))
          }
        } else if (message.type === 'ai_response') {
          // 处理剩余的挂起chunks
          if (pendingChunks.length > 0) {
            request.onToken(pendingChunks.join(''))
            pendingChunks = []
          }
          
          // 最终完整响应
          finalResponse = {
            content: (message as any).content || contentChunks.join(''),
            usage: (message as any).metadata ? {
              inputTokens: (message as any).metadata.tokensUsed || 0,
              outputTokens: (message as any).metadata.tokensUsed || 0
            } : { inputTokens: 0, outputTokens: 0 },
            cost: 0,
            duration: (message as any).metadata?.duration || 0,
            model: (message as any).metadata?.model || request.model || 'deepseek-chat'
          }
        }
      }
      
      // 返回最终响应
      return finalResponse || {
        content: contentChunks.join(''),
        usage: { inputTokens: 0, outputTokens: 0 },
        cost: 0,
        duration: 0,
        model: request.model || 'deepseek-chat'
      }
    }
    
    // 非流式处理
    return this.processNonStreamingRequest(request)
  }

  /**
   * 异步流式处理 - 通过 ProviderFactory 保持提供商无关性
   * 支持实时工具执行显示，兼容所有提供商
   */
  async* processAsyncStreamingRequest(request: AIRequest): AsyncGenerator<StreamMessage, void, unknown> {
    const startTime = Date.now()
    
    try {
      // 发送开始消息
      yield {
        type: 'system',
        level: 'info',
        message: 'WriteFlow AI 开始处理请求',
        timestamp: startTime,
      } as StreamMessage

      // 预处理阶段 - 简化进度消息，避免与UI重复
      yield {
        type: 'progress',
        stage: 'preprocessing',
        message: '',
        progress: 10,
      } as StreamMessage

      const enhancedRequest = await this.enhanceRequest(request)
      
      // AI 响应阶段
      yield {
        type: 'progress', 
        stage: 'ai_processing',
        message: '',
        progress: 30,
      } as StreamMessage

      // 🎯 正确架构：通过 ProviderFactory 获取提供商
      const modelName = enhancedRequest.model || this.getDefaultModelName()
      const providerName = inferProviderFromModel(modelName)
      const provider = createProvider(providerName)
      
      // 检查提供商是否支持 AsyncGenerator 流式接口
      if (typeof (provider as any).processAsyncStreamingRequest === 'function') {
        // 使用提供商的 AsyncGenerator 接口
        for await (const message of (provider as any).processAsyncStreamingRequest(enhancedRequest)) {
          yield message
        }
      } else {
        // 回退到传统流式处理
        const response = await provider.processStreamingRequest(enhancedRequest, this.getModelProfile(modelName))
        
        yield {
          type: 'ai_response',
          content: response.content,
          isComplete: true,
          metadata: {
            model: response.model,
            tokensUsed: response.usage.outputTokens,
            duration: response.duration
          }
        } as StreamMessage
      }

      // 完成处理
      const duration = Date.now() - startTime
      yield {
        type: 'system',
        level: 'info',
        message: `处理完成 (${duration}ms)`,
        timestamp: Date.now()
      } as StreamMessage

    } catch (_error) {
      yield {
        type: "error",
        message: `AI请求处理失败: ${_error instanceof Error ? _error.message : String(_error)}`,
        error: _error as Error, _context: { request }
      } as StreamMessage
    }
  }

  /**
   * 处理流式 AI 请求
   */
  async processStreamingRequest(request: AIRequest): Promise<AIResponse> {
    const streamRequest = { ...request, stream: true }
    return this.processNonStreamingRequest(streamRequest)
  }

  /**
   * 处理非流式 AI 请求
   */
  async processNonStreamingRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    
    try {
      // 预处理请求：智能分析和系统提示词增强
      const enhancedRequest = await this.enhanceRequest(request)
      
      // 获取模型配置
      const modelName = enhancedRequest.model || this.getDefaultModelName()
      if (!modelName) {
        throw new Error('没有可用的模型配置')
      }
      
      // 创建模型配置
      const modelProfile = this.findOrCreateModelProfile(modelName)
      if (!modelProfile) {
        throw new Error(`找不到模型配置: ${modelName}`)
      }
      
      // 离线模式处理
      if (process.env.WRITEFLOW_AI_OFFLINE === 'true') {
        let offlineResponse = this.createOfflineResponse(enhancedRequest, startTime)
        
        // 离线模式也支持工具交互处理
        if (enhancedRequest.enableToolCalls && enhancedRequest.allowedTools && enhancedRequest.allowedTools.length > 0) {
          // 修改离线响应内容，包含一些工具调用示例
          offlineResponse.content = this.createOfflineResponseWithToolCalls(enhancedRequest)
          offlineResponse = await this.processToolInteractions(offlineResponse, enhancedRequest)
          offlineResponse.hasToolInteraction = true
        }
        
        return offlineResponse
      }
      
      // 获取提供商
      const providerName = inferProviderFromModel(modelName)
      const provider = createProvider(providerName)
      
      // 转换请求格式
      const providerRequest = this.convertToProviderRequest(enhancedRequest)
      
      // 调用提供商处理请求
      let response: AIResponse
      if (enhancedRequest.stream) {
        response = await provider.processStreamingRequest(enhancedRequest, modelProfile)
      } else {
        response = await provider.processRequest(enhancedRequest, modelProfile)
      }
      
      // 转换响应格式并后处理
      let finalResponse = await this.convertFromProviderResponse(response, enhancedRequest)
      finalResponse.duration = Date.now() - startTime
      
      // 如果启用了工具调用，处理工具交互
      if (enhancedRequest.enableToolCalls && enhancedRequest.allowedTools && enhancedRequest.allowedTools.length > 0) {
        console.log('🛠️ [WriteFlowAIService] 开始处理工具交互')
        finalResponse = await this.processToolInteractions(finalResponse, enhancedRequest)
        finalResponse.hasToolInteraction = true
        console.log('✅ [WriteFlowAIService] 工具交互处理完成')
      }
      
      return finalResponse
      
    } catch (_error) {
      return this.handleError(_error, request, startTime)
    }
  }
  
  /**
   * 增强请求：自动检测并启用智能分析功能
   */
  private async enhanceRequest(request: AIRequest): Promise<AIRequest> {
    // 🎯 新增：任务顺序验证，确保创作任务按正确顺序执行
    await this.validateTaskOrder(request)
    
    // 使用工具执行管理器设置工具环境
    const enhanced = this.toolExecutionManager.setupToolEnvironment({
      prompt: request.prompt,
      enableToolCalls: request.enableToolCalls,
      allowedTools: request.allowedTools,
      enableSmartAnalysis: request.enableSmartAnalysis
    })
    
    // 合并其他请求属性
    const finalRequest = { ...request, ...enhanced }
    
    // 自动生成或增强系统提示词
    if (finalRequest.autoGenerateSystemPrompt !== false) {
      finalRequest.systemPrompt = await this.generateEnhancedSystemPrompt(finalRequest)
    }
    
    return finalRequest
  }
  
  
  /**
   * 验证任务执行顺序，确保创作任务按正确流程执行
   */
  private async validateTaskOrder(request: AIRequest): Promise<void> {
    try {
      // 检测是否是创作相关的请求
      const isCreativeTask = this.isCreativeWritingTask(request.prompt)
      if (!isCreativeTask) {
        return // 非创作任务无需验证顺序
      }

      // 获取当前TODO状态
      const todoManager = (globalThis as any).__writeflow_todo_manager__
      if (!todoManager) {
        return // 没有TODO管理器时跳过验证
      }

      const currentTodos = await todoManager.getAllTodos()
      if (!currentTodos || currentTodos.length === 0) {
        return // 没有当前任务时跳过验证
      }

      // 定义创作任务的正确顺序
      const creativeTaskOrder = [
        '框架', '大纲', '结构',
        '人物', '角色', '设定',
        '撰写', '写作', '创作',
        '完善', '优化', '润色',
      ]

      // 检查当前请求的任务类型
      const currentTaskType = this.detectCreativeTaskType(request.prompt)
      if (!currentTaskType) {
        return // 无法识别任务类型时跳过验证
      }

      // 获取当前进行中或已完成的任务
      const activeTodos = currentTodos.filter((todo: any) => 
        todo.status === 'in_progress' || todo.status === 'completed'
      )

      // 检查前置任务是否完成
      const currentTaskIndex = this.getTaskOrderIndex(currentTaskType, creativeTaskOrder)
      const hasUncompletedPrerequisites = this.checkPrerequisiteTasks(
        currentTaskIndex, 
        activeTodos, 
        creativeTaskOrder,
      )

      if (hasUncompletedPrerequisites) {
        logWarn(`⚠️ 任务顺序验证：尝试执行"${currentTaskType}"，但前置任务未完成`)
        
        // 在系统提示中添加任务顺序提醒，而不是阻止执行
        const orderReminder = `
        
🎯 任务执行顺序提醒：
当前正在处理"${currentTaskType}"任务，请确保严格按以下顺序执行创作任务：
1. 框架设计 → 2. 人物设定 → 3. 内容撰写 → 4. 内容完善

请先完成前置步骤，再进行当前任务。`
        
        request.systemPrompt = (request.systemPrompt || '') + orderReminder
      }

    } catch (_error) {
      logWarn('任务顺序验证失败，继续执行:', _error)
      // 验证失败时不阻止执行，只记录警告
    }
  }

  /**
   * 检测是否为创意写作任务
   */
  private isCreativeWritingTask(prompt: string): boolean {
    const creativeKeywords = [
      '小说', '故事', '创作', '撰写', '写作',
      '剧本', '诗歌', '文章', '内容',
      '三国', '历史', '传记', '记录',
    ]
    
    return creativeKeywords.some(keyword => prompt.includes(keyword))
  }

  /**
   * 检测创作任务类型
   */
  private detectCreativeTaskType(prompt: string): string | null {
    const taskPatterns = [
      { type: '框架', patterns: ['框架', '大纲', '结构', '规划', '设计框架'] },
      { type: '人物', patterns: ['人物', '角色', '设定', '人设', '角色设计'] },
      { type: '撰写', patterns: ['撰写', '写作', '创作', '编写', '书写'] },
      { type: '完善', patterns: ['完善', '优化', '润色', '修改', '改进'] },
    ]

    for (const { type, patterns } of taskPatterns) {
      if (patterns.some(pattern => prompt.includes(pattern))) {
        return type
      }
    }
    
    return null
  }

  /**
   * 获取任务在顺序中的索引
   */
  private getTaskOrderIndex(taskType: string, orderArray: string[]): number {
    for (let i = 0; i < orderArray.length; i++) {
      if (orderArray[i] === taskType) {
        return i
      }
    }
    return -1
  }

  /**
   * 检查前置任务是否完成
   */
  private checkPrerequisiteTasks(
    currentIndex: number, 
    activeTodos: any[], 
    orderArray: string[],
  ): boolean {
    if (currentIndex <= 0) {
      return false // 第一个任务无需检查前置条件
    }

    // 检查前置任务是否都已完成
    for (let i = 0; i < currentIndex; i++) {
      const prerequisiteType = orderArray[i]
      const hasCompletedPrerequisite = activeTodos.some((todo: any) =>
        todo.status === 'completed' && 
        this.todoContainsTaskType(todo.content, prerequisiteType)
      )
      
      if (!hasCompletedPrerequisite) {
        return true // 发现未完成的前置任务
      }
    }
    
    return false // 所有前置任务都已完成
  }

  /**
   * 检查TODO内容是否包含指定任务类型
   */
  private todoContainsTaskType(todoContent: string, taskType: string): boolean {
    const taskKeywords: Record<string, string[]> = {
      '框架': ['框架', '大纲', '结构'],
      '人物': ['人物', '角色', '设定'],
      '撰写': ['撰写', '写作', '创作'],
      '完善': ['完善', '优化', '润色'],
    }
    
    const keywords = taskKeywords[taskType] || [taskType]
    return keywords.some((keyword: string) => todoContent.includes(keyword))
  }

  /**
   * 生成增强的系统提示词
   */
  private async generateEnhancedSystemPrompt(request: AIRequest): Promise<string> {
    try {
      const optimizedPrompt = await generateOptimizedSystemPrompt({
        taskContext: request.taskContext,
        safeMode: false,
        compact: false
      })
      
      if (request.systemPrompt) {
        return `${optimizedPrompt}\n\n## 用户自定义指令\n${request.systemPrompt}`
      }
      
      return optimizedPrompt
    } catch (_error) {
      logWarn('生成优化系统提示词失败，使用默认提示词:', _error)
      return request.systemPrompt || '你是 WriteFlow AI 写作助手，请帮助用户完成各种写作和分析任务。'
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
      case 'deepseek': return 'deepseek-chat'
      case 'qwen3': return 'qwen-turbo'
      case 'glm4.5': return 'glm-4-flash'
      case 'anthropic': return 'claude-3-sonnet-20240229'
      case 'openai': return 'gpt-3.5-turbo'
      case 'kimi': return 'moonshot-v1-8k'
      default:
        // 检查可用的 API string，智能选择默认模型
        if (process.env.DEEPSEEK_API_KEY) return 'deepseek-chat'
        if (process.env.ANTHROPIC_API_KEY) return 'claude-3-sonnet-20240229'
        if (process.env.OPENAI_API_KEY) return 'gpt-3.5-turbo'
        if (process.env.KIMI_API_KEY) return 'moonshot-v1-8k'
        if (process.env.GLM_API_KEY) return 'glm-4-flash'
        
        return 'deepseek-chat' // 最终默认
    }
  }
  
  /**
   * 查找或创建模型配置
   */
  private findOrCreateModelProfile(name: string): ModelProfile | null {
    // 先尝试从模型管理器中查找
    const profiles = this.modelManager.getAllProfiles()
    const existing = profiles.find(p => p.name === name)
    if (existing) {
      return { ...existing, id: (existing as any).id || existing.name } as ModelProfile
    }
    
    // 创建临时模型配置
    return this.createTempModelProfile(name)
  }
  
  /**
   * 根据模型名称创建临时的模型配置
   */
  private createTempModelProfile(modelName: string): ModelProfile | null {
    const providerName = inferProviderFromModel(modelName)
    
    // 根据提供商创建配置
    const providerConfigs = {
      anthropic: {
        baseURL: 'https://api.anthropic.com/v1/messages',
        envKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY']
      },
      deepseek: {
        baseURL: 'https://api.deepseek.com/v1/chat/completions',
        envKeys: ['DEEPSEEK_API_KEY']
      },
      openai: {
        baseURL: 'https://api.openai.com/v1/chat/completions',
        envKeys: ['OPENAI_API_KEY']
      },
      kimi: {
        baseURL: 'https://api.moonshot.cn/v1/chat/completions',
        envKeys: ['KIMI_API_KEY', 'MOONSHOT_API_KEY']
      },
      qwen: {
        baseURL: process.env.API_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        envKeys: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY']
      },
      glm: {
        baseURL: process.env.API_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        envKeys: ['GLM_API_KEY', 'ZHIPUAI_API_KEY']
      },
      custom: {
        baseURL: process.env.CUSTOM_BASE_URL || process.env.API_BASE_URL || '',
        envKeys: ['CUSTOM_API_KEY', 'API_KEY']
      },
      'custom-openai': {
        baseURL: process.env.CUSTOM_BASE_URL || process.env.API_BASE_URL || '',
        envKeys: ['CUSTOM_API_KEY', 'API_KEY', 'OPENAI_API_KEY']
      }
    }
    
    const config = providerConfigs[providerName as keyof typeof providerConfigs]
    if (!config) return null
    
    // 获取 API 密钥
    let apiKey = ''
    for (const envKey of config.envKeys) {
      const value = process.env[envKey]
      if (value) {
        apiKey = value
        break
      }
    }
    
    // 对于自定义提供商，检查 baseURL 是否配置
    if ((providerName === 'custom' || providerName === 'custom-openai') && !config.baseURL) {
      logWarn(`自定义提供商 ${providerName} 需要配置 CUSTOM_BASE_URL 或 API_BASE_URL 环境变量`)
      return null
    }

    if (!apiKey && config.envKeys.length > 0) {
      logWarn(`找不到 ${providerName} 的 API 密钥，尝试的环境变量: ${config.envKeys.join(', ')}`)
      return null
    }
    
    return {
      id: `temp-${modelName}`,
      name: modelName,
      provider: providerName as any,
      contextWindow: 128000,
      maxOutputTokens: 4000
    } as ModelProfile
  }
  
  /**
   * 转换到提供商请求格式 (暂时直接返回)
   */
  private convertToProviderRequest(request: AIRequest): AIRequest {
    return request
  }
  
  /**
   * 转换提供商响应格式，使用内容处理器
   */
  private async convertFromProviderResponse(response: AIResponse, originalRequest: AIRequest): Promise<AIResponse> {
    // 使用内容处理器处理响应内容
    const processed = await this.contentProcessor.processAIResponse(response.content, {
      enableCollapsible: true,
      enableAnalysis: false,
      parseMarkdown: true,
      enhanceFormatting: false
    })
    
    return {
      content: response.content,
      contentBlocks: processed.contentBlocks,
      usage: response.usage,
      cost: response.cost,
      duration: response.duration,
      model: response.model,
      streamingStats: response.streamingStats
    }
  }
  
  /**
   * 处理工具交互 - 集成渐进式展示
   */
  private async processToolInteractions(response: AIResponse, request: AIRequest): Promise<AIResponse> {
    const maxIterations = 10
    let iterationCount = 0
    let currentContent = response.content

    while (iterationCount < maxIterations) {
      // 检测工具调用
      const toolCalls = this.detectToolCalls(currentContent, request.allowedTools!)
      
      if (toolCalls.length === 0) {
        // 没有工具调用，结束处理
        break
      }

      this.messageLogger.systemInfo(`检测到 ${toolCalls.length} 个工具调用`)
      
      // 创建交互式执行计划
      const executionPlan = this.interactiveManager.createExecutionPlan(
        `AI请求工具执行 - 第${iterationCount + 1}轮`,
        toolCalls.map(call => ({
          toolName: call.toolName,
          parameters: call.parameters
        })),
        {
          requireConfirmation: false,  // AI自动执行时不需要确认
          allowInterruption: false,    // 批量执行时不允许中断 
          showPreview: true,          // 显示执行预览
          batchMode: true             // 批量模式
        }
      )
      
      // 开始交互式执行，添加UI更新回调
      const session = await this.interactiveManager.startInteractiveExecution(executionPlan, {
        requireConfirmation: false,
        allowInterruption: false,
        showPreview: true,
        batchMode: true,
        onToolUpdate: request.onToolUpdate || ((toolName: string, status: string, message?: string) => {
          // 默认使用控制台输出，或使用传递的回调
          this.notifyToolStatusUpdate(toolName, status, message)
        })
      })
      
      // 将交互式执行结果转换为工具结果
      const toolResults: any[] = session.results.map(result => ({
        toolName: result.toolName,
        callId: `interactive_${result.executionId}`,
        result: result.result,
        success: result.status === ToolExecutionStatus.COMPLETED,
        error: result.error?.message
      }))

      // 如果没有结果，回退到直接执行
      if (toolResults.length === 0) {
        for (const toolCall of toolCalls) {
          try {
            // 权限确认检查
            const hasPermission = await this.checkToolPermission(toolCall)
            if (!hasPermission) {
              toolResults.push({
                toolName: toolCall.toolName,
                callId: toolCall.callId,
                result: '',
                success: false,
                error: '权限被拒绝'
              })
              continue
            }

            const result = await this.toolExecutionManager.executeToolCall(
              toolCall.toolName,
              toolCall.parameters,
              { 
                requestId: 'ai-service',
                userId: 'ai-user'
              }
            )
            
            toolResults.push({
              toolName: toolCall.toolName,
              callId: toolCall.callId,
              result: result.result,
              success: result.status === ToolExecutionStatus.COMPLETED,
              error: result.error?.message
            })
          } catch (_error) {
            // 对于 TODO 相关工具，尝试使用 legacy 执行方式
            if (['todo_write', 'todo_read', 'exit_plan_mode'].includes(toolCall.toolName)) {
              try {
                const legacyResult = await this.executeLegacyTool(toolCall.toolName, toolCall.parameters)
                if (legacyResult) {
                  toolResults.push({
                    toolName: toolCall.toolName,
                    callId: toolCall.callId,
                    result: legacyResult.result,
                    success: legacyResult.success,
                    error: legacyResult.error
                  })
                  continue
                }
              } catch (legacyError) {
                // Legacy 执行也失败了，记录错误
                this.messageLogger.systemError(`Legacy tool execution failed for ${toolCall.toolName}: ${legacyError}`)
              }
            }
            
            // 标准错误处理
            toolResults.push({
              toolName: toolCall.toolName,
              callId: toolCall.callId,
              result: '',
              success: false,
              error: _error instanceof Error ? _error.message : String(_error)
            })
          }
        }
      }

      // 更新内容，移除已处理的工具调用
      currentContent = this.updateContentWithToolResults(currentContent, toolResults)
      
      iterationCount++
      
      // 如果所有工具都失败了，停止迭代
      if (toolResults.every(result => !result.success)) {
        this.messageLogger.systemWarning('所有工具调用都失败了，停止处理')
        break
      }
    }

    return {
      ...response,
      content: currentContent,
      toolCallsProcessed: iterationCount > 0
    }
  }

  /**
   * 检测工具调用
   */
  private detectToolCalls(content: string, allowedTools: string[]): any[] {
    const toolCalls: any[] = []
    
    // 检测格式：Write("filename", "content")
    const toolCallPattern = /(\w+)\s*\(([^)]+)\)/g
    let match

    while ((match = toolCallPattern.exec(content)) !== null) {
      const [fullMatch, toolName, argsStr] = match
      
      if (allowedTools.includes(toolName)) {
        try {
          // 尝试解析参数
          const parameters = this.parseToolArguments(argsStr)
          
          toolCalls.push({
            toolName,
            callId: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            parameters,
            fullMatch
          })
        } catch (_error) {
          this.messageLogger.systemWarning(`解析工具调用参数失败 ${toolName}: ${_error}`)
        }
      }
    }

    return toolCalls
  }

  /**
   * 解析工具参数
   */
  private parseToolArguments(argsStr: string): any {
    // 简单的参数解析 - 支持字符串和基本类型
    const args = argsStr.split(',').map(arg => arg.trim().replace(/['"]/g, ''))
    
    // 根据参数数量确定参数结构
    if (args.length === 1) {
      return { input: args[0] }
    } else if (args.length === 2) {
      return { path: args[0], content: args[1] }
    } else {
      return { args }
    }
  }

  /**
   * 更新内容，将工具调用替换为结果
   */
  private updateContentWithToolResults(content: string, results: any[]): string {
    let updatedContent = content

    for (const result of results) {
      if (result.success) {
        // 在工具调用位置显示执行结果
        const toolCallPattern = new RegExp(`${result.toolName}\\s*\\([^)]+\\)`, 'gi')
        updatedContent = updatedContent.replace(toolCallPattern, (match) => {
          const resultPreview = result.result ? result.result.slice(0, 100) : ''
          return `${match}\n✅ [工具执行完成] ${resultPreview}${result.result?.length > 100 ? '...' : ''}`
        })
      } else {
        // 显示错误信息
        const toolCallPattern = new RegExp(`${result.toolName}\\s*\\([^)]+\\)`, 'gi')
        updatedContent = updatedContent.replace(toolCallPattern, (match) => {
          return `${match}\n❌ [工具执行失败] ${result.error || '未知错误'}`
        })
      }
    }

    return updatedContent
  }

  /**
   * 创建离线模式响应
   */
  private createOfflineResponse(request: AIRequest, startTime: number): AIResponse {
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
  
  /**
   * 创建包含工具调用的离线响应
   */
  private createOfflineResponseWithToolCalls(request: AIRequest): string {
    const prompt = request.prompt.toLowerCase()
    
    // 根据用户请求智能生成工具调用示例
    if (prompt.includes('读取') || prompt.includes('read')) {
      return `【离线模式演示】正在执行您的请求...

我将使用以下工具来完成您的任务：

Read("README.md")

让我读取README.md文件来了解项目信息。`
    }
    
    if (prompt.includes('搜索') || prompt.includes('查找') || prompt.includes('grep')) {
      return `【离线模式演示】正在执行搜索任务...

Grep("function", "*.ts")

让我在TypeScript文件中搜索函数定义。`
    }
    
    if (prompt.includes('写入') || prompt.includes('创建文件') || prompt.includes('write')) {
      return `【离线模式演示】正在创建文件...

Write("example.md", "# 示例文件\\n这是一个示例文件的内容。")

让我创建一个示例文件。`
    }
    
    // 默认响应 - 包含多个工具调用示例
    return `【离线模式演示】正在分析您的需求并执行相应的工具...

首先让我读取项目信息：
Read("README.md")

然后搜索相关文件：
Grep("${request.prompt.slice(0, 50)}", "**/*.md")

最后创建分析结果：
Write("analysis.md", "# 分析结果\\n基于您的请求进行的分析...")

这样我可以为您提供全面的分析和处理。`
  }

  /**
   * 错误处理
   */
  private handleError(error: any, request: AIRequest, startTime: number): AIResponse {
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

  /**
   * 执行传统工具调用 - 特别处理 TODO 工具
   * 从 backup 版本恢复，用于支持 AI 调用 TODO 工具
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
        const res = await tool.execute(params, { 
          agentId: 'ai-service', 
          abortController: new AbortController(), 
          options: { verbose: false } 
        })
        return { result: res.content || '', success: res.success, error: res.success ? undefined : (res as any).error }
      }
      if (toolName === 'todo_read') {
        const { TodoReadTool } = await import('../../tools/writing/TodoReadTool.js')
        const tool = new TodoReadTool(sharedManager)
        const res = await tool.execute(params, { 
          agentId: 'ai-service', 
          abortController: new AbortController(), 
          options: { verbose: false } 
        })
        return { result: res.content || '', success: res.success, error: res.success ? undefined : (res as any).error }
      }
      if (toolName === 'exit_plan_mode') {
        // 简化处理：返回固定消息，交由上层解析
        return { result: '已退出计划模式', success: true }
      }
      return null
    } catch (_error) {
      return { result: '', success: false, error: (_error as Error).message }
    }
  }
  
  /**
   * 检查工具权限
   */
  private async checkToolPermission(toolCall: any): Promise<boolean> {
    try {
      // 对于需要权限确认的工具（如Write、Edit等）
      if (['Write', 'Edit', 'MultiEdit', 'Bash'].includes(toolCall.toolName)) {
        // 构建权限请求
        const permissionRequest: PermissionRequest = {
          id: `permission_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          toolName: toolCall.toolName,
          filePath: toolCall.parameters.file_path || toolCall.parameters.path || '未指定',
          description: this.getToolDescription(toolCall),
          args: toolCall.parameters
        }

        // 请求权限确认
        const response = await this.permissionService.requestPermission(permissionRequest)
        return response.decision === 'allow' || response.decision === 'allow-session'
      }

      // 对于读取类工具，直接允许
      if (['Read', 'Glob', 'Grep', 'todo_read', 'todo_write'].includes(toolCall.toolName)) {
        return true
      }

      // 默认需要确认
      return false
    } catch (_error) {
      this.messageLogger.systemError(`权限检查失败: ${_error}`)
      return false
    }
  }

  /**
   * 获取工具描述
   */
  private getToolDescription(toolCall: any): string {
    switch (toolCall.toolName) {
      case 'Write':
        return `写入文件: ${toolCall.parameters.file_path || '未指定'}`
      case 'Edit':
        return `编辑文件: ${toolCall.parameters.file_path || '未指定'}`
      case 'MultiEdit':
        return `批量编辑文件: ${toolCall.parameters.file_path || '未指定'}`
      case 'Bash':
        return `执行命令: ${toolCall.parameters.command || '未指定'}`
      default:
        return `执行工具: ${toolCall.toolName}`
    }
  }

  /**
   * 获取模型配置 - 保持现有兼容性
   */
  private getModelProfile(modelName: string): ModelProfile {
    const profile = this.findOrCreateModelProfile(modelName)
    if (!profile) {
      throw new Error(`无法创建模型配置: ${modelName}`)
    }
    return profile
  }
  
  /**
   * 通知UI工具状态更新
   */
  private notifyToolStatusUpdate(toolName: string, status: string, message?: string): void {
    // 这里将来可以连接到UI事件系统
    // 暂时使用console.log输出，但格式化为类似ToolStatusMessage的样式
    const statusIcon = status === 'completed' ? '●' : status === 'running' ? '○' : '○'
    console.log(`${statusIcon} ${toolName}${message ? ` - ${message}` : ''}`)
  }
  
}

// 全局服务实例（保持兼容性）
let globalAIService: WriteFlowAIService | null = null

/**
 * 获取全局 WriteFlow AI 服务实例
 */
export function getWriteFlowAIService(): WriteFlowAIService {
  if (!globalAIService) {
    globalAIService = new WriteFlowAIService()
  }
  return globalAIService
}

/**
 * 导出默认实例（兼容性）
 */
export const writeFlowAIService = getWriteFlowAIService()