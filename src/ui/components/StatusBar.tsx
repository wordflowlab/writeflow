import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
  status: string
  isLoading: boolean
  totalMessages?: number
  memoryUsage?: string
  shortcuts?: boolean
}

export function StatusBar({ 
  status, 
  isLoading, 
  totalMessages = 0,
  memoryUsage,
  shortcuts = true 
}: StatusBarProps) {
  return (
    <Box flexDirection="column">
      {/* 主状态行 */}
      <Box justifyContent="space-between">
        <Box flexDirection="row">
          <Text color={isLoading ? 'yellow' : 'green'}>
            {isLoading ? '⏳ ' : '✓ '}
          </Text>
          <Text color="white">{status}</Text>
        </Box>
        
        <Box flexDirection="row">
          {totalMessages > 0 && (
            <>
              <Text color="gray">{totalMessages} 条消息</Text>
              <Text color="gray"> | </Text>
            </>
          )}
          {memoryUsage && (
            <>
              <Text color="gray">{memoryUsage}</Text>
              <Text color="gray"> | </Text>
            </>
          )}
          <Text color="gray" dimColor>
            {new Date().toLocaleTimeString()}
          </Text>
        </Box>
      </Box>

      {/* 快捷键提示 */}
      {shortcuts && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ! = bash执行 | # = 笔记记录 | / = 斜杠命令 | /help = 帮助 | /exit = 退出
          </Text>
        </Box>
      )}
    </Box>
  )
}