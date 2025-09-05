/**
 * WriteFlow 流式输出管理器
 * 统一管理流式 UI 组件的渲染和状态
 */

import React, { useState, useEffect, useMemo } from 'react'
import { Text, Box } from 'ink'
import { StreamingPipeline, StreamChunk, RenderBuffer, getStreamingPipeline } from '../../utils/streamingPipeline.js'
import { StreamingText } from './StreamingText.js'
import { StreamingMarkdown } from './StreamingMarkdown.js'
import { StreamingCodeBlock } from './StreamingCodeBlock.js'
import { extractCodeBlocks } from '../../utils/codeFormatter.js'

export interface StreamingOutputManagerProps {
  streamId: string
  content?: string
  contentType?: 'auto' | 'text' | 'markdown' | 'code'
  delay?: number
  theme?: 'light' | 'dark'
  maxWidth?: number
  showProgress?: boolean
  enableSyntaxHighlight?: boolean
  onComplete?: (streamId: string, content: string) => void
  onChunk?: (streamId: string, chunk: StreamChunk) => void
  debug?: boolean
}

export interface StreamState {
  displayedContent: string
  totalContent: string
  isComplete: boolean
  contentType: 'text' | 'markdown' | 'code'
  hasCodeBlocks: boolean
  progress: number
  renderTime: number
}

export const StreamingOutputManager: React.FC<StreamingOutputManagerProps> = ({
  streamId,
  content = '',
  contentType = 'auto',
  delay = 25,
  theme = 'dark',
  maxWidth = 80,
  showProgress = false,
  enableSyntaxHighlight = true,
  onComplete,
  onChunk,
  debug = false
}) => {
  const [streamState, setStreamState] = useState<StreamState>({
    displayedContent: '',
    totalContent: '',
    isComplete: false,
    contentType: 'text',
    hasCodeBlocks: false,
    progress: 0,
    renderTime: 0
  })

  const [pipeline] = useState(() => getStreamingPipeline({
    theme,
    maxWidth,
    showProgress,
    enableColors: true,
    enableDoubleBuffer: true,
    renderDelay: 100
  }))

  // 分析内容类型
  const analyzedContentType = useMemo(() => {
    if (contentType !== 'auto') return contentType

    // 检测代码块
    const codeBlocks = extractCodeBlocks(content)
    if (codeBlocks.length > 0) {
      return 'markdown' // 包含代码块的 Markdown
    }

    // 检测 Markdown 标记
    if (content.includes('# ') || content.includes('## ') || content.includes('**') || content.includes('`')) {
      return 'markdown'
    }

    // 检测代码特征
    const codeIndicators = [
      'function', 'const', 'let', 'var', 'class', 'interface', 'type',
      'import', 'export', '=>', '{', '}', '(', ')', '[', ']'
    ]
    
    if (codeIndicators.some(indicator => content.includes(indicator))) {
      return 'code'
    }

    return 'text'
  }, [content, contentType])

  // 初始化流处理
  useEffect(() => {
    if (!content) return

    const startTime = Date.now()
    
    // 直接设置状态 - 让具体的流式组件处理逐字符显示
    setStreamState({
      displayedContent: content,
      totalContent: content,
      isComplete: true,
      contentType: analyzedContentType,
      hasCodeBlocks: extractCodeBlocks(content).length > 0,
      progress: 100,
      renderTime: Date.now() - startTime
    })

    // 触发完成回调
    setTimeout(() => {
      onComplete?.(streamId, content)
    }, 100)

  }, [content, streamId, analyzedContentType, onComplete])

  // 渲染不同类型的内容
  const renderContent = () => {
    const { displayedContent, totalContent, contentType, isComplete } = streamState
    
    // 如果还没有内容，显示加载状态
    if (!displayedContent && !isComplete) {
      return (
        <Box>
          <Text dimColor>正在接收内容...</Text>
        </Box>
      )
    }

    // 根据内容类型选择合适的组件
    switch (contentType) {
      case 'markdown':
        return (
          <StreamingMarkdown
            content={displayedContent}
            delay={delay}
            theme={theme}
            maxWidth={maxWidth}
            showProgress={showProgress && !isComplete}
            enableSyntaxHighlight={enableSyntaxHighlight}
            onComplete={() => {}}
            onChunk={(displayed, total) => {
              // 内部组件的块更新
            }}
          />
        )

      case 'code':
        return (
          <StreamingCodeBlock
            code={displayedContent}
            language="auto"
            delay={delay}
            theme={theme}
            showLineNumbers={true}
            enableSyntaxHighlight={enableSyntaxHighlight}
            showBorder={true}
            onComplete={() => {}}
            onChunk={(displayed, total) => {
              // 内部组件的块更新
            }}
          />
        )

      case 'text':
      default:
        return (
          <StreamingText
            content={displayedContent}
            delay={delay}
            theme={theme}
            renderMode="character"
            preserveFormatting={true}
            cursor={!isComplete}
            onComplete={() => {}}
            onChunk={(displayed, total) => {
              // 内部组件的块更新
            }}
          />
        )
    }
  }

  return (
    <Box flexDirection="column">
      {/* 调试信息 */}
      {debug && (
        <Box marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Box flexDirection="column">
            <Text dimColor>Debug Info:</Text>
            <Text dimColor>Stream ID: {streamId}</Text>
            <Text dimColor>Content Type: {streamState.contentType}</Text>
            <Text dimColor>Progress: {streamState.progress.toFixed(1)}%</Text>
            <Text dimColor>Length: {streamState.displayedContent.length}/{streamState.totalContent.length}</Text>
            <Text dimColor>Complete: {streamState.isComplete ? 'Yes' : 'No'}</Text>
            {streamState.renderTime > 0 && (
              <Text dimColor>Render Time: {streamState.renderTime}ms</Text>
            )}
          </Box>
        </Box>
      )}

      {/* 主要内容区域 */}
      <Box flexDirection="column">
        {renderContent()}
      </Box>

      {/* 状态信息 */}
      {showProgress && !streamState.isComplete && (
        <Box marginTop={1}>
          <Text dimColor>
            处理中... {streamState.progress.toFixed(1)}% 
            ({streamState.displayedContent.length}/{streamState.totalContent.length || content.length} 字符)
          </Text>
        </Box>
      )}

      {/* 完成信息 */}
      {streamState.isComplete && (
        <Box marginTop={1}>
          <Text color="green" dimColor>
            ✓ 内容已完全加载 
            {streamState.renderTime > 0 && ` (${streamState.renderTime}ms)`}
            {streamState.hasCodeBlocks && ' · 包含代码块'}
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default StreamingOutputManager