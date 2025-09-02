import { Box, Text } from 'ink'
import React, { useState, useCallback, useMemo } from 'react'
import { getTheme } from '../../utils/theme'
import { useTerminalSize } from '../../hooks/useTerminalSize'

interface Message {
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
  placeholder = "开始写作..."
}: PromptInputProps) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  const [exitMessage, setExitMessage] = useState<{ show: boolean; key?: string }>({ show: false })
  const [cursorOffset, setCursorOffset] = useState<number>(input.length)
  
  // Simple input handling (will be enhanced with TextInput later)
  const handleInput = useCallback((inputChar: string, key: any) => {
    if (key.ctrl && inputChar === 'c') {
      setExitMessage({ show: true, key: 'Ctrl-C' })
      setTimeout(() => {
        process.exit(0)
      }, 1000)
      return
    }
    
    if (key.return) {
      if (input.trim()) {
        onSubmit(input.trim())
      }
      return
    }
    
    if (key.backspace || key.delete) {
      onInputChange(input.slice(0, -1))
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
    }
  }, [input, onInputChange, onSubmit, mode, onModeChange])
  
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
      {/* Mode and model info bar */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text color={modeColor}>
            {modeIcon} {mode.toUpperCase()} 模式
          </Text>
        </Box>
        <Box>
          <Text dimColor>
            WriteFlow AI 写作助手
          </Text>
        </Box>
      </Box>
      
      {/* Input box */}
      <Box
        alignItems="flex-start"
        justifyContent="flex-start"
        borderColor={modeColor}
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
          <Text color={isLoading ? theme.secondaryText : modeColor}>
            &nbsp;{'>'}nbsp;
          </Text>
        </Box>
        
        <Box paddingRight={1} width={textInputColumns}>
          <Text>
            {input || (
              <Text dimColor>{placeholder}</Text>
            )}
            {!isLoading && !isDisabled && (
              <Text color={modeColor}>|</Text>
            )}
          </Text>
        </Box>
      </Box>
      
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