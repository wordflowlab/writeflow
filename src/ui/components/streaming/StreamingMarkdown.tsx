/**
 * WriteFlow StreamingMarkdown 组件
 * 智能增量解析和渲染 Markdown 的流式组件
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Text, Box } from 'ink'
import { StreamingService, StreamingResponse } from '../../../services/streaming/StreamingService.js'
import { extractCodeBlocks } from '../../utils/codeFormatter.js'
import { StreamingText } from './StreamingText.js'
import { StreamingCodeBlock } from './StreamingCodeBlock.js'
import { performance } from 'perf_hooks'

export interface StreamingMarkdownProps {
  // 数据源
  streamingService?: StreamingService
  content?: string // 静态内容模式
  
  // 解析配置
  incrementalParsing?: boolean // 增量解析
  structuralAwareness?: boolean // 结构感知渲染
  codeBlockHandling?: 'inline' | 'component' | 'hybrid'
  
  // 渲染配置
  delay?: number
  maxWidth?: number
  preserveFormatting?: boolean
  
  // 功能开关
  enableSyntaxHighlight?: boolean
  enableProgressiveFormatting?: boolean
  enableSmartBuffering?: boolean // 智能缓冲
  
  // 视觉配置
  theme?: 'light' | 'dark'
  showProgress?: boolean
  showStructureHints?: boolean // 显示结构提示
  
  // 性能配置
  parsingBatchSize?: number // 解析批次大小
  renderThreshold?: number // 渲染阈值
  maxFPS?: number
  
  // 回调
  onComplete?: () => void
  onChunk?: (chunk: string, totalLength: number, stats: MarkdownRenderStats) => void
  onStructureDetected?: (structure: MarkdownStructure) => void
  onError?: (error: Error) => void
}

interface MarkdownRenderStats {
  totalElements: number
  renderedElements: number
  parseTime: number
  renderTime: number
  codeBlocks: number
  headings: number
  lists: number
}

interface MarkdownStructure {
  headings: Array<{ level: number; text: string; position: number }>
  codeBlocks: Array<{ language: string; position: number; length: number }>
  lists: Array<{ type: 'ordered' | 'unordered'; position: number; items: number }>
  links: Array<{ text: string; url: string; position: number }>
  tables: Array<{ position: number; rows: number; cols: number }>
}

interface ContentSegment {
  id: string
  type: 'text' | 'heading' | 'codeblock' | 'list' | 'paragraph' | 'blockquote' | 'table'
  content: string
  metadata?: {
    language?: string // for code blocks
    level?: number // for headings
    listType?: 'ordered' | 'unordered' // for lists
    startLine?: number
    endLine?: number
  }
  startIndex: number
  endIndex: number
  rendered?: React.ReactNode
  isComplete?: boolean
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
  streamingService,
  content,
  incrementalParsing = true,
  structuralAwareness = true,
  codeBlockHandling = 'hybrid',
  delay = 15,
  maxWidth = 100,
  preserveFormatting = true,
  enableSyntaxHighlight = true,
  enableProgressiveFormatting = true,
  enableSmartBuffering = true,
  theme = 'dark',
  showProgress = false,
  showStructureHints = false,
  parsingBatchSize = 500,
  renderThreshold = 50,
  maxFPS = 30,
  onComplete,
  onChunk,
  onStructureDetected,
  onError
}) => {
  // 核心状态
  const [segments, setSegments] = useState<ContentSegment[]>([])
  const [renderedContent, setRenderedContent] = useState<React.ReactNode[]>([])
  const [structure, setStructure] = useState<MarkdownStructure>({
    headings: [],
    codeBlocks: [],
    lists: [],
    links: [],
    tables: []
  })
  
  // 流式状态
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // 性能状态
  const [stats, setStats] = useState<MarkdownRenderStats>({
    totalElements: 0,
    renderedElements: 0,
    parseTime: 0,
    renderTime: 0,
    codeBlocks: 0,
    headings: 0,
    lists: 0
  })

  // Refs
  const contentBufferRef = useRef<string>('')
  const parseQueueRef = useRef<string>('')
  const lastParsedPositionRef = useRef<number>(0)
  const segmentCacheRef = useRef<Map<string, ContentSegment>>(new Map())
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // 智能增量解析 Markdown 内容
  const performIncrementalParsing = useCallback(async (newContent: string): Promise<ContentSegment[]> => {
    if (!incrementalParsing || !newContent) return []

    const parseStartTime = performance.now()
    setIsParsing(true)

    try {
      // 智能分段：识别不同类型的 Markdown 结构
      const newSegments: ContentSegment[] = []
      let currentPos = lastParsedPositionRef.current
      
      // 仅解析新增的内容
      const contentToProcess = newContent.slice(currentPos)
      if (!contentToProcess) return segments

      // 使用正则表达式识别 Markdown 结构
      const patterns = {
        heading: /^(#{1,6})\s+(.+)$/gm,
        codeBlock: /^```(\w+)?\n([\s\S]*?)^```$/gm,
        listItem: /^(\s*)[-*+]\s+(.+)$/gm,
        orderedList: /^(\s*)\d+\.\s+(.+)$/gm,
        blockquote: /^>\s+(.+)$/gm,
        table: /^\|.*\|$/gm
      }

      let segments_temp: ContentSegment[] = []
      let lastEnd = currentPos

      // 解析代码块（优先级最高）
      const codeBlocks = extractCodeBlocks(newContent)
      for (const block of codeBlocks) {
        if (block.startIndex >= currentPos) {
          // 添加代码块前的文本
          if (block.startIndex > lastEnd) {
            const textContent = newContent.slice(lastEnd, block.startIndex)
            if (textContent.trim()) {
              segments_temp.push({
                id: `text_${lastEnd}_${block.startIndex}`,
                type: 'text',
                content: textContent,
                startIndex: lastEnd,
                endIndex: block.startIndex,
                isComplete: true
              })
            }
          }

          // 添加代码块
          segments_temp.push({
            id: `code_${block.startIndex}_${block.endIndex}`,
            type: 'codeblock',
            content: block.code,
            metadata: { language: block.language },
            startIndex: block.startIndex,
            endIndex: block.endIndex,
            isComplete: true
          })

          lastEnd = block.endIndex
        }
      }

      // 处理剩余的文本内容
      if (lastEnd < newContent.length) {
        const remainingText = newContent.slice(lastEnd)
        
        // 解析标题
        let match
        patterns.heading.lastIndex = 0
        while ((match = patterns.heading.exec(remainingText)) !== null) {
          const level = match[1].length
          const text = match[2].trim()
          const position = lastEnd + match.index
          
          structure.headings.push({ level, text, position })
          
          segments_temp.push({
            id: `heading_${position}`,
            type: 'heading',
            content: match[0],
            metadata: { level },
            startIndex: position,
            endIndex: position + match[0].length,
            isComplete: true
          })
        }

        // 如果没有特殊结构，作为普通段落处理
        if (segments_temp.length === 0 || lastEnd < newContent.length) {
          segments_temp.push({
            id: `paragraph_${lastEnd}`,
            type: 'paragraph',
            content: remainingText,
            startIndex: lastEnd,
            endIndex: newContent.length,
            isComplete: false // 流式内容可能未完成
          })
        }
      }

      // 更新解析位置
      lastParsedPositionRef.current = newContent.length

      // 更新统计信息
      const parseTime = performance.now() - parseStartTime
      setStats(prev => ({
        ...prev,
        parseTime,
        totalElements: segments_temp.length,
        headings: structure.headings.length,
        codeBlocks: structure.codeBlocks.length
      }))

      // 缓存解析结果
      segments_temp.forEach(segment => {
        segmentCacheRef.current.set(segment.id, segment)
      })

      return segments_temp

    } catch (_error) {
      console.warn('增量解析失败:', _error)
      setError(_error instanceof Error ? _error : new Error(String(_error)))
      return []
    } finally {
      setIsParsing(false)
    }
  }, [incrementalParsing, segments, structure])

  // 渲染单个段落的 React 组件
  const renderSegment = useCallback((segment: ContentSegment): React.ReactNode => {
    const key = segment.id

    switch (segment.type) {
      case 'heading':
        const level = segment.metadata?.level || 1
        const headingColor = theme === 'dark' ? 'cyan' : 'blue'
        return (
          <Box key={key} marginY={level <= 2 ? 1 : 0}>
            <Text color={headingColor} bold={level <= 2} underline={level === 1}>
              {segment.content}
            </Text>
          </Box>
        )

      case 'codeblock':
        if (codeBlockHandling === 'component') {
          return (
            <StreamingCodeBlock
              key={key}
              code={segment.content}
              language={segment.metadata?.language}
              theme={theme}
              enableSyntaxHighlight={enableSyntaxHighlight}
              showBorder={true}
              showHeader={true}
              maxWidth={maxWidth}
            />
          )
        } else {
          // 内联代码处理
          return (
            <Box key={key} marginY={1} borderStyle="round" borderColor="gray" paddingX={1}>
              <StreamingText
                content={segment.content}
                delay={delay}
                theme={theme}
                preserveFormatting={true}
                cursor={false}
              />
            </Box>
          )
        }

      case 'paragraph':
        return (
          <Box key={key} marginBottom={1}>
            <StreamingText
              content={segment.content}
              delay={delay}
              theme={theme}
              preserveFormatting={preserveFormatting}
              cursor={!segment.isComplete}
              renderMode="adaptive"
            />
          </Box>
        )

      case 'text':
        return (
          <StreamingText
            key={key}
            content={segment.content}
            delay={delay}
            theme={theme}
            preserveFormatting={preserveFormatting}
            cursor={false}
          />
        )

      default:
        return (
          <Text key={key} color="gray" dimColor>
            [Unsupported content type: {segment.type}]
          </Text>
        )
    }
  }, [theme, codeBlockHandling, enableSyntaxHighlight, maxWidth, delay, preserveFormatting])

  // 连接到流式服务
  useEffect(() => {
    if (!streamingService) return

    startTimeRef.current = performance.now()
    setIsStreaming(true)
    setIsComplete(false)
    setError(null)
    contentBufferRef.current = ''
    setSegments([])
    lastParsedPositionRef.current = 0

    const handleChunk = async (response: StreamingResponse) => {
      contentBufferRef.current = response.content
      
      // 执行增量解析
      if (incrementalParsing && response.content.length >= renderThreshold) {
        const newSegments = await performIncrementalParsing(response.content)
        if (newSegments.length > 0) {
          setSegments(prev => [...prev, ...newSegments])
        }
      }

      onChunk?.(response.content.slice(contentBufferRef.current.length - response.content.length), 
               response.content.length, stats)
    }

    const handleComplete = async (response: StreamingResponse) => {
      contentBufferRef.current = response.content
      setIsStreaming(false)

      // 最终解析
      const finalSegments = await performIncrementalParsing(response.content)
      setSegments(finalSegments)
      setIsComplete(true)

      // 触发结构检测回调
      onStructureDetected?.(structure)
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
    }
  }, [streamingService, incrementalParsing, renderThreshold, performIncrementalParsing, structure])

  // 静态内容处理
  useEffect(() => {
    if (!content || streamingService) return

    const processStaticContent = async () => {
      const segments = await performIncrementalParsing(content)
      setSegments(segments)
      setIsComplete(true)
      onStructureDetected?.(structure)
      onComplete?.()
    }

    processStaticContent()
  }, [content, streamingService, performIncrementalParsing, structure])

  // 主题颜色
  const colors = useMemo(() => ({
    progress: theme === 'dark' ? 'cyan' : 'blue',
    success: theme === 'dark' ? 'green' : 'greenBright',
    error: theme === 'dark' ? 'red' : 'redBright',
    dim: theme === 'dark' ? 'gray' : 'blackBright'
  }), [theme])

  // 错误状态
  if (error) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color={colors.error}>
          ❌ Markdown 解析错误: {error.message}
        </Text>
        {segments.length > 0 && (
          <Text color={colors.dim}>
            已解析 {segments.length} 个段落
          </Text>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {/* 进度和状态信息 */}
      {showProgress && (isStreaming || isParsing) && (
        <Box marginBottom={1}>
          <Text color={colors.progress} dimColor>
            {isParsing && '解析中... '}
            {isStreaming && '流式传输中... '}
            进度: {stats.renderedElements}/{stats.totalElements} 元素
            {stats.parseTime > 50 && ` · 解析: ${stats.parseTime.toFixed(0)}ms`}
          </Text>
        </Box>
      )}

      {/* 结构提示 */}
      {showStructureHints && structure.headings.length > 0 && (
        <Box marginBottom={1}>
          <Text color={colors.dim} dimColor>
            结构: {structure.headings.length}标题 · {structure.codeBlocks.length}代码块 · {structure.lists.length}列表
          </Text>
        </Box>
      )}

      {/* 主要内容渲染 */}
      <Box flexDirection="column">
        {segments.map((segment, index) => renderSegment(segment))}
      </Box>

      {/* 完成状态 */}
      {isComplete && (
        <Box marginTop={1}>
          <Text color={colors.success} dimColor>
            ✓ Markdown 渲染完成
            {stats.totalElements > 0 && ` · ${stats.totalElements} 个元素`}
            {stats.parseTime > 100 && ` · 解析耗时 ${stats.parseTime.toFixed(0)}ms`}
            {incrementalParsing && ' · 增量解析'}
          </Text>
        </Box>
      )}

      {/* 调试信息 */}
      {process.env.WRITEFLOW_DEBUG === 'true' && (
        <Box marginTop={1}>
          <Text color={colors.dim} dimColor>
            Debug: {segments.length}段落 | {stats.headings}标题 | {stats.codeBlocks}代码块
            {isStreaming && ' | 流式中'}
            {isParsing && ' | 解析中'}
          </Text>
        </Box>
      )}
    </Box>
  )
}

