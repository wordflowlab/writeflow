/**
 * 文件补全弹窗组件
 * 显示文件引用的自动补全建议
 */

import React from 'react'
import { Box, Text } from 'ink'
import { type FileCompletionItem, fileCompletionService } from '../../services/FileCompletionService.js'
import { getTheme } from '../../utils/theme.js'

interface FileCompletionPopupProps {
  /** 补全建议列表 */
  suggestions: FileCompletionItem[]
  /** 当前选中的索引 */
  selectedIndex: number
  /** 是否显示 */
  visible: boolean
  /** 是否正在加载 */
  isLoading?: boolean
  /** 当前查询字符串 */
  query?: string
  /** 最大显示数量 */
  maxItems?: number
}

export function FileCompletionPopup({
  suggestions,
  selectedIndex,
  visible,
  isLoading = false,
  query = '',
  maxItems = 8,
}: FileCompletionPopupProps): React.ReactNode {
  const theme = getTheme()
  
  if (!visible || (!isLoading && suggestions.length === 0)) {
    return null
  }
  
  const displaySuggestions = suggestions.slice(0, maxItems)
  
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      paddingY={0}
      marginTop={1}
      width="100%"
    >
      {/* 标题栏 */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text color={theme.secondaryText}>
          📁 文件引用 {query ? `"${query}"` : ''}
        </Text>
        <Text color={theme.muted} dimColor>
          {isLoading ? '搜索中...' : `${suggestions.length} 项`}
        </Text>
      </Box>
      
      {/* 加载状态 */}
      {isLoading && (
        <Box justifyContent="center" paddingY={1}>
          <Text color={theme.muted}>⏳ 正在搜索文件...</Text>
        </Box>
      )}
      
      {/* 建议列表 */}
      {!isLoading && displaySuggestions.length > 0 && (
        <Box flexDirection="column">
          {displaySuggestions.map((item, index) => (
            <FileCompletionItem
              key={`${item.fullPath}-${index}`}
              item={item}
              isSelected={index === selectedIndex}
              query={query}
            />
          ))}
          
          {/* 底部提示 */}
          <Box justifyContent="center" paddingTop={1}>
            <Text color={theme.muted} dimColor>
              ↑↓ 选择 • Tab/Enter 确认 • Esc 取消
            </Text>
          </Box>
        </Box>
      )}
      
      {/* 无结果提示 */}
      {!isLoading && suggestions.length === 0 && (
        <Box justifyContent="center" paddingY={1}>
          <Text color={theme.warning}>
            📂 未找到匹配的文件 {query && `"${query}"`}
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * 单个文件补全项组件
 */
interface FileCompletionItemProps {
  item: FileCompletionItem
  isSelected: boolean
  query: string
}

function FileCompletionItem({ 
  item, 
  isSelected, 
  query 
}: FileCompletionItemProps): React.ReactNode {
  const theme = getTheme()
  const icon = fileCompletionService.getFileIcon(item)
  
  // 高亮匹配的部分
  const highlightedName = highlightMatches(item.name, query)
  
  return (
    <Box
      paddingX={1}
      paddingY={0}
      backgroundColor={isSelected ? theme.selection : undefined}
    >
      <Box width="100%" justifyContent="space-between">
        {/* 左侧：图标和文件名 */}
        <Box flexGrow={1}>
          <Text color={isSelected ? theme.text : theme.text}>
            {icon} {highlightedName}
          </Text>
          {item.type === 'directory' && (
            <Text color={theme.muted}>/</Text>
          )}
        </Box>
        
        {/* 右侧：文件信息 */}
        <Box>
          {item.size !== undefined && (
            <Text color={theme.muted} dimColor>
              {fileCompletionService.formatFileSize(item.size)}
            </Text>
          )}
          
          {!item.readable && (
            <Text color={theme.error}>🔒</Text>
          )}
        </Box>
      </Box>
      
      {/* 详细路径（如果与文件名不同） */}
      {item.relativePath !== item.name && (
        <Box paddingLeft={3}>
          <Text color={theme.muted} dimColor>
            {item.relativePath}
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * 高亮匹配的文本
 */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text
  
  const theme = getTheme()
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // 简单的高亮实现 - 高亮首次匹配
  const matchIndex = lowerText.indexOf(lowerQuery)
  
  if (matchIndex === -1) {
    return text
  }
  
  const beforeMatch = text.slice(0, matchIndex)
  const match = text.slice(matchIndex, matchIndex + query.length)
  const afterMatch = text.slice(matchIndex + query.length)
  
  return (
    <>
      {beforeMatch}
      <Text backgroundColor={theme.highlight} color={theme.text}>
        {match}
      </Text>
      {afterMatch}
    </>
  )
}