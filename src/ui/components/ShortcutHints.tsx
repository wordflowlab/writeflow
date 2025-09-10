import React from 'react'
import { Box, Text } from 'ink'
import { PlanMode } from '../../types/agent.js'

interface ShortcutHintsProps {
  currentMode: PlanMode
  showTodos: boolean
  isLoading?: boolean
  elapsedTime?: number
}

export function ShortcutHints({ currentMode, showTodos, isLoading = false, elapsedTime = 0 }: ShortcutHintsProps) {
  const getModeDisplay = () => {
    switch (currentMode) {
      case PlanMode.Plan:
        return {
          label: 'plan mode',
          color: 'yellow',
          icon: '⏸',
          description: '只读分析'
        }
      case PlanMode.AcceptEdits:
        return {
          label: 'accept edits',
          color: 'green', 
          icon: '✓',
          description: '自动执行'
        }
      case PlanMode.Default:
      default:
        return {
          label: 'default',
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

  const getShortcuts = () => {
    const shortcuts = []

    // 模式切换快捷键
    shortcuts.push({
      key: 'shift+tab',
      description: '切换模式',
      available: !isLoading
    })

    // TODO 面板快捷键  
    shortcuts.push({
      key: 'ctrl+t',
      description: showTodos ? '隐藏任务' : '显示任务',
      available: !isLoading
    })

    // Plan 模式特定快捷键
    if (currentMode === PlanMode.Plan) {
      shortcuts.push({
        key: 'esc',
        description: '退出计划',
        available: !isLoading
      })
    }

    return shortcuts.filter(s => s.available)
  }

  const mode = getModeDisplay()
  const shortcuts = getShortcuts()

  // Default模式显示简化版快捷键
  if (currentMode === PlanMode.Default) {
    return (
      <Box marginTop={0} marginBottom={0}>
        <Box flexDirection="row" alignItems="center">
          <Text color="gray" dimColor>
            <Text bold>shift+tab</Text> 切换模式 • <Text bold>ctrl+t</Text> {showTodos ? '隐藏任务' : '显示任务'}
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box marginTop={0} marginBottom={0}>
      <Box flexDirection="row" alignItems="center" flexWrap="wrap">
        {/* Plan模式状态显示 */}
        <Box flexDirection="row" alignItems="center" marginRight={2}>
          <Text color={mode.color} bold>
            {mode.icon} {mode.label}
          </Text>
          {currentMode === PlanMode.Plan && elapsedTime > 0 && (
            <Box marginLeft={1}>
              <Text color="gray" dimColor>
                ({formatElapsedTime(elapsedTime)})
              </Text>
            </Box>
          )}
        </Box>

        {/* 快捷键提示 */}
        <Box flexDirection="row" alignItems="center">
          {shortcuts.map((shortcut, index) => (
            <Box key={shortcut.key} marginLeft={index === 0 ? 0 : 1} marginRight={1}>
              <Text color="gray" dimColor>
                <Text bold>{shortcut.key}</Text> {shortcut.description}
                {index < shortcuts.length - 1 && ' • '}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}