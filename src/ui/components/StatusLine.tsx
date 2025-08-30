import React from 'react'
import { Box, Text } from 'ink'
import { UIMode } from '../types/index.js'

interface StatusLineProps {
  mode: UIMode
  status: string
  isLoading: boolean
}

export function StatusLine({ mode, status, isLoading }: StatusLineProps) {
  const getModeColor = (mode: UIMode): string => {
    switch (mode) {
      case UIMode.Plan:
        return 'yellow'
      case UIMode.AcceptEdits:
        return 'green'
      case UIMode.BypassPermissions:
        return 'red'
      default:
        return 'cyan'
    }
  }

  const getModeDisplay = (mode: UIMode): string => {
    switch (mode) {
      case UIMode.Plan:
        return 'PLAN'
      case UIMode.AcceptEdits:
        return 'ACCEPT'
      case UIMode.BypassPermissions:
        return 'BYPASS'
      default:
        return 'DEFAULT'
    }
  }

  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Box flexDirection="row">
        <Text color={getModeColor(mode)} bold>
          [{getModeDisplay(mode)}]
        </Text>
        <Text> </Text>
        <Text color="gray">
          {isLoading ? '⏳ 处理中...' : status}
        </Text>
      </Box>
      <Text color="gray" dimColor>
        Shift+Tab 切换模式
      </Text>
    </Box>
  )
}