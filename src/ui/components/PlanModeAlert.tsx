import React from 'react'
import { Box, Text } from 'ink'

interface PlanModeAlertProps {
  elapsedTime: number
  onModeCycle?: () => void
}

export function PlanModeAlert({ elapsedTime, onModeCycle }: PlanModeAlertProps) {
  // 格式化运行时间
  const formatElapsedTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <Box 
      borderStyle="double" 
      borderColor="yellow" 
      paddingX={2} 
      paddingY={1}
      marginBottom={1}
    >
      <Box flexDirection="column" width="100%">
        {/* 主要警告信息 */}
        <Box justifyContent="space-between" alignItems="center">
          <Box>
            <Text color="yellow" bold>
              ⏸ plan mode on - 只读分析模式
            </Text>
          </Box>
          <Box>
            <Text color="yellow" dimColor>
              运行时间: {formatElapsedTime(elapsedTime)}
            </Text>
          </Box>
        </Box>
        
        {/* 操作提示 */}
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            💡 当前处于计划模式 - 只能分析代码、搜索文件，不能修改 | (shift+tab 切换模式)
          </Text>
        </Box>
        
        {/* 状态说明 */}
        <Box marginTop={1}>
          <Box flexDirection="row">
            <Text color="green">✅ 允许：</Text>
            <Text color="gray"> 读取文件、搜索代码、分析项目</Text>
          </Box>
          <Box flexDirection="row" marginTop={0}>
            <Text color="red">❌ 禁止：</Text>
            <Text color="gray"> 修改文件、执行命令、安装依赖</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}