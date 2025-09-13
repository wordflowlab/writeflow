/**
 * DeepSeek 提供商实现
 * 支持标准调用和工具调用功能
 */

import type { ModelProfile } from '../../../utils/config.js'
import { getResponseStateManager } from '../../streaming/ResponseStateManager.js'
import { startStreamingProgress, stopStreamingProgress } from '../../streaming/ProgressIndicator.js'
import { getOutputFormatter } from '../../../ui/utils/outputFormatter.js'
import type { 
  AIRequest,
  AIResponse,
} from '../WriteFlowAIService.js'
import { 
  getContentProcessor,
} from '../content/index.js'
// 🚀 新增：AsyncGenerator 流式显示所需的导入
import { 
  Message,
  AssistantMessage,
  UserMessage,
  createUserMessage,
  normalizeMessagesForAPI,
  createAssistantMessage
} from '../../../utils/messages.js'
import { all } from '../../../utils/generators.js'
import type { Tool, ToolUseContext } from '../../../Tool.js'
import type { StreamMessage, ProgressMessage } from '../streaming/AsyncStreamingManager.js'
import { debugLog, logError, logWarn } from '../../../utils/log.js'

export class DeepSeekProvider {
  private contentProcessor = getContentProcessor()

  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return 'DeepSeek'
  }

  /**
   * 处理标准请求
   */
  async processRequest(request: AIRequest, profile: ModelProfile): Promise<AIResponse> {
    return this.callDeepSeekAPI(profile, request)
  }

  /**
   * 处理流式请求
   */
  async processStreamingRequest(request: AIRequest, profile: ModelProfile): Promise<AIResponse> {
    const streamRequest = { ...request, stream: true }
    return this.callDeepSeekAPI(profile, streamRequest)
  }

  /**
   * 异步流式处理 - 符合 WriteFlowAIService 接口
   * 将内部 AsyncGenerator 包装为标准 StreamMessage 格式
   */
  async* processAsyncStreamingRequest(request: AIRequest): AsyncGenerator<any, void, unknown> {
    // 创建模型配置
    const modelName = request.model || 'deepseek-chat'
    const profile = this.createTempModelProfile(modelName)
    
    // 获取可用工具
    const availableTools = await this.getAvailableTools(request)
    
    // 创建消息历史
    const messages: Message[] = [
      createUserMessage(request.prompt)
    ]
    
    // 创建工具使用上下文
    const toolUseContext: ToolUseContext = {
      abortController: new AbortController(),
      readFileTimestamps: {},
      options: { verbose: true }
    }

    // 使用内部 AsyncGenerator 流式查询
    for await (const message of this.queryWithStreamingTools(
      messages,
      request.systemPrompt || '',
      profile,
      request,
      availableTools,
      toolUseContext
    )) {
      // 转换流式架构消息为 WriteFlow StreamMessage
      yield this.convertToStreamMessage(message)
    }
  }

  /**
   * 获取可用工具列表
   */
  private async getAvailableTools(request: AIRequest): Promise<Tool[]> {
    if (!request.enableToolCalls || !request.allowedTools || request.allowedTools.length === 0) {
      return []
    }
    
    // 简化实现：返回基本工具接口
    return request.allowedTools.map(toolName => ({
      name: toolName,
      description: `Tool: ${toolName}`,
      execute: async () => `Mock result for ${toolName}`
    })) as Tool[]
  }

  /**
   * 转换 AsyncGenerator 架构消息为 WriteFlow StreamMessage - 支持字符级流式显示
   */
  private convertToStreamMessage(message: Message): any {
    switch (message.type) {
      case 'assistant':
        // 🚀 优化：简化字符级增量消息结构
        const content = message.message.content
        if (Array.isArray(content) && content[0] && (content[0] as any).isCharacterDelta) {
          const block = content[0] as any
          // 只保留核心信息，大幅减少对象创建开销
          return {
            type: 'character_delta',
            delta: block.text,      // 只保留字符增量
          } as any  // 临时类型修复，character_delta 不在 StreamMessage 中
        }
        
        // 常规完整消息
        return {
          type: 'ai_response',
          content: typeof message.message.content === 'string' 
            ? message.message.content 
            : message.message.content.map(block => 
                block.type === 'text' ? block.text : '[非文本内容]'
              ).join('\n'),
          isComplete: true,
          metadata: {
            model: message.message.model,
            tokensUsed: message.message.usage?.output_tokens || 0,
            duration: message.durationMs
          }
        }
        
      case 'progress':
        return {
          type: 'tool_execution',
          toolName: message.toolUseID,
          executionId: message.uuid,
          status: 'running',
          currentStep: '工具执行中...',
          progress: 50
        }
        
      case 'user':
        return {
          type: 'system',
          level: 'info',
          message: '用户输入已处理',
          timestamp: Date.now()
        }
        
      default:
        return {
          type: 'system',
          level: 'info',
          message: `未知消息类型: ${(message as any).type}`,
          timestamp: Date.now()
        }
    }
  }

  /**
   * 创建临时模型配置
   */
  private createTempModelProfile(modelName: string): ModelProfile {
    const apiKey = process.env.DEEPSEEK_API_KEY || 'test-key'
    
    return {
      name: `temp-${modelName}`,
      provider: 'deepseek' as any,
      modelName: modelName,
      baseURL: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: apiKey,
      maxTokens: 4000,
      contextLength: 128000,
      isActive: true
    }
  }

  /**
   * 调用 DeepSeek API - 支持原生 function calling
   */
  private async callDeepSeekAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile)
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
    
    // 使用内容处理器处理响应
    const processed = await this.contentProcessor.processAIResponse(rawContent, {
      enableCollapsible: true,
      parseMarkdown: true
    })
    
    return {
      content: rawContent,
      contentBlocks: processed.contentBlocks,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      cost: this.calculateCost(data.usage, profile),
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
    
    // 获取响应状态管理器并开始流式跟踪
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
              responseManager.updateStreamingProgress(streamId, { 
                tokenCount: estimatedTokens, 
                characterCount: content.length, 
                chunkSize: delta.length, 
                contentType: 'text' 
              })
              
              if (typeof request.onToken === 'function') {
                try { 
                  request.onToken(delta) 
                } catch {}
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
    
    // 停止进度指示器（仅控制台模式）
    if (useConsoleProgress) {
      stopStreamingProgress()
    }
    
    // 格式化输出
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
        logWarn(`最终格式化失败: ${formatError}`)
      }
    }
    
    // 使用内容处理器处理最终内容
    const processed = await this.contentProcessor.processAIResponse(content, {
      enableCollapsible: true,
      parseMarkdown: true
    })
    
    return {
      content,
      contentBlocks: processed.contentBlocks,
      usage,
      cost: this.calculateCost({
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens
      }, profile),
      duration: streamingStats.duration,
      model: profile.modelName,
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
      const iterationStartTime = Date.now()
      debugLog(`🔄 [第${iteration + 1}轮] AI 正在思考和执行... (messages: ${messages.length}, tools: ${lastRoundHadTodoUpdate ? 0 : tools.length})`)
      
      // 为UI提供进度反馈 - 向对话历史中添加进度信息
      if (iteration === 0) {
        conversationHistory += `\n🤖 AI 正在分析任务并准备工具调用...\n`
      } else {
        conversationHistory += `\n🔄 第${iteration + 1}轮：AI 继续处理中...\n`
      }
      
      const payload: any = {
        model: profile.modelName,
        messages,
        tools: lastRoundHadTodoUpdate ? [] : tools,
        tool_choice: lastRoundHadTodoUpdate ? 'none' : 'auto',
        max_tokens: request.maxTokens || profile.maxTokens,
        temperature: request.temperature || 0.3,
        // 工具调用时仍然禁用流式，但提供进度反馈
        stream: false
      }
      
      debugLog(`📤 [第${iteration + 1}轮] 发送请求到 DeepSeek API...`)

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
        logError(`❌ [第${iteration + 1}轮] DeepSeek API 错误: ${response.status}`)
        logError(`📄 错误详情: ${errorText}`)
        throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`)
      }

      debugLog(`📥 [第${iteration + 1}轮] 收到 DeepSeek 响应，正在解析...`)

      let data: any
      try {
        data = await response.json()
        debugLog(`✅ [第${iteration + 1}轮] JSON 解析成功`)
      } catch (e) {
        logWarn(`⚠️ [第${iteration + 1}轮] JSON 解析失败，尝试 SSE 兜底解析...`)
        // 某些网关可能仍返回 SSE，这里兜底读取文本并尝试提取最后一个 data: JSON
        const text = await response.text()
        const lines = text.split(/\n/).map((l: string) => l.trim()).filter(Boolean)
        const lastData = [...lines].reverse().find((l: string) => l.startsWith('data:'))
        if (!lastData) {
          logError(`❌ [第${iteration + 1}轮] SSE 解析也失败，响应内容: ${text.slice(0, 200)}...`)
          throw e
        }
        const jsonStr = lastData.replace(/^data:\s*/, '')
        data = JSON.parse(jsonStr)
        debugLog(`✅ [第${iteration + 1}轮] SSE 兜底解析成功`)
      }
      
      const message: any = data.choices?.[0]?.message
      
      if (!message) {
        logError(`❌ [第${iteration + 1}轮] 响应中没有 message 字段`)
        logError(`📄 响应数据: ${JSON.stringify(data, null, 2)}`)
        throw new Error(`DeepSeek API 响应格式错误：缺少 message`)
      }

      debugLog(`📝 [第${iteration + 1}轮] AI 响应: ${message.content ? message.content.slice(0, 100) + '...' : '(无内容)'}`)
      debugLog(`🔧 [第${iteration + 1}轮] 工具调用: ${message.tool_calls ? message.tool_calls.length : 0} 个`)

      // 处理 DeepSeek 内联工具标记（若存在）
      if (message && typeof message.content === 'string' && message.content.includes('tool▁')) {
        debugLog(`🔧 [第${iteration + 1}轮] 检测到内联工具调用，正在提取...`)
        const inline = this.extractInlineToolCalls(message.content)
        message.content = inline.cleaned
        if (inline.calls.length > 0) {
          debugLog(`✅ [第${iteration + 1}轮] 提取到 ${inline.calls.length} 个内联工具调用`)
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

      // 如果AI没有调用工具，则对话结束
      if (!message.tool_calls || message.tool_calls.length === 0) {
        debugLog(`🏁 [第${iteration + 1}轮] AI 未调用工具，对话结束`)
        const content = this.sanitizeLLMArtifacts(message.content)
        conversationHistory += content
        debugLog(`📄 [第${iteration + 1}轮] 最终内容长度: ${content.length} 字符`)
        
        // 若上一轮刚进行了 todo_* 更新，自动完成任务状态
        if (lastRoundHadTodoUpdate) {
          debugLog(`📋 [第${iteration + 1}轮] 检测到 TODO 更新，正在自动完成任务状态...`)
          try {
            const { TodoManager } = await import('../../../tools/TodoManager.js')
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
            if (changed) {
              // 触发 TODO 变更事件
              const { emitReminderEvent } = await import('../../../services/SystemReminderService.js')
              emitReminderEvent('todo:changed', { agentId: 'deepseek-ai' })
            }
          } catch (e) {
            logWarn('⚠️ 自动完成当前任务失败:', (e as Error)?.message)
          }
        }
        
        return {
          content: conversationHistory,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens
          },
          cost: this.calculateCost({ prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens }, profile),
          duration: 0,
          model: profile.modelName,
          hasToolInteraction: iteration > 0
        }
      }

      // AI 调用了工具，添加 AI 消息到对话历史
      debugLog(`⚙️ [第${iteration + 1}轮] AI 调用了 ${message.tool_calls.length} 个工具，开始执行...`)
      messages.push(message)
      
      // 执行工具调用
      let currentRoundHasFailures = false
      let currentRoundHasTodoUpdate = false
      const toolCallResults = []
      
      for (let i = 0; i < message.tool_calls.length; i++) {
        const toolCall = message.tool_calls[i]
        const toolName = toolCall.function.name
        debugLog(`🔧 [第${iteration + 1}轮-工具${i + 1}/${message.tool_calls.length}] 开始执行 ${toolName}...`)
        
        // 为用户提供工具执行进度反馈
        if (!toolName.includes('todo')) {
          conversationHistory += `\n🔧 正在执行 ${toolName} 工具...\n`
        } else {
          conversationHistory += `\n📋 正在更新任务状态...\n`
        }
        
        try {
          // 添加超时保护和重试机制
          debugLog(`⏱️ [第${iteration + 1}轮-工具${i + 1}] 开始执行，超时限制：30秒`)
          
          const toolPromise = this.executeDeepSeekToolCall(toolCall)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`工具 ${toolName} 调用超时 (30秒)`)), 30000)
          })
          
          let toolResult: any
          try {
            toolResult = await Promise.race([toolPromise, timeoutPromise]) as any
            debugLog(`⚡ [第${iteration + 1}轮-工具${i + 1}] 工具执行完成，耗时估计 < 30秒`)
          } catch (timeoutError) {
            logWarn(`⏰ [第${iteration + 1}轮-工具${i + 1}] 工具超时，尝试返回错误结果...`)
            toolResult = {
              success: false,
              error: timeoutError instanceof Error ? timeoutError.message : '工具调用超时'
            }
          }
          
          toolCallResults.push(toolResult)
          
          if (toolResult.success) {
            debugLog(`✅ [第${iteration + 1}轮-工具${i + 1}] ${toolName} 执行成功`)
            if (!toolName.includes('todo')) {
              const resultLines = toolResult.result.split('\n').length
              debugLog(`📄 [第${iteration + 1}轮-工具${i + 1}] 结果: ${resultLines} 行`)
              conversationHistory += `✅ ${toolName} 工具执行完成\n${toolResult.result}\n`
            } else {
              debugLog(`📋 [第${iteration + 1}轮-工具${i + 1}] TODO 工具执行成功`)
              conversationHistory += `✅ 任务状态更新完成\n`
            }
            consecutiveFailures = 0 // 重置连续失败计数
            if (toolName.startsWith('todo_')) {
              currentRoundHasTodoUpdate = true
            }
          } else {
            logError(`❌ [第${iteration + 1}轮-工具${i + 1}] ${toolName} 执行失败: ${toolResult.error}`)
            if (!toolName.includes('todo')) {
              conversationHistory += `❌ ${toolName} 工具执行失败: ${toolResult.error}\n`
            } else {
              conversationHistory += `❌ 任务状态更新失败\n`
            }
            currentRoundHasFailures = true
          }
          
          // 将工具执行结果添加到消息历史
          const toolMessage = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult.success ? toolResult.result : toolResult.error || '执行失败'
          }
          debugLog(`📝 [第${iteration + 1}轮-工具${i + 1}] 添加工具结果到对话历史 (${toolMessage.content.length} 字符)`)
          messages.push(toolMessage)
          
        } catch (error) {
          const errorMsg = `工具执行异常: ${error instanceof Error ? error.message : '未知错误'}`
          logError(`💥 [第${iteration + 1}轮-工具${i + 1}] ${toolName} 执行异常:`, error)
          
          if (!toolName.includes('todo')) {
            conversationHistory += `${toolName}工具: ${errorMsg}\n`
          }
          currentRoundHasFailures = true
          
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: errorMsg
          })
        }
      }
      
      debugLog(`📊 [第${iteration + 1}轮] 工具执行完成: 成功 ${toolCallResults.filter(r => r.success).length}/${toolCallResults.length}, 失败标记: ${currentRoundHasFailures}`)

      // 智能错误恢复机制
      if (currentRoundHasFailures) {
        consecutiveFailures++
        logWarn(`⚠️ [第${iteration + 1}轮] 本轮有工具失败，连续失败计数: ${consecutiveFailures}/${maxConsecutiveFailures}`)
        
        // 分析失败原因并提供恢复建议
        const failedTools = toolCallResults.filter(r => !r.success)
        const errorAnalysis = this.analyzeToolErrors(failedTools)
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          debugLog(`🚫 连续失败 ${consecutiveFailures} 次，启动恢复模式`)
          
          // 添加错误恢复指导消息
          const recoveryGuidance = this.generateRecoveryGuidance(errorAnalysis, iteration)
          messages.push({
            role: 'user',
            content: recoveryGuidance
          })
          
          debugLog(`🔄 [第${iteration + 1}轮] 添加恢复指导，尝试继续对话...`)
          
          // 重置失败计数，给AI一次恢复机会
          consecutiveFailures = 0
          
          // 如果已经尝试恢复多次，则终止
          if (iteration >= maxIterations - 1) {
            debugLog(`🏁 已达最大轮次，终止并返回当前结果`)
            return {
              content: conversationHistory + `\n\n[系统恢复模式] 由于工具调用持续失败，已切换到安全模式。${errorAnalysis.summary}`,
              usage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens
              },
              cost: this.calculateCost({ prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens }, profile),
              duration: 0,
              model: profile.modelName,
              hasToolInteraction: true
            }
          }
        }
      } else {
        // 本轮成功，重置连续失败计数
        if (consecutiveFailures > 0) {
          debugLog(`✅ [第${iteration + 1}轮] 工具执行成功，重置连续失败计数 (${consecutiveFailures} → 0)`)
          consecutiveFailures = 0
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
      cost: this.calculateCost({ prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens }, profile),
      duration: 0,
      model: profile.modelName,
      hasToolInteraction: true
    }
  }

  /**
   * 获取 API 密钥
   */
  private getAPIKey(profile: ModelProfile): string | undefined {
    if (profile.apiKey) {
      return profile.apiKey
    }
    
    // 检查环境变量
    return process.env.DEEPSEEK_API_KEY
  }

  /**
   * 转换工具定义为 DeepSeek API 格式
   */
  private async convertToolsToDeepSeekFormat(allowedTools: string[]): Promise<any[]> {
    const tools = []
    
    if (!allowedTools || allowedTools.length === 0) {
      return []
    }
    
    for (const toolName of allowedTools) {
      // 内置兼容: 一些写作域工具（如 todo_*、exit_plan_mode）直接提供 JSON-Schema
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
        debugLog(`✅ 工具 ${toolName} 已添加到 API 调用中`)
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
        debugLog(`✅ 工具 ${toolName} 已添加到 API 调用中`)
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
        debugLog(`✅ 工具 ${toolName} 已添加到 API 调用中`)
        continue
      }
      
      // 其他工具尝试从工具系统获取
      try {
        const { getTool } = await import('../../../tools/index.js')
        const tool = getTool(toolName)
        if (tool) {
          const description = await tool.description()
          tools.push({
            type: 'function',
            function: {
              name: toolName,
              description,
              parameters: { type: 'object', properties: {}, additionalProperties: true }
            }
          })
          debugLog(`✅ 工具 ${toolName} 已添加到 API 调用中`)
        } else {
          logWarn(`工具 ${toolName} 不在可用工具列表中，跳过`)
        }
      } catch (error) {
        logWarn(`获取工具 ${toolName} 失败:`, error)
      }
    }
    
    return tools
  }

  /**
   * 执行 DeepSeek 工具调用
   */
  private async executeDeepSeekToolCall(toolCall: any): Promise<{
    toolName: string
    callId: string
    result: string
    success: boolean
    error?: string
  }> {
    const { name: toolName, arguments: argsStr } = toolCall.function
    
    let args: any
    try {
      args = JSON.parse(argsStr)
    } catch (parseError) {
      logError(`❌ [${toolName}] JSON 解析失败，原始字符串:`, argsStr)
      return {
        toolName,
        callId: toolCall.id,
        result: '',
        success: false,
        error: `工具调用参数 JSON 解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`
      }
    }

    // 首先尝试使用 legacy tool execution（支持 TODO 工具）
    if (['todo_write', 'todo_read', 'exit_plan_mode'].includes(toolName)) {
      try {
        const { TodoManager } = await import('../../../tools/TodoManager.js')
        const sessionId = process.env.WRITEFLOW_SESSION_ID
        const sharedManager = new TodoManager(sessionId)

        if (toolName === 'todo_write') {
          const { TodoWriteTool } = await import('../../../tools/writing/TodoWriteTool.js')
          const tool = new TodoWriteTool(sharedManager)
          const res = await tool.execute(args, { 
            agentId: 'deepseek-ai', 
            abortController: new AbortController(), 
            options: { verbose: false } 
          })
          return {
            toolName,
            callId: toolCall.id,
            result: res.content || '',
            success: res.success,
            error: res.success ? undefined : (res as any).error
          }
        }

        if (toolName === 'todo_read') {
          const { TodoReadTool } = await import('../../../tools/writing/TodoReadTool.js')
          const tool = new TodoReadTool(sharedManager)
          const res = await tool.execute({}, { 
            agentId: 'deepseek-ai', 
            abortController: new AbortController(), 
            options: { verbose: false } 
          })
          return {
            toolName,
            callId: toolCall.id,
            result: res.content || '',
            success: res.success,
            error: res.success ? undefined : (res as any).error
          }
        }

        if (toolName === 'exit_plan_mode') {
          const { ExitPlanModeTool } = await import('../../../tools/ExitPlanMode.js')
          const tool = new ExitPlanModeTool()
          const res = await tool.execute(args)
          return {
            toolName,
            callId: toolCall.id,
            result: res.content || '',
            success: res.success,
            error: res.success ? undefined : (res as any).error
          }
        }
      } catch (error) {
        return {
          toolName,
          callId: toolCall.id,
          result: '',
          success: false,
          error: (error as Error).message
        }
      }
    }

    // 其他工具使用标准工具系统
    try {
      const { executeToolQuick } = await import('../../../tools/index.js')
      const toolContext = {
        agentId: 'deepseek-ai',
        abortController: new AbortController(),
        readFileTimestamps: {},
        options: { verbose: false }
      }
      const result = await executeToolQuick(toolName, args, toolContext)
      
      return {
        toolName,
        callId: toolCall.id,
        result: result.result || '',
        success: result.success,
        error: result.success ? undefined : result.error?.message
      }
    } catch (error) {
      return {
        toolName,
        callId: toolCall.id,
        result: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 提取内联工具调用
   */
  private extractInlineToolCalls(text: string) {
    const calls = []
    let cleaned = text
    
    debugLog('🔍 提取内联工具调用，输入文本长度:', text.length)
    debugLog('📝 检查文本片段:', text.slice(0, 200) + '...')
    
    // DeepSeek 完整内联工具格式: <｜tool▁calls▁begin｜><｜tool▁call▁begin｜>function_name<｜tool▁sep｜>{"param":"value"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>
    const fullToolPattern = /<｜tool▁calls▁begin｜>(.*?)<｜tool▁calls▁end｜>/gs
    
    let toolBlockMatch
    while ((toolBlockMatch = fullToolPattern.exec(text)) !== null) {
      const [fullBlock, toolContent] = toolBlockMatch
      debugLog('🔧 找到工具调用块:', fullBlock.slice(0, 100) + '...')
      
      // 在工具块内提取individual工具调用
      const individualToolPattern = /<｜tool▁call▁begin｜>(\w+)<｜tool▁sep｜>(.*?)<｜tool▁call▁end｜>/gs
      let toolMatch
      
      while ((toolMatch = individualToolPattern.exec(toolContent)) !== null) {
        try {
          const [, toolName, argsStr] = toolMatch
          debugLog(`🛠️  提取工具: ${toolName}, 参数: ${argsStr.slice(0, 100)}...`)
          
          const args = JSON.parse(argsStr)
          calls.push({ name: toolName, args })
          debugLog(`✅ 成功解析工具 ${toolName}`)
        } catch (e) {
          logWarn(`⚠️  工具调用解析失败: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      
      // 从文本中移除整个工具调用块
      cleaned = cleaned.replace(fullBlock, '')
    }
    
    // 兼容简化格式: tool▁function_name▁{"param":"value"}
    const simpleToolPattern = /tool▁(\w+)▁({[^}]*})/g
    let match
    
    while ((match = simpleToolPattern.exec(cleaned)) !== null) {
      try {
        const [fullMatch, name, argsStr] = match
        debugLog(`🔧 找到简化格式工具: ${name}`)
        const args = JSON.parse(argsStr)
        calls.push({ name, args })
        cleaned = cleaned.replace(fullMatch, '')
        debugLog(`✅ 成功解析简化格式工具 ${name}`)
      } catch (e) {
        logWarn(`⚠️  简化格式工具解析失败: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    
    debugLog(`📊 提取结果: ${calls.length} 个工具调用，清理后文本长度: ${cleaned.trim().length}`)
    
    return { calls, cleaned: cleaned.trim() }
  }

  /**
   * 清理 LLM 输出中的特殊标记
   */
  private sanitizeLLMArtifacts(content: string): string {
    if (!content) return ''
    
    debugLog('🧹 清理LLM输出，原始长度:', content.length)
    
    let cleaned = content
      // 移除完整的DeepSeek内联工具调用块
      .replace(/<｜tool▁calls▁begin｜>.*?<｜tool▁calls▁end｜>/gs, '')
      // 移除简化格式的内联工具调用
      .replace(/tool▁\w+▁{[^}]*}/g, '')
      // 移除可能残留的工具标记
      .replace(/<｜tool▁call▁begin｜>.*?<｜tool▁call▁end｜>/gs, '')
      .replace(/<｜tool▁sep｜>/g, '')
      // 清理多余空行和空白
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/gm, '') // 移除每行首尾空白
      .trim()
    
    debugLog('🧹 清理后长度:', cleaned.length)
    if (cleaned.length !== content.length) {
      debugLog('✅ 成功清理了', content.length - cleaned.length, '个字符的工具标记')
    }
    
    return cleaned
  }

  /**
   * 分析工具错误
   */
  private analyzeToolErrors(failedTools: any[]): { 
    summary: string; 
    commonErrors: string[]; 
    suggestions: string[] 
  } {
    const errorTypes = new Map<string, number>()
    const toolTypes = new Map<string, number>()
    
    failedTools.forEach(tool => {
      const error = tool.error || ''
      const toolName = tool.toolName || 'unknown'
      
      // 统计工具类型
      toolTypes.set(toolName, (toolTypes.get(toolName) || 0) + 1)
      
      // 分析错误类型
      if (error.includes('超时')) {
        errorTypes.set('timeout', (errorTypes.get('timeout') || 0) + 1)
      } else if (error.includes('权限') || error.includes('permission')) {
        errorTypes.set('permission', (errorTypes.get('permission') || 0) + 1)
      } else if (error.includes('参数') || error.includes('parameter')) {
        errorTypes.set('parameter', (errorTypes.get('parameter') || 0) + 1)
      } else if (error.includes('文件') || error.includes('file')) {
        errorTypes.set('file', (errorTypes.get('file') || 0) + 1)
      } else {
        errorTypes.set('other', (errorTypes.get('other') || 0) + 1)
      }
    })
    
    const commonErrors = Array.from(errorTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type}(${count}次)`)
    
    const suggestions = []
    if (errorTypes.has('timeout')) {
      suggestions.push('尝试使用更简单的工具调用')
    }
    if (errorTypes.has('parameter')) {
      suggestions.push('检查工具参数格式')
    }
    if (errorTypes.has('file')) {
      suggestions.push('确认文件路径是否正确')
    }
    if (toolTypes.has('todo_write') || toolTypes.has('todo_read')) {
      suggestions.push('TODO工具可能需要初始化')
    }
    
    return {
      summary: `检测到 ${failedTools.length} 个工具失败，主要错误：${commonErrors.join(', ')}`,
      commonErrors,
      suggestions
    }
  }

  /**
   * 生成恢复指导
   */
  private generateRecoveryGuidance(errorAnalysis: any, iteration: number): string {
    const suggestions = errorAnalysis.suggestions.length > 0 
      ? errorAnalysis.suggestions.join('；') 
      : '请尝试使用更基础的工具或直接生成文本内容'
      
    return `[系统恢复模式 - 第${iteration + 1}轮] 工具调用遇到困难：${errorAnalysis.summary}。

恢复建议：${suggestions}

现在请根据之前的对话内容，直接生成有用的文本回复，暂时避免调用复杂工具。如果必须使用工具，请使用最基础的工具（如读取文件），并确保参数格式正确。`
  }

  /**
   * 计算成本
   */
  private calculateCost(usage: any, profile: ModelProfile): number {
    if (!usage) return 0
    
    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0
    
    // DeepSeek 价格 (简化版本)
    const inputCostPerToken = 0.00000014  // $0.14 per 1M tokens
    const outputCostPerToken = 0.00000028 // $0.28 per 1M tokens
    
    return inputTokens * inputCostPerToken + outputTokens * outputCostPerToken
  }

  // 🚀 新增：AsyncGenerator 流式查询引擎 - 采用标准架构
  
  /**
   * 流式查询引擎 - 实现 AsyncGenerator 核心架构
   * 支持实时工具执行显示的异步生成器模式
   */
  async* queryWithStreamingTools(
    messages: Message[],
    systemPrompt: string,
    profile: ModelProfile,
    request: AIRequest,
    availableTools: Tool[],
    toolUseContext: ToolUseContext
  ): AsyncGenerator<Message, void> {
    const MAX_ITERATIONS = 5
    const MAX_TOOL_USE_CONCURRENCY = 10
    const ITERATION_TIMEOUT = 90000 // 90秒每轮超时
    const isDebugMode = process.env.WRITEFLOW_DEBUG_STREAM === 'verbose'
    
    let iteration = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    
    while (iteration < MAX_ITERATIONS) {
      if (isDebugMode) {
        debugLog(`🔄 [流式-第${iteration + 1}轮] 开始 AI 查询...`)
      }
      
      // 🎯 为每轮对话添加超时控制
      const iterationController = new AbortController()
      const iterationTimeoutId = setTimeout(() => {
        if (isDebugMode) {
          debugLog(`⏰ [流式-第${iteration + 1}轮] 单轮超时 (90s)，中断当前轮次`)
        }
        iterationController.abort()
      }, ITERATION_TIMEOUT)
      
      try {
      
      // 1. 构造 API 消息格式
      const apiMessages = normalizeMessagesForAPI(messages)
      
      // 2. 调用 DeepSeek API 获取 AI 响应 - 现在是流式的！
      let assistantMessage: AssistantMessage | null = null
      let hasCharacterDeltas = false
      let realtimeCharCount = 0 // 实时字符计数器
      
      for await (const message of this.callDeepSeekAPIForStreaming(
        profile, 
        request, 
        apiMessages, 
        systemPrompt, 
        availableTools
      )) {
        // 检查是否是字符级增量消息
        if (message.type === 'assistant' && message.message.content?.[0] && (message.message.content[0] as any).isCharacterDelta) {
          hasCharacterDeltas = true
          realtimeCharCount++
          
          // 🚀 简化实时字符日志：仅在详细调试模式输出
          if (isDebugMode && realtimeCharCount % 50 === 0) {
            debugLog(`🔥 [字符流-第${iteration + 1}轮] 第${realtimeCharCount}个字符`)
          }
        } else {
          // 这是最终完整消息
          assistantMessage = message as AssistantMessage
          if (isDebugMode) {
            debugLog(`📝 [流式-第${iteration + 1}轮] AI 响应完成，内容长度: ${assistantMessage.message.content?.length || 0}`)
          }
        }
        
        // 3. 立即 yield 每个消息 - 实时显示的关键！
        yield message
      }
      
      if (!assistantMessage) {
        throw new Error('未收到完整的 AI 响应')
      }
      
      // 4. 检查是否有工具调用
      const toolUseBlocks = assistantMessage.message.content.filter(
        (block: any) => block.type === 'tool_use'
      )
      
      if (toolUseBlocks.length === 0) {
        if (isDebugMode) {
          debugLog(`🏁 [流式-第${iteration + 1}轮] 无工具调用，对话结束`)
        }
        return
      }
      
      if (isDebugMode) {
        debugLog(`⚙️ [流式-第${iteration + 1}轮] 检测到 ${toolUseBlocks.length} 个工具调用`)
      }
      
      // 5. 并发或串行执行工具 - 实现标准并发逻辑
      const toolResults: UserMessage[] = []
      const canRunConcurrently = toolUseBlocks.every((block: any) => {
        const tool = availableTools.find(t => t.name === block.name)
        // 简化：假设所有工具都可以并发执行
        return true
      })
      
      if (canRunConcurrently) {
        if (isDebugMode) {
          debugLog(`🚀 [流式-第${iteration + 1}轮] 并发执行工具`)
        }
        for await (const message of this.runToolsConcurrently(
          toolUseBlocks, 
          assistantMessage,
          availableTools,
          toolUseContext
        )) {
          yield message
          if (message.type === 'user') {
            toolResults.push(message)
          }
        }
      } else {
        if (isDebugMode) {
          debugLog(`🔄 [流式-第${iteration + 1}轮] 串行执行工具`)
        }
        for await (const message of this.runToolsSerially(
          toolUseBlocks,
          assistantMessage, 
          availableTools,
          toolUseContext
        )) {
          yield message
          if (message.type === 'user') {
            toolResults.push(message)
          }
        }
      }
      
      // 6. 添加工具结果到消息历史，准备下一轮
      messages = [...messages, assistantMessage, ...toolResults]
      iteration++
      
      debugLog(`🔄 [流式-第${iteration}轮] 准备下一轮，消息历史长度: ${messages.length}`)
      
      } catch (error) {
        // 清理单轮超时
        clearTimeout(iterationTimeoutId)
        
        if (error instanceof Error && error.message?.includes('超时')) {
          debugLog(`⏰ [流式-第${iteration + 1}轮] 轮次超时，尝试恢复或结束对话`)
          // 超时情况下，可以选择结束对话或者重试
          break
        }
        
        logError(`💥 [流式-第${iteration + 1}轮] 轮次异常:`, error)
        throw error
      } finally {
        // 确保清理资源
        clearTimeout(iterationTimeoutId)
      }
    }
    
    debugLog(`⚠️ [流式] 达到最大迭代次数 ${MAX_ITERATIONS}，结束对话`)
  }
  
  /**
   * 调用 DeepSeek API - 真正的流式版本，支持字符级实时显示
   */
  private async* callDeepSeekAPIForStreaming(
    profile: ModelProfile,
    request: AIRequest,
    messages: any[],
    systemPrompt: string,
    availableTools: Tool[]
  ): AsyncGenerator<Message, void> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error('缺少 DeepSeek API 密钥')
    }
    
    const url = profile.baseURL || 'https://api.deepseek.com/v1/chat/completions'
    
    // 🚀 日志节流变量
    let characterCount = 0
    let lastLogTime = 0
    const LOG_THROTTLE_INTERVAL = 2000 // 2秒
    const LOG_CHARACTER_THRESHOLD = 100 // 100个字符
    const isDebugMode = process.env.WRITEFLOW_DEBUG_STREAM === 'verbose'
    
    // 转换工具定义
    const tools = await this.convertToolsToDeepSeekFormat(availableTools.map(t => t.name))
    
    const payload = {
      model: profile.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      max_tokens: request.maxTokens || profile.maxTokens,
      temperature: request.temperature || 0.3,
      stream: true // 🌟 启用真正的流式！
    }
    
    debugLog(`📤 [API] 发送请求到 DeepSeek...`)
    
    // 🎯 添加超时控制，防止API调用卡死
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      debugLog(`⏰ [API] DeepSeek 请求超时 (60s)，中断连接`)
      controller.abort()
    }, 60000) // 60秒超时
    
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      
      // 清除超时定时器
      clearTimeout(timeoutId)
      
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('DeepSeek API 请求超时 (60秒)')
      }
      throw error
    }
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('响应体为空')
    }

    // 🌟 处理真正的 SSE 流式响应 - 字符级实时显示！
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let toolCalls: any[] = []
    let finalUsage: any = null
    let streamId: string | null = null

    debugLog(`🌊 [流式] 开始处理 SSE 响应...`)

    // 🎯 为SSE流式读取添加超时控制
    const streamController = new AbortController()
    let lastDataTime = Date.now()
    let noDataTimeoutId: NodeJS.Timeout | undefined
    
    const resetNoDataTimeout = () => {
      if (noDataTimeoutId) clearTimeout(noDataTimeoutId)
      noDataTimeoutId = setTimeout(() => {
        debugLog(`⏰ [流式] SSE 数据超时 (30s无数据)，中断流式读取`)
        streamController.abort()
        reader.cancel()
      }, 30000) // 30秒无数据则超时
      lastDataTime = Date.now()
    }
    
    resetNoDataTimeout() // 初始化超时检查

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          debugLog(`🏁 [流式] SSE 流式读取完成`)
          break
        }
        
        // 重置无数据超时
        resetNoDataTimeout()
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(dataStr)
            
            // 🎯 关键修复：严格分离文本内容和工具调用处理
            const delta = data.choices?.[0]?.delta?.content
            const deltaToolCalls = data.choices?.[0]?.delta?.tool_calls
            
            // 🚀 处理文本内容：每个字符增量立即发出！
            if (delta && delta.length > 0) {
              content += delta
              
              // 创建字符级增量消息 - 这是实现丝滑显示的关键！
              const deltaMessage: Message = {
                type: 'assistant' as const,
                uuid: crypto.randomUUID(),
                costUSD: 0,
                durationMs: 0,
                message: {
                  id: `delta-${Date.now()}`,
                  model: profile.modelName,
                  role: 'assistant',
                  content: [{
                    type: 'text',
                    text: delta, // 只包含增量！
                    // 特殊标记表示这是字符级增量
                    isCharacterDelta: true,
                    fullContent: content // 完整内容用于 UI 组件
                  } as any],
                  stop_reason: 'max_tokens',
                  stop_sequence: null,
                  type: 'message',
                  usage: { 
                    input_tokens: 0, 
                    output_tokens: 0,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0,
                    cache_creation: null,
                    server_tool_use: null,
                    service_tier: null
                  }
                }
              }
              
              // 🚀 节流日志输出
              characterCount += delta.length
              const now = Date.now()
              const shouldLog = isDebugMode || 
                               characterCount % LOG_CHARACTER_THRESHOLD === 0 ||
                               now - lastLogTime >= LOG_THROTTLE_INTERVAL
              
              if (shouldLog) {
                debugLog(`📝 [字符流] 累计${characterCount}字符, 本次+${delta.length}: "${delta.slice(0, 20)}..."`)
                lastLogTime = now
              }
              
              yield deltaMessage
            }
            
            // 🔧 处理工具调用：使用已分离的变量，避免重复访问
            if (deltaToolCalls && deltaToolCalls.length > 0) {
              for (const tc of deltaToolCalls) {
                if (tc.index !== undefined) {
                  toolCalls[tc.index] = toolCalls[tc.index] || {}
                  if (tc.function?.name) {
                    toolCalls[tc.index].function = toolCalls[tc.index].function || {}
                    toolCalls[tc.index].function.name = tc.function.name
                  }
                  if (tc.function?.arguments) {
                    toolCalls[tc.index].function = toolCalls[tc.index].function || {}
                    toolCalls[tc.index].function.arguments = 
                      (toolCalls[tc.index].function.arguments || '') + tc.function.arguments
                  }
                  if (tc.id) {
                    toolCalls[tc.index].id = tc.id
                  }
                }
              }
            }
            
            // 记录使用情况
            if (data.usage) {
              finalUsage = data.usage
            }
            
          } catch (parseError: any) {
            // 🛡️ 关键修复：JSON解析失败时不中断流程，而是记录并继续
            logWarn(`⚠️ [流式] SSE JSON解析失败，跳过此数据块:`, {
              error: parseError?.message || String(parseError),
              dataStr: dataStr.slice(0, 100) + (dataStr.length > 100 ? '...' : ''),
              dataLength: dataStr.length
            })
            
            // 检查是否是AI生成的包含JSON内容的文本
            if (dataStr.includes('"type":"tool_use"') || dataStr.includes('{"type":')) {
              debugLog(`📝 [流式] 检测到AI生成的JSON格式文本内容，已安全跳过解析`)
            }
            
            // 继续处理下一个数据块，不中断流程
            continue
          }
        }
      }
    } catch (error) {
      // 清理超时定时器
      if (noDataTimeoutId) clearTimeout(noDataTimeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        debugLog(`⏰ [流式] SSE 读取被中断 (超时或手动中止)`)
        throw new Error('流式响应超时 (30秒无数据)')
      }
      
      logError(`💥 [流式] SSE 读取异常:`, error)
      throw error
    } finally {
      // 清理资源
      if (noDataTimeoutId) clearTimeout(noDataTimeoutId)
      reader.releaseLock()
    }

    // 处理内联工具调用
    if (content.includes('tool▁')) {
      debugLog(`🔧 [API] 检测到内联工具调用，正在提取...`)
      const inline = this.extractInlineToolCalls(content)
      content = inline.cleaned
      if (inline.calls.length > 0) {
        toolCalls = toolCalls.concat(
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

    // 创建最终的 AssistantMessage（包含工具调用）
    const finalMessage: AssistantMessage = {
      type: 'assistant',
      costUSD: this.calculateCost(finalUsage, profile),
      durationMs: 0,
      uuid: crypto.randomUUID(),
      message: {
        id: crypto.randomUUID(),
        model: profile.modelName,
        role: 'assistant',
        content: toolCalls.length > 0 ? [] : [{ type: 'text', text: content, citations: [] }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        type: 'message',
        usage: finalUsage || { 
          input_tokens: 0, 
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation: null,
          server_tool_use: null,
          service_tier: null
        }
      }
    }

    // 如果有工具调用，添加到 content
    if (toolCalls.length > 0) {
      // 先添加文本内容（如果有）
      if (content.trim()) {
        finalMessage.message.content.push({ type: 'text', text: content, citations: [] })
      }
      
      // 添加工具调用
      finalMessage.message.content.push(
        ...toolCalls.map((tc: any) => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments)
        }))
      )
    }

    debugLog(`🏁 [流式] AI 响应完成，内容长度: ${content.length}, 工具调用: ${toolCalls.length}`)
    
    // 最后发出完整消息（用于工具调用处理）
    yield finalMessage
  }
  
  // 🚀 实用工具方法：创建工具实例以获取状态消息
  
  /**
   * 创建工具实例用于获取状态消息
   */
  private async createToolInstance(toolName: string, toolInput: any): Promise<any | null> {
    try {
      const sessionId = 'status-display-session'
      const { TodoManager } = await import('../../../tools/TodoManager.js')
      const sharedManager = new TodoManager(sessionId)
      
      if (toolName === 'todo_write') {
        const { TodoWriteTool } = await import('../../../tools/writing/TodoWriteTool.js')
        return new TodoWriteTool(sharedManager)
      }
      
      if (toolName === 'todo_read') {
        const { TodoReadTool } = await import('../../../tools/writing/TodoReadTool.js')
        return new TodoReadTool(sharedManager)
      }
      
      return null
    } catch (error) {
      logWarn(`⚠️ 创建工具实例失败 ${toolName}:`, error)
      return null
    }
  }
  
  // 🚀 阶段4：工具执行流式推送 - 实现实时工具执行架构
  
  /**
   * 并发执行工具 - 实现并发工具执行架构
   */
  async* runToolsConcurrently(
    toolUseBlocks: any[],
    assistantMessage: AssistantMessage,
    availableTools: Tool[],
    toolUseContext: ToolUseContext
  ): AsyncGenerator<Message, void> {
    const generators = toolUseBlocks.map(toolUse =>
      this.runSingleToolUse(
        toolUse,
        new Set(toolUseBlocks.map(block => block.id)),
        assistantMessage,
        availableTools,
        toolUseContext
      )
    )
    
    // 使用照抄的 all() 函数进行并发执行
    yield* all(generators, 10) // MAX_TOOL_USE_CONCURRENCY = 10
  }
  
  /**
   * 串行执行工具 - 实现串行工具执行架构
   */
  async* runToolsSerially(
    toolUseBlocks: any[],
    assistantMessage: AssistantMessage,
    availableTools: Tool[],
    toolUseContext: ToolUseContext
  ): AsyncGenerator<Message, void> {
    for (const toolUse of toolUseBlocks) {
      yield* this.runSingleToolUse(
        toolUse,
        new Set(toolUseBlocks.map(block => block.id)),
        assistantMessage,
        availableTools,
        toolUseContext
      )
    }
  }
  
  /**
   * 执行单个工具 - 实现 AsyncGenerator 流式执行核心逻辑
   * 这是实时工具执行显示的核心实现！
   */
  async* runSingleToolUse(
    toolUse: any,
    siblingToolUseIDs: Set<string>,
    assistantMessage: AssistantMessage,
    availableTools: Tool[],
    toolUseContext: ToolUseContext
  ): AsyncGenerator<Message, void> {
    const toolName = toolUse.name
    const toolUseID = toolUse.id
    const toolInput = toolUse.input
    
    debugLog(`🔧 [工具执行] 开始执行 ${toolName} (ID: ${toolUseID})`)
    
    // 1. 查找工具
    const tool = availableTools.find(t => t.name === toolName)
    if (!tool) {
      logError(`❌ [工具执行] 工具 ${toolName} 不存在`)
      yield createUserMessage([{
        type: 'tool_result',
        content: `错误: 工具 ${toolName} 不存在`,
        is_error: true,
        tool_use_id: toolUseID,
      }])
      return
    }
    
    // 2. 执行工具并流式推送进度 - 实现 AsyncGenerator 流式架构！
    try {
      debugLog(`⚡ [工具执行] ${toolName} 开始执行...`)
      
      // 如果工具支持 AsyncGenerator，使用流式执行
      // 注意：当前 WriteFlow 工具接口可能还不支持 call 方法，这是未来优化方向
      debugLog(`🔍 [调试] ${toolName} 工具call方法检查:`, (tool as any).call ? '有call方法' : '无call方法')
      if ((tool as any).call && typeof (tool as any).call === 'function') {
        const generator = (tool as any).call(toolInput as never, toolUseContext)
        
        for await (const result of generator) {
          switch (result.type) {
            case 'result':
              debugLog(`✅ [工具执行] ${toolName} 执行成功`)
              yield createUserMessage([{
                type: 'tool_result',
                content: result.resultForAssistant || String(result.data),
                tool_use_id: toolUseID,
              }], {
                data: result.data,
                resultForAssistant: result.resultForAssistant || String(result.data),
              })
              return
              
            case 'progress':
              debugLog(`🔄 [工具执行] ${toolName} 进度更新`)
              // 🌟 关键！yield 进度消息实现实时显示
              yield {
                type: 'progress',
                stage: 'tool_progress',
                message: result.content || '工具执行中...',
                progress: result.progress || 50
              } as any  // 临时解决类型冲突
              break
          }
        }
      } else {
        // 🚀 采用Kode架构：Progress消息系统 + 完全消息类型分离
        debugLog(`🔧 [工具执行] ${toolName} 使用Kode风格架构执行`)
        
        // 🌟 阶段1: 工具执行开始的Progress消息（WriteFlow格式）
        yield {
          type: 'progress',
          stage: 'tool_execution', 
          message: `🔧 正在执行 ${toolName} 工具...`,
          progress: 50
        } as any  // 临时解决类型冲突
        
        // 🌟 阶段2: 如果是TODO工具，显示详细状态（仿照Kode的TaskTool）
        if (toolName === 'todo_write') {
          // 创建工具实例以获取详细状态
          const toolInstance = await this.createToolInstance(toolName, toolInput)
          if (toolInstance && (toolInstance as any).renderToolUseMessage) {
            try {
              const statusMessage = (toolInstance as any).renderToolUseMessage(toolInput, { verbose: true })
              
              // 🌟 推送WriteFlow格式的详细进度消息
              yield {
                type: 'progress',
                stage: 'todo_status',
                message: statusMessage,
                progress: 75
              } as any  // 临时解决类型冲突
            } catch (statusError) {
              logWarn(`⚠️ [工具状态] ${toolName} 状态消息生成失败:`, statusError)
            }
          }
        }
        
        // 🌟 阶段3: 执行工具（技术层面，结果不直接显示给用户）
        const result = await this.executeDeepSeekToolCall({
          id: toolUseID,
          function: { name: toolName, arguments: JSON.stringify(toolInput) }
        })
        
        // 🌟 阶段4: Kode风格的结果处理 - 用户友好消息 + 技术消息分离
        if (result.success) {
          debugLog(`✅ [工具执行] ${toolName} 执行成功`)
          
          // 🌟 推送用户友好的完成消息（WriteFlow Progress格式）
          const completionMessage = toolName === 'todo_write' 
            ? '✅ 任务列表更新完成'
            : `✅ ${toolName} 工具执行完成`
            
          yield {
            type: 'progress',
            stage: 'tool_completed',
            message: completionMessage,
            progress: 100
          } as any  // 临时解决类型冲突
          
          // 🔧 技术层面：为AI对话历史提供tool_result（用户不可见）
          yield createUserMessage([{
            type: 'tool_result', 
            content: result.result,
            tool_use_id: toolUseID,
          }])
        } else {
          logError(`❌ [工具执行] ${toolName} 执行失败:`, result.error)
          
          // 🌟 推送用户友好的错误消息（WriteFlow格式）
          yield {
            type: 'progress',
            stage: 'tool_error',
            message: `❌ ${toolName} 工具执行失败`,
            progress: 0
          } as any  // 临时解决类型冲突
          
          // 🔧 技术层面：为AI对话历史提供错误结果
          yield createUserMessage([{
            type: 'tool_result',
            content: result.error || '执行失败',
            is_error: true,
            tool_use_id: toolUseID,
          }])
        }
      }
      
    } catch (error) {
      logError(`💥 [工具执行] ${toolName} 执行异常:`, error)
      yield createUserMessage([{
        type: 'tool_result',
        content: `执行异常: ${error instanceof Error ? error.message : '未知错误'}`,
        is_error: true,
        tool_use_id: toolUseID,
      }])
    }
  }
}

// 导出实例创建函数
export function createDeepSeekProvider(): DeepSeekProvider {
  return new DeepSeekProvider()
}