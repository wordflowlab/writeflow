import React from 'react'
import { Box, Text } from 'ink'

interface PlanModeAlertProps {
  elapsedTime: number
  onModeCycle?: () => void
}

export function PlanModeAlert({ elapsedTime, onModeCycle }: PlanModeAlertProps) {
  return (
    <Box 
      borderStyle="round" 
      borderColor="yellow" 
      paddingX={2} 
      paddingY={1}
      marginBottom={0}
    >
      <Box flexDirection="column" width="100%">
        {/* 操作提示 */}
        <Box marginBottom={1}>
          <Text color="yellow" dimColor>
            💡 当前处于计划模式 - 只能分析代码、搜索文件，不能修改文件
          </Text>
        </Box>
        
        {/* 权限说明 */}
        <Box flexDirection="column">
          <Box flexDirection="row" marginBottom={0}>
            <Text color="green">✅ 允许：</Text>
            <Text color="gray"> 读取文件、搜索代码、分析项目、生成计划</Text>
          </Box>
          <Box flexDirection="row">
            <Text color="red">❌ 禁止：</Text>
            <Text color="gray"> 修改文件、执行命令、安装依赖、写入操作</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}