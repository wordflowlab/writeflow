import { logWarn } from '../../utils/log.js'

/**


 * WriteFlow AI 流式处理 Hook
 * 集成 AI 服务与流式 UI 组件
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { getStreamingAIService, StreamingAIRequest, StreamingAIResponse } from '../../services/ai/StreamingAIService.js'
import { useStreamingOutput, StreamingOutputState } from './useStreamingOutput.js'

export interface AIStreamingOptions {
  model?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  theme?: 'light' | 'dark'
  renderDelay?: number
  chunkSize?: number
  enableRealTimeFormatting?: boolean
  enableToolCalls?: boolean
  allowedTools?: string[]
  onStart?: () => void
  onChunk?: (content: string) => void
  onComplete?: (response: StreamingAIResponse) => void
  onError?: (error: Error) => void
}

export interface AIStreamingState {
  isLoading: boolean
  isStreaming: boolean
  isComplete: boolean
  error?: Error
  response?: StreamingAIResponse
  streamingState: StreamingOutputState
}

/**
 * AI 流式处理 Hook
 */
export function useAIStreaming(options: AIStreamingOptions = {}) {
  const {
    model,
    systemPrompt,
    temperature = 0.3,
    maxTokens = 4000,
    theme = 'dark',
    renderDelay = 25,
    chunkSize = 30,
    enableRealTimeFormatting = true,
    enableToolCalls = false,
    allowedTools = [],
    onStart,
    onChunk,
    onComplete,
    onError
  } = options

  // 内部状态
  const [state, setState] = useState<Omit<AIStreamingState, 'streamingState'>>({
    isLoading: false,
    isStreaming: false,
    isComplete: false,
    error: undefined,
    response: undefined
  })

  // 流式输出管理
  const streamId = useRef(`ai-stream-${Date.now()}`)
  const streamingOutput = useStreamingOutput({
    streamId: streamId.current,
    theme,
    delay: renderDelay,
    chunkSize,
    enableColors: true,
    enableSyntaxHighlight: true,
    onChunk: (chunk) => {
      onChunk?.(chunk.content)
    },
    onComplete: (content) => {
      setState(prev => ({ ...prev, isComplete: true, isStreaming: false }))
    },
    onError: (error) => {
      setState(prev => ({ ...prev, error, isLoading: false, isStreaming: false }))
      onError?.(error)
    }
  })

  // AI 服务引用
  const aiServiceRef = useRef(getStreamingAIService())

  // 清理函数
  useEffect(() => {
    return () => {
      streamingOutput.controls.terminateStream()
    }
  }, [])

  /**
   * 发起 AI 请求
   */
  const ask = useCallback(async (prompt: string, overrideOptions?: Partial<AIStreamingOptions>) => {
    if (state.isLoading || state.isStreaming) {
      logWarn('AI 请求正在进行中，请稍候...')
      return
    }

    const finalOptions = { ...options, ...overrideOptions }
    
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        isStreaming: false,
        isComplete: false,
        error: undefined,
        response: undefined
      }))

      onStart?.()

      // 生成新的流 ID
      streamId.current = `ai-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // 准备 AI 请求
      const aiRequest: StreamingAIRequest = {
        prompt,
        systemPrompt: finalOptions.systemPrompt || systemPrompt,
        model: finalOptions.model || model,
        temperature: finalOptions.temperature || temperature,
        maxTokens: finalOptions.maxTokens || maxTokens,
        stream: true,
        useNewStreaming: true,
        enableRealTimeFormatting: finalOptions.enableRealTimeFormatting ?? enableRealTimeFormatting,
        renderDelay: finalOptions.renderDelay || renderDelay,
        chunkSize: finalOptions.chunkSize || chunkSize,
        streamId: streamId.current,
        enableToolCalls: finalOptions.enableToolCalls || enableToolCalls,
        allowedTools: finalOptions.allowedTools || allowedTools
      }

      setState(prev => ({ ...prev, isStreaming: true, isLoading: false }))

      // 开始流式输出
      streamingOutput.controls.resetStream()

      // 发起 AI 请求
      const response = await aiServiceRef.current.processStreamingRequest(aiRequest)

      // 开始内容流
      if (response.content) {
        streamingOutput.controls.startStream(response.content)
      }

      setState(prev => ({
        ...prev,
        response,
        isLoading: false
      }))

      onComplete?.(response)

    } catch (_error) {
      const errorObj = _error instanceof Error ? _error : new Error(String(_error))
      
      setState(prev => ({
        ...prev,
        _error: errorObj,
        isLoading: false,
        isStreaming: false
      }))

      onError?.(errorObj)
    }
  }, [
    state.isLoading, 
    state.isStreaming, 
    options, 
    systemPrompt, 
    model, 
    temperature, 
    maxTokens, 
    theme, 
    renderDelay, 
    chunkSize, 
    enableRealTimeFormatting, 
    enableToolCalls, 
    allowedTools,
    onStart,
    onComplete,
    onError,
    streamingOutput
  ])

  /**
   * 停止当前流式处理
   */
  const stop = useCallback(() => {
    streamingOutput.controls.pauseStream()
    setState(prev => ({ ...prev, isStreaming: false }))
  }, [streamingOutput])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    streamingOutput.controls.resetStream()
    setState({
      isLoading: false,
      isStreaming: false,
      isComplete: false,
      error: undefined,
      response: undefined
    })
  }, [streamingOutput])

  /**
   * 续写内容
   */
  const continueStream = useCallback(async (additionalPrompt: string) => {
    if (!state.response || !state.isComplete) {
      logWarn('没有可续写的内容')
      return
    }

    const fullPrompt = `${state.response.content}\n\n${additionalPrompt}`
    await ask(fullPrompt)
  }, [state.response, state.isComplete, ask])

  return {
    // 状态
    state: {
      ...state,
      streamingState: streamingOutput.state
    } as AIStreamingState,
    
    // 控制函数
    ask,
    stop,
    reset,
    continueStream,
    
    // 流式输出控制
    streaming: {
      pause: streamingOutput.controls.pauseStream,
      resume: streamingOutput.controls.resumeStream,
      terminate: streamingOutput.controls.terminateStream
    },
    
    // 服务状态
    serviceStatus: aiServiceRef.current.getActiveStreamStatus(),
    
    // 当前内容
    content: streamingOutput.state.content,
    progress: streamingOutput.state.progress,
    
    // 流 ID (用于调试)
    streamId: streamId.current
  }
}

/**
 * 简化的 AI 问答 Hook
 */
export function useAIChat(options?: AIStreamingOptions) {
  const aiStreaming = useAIStreaming(options)
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: number
  }>>([])

  const chat = useCallback(async (message: string) => {
    // 添加用户消息到历史
    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: message, timestamp: Date.now() }
    ])

    // 发起 AI 请求
    await aiStreaming.ask(message, {
      onComplete: (response) => {
        // 添加 AI 响应到历史
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', content: response.content, timestamp: Date.now() }
        ])
      }
    })
  }, [aiStreaming])

  const clearHistory = useCallback(() => {
    setChatHistory([])
    aiStreaming.reset()
  }, [aiStreaming])

  return {
    ...aiStreaming,
    chat,
    chatHistory,
    clearHistory
  }
}

/**
 * AI 代码生成专用 Hook
 */
export function useAICodeGen(options?: AIStreamingOptions) {
  return useAIStreaming({
    ...options,
    systemPrompt: `你是一个专业的代码生成助手。请根据用户需求生成高质量的代码，包含必要的注释和说明。
    
请注意：
- 代码要符合最佳实践
- 包含适当的错误处理
- 提供清晰的注释
- 使用现代语法和特性`,
    enableRealTimeFormatting: true,
    renderDelay: 20, // 代码生成稍微快一点
    chunkSize: 40
  })
}