import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { Header } from './components/Header.js'
import { ModeIndicator } from './components/ModeIndicator.js'
import { MessageList } from './components/MessageList.js'
import { InputArea } from './components/InputArea.js'
import { StatusBar } from './components/StatusBar.js'
import { ToolDisplay } from './components/ToolDisplay.js'
import { PlanMode } from './modes/PlanMode.js'
import { AcceptEditsMode } from './modes/AcceptEditsMode.js'
import { useUIState } from './hooks/useUIState.js'
import { useMode } from './hooks/useMode.js'
import { useAgent } from './hooks/useAgent.js'
import { useKeyboard } from './hooks/useKeyboard.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { UIMode, InputMode } from './types/index.js'

interface AppProps {
  writeFlowApp: WriteFlowApp
}

export function App({ writeFlowApp }: AppProps) {
  const [input, setInput] = useState('')
  
  const {
    state: uiState,
    addMessage,
    setLoading,
    setStatus
  } = useUIState()

  const {
    modeState,
    currentMode,
    switchToNextMode,
    setPlanText,
    toggleAutoAccept,
    isToolAllowed
  } = useMode()

  const {
    executions,
    isProcessing,
    processInput,
    clearExecutions
  } = useAgent(writeFlowApp)

  // 键盘事件处理
  const keyboardHandlers = {
    onModeSwitch: switchToNextMode,
    onClearInput: () => setInput(''),
    onClearScreen: () => {
      clearExecutions()
      // 清空消息历史的逻辑
    },
    onSubmitInput: async (input: string) => {
      await handleInput(input)
    },
    onUpdateInput: (updater: (prev: string) => string) => {
      setInput(updater)
    }
  }

  useKeyboard(input, keyboardHandlers, isProcessing)

  const handleInput = async (inputText: string) => {
    const inputMode = detectInputMode(inputText)
    
    // 添加用户消息
    addMessage({
      type: 'user',
      content: inputText,
      mode: inputMode
    })

    setLoading(true)
    
    try {
      // 检查模式限制
      if (currentMode === UIMode.Plan && !isReadOnlyCommand(inputText)) {
        addMessage({
          type: 'system',
          content: '❌ 计划模式下只能使用只读命令'
        })
        return
      }

      const response = await processInput(inputText, inputMode)
      
      addMessage({
        type: 'assistant',
        content: response
      })

    } catch (error) {
      addMessage({
        type: 'system',
        content: `❌ 错误: ${(error as Error).message}`
      })
    } finally {
      setLoading(false)
      setStatus('Ready')
    }
  }

  const detectInputMode = (input: string): InputMode => {
    if (input.startsWith('!')) return InputMode.Bash
    if (input.startsWith('#')) return InputMode.Memory
    return InputMode.Prompt
  }

  const isReadOnlyCommand = (command: string): boolean => {
    const readOnlyCommands = ['/read', '/search', '/status', '/help', '/settings']
    return readOnlyCommands.some(cmd => command.startsWith(cmd))
  }

  // 欢迎消息
  useEffect(() => {
    addMessage({
      type: 'system',
      content: '🚀 WriteFlow v2.0.0 已启动 | 输入 /help 查看帮助'
    })
  }, [])

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* 顶部标题栏 */}
      <Header mode={currentMode} />

      {/* 模式特定界面 */}
      {currentMode === UIMode.Plan && (
        <PlanMode 
          state={uiState}
          onExitPlan={(plan) => setPlanText(plan)}
          currentPlan={modeState.planText}
        />
      )}

      {currentMode === UIMode.AcceptEdits && (
        <AcceptEditsMode
          autoAcceptEnabled={modeState.autoAcceptEnabled}
          onToggleAutoAccept={toggleAutoAccept}
          pendingEdits={0} // 可以从执行状态中计算
        />
      )}

      {/* 工具执行显示 */}
      {executions.length > 0 && (
        <ToolDisplay executions={executions} />
      )}

      {/* 消息历史 */}
      <MessageList messages={uiState.messages} />

      {/* 输入区域 */}
      <InputArea
        mode={currentMode}
        onInput={handleInput}
        onModeSwitch={switchToNextMode}
        isLoading={isProcessing}
        placeholder="输入命令或问题..."
      />

      {/* 底部状态栏 */}
      <StatusBar
        status={uiState.statusText}
        isLoading={uiState.isLoading || isProcessing}
        totalMessages={uiState.messages.length}
      />
    </Box>
  )
}