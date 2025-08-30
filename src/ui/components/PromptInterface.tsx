import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { UIMode, InputMode } from '../types/index.js'

interface PromptInterfaceProps {
  mode: UIMode
  onInput: (input: string, inputMode: InputMode) => void
  onModeSwitch: () => void
  placeholder?: string
}

export function PromptInterface({ mode, onInput, onModeSwitch, placeholder }: PromptInterfaceProps) {
  const [input, setInput] = useState('')

  useInput((input, key) => {
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
    if (key.ctrl && input === 'c') {
      setInput('')
      return
    }

    // 普通字符输入
    if (input && !key.ctrl && !key.meta && !key.shift) {
      setInput(prev => prev + input)
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
    <Box flexDirection="row">
      <Text color={getPromptColor()} bold>
        writeflow{getInputModeIndicator()}{'> '}
      </Text>
      <Text>
        {input || (placeholder ? <Text color="gray">{placeholder}</Text> : '')}
      </Text>
      <Text color={getPromptColor()}>▋</Text>
    </Box>
  )
}