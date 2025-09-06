import { Box, Text } from 'ink'
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { getTheme } from '../../utils/theme.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { useUnifiedCompletion } from '../../hooks/useUnifiedCompletion.js'
import { CompletionSuggestions } from './CompletionSuggestions.js'
import { SlashCommand } from '../../types/command.js'

interface Message {
  id?: string
  type: 'user' | 'assistant'
  content: string
}

type WriteMode = 'writing' | 'editing' | 'reviewing'

interface PromptInputProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (input: string) => void
  isLoading: boolean
  isDisabled: boolean
  mode: WriteMode
  onModeChange: (mode: WriteMode) => void
  messages: Message[]
  placeholder?: string
  commands?: SlashCommand[]
  enableCompletion?: boolean
}

// Mode indicator icons
const MODE_ICONS = {
  writing: '✎',
  editing: '✏',
  reviewing: '👁'
}

// Mode colors
const MODE_COLORS = {
  writing: '#00ff87',  // bright green
  editing: '#ff9500',  // orange  
  reviewing: '#007acc' // blue
}

export function PromptInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isDisabled,
  mode,
  onModeChange,
  messages,
  placeholder = "开始写作...",
  commands = [],
  enableCompletion = true
}: PromptInputProps) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  const [exitMessage, setExitMessage] = useState<{ show: boolean; key?: string }>({ show: false })
  const [cursorOffset, setCursorOffset] = useState<number>(input?.length || 0)
  
  // 保持 cursorOffset 与 input.length 同步
  useEffect(() => {
    setCursorOffset(input?.length || 0)
  }, [input])
  
  // 使用命令补全 Hook
  const { suggestions, selectedIndex, isActive: completionActive } = useUnifiedCompletion({
    input,
    cursorOffset,
    onInputChange,
    setCursorOffset,
    commands,
    onSubmit,
    enabled: enableCompletion && !isLoading && !isDisabled
  })
  
  // Simple input handling (will be enhanced with TextInput later)
  const handleInput = useCallback((inputChar: string, key: any) => {
    if (key.ctrl && inputChar === 'c') {
      setExitMessage({ show: true, key: 'Ctrl-C' })
      setTimeout(() => {
        process.exit(0)
      }, 1000)
      return
    }
    
    // Tab 键由补全系统处理
    if (key.tab) {
      return
    }
    
    if (key.return) {
      // 如果补全菜单激活，让补全系统处理
      if (completionActive && suggestions.length > 0) {
        return
      }
      if (input.trim()) {
        onSubmit(input.trim())
      }
      return
    }
    
    if (key.backspace || key.delete) {
      onInputChange(input.slice(0, -1))
      setCursorOffset(Math.max(0, input.length - 1))
      return
    }
    
    // Mode switching
    if (key.ctrl && inputChar === 'm') {
      const modes: WriteMode[] = ['writing', 'editing', 'reviewing']
      const currentIndex = modes.indexOf(mode)
      const nextMode = modes[(currentIndex + 1) % modes.length]
      onModeChange(nextMode)
      return
    }
    
    // Regular character input
    if (inputChar && inputChar >= ' ') {
      onInputChange(input + inputChar)
      setCursorOffset(input.length + 1)
    }
  }, [input, onInputChange, onSubmit, mode, onModeChange, completionActive, suggestions])
  
  // Set up input handling
  React.useEffect(() => {
    if (isDisabled || isLoading) return
    
    process.stdin.setRawMode?.(true)
    process.stdin.setEncoding('utf8')
    process.stdin.resume()
    
    const handleData = (data: string) => {
      const key = {
        return: data === '\r' || data === '\n',
        backspace: data === '\u007f' || data === '\b',
        delete: data === '\u007f',
        ctrl: data.charCodeAt(0) < 32,
        escape: data === '\u001b'
      }
      
      handleInput(data, key)
    }
    
    process.stdin.on('data', handleData)
    
    return () => {
      process.stdin.off('data', handleData)
    }
  }, [handleInput, isDisabled, isLoading])
  
  const modeColor = MODE_COLORS[mode]
  const modeIcon = MODE_ICONS[mode]
  
  const textInputColumns = columns - 6
  
  return (
    <Box flexDirection="column">
      {/* Input box - 直接显示输入框，移除顶部的模式提示 */}
      <Box
        alignItems="flex-start"
        justifyContent="flex-start"
        borderColor={theme.claude}
        borderDimColor={isLoading || isDisabled}
        borderStyle="round"
        width="100%"
      >
        <Box
          alignItems="flex-start"
          alignSelf="flex-start" 
          flexWrap="nowrap"
          justifyContent="flex-start"
          width={3}
        >
          <Text color={isLoading ? theme.secondaryText : theme.claude}>
            {' > '}
          </Text>
        </Box>
        
        <Box paddingRight={1} width={textInputColumns}>
          <Text>
            {input || (
              <Text dimColor>{placeholder}</Text>
            )}
            {!isLoading && !isDisabled && (
              <Text color={theme.claude}>|</Text>
            )}
          </Text>
        </Box>
      </Box>
      
      {/* 命令补全建议 */}
      {completionActive && suggestions.length > 0 && (
        <CompletionSuggestions 
          suggestions={suggestions}
          selectedIndex={selectedIndex}
        />
      )}
      
      {/* Help text */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        paddingX={2}
        paddingY={1}
      >
        <Box justifyContent="flex-start" gap={1}>
          {exitMessage.show ? (
            <Text dimColor>按 {exitMessage.key} 再次退出</Text>
          ) : (
            <>
              <Text 
                color={mode === 'writing' ? MODE_COLORS.writing : undefined}
                dimColor={mode !== 'writing'}
              >
                写作模式
              </Text>
              <Text 
                color={mode === 'editing' ? MODE_COLORS.editing : undefined}
                dimColor={mode !== 'editing'}
              >
                · 编辑模式
              </Text>
              <Text 
                color={mode === 'reviewing' ? MODE_COLORS.reviewing : undefined}
                dimColor={mode !== 'reviewing'}
              >
                · 审阅模式
              </Text>
              <Text dimColor>
                · Ctrl+M 切换模式 · Ctrl+C 退出
              </Text>
            </>
          )}
        </Box>
        
        <Box justifyContent="flex-end">
          <Text dimColor>
            Enter 发送 · \\Enter 换行
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
