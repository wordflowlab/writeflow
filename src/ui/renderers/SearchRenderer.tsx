import React from 'react'
import { Box, Text } from 'ink'

interface SearchResult {
  file: string
  line: number
  content: string
  match: string
}

interface SearchRendererProps {
  query: string
  results: SearchResult[]
  totalMatches: number
  searchTime?: number
}

export function SearchRenderer({ 
  query, 
  results, 
  totalMatches,
  searchTime 
}: SearchRendererProps) {
  const highlightMatch = (text: string, match: string): React.ReactNode => {
    if (!match) return text
    
    const parts = text.split(new RegExp(`(${match})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === match.toLowerCase() ? (
        <Text key={index} color="yellow" backgroundColor="gray" bold>
          {part}
        </Text>
      ) : (
        <Text key={index}>{part}</Text>
      )
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* 搜索头部 */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>🔍 搜索结果</Text>
        <Text color="gray"> "{query}"</Text>
      </Box>

      {/* 统计信息 */}
      <Box marginBottom={1} flexDirection="row">
        <Text color="green">找到 {totalMatches} 个匹配项</Text>
        {searchTime && (
          <>
            <Text color="gray"> • </Text>
            <Text color="gray">用时 {searchTime}ms</Text>
          </>
        )}
      </Box>

      {/* 搜索结果 */}
      {results.length > 0 ? (
        <Box flexDirection="column">
          {results.map((result, index) => (
            <Box key={index} flexDirection="column" marginBottom={1}>
              {/* 文件路径和行号 */}
              <Box flexDirection="row">
                <Text color="blue" bold>{result.file}</Text>
                <Text color="gray">:{result.line}</Text>
              </Box>
              
              {/* 匹配内容 */}
              <Box marginLeft={2} paddingX={1} borderStyle="round" borderColor="gray">
                {highlightMatch(result.content.trim(), result.match)}
              </Box>
            </Box>
          ))}
          
          {/* 结果截断提示 */}
          {totalMatches > results.length && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                ... 还有 {totalMatches - results.length} 个匹配项
              </Text>
            </Box>
          )}
        </Box>
      ) : (
        <Box paddingX={2}>
          <Text color="yellow">未找到匹配的结果</Text>
        </Box>
      )}
    </Box>
  )
}