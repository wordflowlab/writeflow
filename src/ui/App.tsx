import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Box, Text, Static } from 'ink'
// import { Header } from './components/Header.js'
import { ModeIndicator } from './components/ModeIndicator.js'
import { MessageList } from './components/MessageList.js'
import { InputArea } from './components/InputArea.js'
import { PromptHintArea } from './components/PromptHintArea.js'
import { StatusBar } from './components/StatusBar.js'
import { ToolDisplay } from './components/ToolDisplay.js'
import { PlanModeAlert } from './components/PlanModeAlert.js'
import { PlanModeConfirmation, ConfirmationOption } from './components/PlanModeConfirmation.js'
import { SystemReminder } from './components/SystemReminder.js'
// import { PlanMode } from './modes/PlanMode.js'
// import { AcceptEditsMode } from './modes/AcceptEditsMode.js'
import { useUIState } from './hooks/useUIState.js'
import { useMode } from './hooks/useMode.js'
import { useAgent } from './hooks/useAgent.js'
import { useKeyboard } from './hooks/useKeyboard.js'
import { useInputProcessor } from './components/InputProcessor.js'
import { usePromptHints } from './hooks/usePromptHints.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { UIMode, InputMode } from './types/index.js'
import { getVersionString } from '../utils/version.js'
import { Logo } from './components/Logo.js'
import { PlanModeManager } from '../modes/PlanModeManager.js'
import { PlanMode } from '../types/agent.js'
import { SystemReminder as SystemReminderType } from '../tools/SystemReminderInjector.js'

interface AppProps {
  writeFlowApp: WriteFlowApp
}

export function App({ writeFlowApp }: AppProps) {
  const [input, setInput] = useState('')
  const [showWelcomeLogo, setShowWelcomeLogo] = useState(true)
  const isProcessingRef = useRef(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  
  // Plan 模式管理器状态
  const [planModeManager] = useState(() => new PlanModeManager())
  const [planModeStartTime, setPlanModeStartTime] = useState<number>(0)
  const [showPlanConfirmation, setShowPlanConfirmation] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<string>('')
  const [systemReminders, setSystemReminders] = useState<SystemReminderType[]>([])
  
  // 状态锁防止重复切换
  const [isSwitchingMode, setIsSwitchingMode] = useState(false)
  
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
  
  // 动态提示功能
  const { currentHint, hasHint } = usePromptHints({
    mode: currentMode,
    isLoading: isProcessing,
    messageCount: uiState.messages.length,
    hasInput: input.length > 0
  })

  // 检查是否为只读命令（Plan模式限制）
  const isReadOnlyCommand = (input: string): boolean => {
    const readOnlyCommands = ['/help', '/status', '/list', '/read']
    const cmd = input.split(' ')[0]
    return readOnlyCommands.includes(cmd) || !input.startsWith('/')
  }

  // 处理中断操作
  const handleInterrupt = () => {
    if (abortController) {
      console.log('⚠️ 用户中断操作')
      abortController.abort()
      setAbortController(null)
      setLoading(false)
      isProcessingRef.current = false
      
      addMessage({
        type: 'system',
        content: '⚠️ 操作已中断'
      })
    }
  }

  // Plan 模式处理函数
  const handleEnterPlanMode = useCallback(async () => {
    if (planModeManager.isInPlanMode()) return // 已在 Plan 模式
    
    // 清理旧的提醒
    setSystemReminders([])
    
    setPlanModeStartTime(Date.now())
    const reminders = await planModeManager.enterPlanMode()
    setSystemReminders(reminders)
    
    // 只添加一次消息
    addMessage({
      type: 'system',
      content: '📋 已进入 Plan 模式 - 只读分析模式激活'
    })
  }, [planModeManager, addMessage])

  const handleExitPlanMode = useCallback(async (plan: string) => {
    setCurrentPlan(plan)
    
    // 通知 PlanModeManager 处理工具调用
    await planModeManager.handleExitPlanModeTool(plan)
    
    // 获取并显示新的系统提醒
    const newReminders = planModeManager.getActiveReminders()
    setSystemReminders(prev => [...prev, ...newReminders])
    
    // 显示确认对话框
    setShowPlanConfirmation(true)
  }, [planModeManager])

  const handlePlanConfirmation = async (option: ConfirmationOption) => {
    setShowPlanConfirmation(false)
    
    try {
      const result = await planModeManager.exitPlanMode(currentPlan)
      
      if (result.success && result.approved) {
        // 计划被批准，执行用户选择的确认选项
        await planModeManager.handleUserConfirmation(option)
        
        addMessage({
          type: 'system',
          content: '✅ 计划已确认，退出 Plan 模式'
        })
        
        setPlanModeStartTime(0)
        setSystemReminders([])
      } else {
        // 计划需要改进
        if (result.reminders) {
          setSystemReminders(result.reminders)
        }
        
        addMessage({
          type: 'system',
          content: result.result?.message || '❌ 计划需要改进，请根据反馈调整'
        })
      }
    } catch (error) {
      addMessage({
        type: 'system',
        content: `❌ 退出 Plan 模式失败: ${(error as Error).message}`
      })
    }
  }

  const handleModeCycle = useCallback(async () => {
    if (isSwitchingMode) return // 防止重复切换
    
    setIsSwitchingMode(true)
    try {
      if (planModeManager.isInPlanMode()) {
        // 从 Plan 模式切换到默认模式
        setSystemReminders([]) // 清理前先清理提醒
        planModeManager.reset()
        setPlanModeStartTime(0)
        addMessage({
          type: 'system', 
          content: '🔄 已退出 Plan 模式'
        })
      } else {
        // 进入 Plan 模式
        await handleEnterPlanMode()
      }
    } finally {
      setIsSwitchingMode(false)
    }
  }, [isSwitchingMode, planModeManager, addMessage, handleEnterPlanMode])

  // 输入处理函数
  const handleInput = useCallback(async (inputText: string) => {
    // 防止重复处理
    if (isProcessingRef.current) {
      console.warn('正在处理中，忽略重复请求')
      return
    }
    
    isProcessingRef.current = true
    const inputMode = detectInputMode(inputText)
    
    // 创建新的 AbortController
    const controller = new AbortController()
    setAbortController(controller)
    
    try {
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
      
      // 检查 Plan 模式限制
      if (planModeManager.isInPlanMode()) {
        const toolName = inputText.startsWith('/') ? inputText.split(' ')[0].slice(1) : 'free_text'
        const permissionCheck = await planModeManager.checkToolPermission(toolName, {})
        
        if (!permissionCheck.allowed) {
          if (permissionCheck.reminder) {
            setSystemReminders(prev => [...prev, permissionCheck.reminder!])
          }
          
          addMessage({
            type: 'system',
            content: `❌ ${permissionCheck.reason || 'Plan 模式下禁止此操作'}`
          })
          return
        }
        
        // 添加工具使用提醒
        if (permissionCheck.reminder) {
          setSystemReminders(prev => [...prev, permissionCheck.reminder!])
        }
      }

      let response: string
      
      // 区分命令和自由对话
      if (inputText.startsWith('/')) {
        // 斜杠命令
        response = await writeFlowApp.executeCommand(inputText, { signal: controller.signal })
      } else if (inputText.startsWith('!') || inputText.startsWith('#')) {
        // 特殊模式输入，通过processInput处理
        response = await processInput(inputText, inputMode)
      } else {
        // 自由对话，直接调用AI - 传递完整对话历史
        response = await writeFlowApp.handleFreeTextInput(inputText, { 
          signal: controller.signal,
          messages: uiState.messages
        })
      }
      
      // 拦截并处理工具调用
      const toolInterception = await writeFlowApp.interceptToolCalls(response)
      
      if (toolInterception.shouldIntercept) {
        // 使用处理后的响应
        addMessage({
          type: 'assistant',
          content: toolInterception.processedResponse || response
        })
      } else {
        // 直接添加响应，不添加AI提供商标识
        addMessage({
          type: 'assistant',
          content: response
        })
      }

    } catch (error) {
      addMessage({
        type: 'system',
        content: `❌ 错误: ${(error as Error).message}`
      })
    } finally {
      setLoading(false)
      setStatus('Ready')
      isProcessingRef.current = false
      setAbortController(null) // 清理 AbortController
    }
  }, [planModeManager, addMessage, setLoading, setStatus, processInput, writeFlowApp, showWelcomeLogo, uiState.messages, detectInputMode])

  // 键盘事件处理
  const keyboardHandlers = useMemo(() => ({
    onModeSwitch: handleModeCycle, // 使用新的模式切换处理器
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
  }), [handleModeCycle, clearExecutions, handleInput])

  useKeyboard(input, keyboardHandlers, isProcessing)


  // 监听 Plan 模式退出事件
  useEffect(() => {
    const handleExitPlan = (plan: string) => {
      handleExitPlanMode(plan)
    }

    // 监听 exit-plan-mode 事件
    writeFlowApp.on('exit-plan-mode', handleExitPlan)

    return () => {
      writeFlowApp.off('exit-plan-mode', handleExitPlan)
    }
  }, [writeFlowApp, handleExitPlanMode])

  // 清理系统提醒的定时器
  useEffect(() => {
    if (systemReminders.length > 0) {
      const timer = setTimeout(() => {
        // 清理非持续的提醒
        setSystemReminders(prev => prev.filter(reminder => reminder.persistent))
      }, 10000) // 10秒后清理非持续提醒

      return () => clearTimeout(timer)
    }
  }, [systemReminders])

  // 欢迎消息 - 注释掉以保持极简
  /*
  useEffect(() => {
    addMessage({
      type: 'system',
      content: `🚀 WriteFlow ${getVersionString()}`
    })
  }, [])
  */

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* 启动欢迎Logo */}
      <Static items={showWelcomeLogo && uiState.messages.length === 0 ? [1] : []}>
        {(item, index) => (
          <Box key={index} marginBottom={2}>
            <Logo variant="full" />
          </Box>
        )}
      </Static>

      {/* Plan 模式警告框 */}
      {planModeManager.isInPlanMode() && planModeStartTime > 0 && (
        <Box key="plan-mode-alert">
          <PlanModeAlert 
            elapsedTime={Date.now() - planModeStartTime}
            onModeCycle={handleModeCycle}
          />
        </Box>
      )}

      {/* 系统提醒显示 */}
      {systemReminders.length > 0 && (
        <Box key="system-reminders">
          <SystemReminder reminders={systemReminders} />
        </Box>
      )}

      {/* Plan 模式确认对话框 */}
      {showPlanConfirmation && (
        <Box key="plan-confirmation">
          <PlanModeConfirmation
            plan={currentPlan}
            onConfirm={handlePlanConfirmation}
            onCancel={() => setShowPlanConfirmation(false)}
          />
        </Box>
      )}

      {/* 顶部标题栏 - 移除以保持极简 */}
      {/* <Header mode={currentMode} /> */}

      {/* 模式特定界面 - 注释掉以保持极简设计 */}
      {/* 
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
      */}

      {/* 工具执行显示 */}
      {executions.length > 0 && (
        <Box marginBottom={1}>
          <Text color="cyan" bold>🔧 执行历史</Text>
        </Box>
      )}

      {/* 消息历史 */}
      <MessageList messages={uiState.messages} />

      {/* 提示区域 */}
      <PromptHintArea
        mode={currentMode}
        currentHint={currentHint}
        hasHint={hasHint}
        isLoading={isProcessing}
      />

      {/* 输入区域 */}
      <InputArea
        mode={currentMode}
        onInput={handleInput}
        onModeSwitch={switchToNextMode}
        onInterrupt={handleInterrupt}
        isLoading={isProcessing}
        messageCount={uiState.messages.length}
      />

      {/* 底部状态栏 */}
      <StatusBar
        status={uiState.statusText}
        isLoading={uiState.isLoading || isProcessing}
        totalMessages={uiState.messages.length}
        shortcuts={false}
      />
    </Box>
  )
}