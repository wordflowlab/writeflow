import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { UIMode, InputMode } from '../types/index.js'
import { usePromptHints } from '../hooks/usePromptHints.js'

interface InputAreaProps {
  mode: UIMode
  onInput: (input: string, inputMode: InputMode) => void
  onModeSwitch: () => void
  onInterrupt?: () => void
  isLoading?: boolean
  messageCount?: number
}

export function InputArea({ 
  mode, 
  onInput, 
  onModeSwitch,
  onInterrupt,
  isLoading = false,
  messageCount = 0
}: InputAreaProps) {
  const [input, setInput] = useState('')
  
  // 使用动态提示Hook
  const { currentHint, hasHint } = usePromptHints({
    mode,
    isLoading,
    messageCount,
    hasInput: input.length > 0
  })

  useInput((inputChar, key) => {
    // ESC 键处理 - 优先级最高
    if (key.escape) {
      if (isLoading) {
        // 正在加载时触发中断
        onInterrupt?.()
      } else {
        // 未加载时清空输入
        setInput('')
      }
      return
    }

    if (isLoading) return // 加载时禁用其他输入

    // Shift+Tab 模式切换
    if (key.shift && key.tab) {
      onModeSwitch()
      return
    }

    // Enter 提交输入
    if (key.return) {
      if (input.trim()) {
        const inputMode = detectInputMode(input)
        onInput(input, inputMode)
        setInput('')
      }
      return
    }

    // Backspace 删除
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1))
      return
    }

    // Ctrl+C 清空当前输入
    if (key.ctrl && inputChar === 'c') {
      setInput('')
      return
    }

    // Ctrl+L 清屏（发送特殊命令）
    if (key.ctrl && inputChar === 'l') {
      onInput('/clear', InputMode.Prompt)
      return
    }

    // 普通字符输入
    if (inputChar && !key.ctrl && !key.meta && !key.shift) {
      setInput(prev => prev + inputChar)
    }
  })

  const detectInputMode = (input: string): InputMode => {
    if (input.startsWith('!')) return InputMode.Bash
    if (input.startsWith('#')) return InputMode.Memory
    return InputMode.Prompt
  }

  const getPromptColor = (): string => {
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

  const getInputModeIndicator = (): string => {
    if (input.startsWith('!')) return ' [BASH]'
    if (input.startsWith('#')) return ' [NOTE]'
    if (input.startsWith('/')) return ' [CMD]'
    return ''
  }


  return (
    <Box flexDirection="column">
      {/* 输入框 - 带边框 */}
      <Box 
        borderStyle="round"
        borderColor={getPromptColor()}
        paddingX={1}
        paddingY={0}
        minHeight={3}
        flexDirection="column"
      >
        {/* 输入行 */}
        <Box flexDirection="row" alignItems="center">
          {/* 模式指示器 */}
          {getInputModeIndicator() && (
            <Text color={getPromptColor()} bold>
              {getInputModeIndicator()}{' '}
            </Text>
          )}
          {/* 提示符 */}
          <Text color={getPromptColor()} bold>
            {'> '}
          </Text>
          {/* 用户输入 */}
          <Text>
            {input}
          </Text>
          {/* 动态提示文案 - 只在没有输入时显示 */}
          {!input && hasHint && currentHint && (
            <Text color={currentHint.color} dimColor>
              {currentHint.text}
            </Text>
          )}
          {/* 光标 */}
          {!isLoading && <Text color={getPromptColor()}>▋</Text>}
          {isLoading && <Text color="yellow">⏳</Text>}
        </Box>
      </Box>

      {/* 简化的模式提示 - 只在特殊模式下显示 */}
      {mode !== UIMode.Default && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {mode === UIMode.Plan && "📋 Plan Mode"}
            {mode === UIMode.AcceptEdits && "✅ Accept Edits"}  
            {mode === UIMode.BypassPermissions && "🔓 Bypass Permissions"}
          </Text>
        </Box>
      )}
    </Box>
  )
}