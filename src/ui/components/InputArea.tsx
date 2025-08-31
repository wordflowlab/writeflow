import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { UIMode, InputMode } from '../types/index.js'

interface InputAreaProps {
  mode: UIMode
  onInput: (input: string, inputMode: InputMode) => void
  onModeSwitch: () => void
  isLoading?: boolean
  placeholder?: string
}

export function InputArea({ 
  mode, 
  onInput, 
  onModeSwitch, 
  isLoading = false,
  placeholder = "输入命令或问题..." 
}: InputAreaProps) {
  const [input, setInput] = useState('')

  useInput((inputChar, key) => {
    if (isLoading) return // 加载时禁用输入

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

  const getModePrefix = (): string => {
    // 不显示任何前缀，保持简洁
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
          <Text color={getPromptColor()} bold>
            {getInputModeIndicator() ? getInputModeIndicator() + ' ' : ''}{'> '}
          </Text>
          <Text>
            {input || (placeholder && !isLoading ? <Text color="gray">{placeholder}</Text> : '')}
          </Text>
          {!isLoading && <Text color={getPromptColor()}>▋</Text>}
          {isLoading && <Text color="yellow">⏳</Text>}
        </Box>
      </Box>

      {/* 模式提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {mode !== UIMode.Default && (
            <>
              {mode === UIMode.Plan && "📋 plan mode on"}
              {mode === UIMode.AcceptEdits && "✅ accept edits on"}
              {mode === UIMode.BypassPermissions && "🔓 bypass permissions on"}
              <Text color="gray"> (shift+tab to cycle)</Text>
            </>
          )}
        </Text>
      </Box>
    </Box>
  )
}