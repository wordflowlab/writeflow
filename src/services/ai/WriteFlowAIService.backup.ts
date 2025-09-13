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
import { formatContent, toolFormatter } from '../../utils/SmartFormatter.js'
import { format } from '../../utils/colorScheme.js'
import { analyzeContent } from '../../utils/contentAnalyzer.js'
import { AgentContext } from '../../types/agent.js'
import { ToolUseContext } from '../../Tool.js'
import { getResponseStateManager } from '../streaming/ResponseStateManager.js'
import { getProviderAdapter } from './providers/index.js'
import { emitReminderEvent } from '../SystemReminderService.js'
import { startStreamingProgress, stopStreamingProgress } from '../streaming/ProgressIndicator.js'
import { getOutputFormatter } from '../../ui/utils/outputFormatter.js'
import { parseAIResponse, parseStreamingChunk, type ParsedResponse } from './ResponseParser.js'
import type { 
  ContentBlock, 
  LongContentBlock 
} from '../../types/UIMessage.js'
import { 
  createTextBlock, 
  createLongContentBlock
} from '../../types/UIMessage.js'
import type { 
  CollapsibleContentType, 
  ContentAnalysis
} from '../../types/CollapsibleContent.js'
import { 
  AUTO_COLLAPSE_THRESHOLDS,
  CONTENT_TYPE_PATTERNS 
} from '../../types/CollapsibleContent.js'
import { generateOptimizedSystemPrompt } from '../../tools/SystemPromptOptimizer.js'
import { addCostEntry } from '../CostTracker.js'
import { getContextManager, estimateTokens, ContextEntry } from '../ContextManager.js'

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
  // 智能分析相关选项
  enableSmartAnalysis?: boolean
  taskContext?: string
  autoGenerateSystemPrompt?: boolean
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
  private contextManager = getContextManager()
  
  /**
   * 处理 AI 请求（支持流式和非流式）
   */
  async processRequest(request: AIRequest): Promise<AIResponse> {
    // 预处理请求：智能分析和系统提示词增强
    const enhancedRequest = await this.enhanceRequest(request)
    
    // 如果请求流式处理，委托给流式服务
    if (enhancedRequest.stream) {
      return this.processStreamingRequest(enhancedRequest)
    }
    
    return this.processNonStreamingRequest(enhancedRequest)
  }

  /**
   * 增强请求：自动检测并启用智能分析功能
   */
  private async enhanceRequest(request: AIRequest): Promise<AIRequest> {
    const enhanced = { ...request }
    
    // 自动检测是否需要智能分析
    const needsSmartAnalysis = this.detectSmartAnalysisNeed(request.prompt)
    
    if (needsSmartAnalysis || request.enableSmartAnalysis) {
      // 启用工具调用
      enhanced.enableToolCalls = true
      enhanced.allowedTools = enhanced.allowedTools || [
        'Read', 'Grep', 'Glob', 'Bash', 
        'todo_write', 'todo_read'
      ]
      
      // 设置任务上下文
      enhanced.taskContext = enhanced.taskContext || this.extractTaskContext(request.prompt)
    }
    
    // 自动生成或增强系统提示词
    if (enhanced.autoGenerateSystemPrompt !== false) {
      enhanced.systemPrompt = await this.generateEnhancedSystemPrompt(enhanced)
    }
    
    return enhanced
  }

  /**
   * 检测是否需要智能分析
   */
  private detectSmartAnalysisNeed(prompt: string): boolean {
    const analysisKeywords = [
      '分析', '项目', '总结', '理解', '查看', '检查', '搜索', '探索',
      'analyze', 'project', 'summary', 'understand', 'explore', 'search'
    ]
    
    const lowerPrompt = prompt.toLowerCase()
    return analysisKeywords.some(keyword => 
      lowerPrompt.includes(keyword) || 
      lowerPrompt.includes(keyword.toLowerCase())
    )
  }

  /**
   * 从提示词中提取任务上下文
   */
  private extractTaskContext(prompt: string): string {
    // 简单的上下文提取逻辑
    if (prompt.includes('项目') || prompt.includes('project')) {
      return '项目分析和结构理解'
    }
    if (prompt.includes('代码') || prompt.includes('code')) {
      return '代码分析和理解'
    }
    if (prompt.includes('文件') || prompt.includes('file')) {
      return '文件分析和处理'
    }
    return '智能分析任务'
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
      
      // 如果用户提供了自定义系统提示词，将其与优化提示词合并
      if (request.systemPrompt) {
        return `${optimizedPrompt}\n\n## 用户自定义指令\n${request.systemPrompt}`
      }
      
      return optimizedPrompt
    } catch (error) {
      console.warn('生成优化系统提示词失败，使用默认提示词:', error)
      return request.systemPrompt || '你是 WriteFlow AI 写作助手，请帮助用户完成各种写作和分析任务。'
    }
  }

  /**
   * 显示工具执行过程的详细反馈，使用智能格式化器
   */
  private displayToolExecution(toolCall: any): ContentBlock | null {
    const { name: toolName, arguments: argsStr } = toolCall.function
    
    try {
      const args = JSON.parse(argsStr)
      
      // 🔧 标准化参数以支持不同的参数命名
      const normalizedArgs = this.normalizeToolParams(toolName, args)
      
      // 简化的控制台输出 - 只显示关键信息
      const briefMessage = this.getBriefToolMessage(toolName, normalizedArgs)
      
      // 构建详细内容用于展开
      const detailedContent = this.formatDetailedToolExecution(toolName, normalizedArgs, '执行中...')
      
      // 控制台显示简洁信息和展开提示
      console.log(`${briefMessage} ${format.dim('(Ctrl+R to expand)')}`)
      
      // 创建可折叠的工具执行块
      const contentId = `tool-exec-${toolName.toLowerCase()}-${Date.now()}`
      return createLongContentBlock(
        detailedContent,
        'tool-execution',
        briefMessage,
        { 
          collapsed: true, // 默认折叠，显示简洁信息
          maxLines: 1,
          id: contentId
        },
        {
          toolName,
          contentType: 'tool-execution',
          estimatedLines: detailedContent.split('\n').length,
          hasLongContent: true
        }
      )
      
    } catch (error) {
      const simpleMessage = format.tool(toolName, '执行中')
      console.log(`${simpleMessage} ${format.dim('(parsing error)')}`)
      
      // 即使解析失败也创建基本的内容块
      return createTextBlock(
        simpleMessage,
        {
          id: `tool-${Date.now()}`,
          collapsed: false,
          autoCollapse: false,
          maxLines: 3
        },
        {
          estimatedLines: 1,
          hasLongContent: false,
          contentType: 'tool-execution',
          toolName
        }
      )
    }
  }

  /**
   * 格式化详细的工具执行信息
   */
  private formatDetailedToolExecution(toolName: string, args: any, status: string): string {
    const lines = [`🔧 ${toolName} 工具执行详细信息`, '']
    
    // 添加参数信息
    lines.push('参数:')
    for (const [key, value] of Object.entries(args)) {
      const displayValue = typeof value === 'string' && value.length > 100 
        ? value.slice(0, 100) + '...' 
        : JSON.stringify(value)
      lines.push(`  ${key}: ${displayValue}`)
    }
    
    lines.push('')
    lines.push(`状态: ${status}`)
    
    return lines.join('\n')
  }

  /**
   * 生成简化的工具执行消息 - 只显示最关键的信息
   */
  private getBriefToolMessage(toolName: string, args: any): string {
    switch (toolName) {
      case 'Read':
        const fileName = this.getFileName(args.file_path || '未知文件')
        return format.info(`📖 读取 ${fileName}`)
      case 'Grep':
        const pattern = args.pattern || '未知模式'
        return format.info(`🔍 搜索 "${pattern}"`)
      case 'Glob':
        const globPattern = args.pattern || '未知模式'
        return format.info(`📁 查找 ${globPattern}`)
      case 'Bash':
        const cmd = this.getSimpleCommand(args.command || '未知命令')
        return format.info(`⚡ 执行 ${cmd}`)
      case 'Write':
        const writeFile = this.getFileName(args.file_path || '未知文件')
        return format.info(`✏️ 写入 ${writeFile}`)
      case 'Edit':
        const editFile = this.getFileName(args.file_path || '未知文件')
        return format.info(`✂️ 编辑 ${editFile}`)
      default:
        return format.info(`🔧 ${toolName}`)
    }
  }
  
  /**
   * 从文件路径中提取文件名
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split('/')
    return parts[parts.length - 1] || filePath
  }
  
  /**
   * 简化命令显示
   */
  private getSimpleCommand(command: string): string {
    if (command.length > 30) {
      return command.split(' ')[0] + '...'
    }
    return command
  }
  
  /**
   * 生成简化的工具结果消息
   */
  private getBriefResultMessage(toolName: string, status: string, result: string): string {
    const lines = result.split('\n').length
    const chars = result.length
    
    let statusIcon = ''
    let statusColor = format.success
    
    switch (status) {
      case 'success':
        statusIcon = '✅'
        statusColor = format.success
        break
      case 'error':
        statusIcon = '❌'
        statusColor = format.error
        break
      default:
        statusIcon = '🔧'
        statusColor = format.info
    }
    
    // 根据工具类型生成不同的结果摘要
    switch (toolName) {
      case 'Read':
        if (status === 'success') {
          return statusColor(`${statusIcon} 读取完成 (${lines} 行)`)
        } else {
          return statusColor(`${statusIcon} 读取失败`)
        }
      case 'Grep':
        if (status === 'success') {
          const matches = lines - 1 // 通常第一行是文件路径
          return statusColor(`${statusIcon} 找到 ${matches} 个匹配`)
        } else {
          return statusColor(`${statusIcon} 搜索失败`)
        }
      case 'Glob':
        if (status === 'success') {
          return statusColor(`${statusIcon} 找到 ${lines} 个文件`)
        } else {
          return statusColor(`${statusIcon} 查找失败`)
        }
      case 'Bash':
        if (status === 'success') {
          return statusColor(`${statusIcon} 命令执行完成`)
        } else {
          return statusColor(`${statusIcon} 命令执行失败`)
        }
      case 'Write':
      case 'Edit':
        if (status === 'success') {
          return statusColor(`${statusIcon} 文件保存成功`)
        } else {
          return statusColor(`${statusIcon} 文件保存失败`)
        }
      default:
        if (status === 'success') {
          return statusColor(`${statusIcon} ${toolName} 完成`)
        } else {
          return statusColor(`${statusIcon} ${toolName} 失败`)
        }
    }
  }

  /**
   * 提取工具的关键参数用于显示
   */
  private extractKeyParams(toolName: string, args: any): [string, string][] {
    const params: [string, string][] = []
    
    switch (toolName) {
      case 'Read':
        if (args.file_path) params.push(['文件', format.path(args.file_path)])
        break
      case 'Grep':
        if (args.pattern) params.push(['模式', args.pattern])
        if (args.path) params.push(['路径', args.path])
        break
      case 'Glob':
        if (args.pattern) params.push(['模式', args.pattern])
        if (args.path) params.push(['路径', args.path])
        break
      case 'Bash':
        if (args.command) {
          const cmd = args.command.length > 50 ? args.command.slice(0, 50) + '...' : args.command
          params.push(['命令', cmd])
        }
        break
      case 'Write':
      case 'Edit':
        if (args.file_path) params.push(['文件', format.path(args.file_path)])
        break
      default:
        // 对于其他工具，显示前2个参数
        const entries = Object.entries(args).slice(0, 2)
        entries.forEach(([key, value]) => {
          const strValue = String(value)
          const displayValue = strValue.length > 50 ? strValue.slice(0, 50) + '...' : strValue
          params.push([key, displayValue])
        })
    }
    
    return params
  }

  /**
   * 创建工具执行结果的内容块 - 使用智能格式化器
   */
  private createToolResultBlock(
    toolName: string, 
    result: string, 
    success: boolean,
    callId?: string
  ): ContentBlock {
    const status = success ? 'success' : 'error'
    
    // 简化的结果输出
    const briefResult = this.getBriefResultMessage(toolName, status, result)
    
    // 格式化详细结果
    const detailedResult = this.formatDetailedToolResult(toolName, result, success)
    
    // 控制台显示简洁信息和展开提示
    const resultLines = result.split('\n').length
    console.log(`${briefResult} ${format.dim(`(${resultLines} lines, Ctrl+R to expand)`)}`)
    
    // 使用内容分析器分析结果
    const analysis = analyzeContent(result)
    
    // 总是创建可折叠的长内容块，让用户可以选择展开
    const resultId = `tool-result-${toolName.toLowerCase()}-${Date.now()}`
    return createLongContentBlock(
      detailedResult,
      analysis.contentType,
      briefResult,
      {
        collapsed: true, // 默认折叠，显示简洁信息
        maxLines: analysis.shouldCollapse ? 15 : 5,
        id: resultId
      },
      {
        toolName,
        contentType: analysis.contentType,
        estimatedLines: analysis.estimatedLines,
        hasLongContent: true
      }
    )
  }

  /**
   * 格式化详细的工具执行结果
   */
  private formatDetailedToolResult(toolName: string, result: string, success: boolean): string {
    const lines = [`🔧 ${toolName} 执行结果`, '']
    
    lines.push(`状态: ${success ? '✅ 成功' : '❌ 失败'}`)
    lines.push(`结果长度: ${result.length} 字符，${result.split('\n').length} 行`)
    lines.push('')
    lines.push('详细内容:')
    lines.push('─'.repeat(40))
    lines.push(result)
    lines.push('─'.repeat(40))
    
    return lines.join('\n')
  }


  /**
   * 分析内容并决定是否需要创建可折叠块
   */
  /**
   * 检测是否为创作内容（永远不应该被折叠）
   */
  private isCreativeContent(content: string): boolean {
    const creativePatternsOrder = [
      CONTENT_TYPE_PATTERNS['creative-content'],
      CONTENT_TYPE_PATTERNS['creative-writing'], 
      CONTENT_TYPE_PATTERNS['article'],
      CONTENT_TYPE_PATTERNS['novel']
    ]
    
    return creativePatternsOrder.some(pattern => pattern.test(content))
  }

  private analyzeContentForCollapsible(content: string): ContentAnalysis {
    const lines = content.split('\n')
    const lineCount = lines.length
    const charCount = content.length
    const hasLongLines = lines.some(line => line.length > 120)
    const hasCodeBlocks = /```[\s\S]*?```/.test(content)
    
    // 检测内容类型
    let contentType: CollapsibleContentType = 'long-text'
    for (const [type, pattern] of Object.entries(CONTENT_TYPE_PATTERNS)) {
      if (pattern.test(content)) {
        contentType = type as CollapsibleContentType
        break
      }
    }
    
    // 优先检测创作内容 - 永远不折叠
    if (this.isCreativeContent(content)) {
      return {
        shouldAutoCollapse: false,  // 创作内容永远不折叠
        estimatedLines: lineCount,
        contentType: 'creative-content',
        hasCodeBlocks,
        hasLongLines,
        complexity: lineCount > 50 ? 'complex' : lineCount > 20 ? 'medium' : 'simple'
      }
    }
    
    // 判断是否应该自动折叠
    let shouldAutoCollapse = false
    switch (contentType) {
      case 'tool-execution':
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.toolOutputLines
        break
      case 'code-block':
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.codeBlockLines
        break
      case 'error-message':
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.errorMessageLines
        break
      case 'creative-content':
      case 'creative-writing':
      case 'article':
      case 'novel':
        shouldAutoCollapse = false  // 创作内容永远不折叠
        break
      default:
        shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.lines || 
                           charCount > AUTO_COLLAPSE_THRESHOLDS.characters
    }
    
    // 计算复杂度
    let complexity: ContentAnalysis['complexity'] = 'simple'
    if (hasCodeBlocks || lineCount > 50) complexity = 'complex'
    else if (lineCount > 20 || hasLongLines) complexity = 'medium'
    
    return {
      shouldAutoCollapse,
      estimatedLines: lineCount,
      contentType,
      hasCodeBlocks,
      hasLongLines,
      complexity
    }
  }

  /**
   * 将长内容转换为可折叠的内容块
   */
  private createCollapsibleContentBlocks(content: string): ContentBlock[] {
    const analysis = this.analyzeContentForCollapsible(content)
    
    // 如果内容不需要折叠，返回普通文本块
    if (!analysis.shouldAutoCollapse) {
      return [createTextBlock(content)]
    }
    
    // 创建可折叠的长内容块
    return [createLongContentBlock(
      content,
      analysis.contentType,
      undefined, // 让组件自动生成标题
      {
        collapsed: analysis.shouldAutoCollapse,
        maxLines: AUTO_COLLAPSE_THRESHOLDS.lines,
        autoCollapse: true
      },
      {
        estimatedLines: analysis.estimatedLines,
        hasLongContent: true,
        contentType: analysis.contentType
      }
    )]
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
    
    // 分析内容并创建可折叠的内容块
    const collapsibleBlocks = this.createCollapsibleContentBlocks(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: collapsibleBlocks.length > 0 ? collapsibleBlocks : parsedResponse.content,
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
    
    // 分析内容并创建可折叠的内容块
    const collapsibleBlocks = this.createCollapsibleContentBlocks(content)

    return {
      content,
      contentBlocks: collapsibleBlocks.length > 0 ? collapsibleBlocks : parsedResponse.content,
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
    
    // 分析内容并创建可折叠的内容块
    const collapsibleBlocks = this.createCollapsibleContentBlocks(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: collapsibleBlocks.length > 0 ? collapsibleBlocks : parsedResponse.content,
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
    
    // 分析内容并创建可折叠的内容块
    const collapsibleBlocks = this.createCollapsibleContentBlocks(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: collapsibleBlocks.length > 0 ? collapsibleBlocks : parsedResponse.content,
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
    
    // 分析内容并创建可折叠的内容块
    const collapsibleBlocks = this.createCollapsibleContentBlocks(rawContent)
    
    return {
      content: rawContent,
      contentBlocks: collapsibleBlocks.length > 0 ? collapsibleBlocks : parsedResponse.content,
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
    
    // 添加用户请求到上下文管理器
    const userRequestTokens = estimateTokens(request.prompt)
    this.contextManager.addEntry({
      role: 'user',
      content: request.prompt,
      tokens: userRequestTokens,
      importance: this.contextManager.calculateImportance(request.prompt, 'conversation'),
      type: 'conversation'
    })

    while (iteration < maxIterations) {
      const iterationStartTime = Date.now()
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
      
      const promptTokens = data.usage?.prompt_tokens || 0
      const completionTokens = data.usage?.completion_tokens || 0
      
      totalInputTokens += promptTokens
      totalOutputTokens += completionTokens
      
      // 计算成本并记录到 CostTracker
      const cost = this.calculateCost(data.usage, profile.provider)
      const duration = Date.now() - iterationStartTime
      
      addCostEntry(
        profile.modelName,
        promptTokens,
        completionTokens,
        cost,
        duration,
        message.tool_calls && message.tool_calls.length > 0 ? 'tool' : 'chat'
      )

      // 如果AI没有调用工具，则对话结束
      if (!message.tool_calls || message.tool_calls.length === 0) {
        conversationHistory += this.sanitizeLLMArtifacts(message.content)
        
        // 添加AI响应到上下文管理器
        const responseTokens = estimateTokens(message.content)
        this.contextManager.addEntry({
          role: 'assistant',
          content: message.content,
          tokens: responseTokens,
          importance: this.contextManager.calculateImportance(message.content, 'conversation'),
          type: 'conversation'
        })

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
        // 显示简洁的工具执行信息（已通过 displayToolExecution 处理）
        this.displayToolExecution(toolCall)
        
        // 过滤TODO工具的执行信息，不添加到conversation history中
        if (!toolCall.function.name.includes('todo')) {
          conversationHistory += `\nAI: [调用 ${toolCall.function.name} 工具] 正在执行...\n`
        }
        
        try {
          const toolResult = await this.executeDeepSeekToolCall(toolCall)
          
          if (toolResult.success) {
            // 显示简洁的结果消息（通过 createToolResultBlock 或直接输出）
            if (!toolCall.function.name.includes('todo')) {
              const briefMessage = this.getBriefResultMessage(toolCall.function.name, 'success', toolResult.result)
              const resultLines = toolResult.result.split('\n').length
              console.log(`${briefMessage} ${format.dim(`(${resultLines} lines, Ctrl+R to expand)`)}`)
              conversationHistory += `${toolCall.function.name}工具: ${toolResult.result}\n`
              
              // 添加工具执行结果到上下文管理器
              const toolResultTokens = estimateTokens(toolResult.result)
              this.contextManager.addEntry({
                role: 'tool',
                content: `${toolCall.function.name}: ${toolResult.result}`,
                tokens: toolResultTokens,
                importance: this.contextManager.calculateImportance(toolResult.result, 'tool_use'),
                type: 'tool_use'
              })
            }
            consecutiveFailures = 0 // 重置连续失败计数
            if (toolCall.function.name.startsWith('todo_')) {
              currentRoundHasTodoUpdate = true
            }
          } else {
            // 显示简洁的错误消息
            if (!toolCall.function.name.includes('todo')) {
              const briefMessage = this.getBriefResultMessage(toolCall.function.name, 'error', toolResult.error || '执行失败')
              console.log(`${briefMessage} ${format.dim('(error)')}`)
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
          if (!toolCall.function.name.includes('todo')) {
            console.log(`❌ [${toolCall.function.name}] ${errorMsg} ${format.dim('(exception)')}`)
            conversationHistory += `${toolCall.function.name}工具: ${errorMsg}\n`
          }
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
   * 标准化工具参数 - 解决 AI 模型参数命名不一致问题
   */
  private normalizeToolParams(toolName: string, args: any): any {
    const normalized = { ...args }
    
    switch (toolName) {
      case 'Read':
        // AI 常用: path, file_path, filePath, filename
        if (args.path && !args.file_path) normalized.file_path = args.path
        if (args.filePath && !args.file_path) normalized.file_path = args.filePath  
        if (args.filename && !args.file_path) normalized.file_path = args.filename
        break
        
      case 'Write':
        if (args.path && !args.file_path) normalized.file_path = args.path
        if (args.filePath && !args.file_path) normalized.file_path = args.filePath
        if (args.text && !args.content) normalized.content = args.text
        break
        
      case 'Edit': 
        if (args.path && !args.file_path) normalized.file_path = args.path
        if (args.filePath && !args.file_path) normalized.file_path = args.filePath
        if (args.new_content && !args.new_string) normalized.new_string = args.new_content
        if (args.replacement && !args.new_string) normalized.new_string = args.replacement
        break
        
      case 'Bash':
        // AI 常用: cmd, command
        if (args.cmd && !args.command) normalized.command = args.cmd
        if (args.script && !args.command) normalized.command = args.script
        break
        
      case 'Grep':
        if (args.search && !args.pattern) normalized.pattern = args.search
        if (args.query && !args.pattern) normalized.pattern = args.query
        break
        
      case 'Glob':
        if (args.search && !args.pattern) normalized.pattern = args.search
        if (args.glob && !args.pattern) normalized.pattern = args.glob
        break
    }
    
    return normalized
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
      // 移除详细参数日志 - 太冗余了
      // console.log(`🔧 [${toolName}] 解析参数:`, JSON.stringify(args, null, 2))
      
      // 🔧 新增：标准化参数，解决 AI 模型参数命名不一致问题
      args = this.normalizeToolParams(toolName, args)
      // console.log(`🔧 [${toolName}] 标准化后参数:`, JSON.stringify(args, null, 2))
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
        
        // 显示工具执行过程 - 使用简洁消息
        if (result.success) {
          const briefMessage = this.getBriefResultMessage(result.toolName, 'success', result.result)
          console.log(briefMessage)
        } else {
          const briefMessage = this.getBriefResultMessage(result.toolName, 'error', result.error || '执行失败')
          console.log(briefMessage)
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
