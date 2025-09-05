/**
 * WriteFlow StreamingText 组件
 * 真实连接流式数据源的实时文本渲染组件
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Text, Box } from 'ink'
import { StreamingService, StreamingResponse, UIStreamingChunk } from '../../../services/streaming/StreamingService.js'
import { performance } from 'perf_hooks'

export interface StreamingTextProps {
  // 流式数据源 - 支持多种输入方式
  streamingService?: StreamingService
  content?: string // 静态内容模式
  
  // 渲染配置
  renderMode?: 'character' | 'word' | 'chunk' | 'adaptive'
  delay?: number // 基础渲染延迟(ms)
  adaptiveSpeed?: boolean // 根据网络速度自适应
  
  // 视觉配置
  preserveFormatting?: boolean
  cursor?: boolean
  cursorChar?: string
  theme?: 'light' | 'dark'
  
  // 性能配置
  maxFPS?: number // 最大渲染帧率
  bufferSize?: number // 内部缓冲区大小
  smoothing?: boolean // 平滑渲染
  
  // 回调函数
  onComplete?: () => void
  onChunk?: (chunk: string, totalLength: number, renderStats: RenderStats) => void
  onError?: (error: Error) => void
}

export interface RenderStats {
  fps: number
  charactersPerSecond: number
  renderTime: number
  bufferSize: number
  droppedFrames: number
}

export const StreamingText: React.FC<StreamingTextProps> = ({
  streamingService,
  content,
  renderMode = 'adaptive',
  delay = 20,
  adaptiveSpeed = true,
  preserveFormatting = true,
  cursor = true,
  cursorChar = '▊',
  theme = 'dark',
  maxFPS = 60,
  bufferSize = 1024,
  smoothing = true,
  onComplete,
  onChunk,
  onError
}) => {
  // 核心状态
  const [displayedContent, setDisplayedContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [showCursor, setShowCursor] = useState(cursor)
  const [error, setError] = useState<Error | null>(null)

  // 性能监控状态
  const [renderStats, setRenderStats] = useState<RenderStats>({
    fps: 0,
    charactersPerSecond: 0,
    renderTime: 0,
    bufferSize: 0,
    droppedFrames: 0
  })

  // Refs
  const contentBufferRef = useRef<string>('')
  const renderQueueRef = useRef<string[]>([])
  const lastRenderTimeRef = useRef<number>(0)
  const frameTimeHistoryRef = useRef<number[]>([])
  const droppedFramesRef = useRef<number>(0)
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // 自适应渲染速度计算
  const calculateAdaptiveSpeed = useMemo(() => {
    if (!adaptiveSpeed) return delay

    const avgFPS = frameTimeHistoryRef.current.length > 0
      ? 1000 / (frameTimeHistoryRef.current.reduce((a, b) => a + b) / frameTimeHistoryRef.current.length)
      : maxFPS

    // 根据当前 FPS 调整延迟
    if (avgFPS < maxFPS * 0.5) {
      return Math.max(delay * 2, 50) // 性能不足时减慢渲染
    } else if (avgFPS > maxFPS * 0.9) {
      return Math.max(delay * 0.7, 10) // 性能充足时加快渲染
    }

    return delay
  }, [delay, maxFPS, adaptiveSpeed, renderStats.fps])

  // 智能内容分块逻辑
  const getNextRenderChunk = (availableContent: string, currentDisplayLength: number): string => {
    const remaining = availableContent.slice(currentDisplayLength)
    if (!remaining) return ''

    switch (renderMode) {
      case 'character':
        return remaining.charAt(0)

      case 'word': {
        const wordMatch = remaining.match(/^(\S*\s*)/)
        return wordMatch ? wordMatch[1] : remaining.charAt(0)
      }

      case 'chunk': {
        const chunkSize = Math.min(8, remaining.length)
        return remaining.slice(0, chunkSize)
      }

      case 'adaptive': {
        // 基于网络速度和内容类型的自适应分块
        const networkSpeed = renderStats.charactersPerSecond
        
        if (networkSpeed > 100) {
          // 高速网络：按词分块
          const wordMatch = remaining.match(/^(\S*\s*)/)
          return wordMatch ? wordMatch[1] : remaining.slice(0, Math.min(4, remaining.length))
        } else if (networkSpeed > 20) {
          // 中速网络：小块分块
          return remaining.slice(0, Math.min(2, remaining.length))
        } else {
          // 低速网络：单字符
          return remaining.charAt(0)
        }
      }

      default:
        return remaining.charAt(0)
    }
  }

  // 连接到真实的流式服务
  useEffect(() => {
    if (!streamingService) return

    startTimeRef.current = performance.now()
    setIsStreaming(true)
    setIsComplete(false)
    setError(null)
    contentBufferRef.current = ''
    setDisplayedContent('')

    // 处理 UI 优化的流式数据块 - 关键改进：使用新的 uiChunk 事件
    const handleUIChunk = (uiChunk: UIStreamingChunk) => {
      // 使用 UI 优化的数据结构
      contentBufferRef.current = uiChunk.content
      
      // 直接渲染增量内容，实现真正的字符级流式显示
      if (uiChunk.delta && uiChunk.delta.length > 0) {
        setDisplayedContent(prev => {
          const newContent = prev + uiChunk.delta
          // 触发用户回调
          onChunk?.(uiChunk.delta, newContent.length, renderStats)
          return newContent
        })
        
        // 更新性能统计
        const now = performance.now()
        updateRenderStats(now, uiChunk.delta.length)
      }
    }
    
    // 降级兼容：处理标准流式数据块
    const handleChunk = (response: StreamingResponse) => {
      const newContent = response.content
      contentBufferRef.current = newContent
      
      // 将新内容添加到渲染队列
      if (newContent.length > displayedContent.length) {
        const newChunk = newContent.slice(displayedContent.length)
        renderQueueRef.current.push(newChunk)
      }
      
      // 触发渲染更新
      if (!renderTimeoutRef.current) {
        scheduleRender()
      }
    }

    const handleComplete = (response: StreamingResponse) => {
      contentBufferRef.current = response.content
      setIsStreaming(false)
      
      // 确保所有内容都被渲染
      const finalRender = () => {
        if (displayedContent.length < contentBufferRef.current.length) {
          setDisplayedContent(contentBufferRef.current)
        }
        setIsComplete(true)
        setShowCursor(false)
        onComplete?.()
      }
      
      setTimeout(finalRender, 100) // 给最后的渲染一些时间
    }

    const handleError = (error: Error) => {
      setError(error)
      setIsStreaming(false)
      setShowCursor(false)
      onError?.(error)
    }

    // 订阅流式服务事件 - 优先使用 UI 优化事件
    streamingService.on('uiChunk', handleUIChunk)
    streamingService.on('chunk', handleChunk) // 降级兼容
    streamingService.on('complete', handleComplete)
    streamingService.on('error', handleError)

    return () => {
      streamingService.off('uiChunk', handleUIChunk)
      streamingService.off('chunk', handleChunk)
      streamingService.off('complete', handleComplete)
      streamingService.off('error', handleError)
      cleanupTimers()
    }
  }, [streamingService, displayedContent.length])

  // 静态内容模式的处理
  useEffect(() => {
    if (!content || streamingService) return

    contentBufferRef.current = content
    setIsComplete(false)
    setShowCursor(cursor)
    
    // 模拟流式渲染静态内容
    simulateStreamingForStaticContent()
    
    return () => cleanupTimers()
  }, [content, cursor])

  // 调度渲染帧
  const scheduleRender = () => {
    if (renderTimeoutRef.current) return

    const now = performance.now()
    const timeSinceLastRender = now - lastRenderTimeRef.current
    const targetFrameTime = 1000 / maxFPS
    
    if (timeSinceLastRender >= targetFrameTime) {
      renderNextFrame()
    } else {
      const delay = Math.max(calculateAdaptiveSpeed, targetFrameTime - timeSinceLastRender)
      renderTimeoutRef.current = setTimeout(() => {
        renderTimeoutRef.current = null
        renderNextFrame()
      }, delay)
    }
  }

  // 渲染下一帧
  const renderNextFrame = () => {
    const frameStartTime = performance.now()
    
    // 检查是否有内容需要渲染
    const availableContent = contentBufferRef.current
    const currentDisplayLength = displayedContent.length
    
    if (currentDisplayLength >= availableContent.length) {
      // 已渲染完所有可用内容
      updateRenderStats(frameStartTime, 0)
      return
    }

    // 获取下一个渲染块
    const nextChunk = getNextRenderChunk(availableContent, currentDisplayLength)
    if (!nextChunk) {
      updateRenderStats(frameStartTime, 0)
      return
    }

    // 更新显示内容
    const newDisplayedContent = displayedContent + nextChunk
    setDisplayedContent(newDisplayedContent)
    
    // 记录性能指标
    updateRenderStats(frameStartTime, nextChunk.length)
    
    // 触发回调
    onChunk?.(nextChunk, contentBufferRef.current.length, renderStats)
    
    // 如果还有更多内容需要渲染，继续调度
    if (newDisplayedContent.length < availableContent.length) {
      scheduleRender()
    } else if (!isStreaming) {
      // 如果流已结束且内容已完全渲染
      setIsComplete(true)
      setShowCursor(false)
      onComplete?.()
    }
  }

  // 为静态内容模拟流式渲染
  const simulateStreamingForStaticContent = () => {
    let currentPos = 0
    
    const renderStaticChunk = () => {
      if (currentPos >= contentBufferRef.current.length) {
        setIsComplete(true)
        setShowCursor(false)
        onComplete?.()
        return
      }

      const chunk = getNextRenderChunk(contentBufferRef.current, currentPos)
      currentPos += chunk.length
      
      setDisplayedContent(prev => prev + chunk)
      onChunk?.(chunk, contentBufferRef.current.length, renderStats)
      
      renderTimeoutRef.current = setTimeout(renderStaticChunk, calculateAdaptiveSpeed)
    }

    renderTimeoutRef.current = setTimeout(renderStaticChunk, calculateAdaptiveSpeed)
  }

  // 性能指标更新
  const updateRenderStats = (frameStartTime: number, charactersRendered: number) => {
    const frameEndTime = performance.now()
    const frameTime = frameEndTime - frameStartTime
    
    // 更新帧时间历史
    frameTimeHistoryRef.current.push(frameTime)
    if (frameTimeHistoryRef.current.length > 60) {
      frameTimeHistoryRef.current.shift() // 保持最近60帧
    }

    // 检测掉帧
    const targetFrameTime = 1000 / maxFPS
    if (frameTime > targetFrameTime * 1.5) {
      droppedFramesRef.current++
    }

    // 计算性能指标
    const avgFrameTime = frameTimeHistoryRef.current.reduce((a, b) => a + b) / frameTimeHistoryRef.current.length
    const currentFPS = 1000 / avgFrameTime
    
    const elapsedTime = (frameEndTime - startTimeRef.current) / 1000
    const totalCharacters = displayedContent.length + charactersRendered
    const charactersPerSecond = elapsedTime > 0 ? totalCharacters / elapsedTime : 0

    setRenderStats({
      fps: currentFPS,
      charactersPerSecond,
      renderTime: frameTime,
      bufferSize: contentBufferRef.current.length - displayedContent.length,
      droppedFrames: droppedFramesRef.current
    })

    lastRenderTimeRef.current = frameEndTime
  }

  // 光标闪烁效果
  useEffect(() => {
    if (!cursor || isComplete || error) {
      setShowCursor(false)
      return
    }

    if (isStreaming) {
      setShowCursor(true) // 流式传输时保持光标显示
      return
    }

    // 非流式模式下的光标闪烁
    const blinkCursor = () => {
      setShowCursor(prev => !prev)
      cursorTimeoutRef.current = setTimeout(blinkCursor, 500)
    }

    cursorTimeoutRef.current = setTimeout(blinkCursor, 500)

    return () => {
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current)
      }
    }
  }, [cursor, isComplete, isStreaming, error])

  // 清理函数
  const cleanupTimers = () => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current)
      renderTimeoutRef.current = null
    }
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current)
      cursorTimeoutRef.current = null
    }
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupTimers()
    }
  }, [])

  // 主题颜色
  const colors = useMemo(() => ({
    cursor: theme === 'dark' ? 'cyan' : 'blue',
    error: theme === 'dark' ? 'red' : 'redBright',
    dim: theme === 'dark' ? 'gray' : 'blackBright'
  }), [theme])

  // 错误状态渲染
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={colors.error}>
          ❌ 流式渲染错误: {error.message}
        </Text>
        {displayedContent && (
          <Text color={colors.dim}>
            已渲染内容: {displayedContent.slice(0, 100)}
            {displayedContent.length > 100 ? '...' : ''}
          </Text>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {/* 主要内容区域 */}
      <Box flexDirection="row">
        <Text>
          {preserveFormatting ? displayedContent : displayedContent.replace(/\n/g, ' ')}
        </Text>
        {showCursor && !isComplete && (
          <Text color={colors.cursor}>{cursorChar}</Text>
        )}
      </Box>

      {/* 调试信息（可选） */}
      {process.env.WRITEFLOW_DEBUG === 'true' && (
        <Box marginTop={1}>
          <Text color={colors.dim} dimColor>
            FPS: {renderStats.fps.toFixed(1)} | 
            速度: {renderStats.charactersPerSecond.toFixed(0)}c/s | 
            缓冲: {renderStats.bufferSize} | 
            掉帧: {renderStats.droppedFrames}
            {isStreaming && ' | 流式中...'}
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default StreamingText