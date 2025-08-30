import React, { useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import { StatusLine } from './StatusLine.js'
import { MessageRenderer } from './MessageRenderer.js'
import { PromptInterface } from './PromptInterface.js'
import { WelcomeHeader } from './WelcomeHeader.js'
import { useUIState } from '../hooks/useUIState.js'
import { useModeManager } from './ModeManager.js'
import { useInputProcessor } from './InputProcessor.js'
import { UIMode, InputMode } from '../types/index.js'

interface WriteFlowUIProps {
  onCommand: (command: string) => Promise<string>
  onBashExecution: (command: string) => Promise<string>
  onMemoryNote: (note: string) => Promise<void>
}

export function WriteFlowUI({ onCommand, onBashExecution, onMemoryNote }: WriteFlowUIProps) {
  const { exit } = useApp()
  const {
    state,
    updateMode,
    updateInputMode,
    addMessage,
    setLoading,
    setStatus
  } = useUIState()

  const { switchToNextMode } = useModeManager(state.currentMode, updateMode)

  const handleInput = async (input: string, inputMode: InputMode) => {
    // 添加用户消息
    addMessage({
      type: 'user',
      content: input,
      mode: inputMode
    })

    setLoading(true)
    updateInputMode(inputMode)

    try {
      let response: string

      switch (inputMode) {
        case InputMode.Bash:
          setStatus('执行bash命令...')
          response = await onBashExecution(input)
          break
        
        case InputMode.Memory:
          setStatus('记录笔记...')
          await onMemoryNote(input)
          response = '笔记已记录'
          break
        
        default:
          if (input.startsWith('/')) {
            setStatus('执行命令...')
            if (input === '/exit' || input === '/quit') {
              exit()
              return
            }
            response = await onCommand(input)
          } else {
            setStatus('处理输入...')
            response = await onCommand(input)
          }
      }

      // 添加助手响应
      addMessage({
        type: 'assistant',
        content: response
      })

    } catch (error) {
      addMessage({
        type: 'system',
        content: `错误: ${(error as Error).message}`
      })
    } finally {
      setLoading(false)
      setStatus('Ready')
    }
  }

  const { processInput } = useInputProcessor(handleInput)

  // 首次启动显示欢迎信息
  useEffect(() => {
    addMessage({
      type: 'system',
      content: '输入 /help 查看可用命令，输入 /exit 退出'
    })
  }, [])

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* 欢迎头部 */}
      <WelcomeHeader />

      {/* 状态栏 */}
      <StatusLine 
        mode={state.currentMode}
        status={state.statusText}
        isLoading={state.isLoading}
      />
      
      {/* 分隔线 */}
      <Box marginY={1}>
        <Text color="gray">─────────────────────────────────────────</Text>
      </Box>

      {/* 消息历史 */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {state.messages.map(message => (
          <MessageRenderer key={message.id} message={message} />
        ))}
      </Box>

      {/* 输入提示 */}
      <Box marginTop={1}>
        <PromptInterface
          mode={state.currentMode}
          onInput={processInput}
          onModeSwitch={switchToNextMode}
          placeholder="输入命令或问题..."
        />
      </Box>

      {/* 帮助提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ! = bash执行 | # = 笔记记录 | / = 斜杠命令 | /help = 帮助 | /exit = 退出
        </Text>
      </Box>
    </Box>
  )
}