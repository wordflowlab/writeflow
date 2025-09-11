/**
 * VisualFormatter 组件
 * 专门处理可折叠内容的视觉格式化和色彩显示
 */

import React from 'react'
import { Box, Text } from 'ink'
import { getTheme } from '../../utils/theme.js'
import { CollapsibleContent } from './CollapsibleContent.js'
import { RichTextRenderer } from './RichTextRenderer.js'
import { getContentBlockRenderer } from '../utils/contentBlockRenderer.js'
import type { 
  ContentBlock
} from '../../types/UIMessage.js'
import { 
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
  isLongContentBlock,
  getBlockText
} from '../../types/UIMessage.js'
import type { CollapsibleContentType } from '../../types/CollapsibleContent.js'

interface VisualFormatterProps {
  block: ContentBlock
  enableCollapsible?: boolean
  maxLines?: number
  showMetadata?: boolean
  onToggle?: (collapsed: boolean, id: string) => void
  onFocus?: (id: string) => void
  isFocused?: boolean
}

export function VisualFormatter({
  block,
  enableCollapsible = true,
  maxLines = 15,
  showMetadata = false,
  onToggle,
  onFocus,
  isFocused = false
}: VisualFormatterProps) {
  const theme = getTheme()
  const renderer = getContentBlockRenderer({
    enableColors: true,
    showMetadata,
    maxWidth: process.stdout.columns - 6
  })

  // 检查是否应该使用可折叠显示
  const shouldUseCollapsible = () => {
    if (!enableCollapsible) return false
    
    const text = getBlockText(block)
    const lines = text.split('\n').length
    const chars = text.length
    
    // 提高折叠阈值，减少过度折叠 - 移除LongContentBlock强制折叠
    return lines > 30 || chars > 1000
  }

  // 检测内容类型
  const detectContentType = (): CollapsibleContentType => {
    if (isLongContentBlock(block)) {
      return block.contentType
    }
    
    if (isToolUseBlock(block) || isToolResultBlock(block)) {
      return 'tool-execution'
    }
    
    const text = getBlockText(block)
    
    // 工具执行输出检测 - 更积极地识别工具输出
    if (text.includes('🔧') || text.includes('Tools loaded:') || 
        text.includes('matches') || text.includes('path') || 
        text.includes('exec_') || text.includes('[Glob]') ||
        text.includes('正在执行') || text.includes('工具执行') ||
        /\.(js|ts|tsx|jsx|py|go|rs|java|cpp|c|h)/.test(text)) {
      return 'tool-execution'
    }
    
    // 错误信息检测
    if (text.includes('错误') || text.includes('Error') || text.includes('Exception')) {
      return 'error-message'
    }
    
    // 代码块检测
    if (text.includes('```') || /^(function|const|let|var|class|interface)/.test(text)) {
      return 'code-block'
    }
    
    // 文件内容检测
    if (text.includes('📄') || text.startsWith('File:') || text.startsWith('文件:')) {
      return 'file-content'
    }
    
    // 分析结果检测
    if (text.includes('分析') || text.includes('Analysis') || text.includes('📊')) {
      return 'analysis-result'
    }
    
    return 'long-text'
  }

  // 生成标题
  const generateTitle = (): string | undefined => {
    if (isLongContentBlock(block) && block.title) {
      return block.title
    }
    
    if (isToolUseBlock(block)) {
      return `${block.name} 工具`
    }
    
    if (isToolResultBlock(block)) {
      return block.is_error ? '执行错误' : '执行结果'
    }
    
    const contentType = detectContentType()
    const typeLabels: Record<CollapsibleContentType, string> = {
      'tool-execution': '工具执行',
      'tool-output': '工具输出',
      'code-block': '代码块',
      'code': '代码',
      'file-content': '文件内容',
      'error-message': '错误信息',
      'error': '错误',
      'analysis-result': '分析结果',
      'analysis': '分析',
      'long-text': '长文本',
      'text': '文本',
      'bash-output': '命令输出',
      'creative-content': '创作内容',
      'creative-writing': '创意写作',
      'article': '文章',
      'novel': '小说'
    }
    
    return typeLabels[contentType]
  }

  // 如果不需要折叠，使用标准渲染
  if (!shouldUseCollapsible()) {
    return (
      <Box flexDirection="column">
        {renderStandardBlock()}
      </Box>
    )
  }

  // 使用可折叠渲染
  return (
    <CollapsibleContent
      content={getBlockText(block)}
      contentType={detectContentType()}
      title={generateTitle()}
      maxLines={maxLines}
      autoCollapse={true}
      defaultCollapsed={false}  // 永远不默认折叠
      onToggle={onToggle}
      onFocus={onFocus}
      isFocused={isFocused}
      showPreview={true}
      previewLines={3}
    />
  )

  // 标准块渲染函数
  function renderStandardBlock() {
    switch (block.type) {
      case 'text':
        return renderTextBlock()
      case 'tool_use':
        return renderToolUseBlock()
      case 'tool_result':
        return renderToolResultBlock()
      case 'thinking':
        return renderThinkingBlock()
      case 'long_content':
        return renderLongContentBlock()
      default:
        return <Text>{getBlockText(block)}</Text>
    }
  }

  function renderTextBlock() {
    if (!isTextBlock(block)) return null
    
    return (
      <RichTextRenderer 
        content={block.text}
        wrap={true}
        preserveWhitespace={true}
      />
    )
  }

  function renderToolUseBlock() {
    if (!isToolUseBlock(block)) return null
    
    const icon = getToolIcon(block.name)
    
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginBottom={1}>
          <Text color={theme.info}>{icon}</Text>
          <Text color={theme.info} bold> 
            {block.name}
          </Text>
        </Box>
        
        {block.input && (
          <Box paddingLeft={2}>
            <Text color={theme.dimText}>
              参数: {typeof block.input === 'string' ? block.input : JSON.stringify(block.input)}
            </Text>
          </Box>
        )}
      </Box>
    )
  }

  function renderToolResultBlock() {
    if (!isToolResultBlock(block)) return null
    
    const content = typeof block.content === 'string' 
      ? block.content 
      : JSON.stringify(block.content, null, 2)
    
    const icon = block.is_error ? '❌' : '✅'
    const color = block.is_error ? theme.error : theme.success
    
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginBottom={1}>
          <Text color={color}>{icon}</Text>
          <Text color={color} bold> 
            {block.is_error ? '执行错误' : '执行结果'}
          </Text>
        </Box>
        
        <Box paddingLeft={2}>
          <RichTextRenderer 
            content={content}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    )
  }

  function renderThinkingBlock() {
    const thinkingBlock = block as any
    
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginBottom={1}>
          <Text color={theme.warning}>💭</Text>
          <Text color={theme.warning} bold> 
            AI 思考过程
          </Text>
        </Box>
        
        <Box marginLeft={2}>
          <Text color={theme.dimText}>
            {thinkingBlock.content}
          </Text>
        </Box>
      </Box>
    )
  }

  function renderLongContentBlock() {
    if (!isLongContentBlock(block)) return null
    
    const icon = getContentTypeIcon(block.contentType)
    const typeLabel = getContentTypeLabel(block.contentType)
    
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginBottom={1}>
          <Text color={theme.claude}>{icon}</Text>
          <Text color={theme.claude} bold> 
            {typeLabel}
          </Text>
          {block.title && (
            <Text color={theme.text}> 
              : {block.title}
            </Text>
          )}
        </Box>
        
        <Box marginLeft={2}>
          <RichTextRenderer 
            content={block.content}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    )
  }

  function getToolIcon(toolName: string): string {
    const iconMap: Record<string, string> = {
      'Read': '📖',
      'Write': '✏️',
      'Edit': '✂️',
      'Bash': '⚡',
      'Grep': '🔍',
      'Glob': '📁',
      'todo_write': '📝',
      'todo_read': '📋',
      'exit_plan_mode': '🚪'
    }
    
    return iconMap[toolName] || '🔧'
  }

  function getContentTypeIcon(type: CollapsibleContentType): string {
    const iconMap: Record<CollapsibleContentType, string> = {
      'tool-execution': '🔧',
      'tool-output': '🔧',
      'code-block': '📝',
      'code': '📝',
      'file-content': '📄',
      'error-message': '❌',
      'error': '❌',
      'analysis-result': '📊',
      'analysis': '📊',
      'long-text': '📄',
      'text': '📄',
      'bash-output': '⚡',
      'creative-content': '✍️',
      'creative-writing': '🎭',
      'article': '📰',
      'novel': '📖'
    }
    
    return iconMap[type] || '📄'
  }

  function getContentTypeLabel(type: CollapsibleContentType): string {
    const labelMap: Record<CollapsibleContentType, string> = {
      'tool-execution': '工具执行',
      'tool-output': '工具输出',
      'code-block': '代码块',
      'code': '代码',
      'file-content': '文件内容',
      'error-message': '错误信息',
      'error': '错误',
      'analysis-result': '分析结果',
      'analysis': '分析',
      'long-text': '长文本',
      'text': '文本',
      'bash-output': '命令输出',
      'creative-content': '创作内容',
      'creative-writing': '创意写作',
      'article': '文章',
      'novel': '小说'
    }
    
    return labelMap[type] || '内容'
  }
}

/**
 * 专门用于工具执行结果的格式化组件
 */
export function ToolExecutionFormatter({
  toolName,
  status,
  content,
  enableCollapsible = true,
  onToggle,
  onFocus,
  isFocused
}: {
  toolName: string
  status: 'running' | 'success' | 'error'
  content: string
  enableCollapsible?: boolean
  onToggle?: (collapsed: boolean, id: string) => void
  onFocus?: (id: string) => void
  isFocused?: boolean
}) {
  const theme = getTheme()
  
  const getStatusDisplay = () => {
    switch (status) {
      case 'running':
        return { icon: '⏳', color: theme.warning, label: '执行中' }
      case 'success':
        return { icon: '✅', color: theme.success, label: '成功' }
      case 'error':
        return { icon: '❌', color: theme.error, label: '失败' }
    }
  }

  const { icon, color, label } = getStatusDisplay()
  const toolIcon = getToolIcon(toolName)
  
  if (!enableCollapsible || content.length < 500) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginBottom={1}>
          <Text color={color}>{icon}</Text>
          <Text color={theme.info}> {toolIcon}</Text>
          <Text color={theme.info} bold> 
            {toolName}
          </Text>
          <Text color={color}> 
            ({label})
          </Text>
        </Box>
        
        <Box marginLeft={2}>
          <RichTextRenderer 
            content={content}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    )
  }

  return (
    <CollapsibleContent
      content={content}
      contentType="tool-execution"
      title={`${toolName} (${label})`}
      maxLines={10}
      onToggle={onToggle}
      onFocus={onFocus}
      isFocused={isFocused}
      showPreview={true}
      previewLines={3}
    />
  )

  function getToolIcon(name: string): string {
    const iconMap: Record<string, string> = {
      'Read': '📖',
      'Write': '✏️',
      'Edit': '✂️',
      'Bash': '⚡',
      'Grep': '🔍',
      'Glob': '📁'
    }
    
    return iconMap[name] || '🔧'
  }
}

/**
 * 专门用于代码块的格式化组件
 */
export function CodeBlockFormatter({
  code,
  language,
  filename,
  enableCollapsible = true,
  onToggle,
  onFocus,
  isFocused
}: {
  code: string
  language?: string
  filename?: string
  enableCollapsible?: boolean
  onToggle?: (collapsed: boolean, id: string) => void
  onFocus?: (id: string) => void
  isFocused?: boolean
}) {
  const title = filename 
    ? `${filename}${language ? ` (${language})` : ''}` 
    : language 
      ? `代码块 (${language})`
      : '代码块'

  if (!enableCollapsible || code.split('\n').length <= 10) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" marginBottom={1}>
          <Text color="blue">📝</Text>
          <Text color="blue" bold> 
            {title}
          </Text>
        </Box>
        
        <Box marginLeft={2}>
          <RichTextRenderer 
            content={`\`\`\`${language || ''}\n${code}\n\`\`\``}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    )
  }

  return (
    <CollapsibleContent
      content={`\`\`\`${language || ''}\n${code}\n\`\`\``}
      contentType="code-block"
      title={title}
      maxLines={15}
      onToggle={onToggle}
      onFocus={onFocus}
      isFocused={isFocused}
      showPreview={true}
      previewLines={5}
    />
  )
}