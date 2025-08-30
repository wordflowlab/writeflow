import React from 'react'
import { Box, Text } from 'ink'
import { UIMode } from '../types/index.js'

interface HeaderProps {
  mode: UIMode
  projectName?: string
  version?: string
}

export function Header({ mode, projectName = 'WriteFlow', version = '2.0.0' }: HeaderProps) {
  const getModeIcon = (mode: UIMode): string => {
    switch (mode) {
      case UIMode.Plan:
        return '📋'
      case UIMode.AcceptEdits:
        return '✅'
      case UIMode.BypassPermissions:
        return '🔓'
      default:
        return '🚀'
    }
  }

  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Box flexDirection="row">
        <Text color="cyan" bold>
          {getModeIcon(mode)} {projectName} AI 写作助手
        </Text>
        <Text color="gray"> v{version}</Text>
      </Box>
      <Text color="gray" dimColor>
        基于 Claude Code 架构
      </Text>
    </Box>
  )
}