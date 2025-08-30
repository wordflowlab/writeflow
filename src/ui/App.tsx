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
import { useInputProcessor } from './components/InputProcessor.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { UIMode, InputMode } from './types/index.js'
import { getVersionString } from '../utils/version.js'
import { Logo } from './components/Logo.js'

interface AppProps {
  writeFlowApp: WriteFlowApp
}

export function App({ writeFlowApp }: AppProps) {
  const [input, setInput] = useState('')
  const [showWelcomeLogo, setShowWelcomeLogo] = useState(true)
  
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

  // 输入处理逻辑
  const { detectInputMode } = useInputProcessor(() => {})

  // 检查是否为只读命令（Plan模式限制）
  const isReadOnlyCommand = (input: string): boolean => {
    const readOnlyCommands = ['/help', '/status', '/list', '/read']
    const cmd = input.split(' ')[0]
    return readOnlyCommands.includes(cmd) || !input.startsWith('/')
  }

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
    
    // 用户开始输入后隐藏欢迎Logo
    if (showWelcomeLogo) {
      setShowWelcomeLogo(false)
    }
    
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

      let response: string
      
      // 区分命令和自由对话
      if (inputText.startsWith('/')) {
        // 斜杠命令
        response = await writeFlowApp.executeCommand(inputText)
      } else if (inputText.startsWith('!') || inputText.startsWith('#')) {
        // 特殊模式输入，通过processInput处理
        response = await processInput(inputText, inputMode)
      } else {
        // 自由对话，直接调用AI
        response = await writeFlowApp.handleFreeTextInput(inputText)
      }
      
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


  // 欢迎消息 - 使用空依赖数组确保只执行一次
  useEffect(() => {
    addMessage({
      type: 'system',
      content: `🚀 WriteFlow ${getVersionString()} 已启动 | 输入 /help 查看帮助`
    })
  }, [])

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* 启动欢迎Logo */}
      {showWelcomeLogo && uiState.messages.length <= 1 && (
        <Box marginBottom={2}>
          <Logo variant="full" />
        </Box>
      )}

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
        <Box marginBottom={1}>
          <Text color="cyan" bold>🔧 执行历史</Text>
        </Box>
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