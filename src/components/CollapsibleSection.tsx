/**
 * 可折叠内容组件 - 基于 @other/kode 的交互设计
 * 支持 Ctrl+R 切换展开/折叠状态
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { analyzeContent, getContentTypeEmoji, getContentTypeName } from '../utils/contentAnalyzer.js'
import { format, defaultColorScheme } from '../utils/colorScheme.js'

export interface CollapsibleSectionProps {
  /**
   * 要显示的内容
   */
  content: string
  
  /**
   * 是否默认折叠（如果未指定，将根据内容分析自动判断）
   */
  defaultCollapsed?: boolean
  
  /**
   * 标题（可选，如果未指定将根据内容类型生成）
   */
  title?: string
  
  /**
   * 是否显示统计信息（行数等）
   */
  showStats?: boolean
  
  /**
   * 最大预览行数
   */
  maxPreviewLines?: number
  
  /**
   * 是否启用键盘交互
   */
  enableKeyboard?: boolean
  
  /**
   * 折叠状态变化回调
   */
  onCollapseChange?: (collapsed: boolean) => void
}

export function CollapsibleSection({
  content,
  defaultCollapsed,
  title,
  showStats = true,
  maxPreviewLines = 3,
  enableKeyboard = true,
  onCollapseChange
}: CollapsibleSectionProps) {
  // 分析内容
  const analysis = analyzeContent(content)
  
  // 确定初始折叠状态
  const initialCollapsed = defaultCollapsed !== undefined 
    ? defaultCollapsed 
    : analysis.shouldCollapse
  
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const [isFocused, setIsFocused] = useState(false)
  
  // 键盘事件处理
  useInput((input, key) => {
    if (!enableKeyboard) return
    
    // Ctrl+R 切换折叠状态
    if (key.ctrl && input.toLowerCase() === 'r') {
      const newCollapsed = !isCollapsed
      setIsCollapsed(newCollapsed)
      onCollapseChange?.(newCollapsed)
    }
    
    // 方向键聚焦
    if (key.upArrow || key.downArrow) {
      setIsFocused(true)
      // 2秒后自动取消聚焦
      setTimeout(() => setIsFocused(false), 2000)
    }
  })
  
  // 生成标题
  const displayTitle = title || getContentTypeName(analysis.contentType)
  const emoji = getContentTypeEmoji(analysis.contentType)
  
  // 生成统计信息
  const stats = showStats ? [
    `${analysis.estimatedLines} 行`,
    `${Math.round(content.length / 1024 * 10) / 10}KB`,
    analysis.complexity
  ].join(' • ') : ''
  
  return (
    <Box flexDirection="column" marginY={1}>
      {/* 标题栏 */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row">
          <Text color={defaultColorScheme.primary}>{emoji} </Text>
          <Text color={defaultColorScheme.text} bold={isFocused}>
            {displayTitle}
          </Text>
          {isCollapsed && (
            <Text color={defaultColorScheme.dim}>
              {' '}(已折叠 - Ctrl+R 展开)
            </Text>
          )}
        </Box>
        
        {showStats && (
          <Text color={defaultColorScheme.dim}>
            {stats}
          </Text>
        )}
      </Box>
      
      {/* 内容区域 */}
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {isCollapsed ? (
          // 折叠状态 - 显示预览
          <CollapsedContent 
            previewText={analysis.previewText}
            remainingLines={Math.max(0, analysis.estimatedLines - maxPreviewLines)}
            contentType={analysis.contentType}
          />
        ) : (
          // 展开状态 - 显示完整内容
          <ExpandedContent 
            content={content}
            contentType={analysis.contentType}
          />
        )}
      </Box>
      
      {/* 操作提示 */}
      {enableKeyboard && isFocused && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={defaultColorScheme.info}>
            💡 按 Ctrl+R 切换展开/折叠
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * 折叠状态的内容组件
 */
function CollapsedContent({ 
  previewText, 
  remainingLines, 
  contentType 
}: { 
  previewText: string
  remainingLines: number
  contentType: string 
}) {
  return (
    <Box flexDirection="column">
      {/* 预览文本 */}
      <Box flexDirection="column">
        {previewText.split('\n').map((line, index) => (
          <Text key={index} color={defaultColorScheme.text}>
            {line}
          </Text>
        ))}
      </Box>
      
      {/* 折叠提示 */}
      {remainingLines > 0 && (
        <Box marginTop={1}>
          <Text color={defaultColorScheme.secondary}>
            ⋮ 还有 {remainingLines} 行内容已折叠
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * 展开状态的内容组件
 */
function ExpandedContent({ 
  content, 
  contentType 
}: { 
  content: string
  contentType: string 
}) {
  return (
    <Box flexDirection="column">
      {content.split('\n').map((line, index) => (
        <Text key={index} color={defaultColorScheme.text}>
          {line}
        </Text>
      ))}
    </Box>
  )
}

/**
 * 批量折叠组件 - 管理多个可折叠区域
 */
export function CollapsibleContainer({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | null>(null)
  
  // 全局键盘事件
  useInput((input, key) => {
    // Ctrl+Shift+R 全局切换
    if (key.ctrl && key.shift && input.toLowerCase() === 'r') {
      setGlobalCollapsed(prev => prev === null ? true : !prev)
    }
  })
  
  return (
    <Box flexDirection="column">
      {/* 全局控制提示 */}
      {globalCollapsed !== null && (
        <Box marginBottom={1}>
          <Text color={defaultColorScheme.info}>
            🔄 全局{globalCollapsed ? '折叠' : '展开'}模式 (Ctrl+Shift+R 切换)
          </Text>
        </Box>
      )}
      
      {children}
    </Box>
  )
}

/**
 * 智能折叠包装器 - 自动为长内容添加折叠功能
 */
export function SmartCollapsible({ 
  content, 
  threshold = { lines: 10, chars: 800 },
  ...props 
}: CollapsibleSectionProps & { 
  threshold?: { lines: number; chars: number }
}) {
  const lines = content.split('\n').length
  const chars = content.length
  
  // 如果内容超过阈值，使用折叠组件
  if (lines > threshold.lines || chars > threshold.chars) {
    return <CollapsibleSection content={content} {...props} />
  }
  
  // 否则直接显示内容
  return (
    <Box flexDirection="column" marginY={1}>
      {content.split('\n').map((line, index) => (
        <Text key={index} color={defaultColorScheme.text}>
          {line}
        </Text>
      ))}
    </Box>
  )
}