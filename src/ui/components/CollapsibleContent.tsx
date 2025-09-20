/**
 * CollapsibleContent 组件
 * 支持键盘交互的可折叠内容显示组件
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { getTheme } from '../../utils/theme.js'
import { RichTextRenderer } from './RichTextRenderer.js'
import type { 
  CollapsibleOptions, 
  CollapsibleContentType,
  ContentAnalysis
} from '../../types/CollapsibleContent.js'
import { 
  DEFAULT_COLLAPSIBLE_OPTIONS,
  AUTO_COLLAPSE_THRESHOLDS,
  CONTENT_TYPE_PATTERNS
} from '../../types/CollapsibleContent.js'

interface CollapsibleContentProps extends CollapsibleOptions {
  content: string
  id?: string
  title?: string
  onToggle?: (collapsed: boolean, id: string) => void
  onFocus?: (id: string) => void
  isFocused?: boolean
  globalCollapsed?: boolean
}

export function CollapsibleContent({
  content,
  id = `collapsible-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title,
  maxLines = DEFAULT_COLLAPSIBLE_OPTIONS.maxLines,
  defaultCollapsed,
  autoCollapse = DEFAULT_COLLAPSIBLE_OPTIONS.autoCollapse,
  contentType = DEFAULT_COLLAPSIBLE_OPTIONS.contentType,
  shortcuts = DEFAULT_COLLAPSIBLE_OPTIONS.shortcuts,
  showPreview = DEFAULT_COLLAPSIBLE_OPTIONS.showPreview,
  previewLines = DEFAULT_COLLAPSIBLE_OPTIONS.previewLines,
  onToggle,
  onFocus,
  isFocused = false,
  globalCollapsed
}: CollapsibleContentProps) {
  const theme = getTheme()
  const contentRef = useRef<string>(content)
  
  // 分析内容特征
  const analysis = useMemo((): ContentAnalysis => {
    const lines = content.split('\n')
    const lineCount = lines.length
    const charCount = content.length
    const hasLongLines = lines.some(line => line.length > 120)
    const hasCodeBlocks = /```[\s\S]*?```/.test(content)
    
    // 检测内容类型
    let detectedType: CollapsibleContentType = contentType
    for (const [type, pattern] of Object.entries(CONTENT_TYPE_PATTERNS)) {
      if (pattern.test(content)) {
        detectedType = type as CollapsibleContentType
        break
      }
    }
    
    // 判断是否应该自动折叠 - 创作内容永不折叠
    let shouldAutoCollapse = false
    if (autoCollapse) {
      switch (detectedType) {
        case 'creative-content':
        case 'creative-writing':
        case 'article':
        case 'novel':
          shouldAutoCollapse = false  // 创作内容永远不折叠
          break
        case 'tool-execution':
          shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.toolOutputLines
          break
        case 'code-block':
          shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.codeBlockLines
          break
        case 'error-message':
          shouldAutoCollapse = lineCount > AUTO_COLLAPSE_THRESHOLDS.errorMessageLines
          break
        default:
          // 提高默认阈值：从15行提高到30行
          shouldAutoCollapse = lineCount > 30 || charCount > AUTO_COLLAPSE_THRESHOLDS.characters
      }
    }
    
    // 计算复杂度
    let complexity: ContentAnalysis['complexity'] = 'simple'
    if (hasCodeBlocks || lineCount > 50) complexity = 'complex'
    else if (lineCount > 20 || hasLongLines) complexity = 'medium'
    
    return {
      shouldAutoCollapse,
      estimatedLines: lineCount,
      contentType: detectedType,
      hasCodeBlocks,
      hasLongLines,
      complexity
    }
  }, [content, contentType, autoCollapse, maxLines])
  
  // 折叠状态管理
  const [collapsed, setCollapsed] = useState(() => {
    if (defaultCollapsed !== undefined) return defaultCollapsed
    return analysis.shouldAutoCollapse
  })
  
  // 响应全局折叠状态变化
  useEffect(() => {
    if (globalCollapsed !== undefined) {
      setCollapsed(globalCollapsed)
    }
  }, [globalCollapsed])
  
  // 切换折叠状态
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const newState = !prev
      onToggle?.(newState, id)
      return newState
    })
  }, [onToggle, id])
  
  // 处理焦点
  const handleFocus = useCallback(() => {
    onFocus?.(id)
  }, [onFocus, id])
  
  // 键盘事件处理
  useInput((input, key) => {
    if (!isFocused) return
    
    // Ctrl+R 切换当前内容
    if ((key as any).ctrl && input === 'r') {
      toggle()
      return
    }
    
    // 空格键也可以切换
    if (input === ' ') {
      toggle()
      return
    }
    
    // Enter 键聚焦
    if ((key as any).return) {
      handleFocus()
      return
    }
  })
  
  // 生成预览内容
  const getPreviewContent = useCallback((fullContent: string): string => {
    const lines = fullContent.split('\n')
    if (lines.length <= previewLines) return fullContent
    
    const preview = lines.slice(0, previewLines).join('\n')
    const remainingLines = lines.length - previewLines
    const remainingChars = fullContent.length - preview.length
    
    return `${preview}\n\n... (+${remainingLines} 行, ${remainingChars} 字符)\n按 ${shortcuts?.toggle || 'Ctrl+R'} 展开`
  }, [previewLines, shortcuts?.toggle, theme])
  
  // 获取显示内容
  const displayContent = collapsed && showPreview 
    ? getPreviewContent(content)
    : content
  
  // 获取内容类型图标和颜色
  const getContentTypeDisplay = () => {
    const iconMap = {
      'tool-execution': { icon: '🔧', color: theme.info },
      'tool-output': { icon: '🔧', color: theme.info },
      'code-block': { icon: '📝', color: theme.claude },
      'code': { icon: '📝', color: theme.claude },
      'file-content': { icon: '📄', color: theme.warning },
      'error-message': { icon: '❌', color: theme.error },
      'error': { icon: '❌', color: theme.error },
      'analysis-result': { icon: '📊', color: theme.success },
      'analysis': { icon: '📊', color: theme.success },
      'long-text': { icon: '📄', color: theme.text },
      'text': { icon: '📄', color: theme.text },
      'bash-output': { icon: '⚡', color: theme.claude },
      'creative-content': { icon: '✍️', color: theme.success },
      'creative-writing': { icon: '🎭', color: theme.success },
      'article': { icon: '📰', color: theme.success },
      'novel': { icon: '📖', color: theme.success }
    }
    
    return iconMap[analysis.contentType] || iconMap['long-text']
  }
  
  const { icon, color } = getContentTypeDisplay()
  
  // 如果内容很短，直接返回普通渲染
  if (analysis.estimatedLines <= 3 && content.length <= 200) {
    return (
      <Box flexDirection="column">
        <RichTextRenderer 
          content={content}
          wrap={true}
          preserveWhitespace={true}
        />
      </Box>
    )
  }
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle={isFocused ? 'single' : undefined}
      borderColor={isFocused ? theme.info : undefined}
      paddingX={isFocused ? 1 : 0}
    >
      {/* 标题栏 */}
      <Box flexDirection="row" marginBottom={1}>
        <Box flexDirection="row" alignItems="center">
          <Text color={color}>
            {collapsed ? '▶' : '▼'}
          </Text>
          <Text color={color}>
            {' '}{icon}
          </Text>
          {title && (
            <Text color={theme.text} bold>
              {' '}{title}
            </Text>
          )}
          <Text color={theme.dimText}>
            {' '}({analysis.estimatedLines} 行)
          </Text>
        </Box>
        
        {/* 快捷键提示 */}
        {isFocused && (
          <Box>
            <Text color={theme.dimText} dimColor>
              {'  '}{shortcuts?.toggle || 'Ctrl+R'} 切换
            </Text>
          </Box>
        )}
      </Box>
      
      {/* 内容区域 */}
      <Box flexDirection="column" marginLeft={2}>
        <RichTextRenderer 
          content={displayContent}
          wrap={true}
          preserveWhitespace={true}
        />
      </Box>
      
      {/* 状态指示器 */}
      {collapsed && (
        <Box flexDirection="row" marginTop={1} marginLeft={2}>
          <Text color={theme.dimText} dimColor>
            {analysis.contentType === 'code-block' && '代码已折叠'}
            {analysis.contentType === 'tool-execution' && '工具输出已折叠'}
            {analysis.contentType === 'file-content' && '文件内容已折叠'}
            {analysis.contentType === 'error-message' && '错误信息已折叠'}
            {analysis.contentType === 'analysis-result' && '分析结果已折叠'}
            {analysis.contentType === 'long-text' && '长文本已折叠'}
          </Text>
        </Box>
      )}
    </Box>
  )
}

