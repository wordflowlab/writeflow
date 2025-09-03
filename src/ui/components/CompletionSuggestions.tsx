/**
 * 补全建议显示组件
 * 负责渲染命令补全的建议列表
 */

import React from 'react'
import { Box, Text } from 'ink'
import { CommandSuggestion } from '../../utils/commandRegistry.js'
import { getTheme } from '../../utils/theme.js'

interface CompletionSuggestionsProps {
  suggestions: CommandSuggestion[]
  selectedIndex: number
  maxDisplay?: number
}

export function CompletionSuggestions({
  suggestions,
  selectedIndex,
  maxDisplay = 5
}: CompletionSuggestionsProps) {
  const theme = getTheme()
  
  if (suggestions.length === 0) return null
  
  // 限制显示数量
  const displaySuggestions = suggestions.slice(0, maxDisplay)
  const hasMore = suggestions.length > maxDisplay
  
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* 建议列表容器 */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.border}
        paddingLeft={1}
        paddingRight={1}
      >
        {/* 建议项 */}
        {displaySuggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex
          
          return (
            <Box key={index} paddingLeft={1}>
              <Text
                color={isSelected ? theme.highlight : theme.text}
                backgroundColor={isSelected ? theme.selection : undefined}
                bold={isSelected}
              >
                {isSelected ? '▸ ' : '  '}
                {suggestion.displayValue}
              </Text>
            </Box>
          )
        })}
        
        {/* 更多提示 */}
        {hasMore && (
          <Box paddingLeft={1}>
            <Text dimColor>
              ... 还有 {suggestions.length - maxDisplay} 个建议
            </Text>
          </Box>
        )}
      </Box>
      
      {/* 操作提示 */}
      <Box marginTop={1} paddingX={2}>
        <Text dimColor>
          ↑↓ 导航 • Tab 循环 • Enter 确认 • Esc 取消
        </Text>
      </Box>
    </Box>
  )
}

/**
 * 紧凑版补全建议组件（内联显示）
 */
export function InlineCompletionSuggestions({
  suggestions,
  selectedIndex
}: CompletionSuggestionsProps) {
  const theme = getTheme()
  
  if (suggestions.length === 0) return null
  
  // 只显示选中的建议
  const selected = suggestions[selectedIndex]
  if (!selected) return null
  
  return (
    <Text color={theme.muted}>
      {' '}← {selected.displayValue}
    </Text>
  )
}