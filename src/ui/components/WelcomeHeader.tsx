import React from 'react'
import { Box, Text } from 'ink'

export function WelcomeHeader() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        🚀 WriteFlow AI 写作助手 v2.0.0
      </Text>
      <Text color="gray">
        基于 Claude Code 架构 | React + Ink 终端界面
      </Text>
    </Box>
  )
}