/**
 * VisualFormatter 组件
 * 专门处理可折叠内容的视觉格式化和色彩显示
 */

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
import { getContentAnalyzer } from '../../services/ai/content/ContentAnalyzer.js'

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
  // 移除对 getContentBlockRenderer 的依赖，直接使用 RichTextRenderer
  // 这确保了所有 Markdown 内容都能正确渲染

  // 🎯 重构后的折叠策略 - 使用ContentAnalyzer统一检测
  const shouldUseCollapsible = () => {
    if (!enableCollapsible) return false
    
    const text = getBlockText(block)
    const lines = text.split('\n').length
    const chars = text.length
    
    // 使用ContentAnalyzer检测创意内容，移除硬编码
    const contentAnalyzer = getContentAnalyzer()
    const isCreativeContent = contentAnalyzer.isCreativeContent(text)
    
    if (isCreativeContent) {
      // 创意内容：更高的阈值，避免过度折叠
      return lines > 50 || chars > 2000
    }
    
    // 其他内容：提高折叠阈值，减少过度折叠
    return lines > 30 || chars > 1000
  }

  // 🎯 重构后的内容类型检测 - 统一使用ContentAnalyzer
  const detectContentType = (): CollapsibleContentType => {
    if (isLongContentBlock(block)) {
      return block.contentType
    }
    
    if (isToolUseBlock(block) || isToolResultBlock(block)) {
      return 'tool-execution'
    }
    
    const text = getBlockText(block)
    
    // 使用专业的ContentAnalyzer进行内容类型检测
    const contentAnalyzer = getContentAnalyzer()
    const detectedType = contentAnalyzer.detectContentType(text)
    
    // 如果ContentAnalyzer能识别，直接使用其结果
    if (detectedType !== 'long-text') {
      return detectedType
    }
    
    // 仅保留必要的特殊情况检测（这些是UI特有的检测需求）
    // 工具执行输出的UI特殊标识
    if (text.includes('🔧') || text.includes('Tools loaded:') || 
        text.includes('正在执行') || text.includes('工具执行')) {
      return 'tool-execution'
    }
    
    // 文件内容的UI特殊标识  
    if (text.includes('📄') || text.startsWith('File:') || text.startsWith('文件:')) {
      return 'file-content'
    }
    
    // 分析结果的UI特殊标识
    if (text.includes('📊')) {
      return 'analysis-result'
    }
    
    // 默认返回ContentAnalyzer的结果
    return detectedType
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
          <RichTextRenderer
            content={thinkingBlock.content || ''}
            wrap={true}
            preserveWhitespace={true}
          />
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


