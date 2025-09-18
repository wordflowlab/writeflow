/**
 * WriteFlow StreamingCodeBlock 组件
 * 真实的渐进式代码语法高亮组件
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Text, Box } from 'ink'
import { StreamingService, StreamingResponse } from '../../../services/streaming/StreamingService.js'
import { formatCode, formatInlineCode, detectLanguage } from '../../utils/codeFormatter.js'
import { figures } from '../../constants/figures.js'
import { performance } from 'perf_hooks'

export interface StreamingCodeBlockProps {
  // 数据源
  streamingService?: StreamingService
  code?: string // 静态代码
  
  // 代码配置
  language?: string
  autoDetectLanguage?: boolean
  filename?: string
  
  // 渲染配置
  delay?: number
  showLineNumbers?: boolean
  startLine?: number
  maxWidth?: number
  
  // 语法高亮配置
  enableSyntaxHighlight?: boolean
  progressiveHighlight?: boolean // 渐进式高亮
  highlightThreshold?: number // 开始语法高亮的字符数阈值
  
  // 视觉配置
  theme?: 'light' | 'dark'
  showBorder?: boolean
  showHeader?: boolean
  showFooter?: boolean
  
  // 性能配置
  maxFPS?: number
  lazyHighlight?: boolean // 延迟高亮以提升性能
  
  // 回调
  onComplete?: () => void
  onChunk?: (chunk: string, totalLength: number, stats: CodeRenderStats) => void
  onLanguageDetected?: (language: string) => void
  onError?: (error: Error) => void
}

interface CodeRenderStats {
  totalLines: number
  highlightedLines: number
  renderTime: number
  highlightTime: number
  detectedLanguage?: string
}

export const StreamingCodeBlock: React.FC<StreamingCodeBlockProps> = ({
  streamingService,
  code,
  language,
  autoDetectLanguage = true,
  filename,
  delay = 15,
  showLineNumbers = true,
  startLine = 1,
  maxWidth = 120,
  enableSyntaxHighlight = true,
  progressiveHighlight = true,
  highlightThreshold = 50,
  theme = 'dark',
  showBorder = true,
  showHeader = true,
  showFooter = true,
  maxFPS = 30,
  lazyHighlight = true,
  onComplete,
  onChunk,
  onLanguageDetected,
  onError
}) => {
  // 核心状态
  const [displayedCode, setDisplayedCode] = useState('')
  const [highlightedLines, setHighlightedLines] = useState<string[]>([])
  const [detectedLanguage, setDetectedLanguage] = useState<string | undefined>(language)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // 性能状态
  const [stats, setStats] = useState<CodeRenderStats>({
    totalLines: 0,
    highlightedLines: 0,
    renderTime: 0,
    highlightTime: 0,
    detectedLanguage: undefined
  })

  // Refs
  const codeBufferRef = useRef<string>('')
  const highlightCacheRef = useRef<Map<string, string>>(new Map())
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const renderStartTimeRef = useRef<number>(0)
  const lastHighlightPosRef = useRef<number>(0)

  // 语言检测和缓存
  const detectAndCacheLanguage = useCallback(async (codeContent: string): Promise<string> => {
    if (language) return language

    const cacheKey = `lang_${codeContent.slice(0, 200)}`
    const cached = highlightCacheRef.current.get(cacheKey)
    if (cached) return cached

    try {
      const detected = await detectLanguage(codeContent)
      highlightCacheRef.current.set(cacheKey, detected)
      return detected
    } catch (error) {
      console.warn('语言检测失败:', error)
      return 'text'
    }
  }, [language])

  // 渐进式语法高亮
  const performProgressiveHighlight = useCallback(async (
    codeContent: string, 
    targetLanguage: string
  ): Promise<string[]> => {
    if (!enableSyntaxHighlight || !codeContent.trim()) return []

    const highlightStartTime = performance.now()

    try {
      const lines = codeContent.split('\n')
      const highlightedLinesList: string[] = []

      // 批量处理行，以提高性能
      const batchSize = lazyHighlight ? 5 : 20
      
      for (let i = lastHighlightPosRef.current; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize)
        const batchCode = batch.join('\n')
        
        const cacheKey = `highlight_${targetLanguage}_${batchCode.slice(0, 100)}`
        let highlightedBatch = highlightCacheRef.current.get(cacheKey)
        
        if (!highlightedBatch) {
          const formatResult = await formatCode(batchCode, {
            language: targetLanguage,
            showLineNumbers: false,
            theme,
            maxWidth
          })
          
          highlightedBatch = formatResult.content
          highlightCacheRef.current.set(cacheKey, highlightedBatch)
        }

        const highlightedBatchLines = highlightedBatch.split('\n')
        highlightedLinesList.push(...highlightedBatchLines)
        
        // 如果是延迟高亮模式，给其他任务让路
        if (lazyHighlight && i % batchSize === 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }

      const highlightTime = performance.now() - highlightStartTime
      setStats(prev => ({
        ...prev,
        highlightTime,
        highlightedLines: highlightedLinesList.length,
        detectedLanguage: targetLanguage
      }))

      return highlightedLinesList
      
    } catch (error) {
      console.warn('渐进式高亮失败:', error)
      return codeContent.split('\n') // 降级到无高亮
    }
  }, [enableSyntaxHighlight, theme, maxWidth, lazyHighlight])

  // 连接到流式服务
  useEffect(() => {
    if (!streamingService) return

    renderStartTimeRef.current = performance.now()
    setIsStreaming(true)
    setIsComplete(false)
    setError(null)
    codeBufferRef.current = ''
    setDisplayedCode('')
    setHighlightedLines([])
    lastHighlightPosRef.current = 0

    const handleChunk = async (response: StreamingResponse) => {
      const newCode = response.content
      codeBufferRef.current = newCode
      
      // 更新显示的代码
      setDisplayedCode(newCode)

      // 语言检测（仅在有足够内容时进行）
      if (!detectedLanguage && newCode.length >= highlightThreshold && autoDetectLanguage) {
        const detected = await detectAndCacheLanguage(newCode)
        setDetectedLanguage(detected)
        onLanguageDetected?.(detected)
      }

      // 渐进式高亮（当达到阈值且有语言信息时）
      if (progressiveHighlight && 
          newCode.length >= highlightThreshold && 
          (detectedLanguage || language)) {
        
        const targetLang = detectedLanguage || language || 'text'
        const highlighted = await performProgressiveHighlight(newCode, targetLang)
        setHighlightedLines(highlighted)
      }

      // 更新统计信息
      const lines = newCode.split('\n')
      setStats(prev => ({
        ...prev,
        totalLines: lines.length,
        renderTime: performance.now() - renderStartTimeRef.current
      }))

      onChunk?.(newCode.slice(displayedCode.length), newCode.length, stats)
    }

    const handleComplete = async (response: StreamingResponse) => {
      codeBufferRef.current = response.content
      setDisplayedCode(response.content)
      setIsStreaming(false)

      // 最终高亮处理
      if (enableSyntaxHighlight && response.content.trim()) {
        const finalLanguage = detectedLanguage || 
                             (autoDetectLanguage ? await detectAndCacheLanguage(response.content) : language) || 
                             'text'
        
        if (finalLanguage !== detectedLanguage) {
          setDetectedLanguage(finalLanguage)
          onLanguageDetected?.(finalLanguage)
        }

        const finalHighlighted = await performProgressiveHighlight(response.content, finalLanguage)
        setHighlightedLines(finalHighlighted)
      }

      setIsComplete(true)
      onComplete?.()
    }

    const handleError = (error: Error) => {
      setError(error)
      setIsStreaming(false)
      onError?.(error)
    }

    streamingService.on('chunk', handleChunk)
    streamingService.on('complete', handleComplete)
    streamingService.on('error', handleError)

    return () => {
      streamingService.off('chunk', handleChunk)
      streamingService.off('complete', handleComplete)
      streamingService.off('error', handleError)
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [streamingService, displayedCode.length, detectedLanguage, language, highlightThreshold, autoDetectLanguage])

  // 静态代码处理
  useEffect(() => {
    if (!code || streamingService) return

    codeBufferRef.current = code
    setDisplayedCode(code)
    setIsComplete(true)

    const processStaticCode = async () => {
      const finalLanguage = detectedLanguage || 
                           (autoDetectLanguage ? await detectAndCacheLanguage(code) : language) || 
                           'text'
      
      setDetectedLanguage(finalLanguage)
      onLanguageDetected?.(finalLanguage)

      if (enableSyntaxHighlight) {
        const highlighted = await performProgressiveHighlight(code, finalLanguage)
        setHighlightedLines(highlighted)
      }

      const lines = code.split('\n')
      setStats(prev => ({
        ...prev,
        totalLines: lines.length,
        detectedLanguage: finalLanguage
      }))
    }

    processStaticCode()
  }, [code, language, enableSyntaxHighlight, autoDetectLanguage])

  // 主题颜色配置
  const colors = useMemo(() => ({
    border: theme === 'dark' ? 'gray' : 'blackBright',
    header: theme === 'dark' ? 'cyan' : 'blue',
    success: theme === 'dark' ? 'green' : 'greenBright',
    error: theme === 'dark' ? 'red' : 'redBright',
    dim: theme === 'dark' ? 'gray' : 'blackBright',
    warning: theme === 'dark' ? 'yellow' : 'yellowBright'
  }), [theme])

  // 渲染行号
  const renderWithLineNumbers = (content: string[]): React.ReactNode => {
    return content.map((line, index) => {
      const lineNum = startLine + index
      const lineNumStr = lineNum.toString().padStart(4, ' ')
      
      return (
        <Box key={index} flexDirection="row">
          <Text color={colors.dim} dimColor>
            {lineNumStr} │ 
          </Text>
          <Text>{line}</Text>
        </Box>
      )
    })
  }

  // 渲染代码内容
  const renderCodeContent = (): React.ReactNode => {
    // 优先使用高亮版本，回退到原始代码
    const contentToRender = highlightedLines.length > 0 ? highlightedLines : displayedCode.split('\n')
    
    if (showLineNumbers) {
      return renderWithLineNumbers(contentToRender)
    } else {
      return contentToRender.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))
    }
  }

  // 错误状态
  if (error) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box borderStyle="round" borderColor={colors.error} paddingX={1}>
          <Text color={colors.error}>
            ❌ 代码渲染错误: {error.message}
          </Text>
          {displayedCode && (
            <Text color={colors.dim}>
              已渲染 {displayedCode.split('\n').length} 行代码
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {/* 代码块头部 */}
      {showHeader && (filename || detectedLanguage) && (
        <Box marginBottom={1} flexDirection="row">
          {filename && (
            <Text color={colors.header}>
              {figures.file} {filename}
            </Text>
          )}
          {detectedLanguage && detectedLanguage !== 'text' && (
            <Text color={colors.dim} dimColor>
              {filename ? ' · ' : ''}{detectedLanguage}
              {autoDetectLanguage && !language && ' (detected)'}
            </Text>
          )}
          {isStreaming && (
            <Text color={colors.warning} dimColor> · streaming...</Text>
          )}
        </Box>
      )}

      {/* 实时统计信息 */}
      {showHeader && stats.totalLines > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>
            {stats.totalLines} lines
            {stats.highlightedLines > 0 && (
              <Text color={colors.success}> · {stats.highlightedLines} highlighted</Text>
            )}
            {stats.renderTime > 100 && (
              <Text color={colors.dim}> · {stats.renderTime.toFixed(0)}ms</Text>
            )}
            {progressiveHighlight && isStreaming && (
              <Text color={colors.warning}> · progressive highlight</Text>
            )}
          </Text>
        </Box>
      )}

      {/* 代码内容区域 */}
      <Box flexDirection="column">
        {showBorder ? (
          <Box 
            flexDirection="column" 
            borderStyle="round" 
            borderColor={colors.border}
            paddingX={1}
            paddingY={0}
          >
            {renderCodeContent()}
          </Box>
        ) : (
          <Box flexDirection="column">
            {renderCodeContent()}
          </Box>
        )}
      </Box>

      {/* 底部状态信息 */}
      {showFooter && isComplete && (
        <Box marginTop={1}>
          <Text color={colors.success} dimColor>
            {figures.tick} Code block completed
            {enableSyntaxHighlight && highlightedLines.length > 0 && (
              <Text> · syntax highlighted ({stats.highlightTime.toFixed(0)}ms)</Text>
            )}
            {detectedLanguage && autoDetectLanguage && !language && (
              <Text> · auto-detected as {detectedLanguage}</Text>
            )}
          </Text>
        </Box>
      )}

      {/* 性能调试信息 */}
      {process.env.WRITEFLOW_DEBUG === 'true' && (
        <Box marginTop={1}>
          <Text color={colors.dim} dimColor>
            Debug: {stats.totalLines}L | {stats.highlightedLines}HL | 
            R:{stats.renderTime.toFixed(1)}ms | H:{stats.highlightTime.toFixed(1)}ms
            {isStreaming && ' | STREAMING'}
          </Text>
        </Box>
      )}
    </Box>
  )
}

