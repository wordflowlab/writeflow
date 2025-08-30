import React from 'react'
import { Box, Text } from 'ink'
import { UIState } from '../types/index.js'

interface PlanModeProps {
  state: UIState
  onExitPlan: (plan: string) => void
  currentPlan?: string
}

export function PlanMode({ state, onExitPlan, currentPlan }: PlanModeProps) {
  return (
    <Box flexDirection="column">
      {/* Plan模式标识 */}
      <Box marginBottom={1}>
        <Text color="yellow" bold>
          📋 PLAN MODE - 只读分析模式
        </Text>
      </Box>

      {/* 模式说明 */}
      <Box marginBottom={1} paddingX={2} borderStyle="round" borderColor="yellow">
        <Box flexDirection="column">
          <Text color="yellow">
            当前处于计划模式，只能使用只读工具：
          </Text>
          <Text color="gray">
            • 可以：分析代码、搜索文件、查看状态
          </Text>
          <Text color="gray">
            • 禁止：修改文件、执行命令、安装依赖
          </Text>
        </Box>
      </Box>

      {/* 当前计划显示 */}
      {currentPlan && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="yellow" bold>当前计划：</Text>
          <Box paddingX={2} borderStyle="round" borderColor="gray">
            <Text>{currentPlan}</Text>
          </Box>
        </Box>
      )}

      {/* 退出计划模式提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          完成计划后，使用 exit_plan_mode 工具退出计划模式并开始执行
        </Text>
      </Box>
    </Box>
  )
}