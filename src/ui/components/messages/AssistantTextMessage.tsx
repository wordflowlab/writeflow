import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import type { TextBlock } from '../../../types/UIMessage.js'
import { isCollapsibleBlock, isLongContentBlock } from '../../../types/UIMessage.js'
import { getTheme } from '../../../utils/theme.js'
import { useTerminalSize } from '../../../hooks/useTerminalSize.js'
import { RichTextRenderer } from '../RichTextRenderer.js'
import { VisualFormatter } from '../VisualFormatter.js'
import { detectContentType } from '../../../utils/contentAnalyzer.js'

interface AssistantTextMessageProps {
  block: TextBlock
  costUSD: number
  durationMs: number
  addMargin: boolean
  shouldShowDot: boolean
  debug: boolean
  verbose?: boolean
  width?: number | string
  enableCollapsible?: boolean
  onCollapsibleToggle?: (collapsed: boolean, id: string) => void
  onCollapsibleFocus?: (id: string) => void
  isCollapsibleFocused?: boolean
  onNewCollapsibleContent?: (id: string) => void // 新增：通知有新的可折叠内容
}

export function AssistantTextMessage({
  block,
  costUSD,
  durationMs,
  addMargin,
  shouldShowDot,
  debug,
  verbose,
  width,
  enableCollapsible = true,
  onCollapsibleToggle,
  onCollapsibleFocus,
  isCollapsibleFocused = false,
  onNewCollapsibleContent,
}: AssistantTextMessageProps): React.ReactNode {
  const { columns } = useTerminalSize()
  const theme = getTheme()
  
  // 如果文本为空，不渲染
  if (!block.text || !block.text.trim()) {
    return null
  }

  // 检查是否应该使用可折叠格式器 - 提高阈值减少过度折叠
  const contentType = detectContentType(block.text)
  const isCreativeContent = ['creative-content', 'creative-writing', 'article', 'novel'].includes(contentType)
  
  const shouldUseCollapsible = enableCollapsible && !isCreativeContent && (
    block.text.length > 800 ||     // 提高字符阈值从100->800
    block.text.split('\n').length > 20  // 提高行数阈值从3->20
  )
  
  // 自动注册可折叠内容
  useEffect(() => {
    if (enableCollapsible && shouldUseCollapsible && block.collapsible?.id && onNewCollapsibleContent) {
      onNewCollapsibleContent(block.collapsible.id)
    }
  }, [block.collapsible?.id, enableCollapsible, shouldUseCollapsible, onNewCollapsibleContent])

  // 检查是否是错误消息
  const isError = block.text.startsWith('错误:') || block.text.includes('Error')
  
  // 检查是否是中断消息
  if (block.text === 'Interrupted by user' || block.text.includes('中断')) {
    return (
      <Box flexDirection="row" marginTop={addMargin ? 1 : 0}>
        <Text color="gray" dimColor>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text color={theme.error}>{block.text}</Text>
      </Box>
    )
  }
  


  // 如果需要可折叠显示，使用 VisualFormatter
  if (shouldUseCollapsible) {
    return (
      <Box
        alignItems="flex-start"
        flexDirection="row"
        justifyContent="space-between"
        marginTop={addMargin ? 1 : 0}
        width="100%"
      >
        <Box flexDirection="row">
          {shouldShowDot && (
            <Box minWidth={2}>
              <Text color={theme.text}>●</Text>
            </Box>
          )}
          <Box 
            flexDirection="column" 
            width={width || columns - 6}
          >
            <VisualFormatter
              block={block}
              enableCollapsible={enableCollapsible}
              maxLines={30}    // 提高从15->30行
              showMetadata={verbose}
              onToggle={onCollapsibleToggle}
              onFocus={onCollapsibleFocus}
              isFocused={isCollapsibleFocused}
            />
          </Box>
        </Box>
        
        {/* 成本和时间信息（仅在 verbose 模式下显示） */}
        {verbose && (costUSD > 0 || durationMs > 0) && (
          <Box flexDirection="column" alignItems="flex-end">
            {costUSD > 0 && (
              <Text color="gray" dimColor>
                ${costUSD.toFixed(4)}
              </Text>
            )}
            {durationMs > 0 && (
              <Text color="gray" dimColor>
                {durationMs}ms
              </Text>
            )}
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box
      alignItems="flex-start"
      flexDirection="row"
      justifyContent="space-between"
      marginTop={addMargin ? 1 : 0}
      width="100%"
    >
      <Box flexDirection="row">
        {shouldShowDot && (
          <Box minWidth={2}>
            <Text color={theme.text}>●</Text>
          </Box>
        )}
        <Box 
          flexDirection="column" 
          width={width || columns - 6}
        >
          <RichTextRenderer 
            content={block.text}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
      
      {/* 成本和时间信息（仅在 verbose 模式下显示） */}
      {verbose && (costUSD > 0 || durationMs > 0) && (
        <Box flexDirection="column" alignItems="flex-end">
          {costUSD > 0 && (
            <Text color="gray" dimColor>
              ${costUSD.toFixed(4)}
            </Text>
          )}
          {durationMs > 0 && (
            <Text color="gray" dimColor>
              {durationMs}ms
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}