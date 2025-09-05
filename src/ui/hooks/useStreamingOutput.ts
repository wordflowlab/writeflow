/**
 * WriteFlow 流式输出 Hook
 * 为组件提供流式输出能力的 React Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getStreamingPipeline, StreamChunk, RenderBuffer, StreamingPipeline } from '../utils/streamingPipeline.js'

export interface StreamingOutputOptions {
  streamId: string
  theme?: 'light' | 'dark'
  maxWidth?: number
  delay?: number
  chunkSize?: number
  enableColors?: boolean
  enableSyntaxHighlight?: boolean
  onChunk?: (chunk: StreamChunk) => void
  onComplete?: (content: string) => void
  onError?: (error: Error) => void
  debug?: boolean
}

export interface StreamingOutputState {
  content: string
  isStreaming: boolean
  isComplete: boolean
  progress: number
  contentType: 'text' | 'markdown' | 'code'
  hasCodeBlocks: boolean
  renderTime: number
  error?: Error
}

export interface StreamingOutputControls {
  startStream: (content: string) => void
  addContent: (content: string) => void
  completeStream: () => void
  pauseStream: () => void
  resumeStream: () => void
  resetStream: () => void
  terminateStream: () => void
}

/**
 * 流式输出 Hook
 */
export function useStreamingOutput(options: StreamingOutputOptions): {
  state: StreamingOutputState
  controls: StreamingOutputControls
  pipeline: StreamingPipeline
} {
  const {
    streamId,
    theme = 'dark',
    maxWidth = 80,
    delay = 25,
    chunkSize = 50,
    enableColors = true,
    enableSyntaxHighlight = true,
    onChunk,
    onComplete,
    onError,
    debug = false
  } = options

  // 状态管理
  const [state, setState] = useState<StreamingOutputState>({
    content: '',
    isStreaming: false,
    isComplete: false,
    progress: 0,
    contentType: 'text',
    hasCodeBlocks: false,
    renderTime: 0
  })

  // Refs
  const pipelineRef = useRef<StreamingPipeline | null>(null)
  const isPausedRef = useRef(false)
  const totalLengthRef = useRef(0)
  const startTimeRef = useRef(0)
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 初始化 Pipeline
  useEffect(() => {
    pipelineRef.current = getStreamingPipeline({
      theme,
      maxWidth,
      enableColors,
      chunkSize,
      renderDelay: delay,
      enableDoubleBuffer: true
    })

    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.terminateStream(streamId)
      }
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current)
      }
    }
  }, [streamId, theme, maxWidth, enableColors, chunkSize, delay])

  // 事件监听器设置
  useEffect(() => {
    if (!pipelineRef.current) return

    const pipeline = pipelineRef.current

    const handleChunk = (sid: string, chunk: StreamChunk) => {
      if (sid !== streamId) return

      setState(prev => {
        const newProgress = totalLengthRef.current > 0 
          ? ((chunk.index + chunk.content.length) / totalLengthRef.current) * 100 
          : 0

        return {
          ...prev,
          content: prev.content + chunk.content,
          progress: Math.min(newProgress, 100),
          contentType: chunk.type === 'complete' ? prev.contentType : chunk.type as any
        }
      })

      onChunk?.(chunk)
      
      if (debug) {
        console.log(`[Stream ${streamId}] Chunk:`, {
          type: chunk.type,
          length: chunk.content.length,
          index: chunk.index,
          totalLength: chunk.totalLength
        })
      }
    }

    const handleFormatted = (sid: string, buffer: RenderBuffer) => {
      if (sid !== streamId) return

      setState(prev => ({
        ...prev,
        content: buffer.content,
        hasCodeBlocks: buffer.content.includes('```') || buffer.content.includes('function')
      }))
    }

    const handleComplete = (sid: string, buffer: RenderBuffer) => {
      if (sid !== streamId) return

      setState(prev => ({
        ...prev,
        isStreaming: false,
        isComplete: true,
        progress: 100,
        renderTime: Date.now() - startTimeRef.current
      }))

      onComplete?.(buffer.content)
      
      if (debug) {
        console.log(`[Stream ${streamId}] Completed:`, {
          contentLength: buffer.content.length,
          renderTime: Date.now() - startTimeRef.current
        })
      }
    }

    const handleError = (sid: string, error: any) => {
      if (sid !== streamId) return

      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        isStreaming: false
      }))

      onError?.(error instanceof Error ? error : new Error(String(error)))
    }

    pipeline.on('chunk', handleChunk)
    pipeline.on('formatted', handleFormatted)
    pipeline.on('complete', handleComplete)
    pipeline.on('error', handleError)

    return () => {
      pipeline.off('chunk', handleChunk)
      pipeline.off('formatted', handleFormatted)
      pipeline.off('complete', handleComplete)
      pipeline.off('error', handleError)
    }
  }, [streamId, onChunk, onComplete, onError, debug])

  // 控制函数
  const startStream = useCallback((content: string) => {
    // 重置状态
    setState({
      content: '',
      isStreaming: true,
      isComplete: false,
      progress: 0,
      contentType: 'text',
      hasCodeBlocks: false,
      renderTime: 0,
      error: undefined
    })

    totalLengthRef.current = content.length
    startTimeRef.current = Date.now()
    isPausedRef.current = false

    // 检测内容类型
    const detectedType = content.includes('```') || content.includes('# ') ? 'markdown' 
                       : content.includes('function') || content.includes('const') ? 'code'
                       : 'text'

    setState(prev => ({ ...prev, contentType: detectedType }))

    // 直接设置完整内容 - 让具体的流式组件处理逐字符显示
    setState(prev => ({
      ...prev,
      content,
      isComplete: true,
      isStreaming: false,
      progress: 100,
      renderTime: Date.now() - startTimeRef.current
    }))

    // 触发完成回调
    onComplete?.(content)
  }, [streamId, onComplete])

  const addContent = useCallback((content: string) => {
    if (!pipelineRef.current) return
    
    totalLengthRef.current += content.length
    pipelineRef.current.addChunk(streamId, content)
  }, [streamId])

  const completeStream = useCallback(() => {
    if (!pipelineRef.current) return
    
    pipelineRef.current.completeStream(streamId)
    
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }
  }, [streamId])

  const pauseStream = useCallback(() => {
    isPausedRef.current = true
    
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }

    if (debug) {
      console.log(`[Stream ${streamId}] Paused`)
    }
  }, [streamId, debug])

  const resumeStream = useCallback(() => {
    if (!state.isStreaming || state.isComplete) return
    
    isPausedRef.current = false
    
    if (debug) {
      console.log(`[Stream ${streamId}] Resumed`)
    }
  }, [state.isStreaming, state.isComplete, streamId, debug])

  const resetStream = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }

    setState({
      content: '',
      isStreaming: false,
      isComplete: false,
      progress: 0,
      contentType: 'text',
      hasCodeBlocks: false,
      renderTime: 0,
      error: undefined
    })

    totalLengthRef.current = 0
    startTimeRef.current = 0
    isPausedRef.current = false

    if (debug) {
      console.log(`[Stream ${streamId}] Reset`)
    }
  }, [streamId, debug])

  const terminateStream = useCallback(() => {
    if (!pipelineRef.current) return

    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }

    pipelineRef.current.terminateStream(streamId)
    resetStream()

    if (debug) {
      console.log(`[Stream ${streamId}] Terminated`)
    }
  }, [streamId, resetStream, debug])

  return {
    state,
    controls: {
      startStream,
      addContent,
      completeStream,
      pauseStream,
      resumeStream,
      resetStream,
      terminateStream
    },
    pipeline: pipelineRef.current!
  }
}

/**
 * 简化的流式输出 Hook
 * 用于快速创建流式内容显示
 */
export function useSimpleStreaming(
  streamId: string,
  content: string,
  options?: Partial<StreamingOutputOptions>
) {
  const streamingOutput = useStreamingOutput({
    streamId,
    ...options
  })

  // 自动开始流式传输
  useEffect(() => {
    if (content && !streamingOutput.state.isStreaming && !streamingOutput.state.isComplete) {
      streamingOutput.controls.startStream(content)
    }
  }, [content, streamingOutput.state.isStreaming, streamingOutput.state.isComplete])

  return streamingOutput
}