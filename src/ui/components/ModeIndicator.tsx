import React from 'react'
import { Box, Text } from 'ink'
import { UIMode } from '../types/index.js'

interface ModeIndicatorProps {
  mode: UIMode
  showDetails?: boolean
}

export function ModeIndicator({ mode, showDetails = false }: ModeIndicatorProps) {
  const getModeInfo = (mode: UIMode) => {
    switch (mode) {
      case UIMode.Plan:
        return {
          name: 'PLAN',
          color: 'yellow' as const,
          icon: '📋',
          description: '只读分析模式'
        }
      case UIMode.AcceptEdits:
        return {
          name: 'ACCEPT',
          color: 'green' as const,
          icon: '✅',
          description: '自动接受编辑'
        }
      case UIMode.BypassPermissions:
        return {
          name: 'BYPASS',
          color: 'red' as const,
          icon: '🔓',
          description: '绕过权限检查'
        }
      default:
        return {
          name: 'DEFAULT',
          color: 'cyan' as const,
          icon: '🎯',
          description: '标准执行模式'
        }
    }
  }

  const modeInfo = getModeInfo(mode)

  if (showDetails) {
    return (
      <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={modeInfo.color}>
        <Box flexDirection="row">
          <Text color={modeInfo.color} bold>
            {modeInfo.icon} {modeInfo.name}
          </Text>
        </Box>
        <Text color="gray" dimColor>
          {modeInfo.description}
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="row">
      <Text color={modeInfo.color} bold>
        [{modeInfo.name}]
      </Text>
    </Box>
  )
}