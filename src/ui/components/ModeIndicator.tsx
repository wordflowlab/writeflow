import React from 'react'
import { Box, Text } from 'ink'
import { PlanMode } from '../../types/agent.js'

interface ModeIndicatorProps {
  currentMode: PlanMode
  elapsedTime?: number
  onModeCycle?: () => void
}

export function ModeIndicator({ currentMode, elapsedTime = 0, onModeCycle }: ModeIndicatorProps) {
  const getModeDisplay = () => {
    switch (currentMode) {
      case PlanMode.Plan:
        return {
          label: 'plan mode on',
          color: 'yellow',
          icon: '⏸',
          description: '只读分析模式'
        }
      case PlanMode.AcceptEdits:
        return {
          label: 'accept edits',
          color: 'green',
          icon: '✓',
          description: '自动执行模式'
        }
      case PlanMode.Default:
      default:
        return {
          label: 'default mode',
          color: 'cyan',
          icon: '✨',
          description: '标准模式'
        }
    }
  }

  const formatElapsedTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const mode = getModeDisplay()

  return (
    <Box 
      borderStyle="round" 
      borderColor={mode.color} 
      paddingX={2} 
      paddingY={0}
      marginBottom={1}
    >
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" width="100%">
        {/* 模式指示 */}
        <Box flexDirection="row" alignItems="center">
          <Text color={mode.color} bold>
            {mode.icon} {mode.label}
          </Text>
          <Box marginLeft={2}>
            <Text color="gray" dimColor>
              - {mode.description}
            </Text>
          </Box>
        </Box>

        {/* 时间和快捷键提示 */}
        <Box flexDirection="row" alignItems="center">
          {currentMode === PlanMode.Plan && elapsedTime > 0 && (
            <Box marginRight={2}>
              <Text color="gray" dimColor>
                运行时间: {formatElapsedTime(elapsedTime)}
              </Text>
            </Box>
          )}
          <Text color="gray" dimColor>
            (shift+tab 切换模式)
          </Text>
        </Box>
      </Box>
    </Box>
  )
}