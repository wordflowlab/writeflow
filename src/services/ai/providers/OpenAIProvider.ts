import { logWarn } from '../../../utils/log.js'

/**

 * OpenAI 提供商实现
 * 支持 OpenAI GPT 模型的标准调用和流式调用
 */

import type { ModelProfile } from '../../../utils/config.js'
import { getResponseStateManager } from '../../streaming/ResponseStateManager.js'
import { startStreamingProgress, stopStreamingProgress } from '../../streaming/ProgressIndicator.js'
import { getOutputFormatter } from '../../../ui/utils/outputFormatter.js'
import type { 
  AIRequest,
  AIResponse
} from '../WriteFlowAIService.js'
import { 
  getContentProcessor
} from '../content/index.js'

export class OpenAIProvider {
  private contentProcessor = getContentProcessor()

  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return 'OpenAI'
  }

  /**
   * 处理标准请求
   */
  async processRequest(request: AIRequest, profile: ModelProfile): Promise<AIResponse> {
    return this.callOpenAIAPI(profile, request)
  }

  /**
   * 处理流式请求
   */
  async processStreamingRequest(request: AIRequest, profile: ModelProfile): Promise<AIResponse> {
    const streamRequest = { ...request, stream: true }
    return this.callOpenAIAPI(profile, streamRequest)
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAIAPI(profile: ModelProfile, request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getAPIKey(profile)
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
   * 处理流式响应 (使用和 DeepSeek 相同的 SSE 格式)
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
        const parts = buffer.split('\\n\\n')
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
   * 获取 API 密钥
   */
  private getAPIKey(profile: ModelProfile): string | undefined {
    if (profile.apiKey) {
      return profile.apiKey
    }
    
    // 检查环境变量
    return process.env.OPENAI_API_KEY
  }

  /**
   * 计算成本
   */
  private calculateCost(usage: any, profile: ModelProfile): number {
    if (!usage) return 0
    
    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0
    
    // OpenAI GPT-4 价格 (简化版本)
    const inputCostPerToken = 0.0000025  // $2.5 per 1M tokens
    const outputCostPerToken = 0.00001   // $10 per 1M tokens
    
    return inputTokens * inputCostPerToken + outputTokens * outputCostPerToken
  }
}

// 导出实例创建函数
export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider()
}