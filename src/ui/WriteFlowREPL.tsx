/**
 * WriteFlow REPL - 重构版本
 * 完全采用 Kode 架构，使用新的消息类型系统和渲染组件
 */

import { Box, Text } from 'ink'
import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { getTheme } from '../utils/theme.js'
import { PromptInput } from './components/PromptInput.js'
import { TodoPanel } from './components/TodoPanel.js'
import { PlanModeConfirmation, ConfirmationOption } from './components/PlanModeConfirmation.js'
import { ShortcutHints } from './components/ShortcutHints.js'
import { useTodoShortcuts, useModeShortcuts } from '../hooks/useKeyboardShortcuts.js'
import { useCollapsibleShortcuts } from '../hooks/useCollapsibleShortcuts.js'
import { Todo, TodoStats, TodoStatus } from '../types/Todo.js'
import { PlanMode } from '../types/agent.js'

// 导入新的消息系统
import type { 
  UIMessage, 
  UserMessage, 
  AssistantMessage,
  NormalizedMessage,
  ContentBlock
} from '../types/UIMessage.js'
import { 
  createUserMessage, 
  createAssistantMessage,
  createTextBlock,
  isUserMessage,
  isAssistantMessage,
  isTextBlock
} from '../types/UIMessage.js'
import { Message } from './components/messages/Message.js'

// 导入工具系统
import { getAvailableTools } from '../tools/index.js'
import { systemReminderService } from '../services/SystemReminderService.js'
import type { Tool } from '../Tool.js'

const PRODUCT_NAME = 'WriteFlow'

interface WriteFlowREPLProps {
  writeFlowApp: WriteFlowApp
  onExit?: () => void
}

export function WriteFlowREPL({ writeFlowApp, onExit }: WriteFlowREPLProps) {
  const theme = getTheme()
  
  // 消息状态 - 使用新的 UIMessage 类型
  const [messages, setMessages] = useState<UIMessage[]>([])
  
  // 可折叠内容管理
  const {
    focusedId: focusedCollapsibleId,
    toggleCollapsible,
    setFocus: setCollapsibleFocus,
    getStats: getCollapsibleStats,
    registerCollapsible,
    manager: collapsibleManager
  } = useCollapsibleShortcuts({
    enableGlobalShortcuts: true,
    onStateChange: (event) => {
      // 可以在这里添加状态变化的日志或其他处理逻辑
      console.log(`🔧 可折叠内容 ${event.contentId} ${event.collapsed ? '已折叠' : '已展开'}`)
    }
  })
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [showModelConfig, setShowModelConfig] = useState(false)
  
  // TODO 状态
  const [todos, setTodos] = useState<Todo[]>([])
  const [todoStats, setTodoStats] = useState<TodoStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    completionRate: 0
  })

  // Plan 模式状态
  const [currentMode, setCurrentMode] = useState<PlanMode>(PlanMode.Default)
  const [planModeStartTime, setPlanModeStartTime] = useState<number>(0)
  const [showPlanConfirmation, setShowPlanConfirmation] = useState<boolean>(false)
  const [pendingPlan, setPendingPlan] = useState<string>('')

  // 工具调用状态管理
  const [erroredToolUseIDs, setErroredToolUseIDs] = useState<Set<string>>(new Set())
  const [inProgressToolUseIDs, setInProgressToolUseIDs] = useState<Set<string>>(new Set())
  const [unresolvedToolUseIDs, setUnresolvedToolUseIDs] = useState<Set<string>>(new Set())
  
  // 流式显示状态管理
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  
  // 获取可用工具
  const tools = useMemo(() => getAvailableTools(), [])
  
  // 获取可用命令
  const commands = useMemo(() => {
    try {
      return writeFlowApp.getAllCommands()
    } catch (error) {
      console.warn('Failed to get commands:', error)
      return []
    }
  }, [writeFlowApp])

  // TODO 面板是否展开
  const [showTodos, setShowTodos] = useState<boolean>(false)

  // 键盘快捷键：Ctrl+T 切换 TODO 面板
  useTodoShortcuts({
    onToggleTodos: () => setShowTodos(v => !v)
  })

  // Plan 模式确认处理
  const handlePlanConfirmation = useCallback(async (option: ConfirmationOption) => {
    try {
      const planManager = writeFlowApp.getPlanModeManager()
      if (planManager) {
        await planManager.handleUserConfirmation(option)
      }
      
      // 根据选项执行相应操作
      if (option === 'auto_approve' || option === 'manual_approve') {
        await writeFlowApp.exitPlanMode(pendingPlan)
      }
      
      setShowPlanConfirmation(false)
      setPendingPlan('')
    } catch (error) {
      console.error('处理 Plan 模式确认失败:', error)
      setShowPlanConfirmation(false)
    }
  }, [writeFlowApp, pendingPlan])

  const handlePlanConfirmationCancel = useCallback(() => {
    setShowPlanConfirmation(false)
    setPendingPlan('')
  }, [])

  // 模式循环切换处理
  const handleModeCycle = useCallback(async () => {
    if (isThinking) return // 在处理中时不允许切换模式

    // 调试日志：显示切换前的状态
    console.log('🔄 模式切换开始:', {
      currentMode,
      appInPlanMode: writeFlowApp.isInPlanMode(),
      hasCurrentPlan: !!writeFlowApp.getCurrentPlan?.()
    })

    try {
      let nextMode: PlanMode
      
      switch (currentMode) {
        case PlanMode.Default:
          nextMode = PlanMode.Plan
          await writeFlowApp.enterPlanMode()
          break
        case PlanMode.Plan:
          nextMode = PlanMode.AcceptEdits
          try {
            const currentPlan = writeFlowApp.getCurrentPlan?.() || ''
            
            if (currentPlan.trim()) {
              // 有计划内容，正常退出
              const exitResult = await writeFlowApp.exitPlanMode(currentPlan)
              if (!exitResult) {
                // 退出失败，但仍允许强制切换到AcceptEdits模式
                console.warn('Plan模式退出被拒绝，但允许强制切换')
                // 直接设置应用层状态为非Plan模式
                const planManager = writeFlowApp.getPlanModeManager()
                if (planManager) {
                  planManager.reset() // 强制重置Plan模式
                }
              }
            } else {
              // 没有计划内容，直接强制退出
              console.log('没有计划内容，强制退出Plan模式')
              const planManager = writeFlowApp.getPlanModeManager()
              if (planManager) {
                planManager.reset()
              }
            }
          } catch (error) {
            console.error('退出Plan模式异常，强制重置:', error)
            // 异常情况下强制重置
            const planManager = writeFlowApp.getPlanModeManager()
            if (planManager) {
              planManager.reset()
            }
          }
          break
        case PlanMode.AcceptEdits:
        default:
          nextMode = PlanMode.Default
          // 回到默认模式
          break
      }
      
      setCurrentMode(nextMode)
      console.log(`🔄 模式切换: ${currentMode} → ${nextMode}`)
      
    } catch (error) {
      console.error('模式切换失败:', error)
      
      // 状态恢复逻辑：确保UI状态与应用层一致
      const actualPlanMode = writeFlowApp.isInPlanMode()
      if (actualPlanMode) {
        setCurrentMode(PlanMode.Plan)
      } else {
        setCurrentMode(PlanMode.Default)
        setPlanModeStartTime(0)
      }
      
      // 通知用户
      console.warn('模式切换失败，已恢复到正确状态')
    }
  }, [currentMode, isThinking, writeFlowApp, pendingPlan])

  // 键盘快捷键：Shift+Tab 切换模式，ESC 退出 Plan 模式
  useModeShortcuts({
    onModeCycle: handleModeCycle,
    onExitPlanMode: currentMode === PlanMode.Plan ? async () => {
      try {
        console.log('ESC键强制退出Plan模式')
        
        // 直接强制重置，不管是否有计划内容
        const planManager = writeFlowApp.getPlanModeManager()
        if (planManager) {
          planManager.reset()
        }
        
        // 强制更新UI状态
        setCurrentMode(PlanMode.Default)
        setPlanModeStartTime(0)
        
        console.log('Plan模式已强制退出')
      } catch (error) {
        console.error('ESC强制退出失败:', error)
        // 即使出错也要重置UI状态
        setCurrentMode(PlanMode.Default)
        setPlanModeStartTime(0)
      }
    } : undefined
  })

  // 获取 TODOs
  const fetchTodos = useCallback(async () => {
    try {
      const todoManager = (writeFlowApp as any).getTodoManager?.()
      console.log('🔍 TODO Manager:', todoManager ? 'found' : 'not found')
      if (todoManager) {
        const todosData = await (todoManager.getAllTodos?.() || todoManager.getTodos?.() || [])
        const list = Array.isArray(todosData) ? todosData : []
        console.log('📝 TODOs loaded:', list.length, 'items')
        setTodos(list)
        updateTodoStats(list)
        setShowTodos(prev => prev || list.length > 0)
      } else {
        // 兜底：直接用共享会话ID创建一个 TodoManager 读取
        try {
          const { TodoManager } = await import('../tools/TodoManager.js')
          const manager = new TodoManager(process.env.WRITEFLOW_SESSION_ID)
          const list = await manager.getAllTodos()
          console.log('📝 Fallback TODOs loaded:', list.length, 'items')
          setTodos(list)
          updateTodoStats(list)
          setShowTodos(prev => prev || list.length > 0)
        } catch (e) {
          console.log('📝 TODO Manager 未找到，使用空数组')
          setTodos([])
        }
      }
    } catch (error) {
      console.warn('获取 TODOs 失败:', error)
      setTodos([])
    }
  }, [writeFlowApp])

  // 更新 TODO 统计
  const updateTodoStats = useCallback((todosData: Todo[]) => {
    const stats = {
      total: todosData.length,
      pending: todosData.filter(t => t.status === TodoStatus.PENDING).length,
      inProgress: todosData.filter(t => t.status === TodoStatus.IN_PROGRESS).length,
      completed: todosData.filter(t => t.status === TodoStatus.COMPLETED).length,
      completionRate: todosData.length === 0 ? 0 : Math.round(
        (todosData.filter(t => t.status === TodoStatus.COMPLETED).length / todosData.length) * 100
      )
    }
    setTodoStats(stats)
  }, [])

  useEffect(() => {
    console.log('🚀 WriteFlowREPL 组件初始化')
    fetchTodos()
    
    // 检查初始的Plan模式状态
    const initialPlanMode = writeFlowApp.isInPlanMode()
    if (initialPlanMode) {
      setCurrentMode(PlanMode.Plan)
      setPlanModeStartTime(Date.now())
    }
    
    // 初始：若已有任务则展开显示
    setShowTodos((prev) => prev || todos.length > 0)
    // 订阅 todo:changed，全局任何地方更新都会刷新此面板
    const onTodoChanged = () => fetchTodos()
    systemReminderService.addEventListener('todo:changed', onTodoChanged)
    return () => {
      // 没有 remove 接口，允许会话结束后由服务重置
    }
  }, [fetchTodos, writeFlowApp])

  // 事件监听器
  useEffect(() => {
    const handleLaunchModelConfig = () => {
      setShowModelConfig(true)
    }

    const handleThinking = (thinkingText: string) => {
      if (thinkingText && thinkingText.trim()) {
        // 创建思考消息，但不显示在主对话中
        console.log('💭 AI 思考:', thinkingText)
      }
    }

    const handlePlanModeChanged = (data: { isActive: boolean; approved?: boolean; reminders?: any[] }) => {
      console.log('🔄 Plan mode changed:', data)
      if (data.isActive) {
        setCurrentMode(PlanMode.Plan)
        setPlanModeStartTime(Date.now())
      } else if (data.approved) {
        setCurrentMode(PlanMode.AcceptEdits)
        setPlanModeStartTime(0)
        setShowPlanConfirmation(false)
        setPendingPlan('')
      } else {
        setCurrentMode(PlanMode.Default)
        setPlanModeStartTime(0)
        setShowPlanConfirmation(false)
        setPendingPlan('')
      }
    }

    const handleExitPlanMode = (plan: string) => {
      console.log('📋 Exit plan mode requested with plan length:', plan.length)
      setPendingPlan(plan)
      setShowPlanConfirmation(true)
    }

    writeFlowApp.on('launch-model-config', handleLaunchModelConfig)
    writeFlowApp.on('ai-thinking', handleThinking)
    writeFlowApp.on('plan-mode-changed', handlePlanModeChanged)
    writeFlowApp.on('exit-plan-mode', handleExitPlanMode)

    return () => {
      writeFlowApp.off('launch-model-config', handleLaunchModelConfig)
      writeFlowApp.off('ai-thinking', handleThinking)
      writeFlowApp.off('plan-mode-changed', handlePlanModeChanged)
      writeFlowApp.off('exit-plan-mode', handleExitPlanMode)
    }
  }, [writeFlowApp])

  // 移除状态监控，避免干扰消息渲染

  // 处理消息提交
  const handleSubmit = useCallback(async (message: string) => {
    if (!message.trim()) return

    // 添加用户消息
    const userMessage = createUserMessage(message.trim())
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsThinking(true)

    try {
      const trimmedMessage = message.trim()
      
      // 预创建流式助手消息
      let streamingMessage = createAssistantMessage([])
      setMessages(prev => [...prev, streamingMessage])
      
      // 设置流式状态
      setStreamingMessageId(streamingMessage.uuid)
      
      // 智能文本缓冲器，用于处理 JSON 和纯文本混合
      let accumulatedText = ''
      let pendingTodoUpdate: any = null

      // 🎯 修复后的流式处理回调 - 保护markdown格式
      const onToken = (chunk: string) => {
        console.log(`🌊 [REPL流式] 收到字符块: "${chunk}" (长度: ${chunk.length})`)
        accumulatedText += chunk
        
        // 智能分离JSON和内容 - 保护创意内容的markdown格式
        let displayText = accumulatedText
        let hasJsonUpdate = false
        
        // 检测并移除TODO JSON更新（在独立行中）
        const lines = displayText.split('\n')
        const filteredLines: string[] = []
        
        for (const line of lines) {
          const trimmed = line.trim()
          
          // 检测完整的JSON TODO更新行
          if (trimmed.startsWith('{') && trimmed.includes('"todos"') && trimmed.endsWith('}')) {
            try {
              const todoData = JSON.parse(trimmed)
              if (todoData.todos && Array.isArray(todoData.todos)) {
                pendingTodoUpdate = todoData.todos
                hasJsonUpdate = true
                continue // 跳过此行，不添加到显示内容
              }
            } catch (e) {
              // 不是有效的JSON，保留原始内容
            }
          }
          
          // 过滤明确的系统消息，但保护内容中的格式
          if (trimmed.startsWith('AI: [调用 todo_write 工具]') ||
              trimmed.startsWith('todo_write工具:') ||
              trimmed.startsWith('🎯 **任务列表已更新**') ||
              trimmed.startsWith('⎿')) {
            continue // 跳过系统消息行
          }
          
          // 保留所有其他内容，包括markdown格式
          filteredLines.push(line)
        }
        
        // 重新组装显示文本，保留原始格式
        displayText = filteredLines.join('\n').trim()
        
        // 实时更新消息显示 - 保护markdown结构
        if (displayText) {
          console.log(`🎯 [REPL更新] 更新显示，保护格式，长度: ${displayText.length}`)
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMessage = newMessages[newMessages.length - 1]
            
            if (isAssistantMessage(lastMessage)) {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                message: {
                  ...lastMessage.message,
                  content: [createTextBlock(displayText)]
                }
              }
            }
            
            return newMessages
          })
        }
      }

      // 调用 WriteFlowApp 的 handleFreeTextInput 方法
      const finalText = await writeFlowApp.handleFreeTextInput(trimmedMessage, {
        onToken
      })
      
      // 🎯 智能处理最终文本，强化markdown格式保护
      if (finalText && finalText.trim()) {
        setMessages(prev => {
          const newMessages = [...prev]
          const last = newMessages[newMessages.length - 1]
          if (isAssistantMessage(last)) {
            const currentContent = last.message.content[0]
            const currentText = isTextBlock(currentContent) ? currentContent.text : ''
            
            // 检查当前内容是否需要更新
            const shouldUpdate = !currentText || 
                                currentText.trim() === '' ||
                                currentText.includes('思考中...') ||
                                currentText.includes('正在处理...')
            
            // 应用与onToken相同的过滤逻辑，确保一致性
            const lines = finalText.split('\n')
            const filteredLines: string[] = []
            
            for (const line of lines) {
              const trimmed = line.trim()
              
              // 跳过JSON TODO更新行
              if (trimmed.startsWith('{') && trimmed.includes('"todos"') && trimmed.endsWith('}')) {
                try {
                  const todoData = JSON.parse(trimmed)
                  if (todoData.todos && Array.isArray(todoData.todos)) {
                    continue // 跳过TODO JSON行
                  }
                } catch (e) {
                  // 不是有效JSON，保留原始内容
                }
              }
              
              // 跳过系统消息行，保护创意内容
              if (trimmed.startsWith('AI: [调用 todo_write 工具]') ||
                  trimmed.startsWith('todo_write工具:') ||
                  trimmed.startsWith('🎯 **任务列表已更新**') ||
                  trimmed.startsWith('⎿')) {
                continue
              }
              
              // 保留所有其他内容，包括markdown格式
              filteredLines.push(line)
            }
            
            const cleanedText = filteredLines.join('\n').trim()
            
            if (shouldUpdate && cleanedText) {
              console.log(`🎯 [最终文本] 更新内容，保护markdown格式，长度: ${cleanedText.length}`)
              newMessages[newMessages.length - 1] = {
                ...last,
                message: {
                  ...last.message,
                  content: [createTextBlock(cleanedText)]
                }
              }
            }
            // 如果已有格式化内容且无需更新，完全保护现有格式
          }
          return newMessages
        })

        // 若文本包含 TODO 更新的信号，则刷新面板
        if (/Todos have been modified|任务列表已更新|"todos"\s*:\s*\[/.test(finalText)) {
          await fetchTodos()
        }
      }
      
      // 处理待处理的 TODO 更新
      if (pendingTodoUpdate) {
        try {
          const todoManager = (writeFlowApp as any).getTodoManager?.()
          if (todoManager) {
            await todoManager.saveTodos(pendingTodoUpdate)
            await fetchTodos()
          } else {
            setTodos(pendingTodoUpdate)
            updateTodoStats(pendingTodoUpdate)
          }
        } catch (error) {
          console.error('处理 TODO 更新失败:', error)
        }
      }

    } catch (error) {
      console.error('处理消息失败:', error)
      
      // 清除流式状态（错误时也要清理）
      setStreamingMessageId(null)
      
      // 添加错误消息
      const errorMessage = createAssistantMessage([
        createTextBlock(`处理请求时发生错误: ${error instanceof Error ? error.message : '未知错误'}`)
      ])
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsThinking(false)
      // 清除流式状态
      setStreamingMessageId(null)
    }
  }, [writeFlowApp, fetchTodos, updateTodoStats])


  // 规范化消息用于渲染
  const normalizedMessages = useMemo((): NormalizedMessage[] => {
    return messages.filter(msg => {
      if (isUserMessage(msg)) {
        return typeof msg.message.content === 'string' && msg.message.content.trim().length > 0
      }
      if (isAssistantMessage(msg)) {
        return msg.message.content.length > 0 && msg.message.content.some(block => {
          return block.type === 'text' ? block.text.trim().length > 0 : true
        })
      }
      return true
    })
  }, [messages])

  // console.log('🎨 WriteFlowREPL 渲染中，todos.length:', todos.length, 'messages.length:', messages.length)
  
  // 计算动态状态文案
  const activityStatus: 'idle' | 'working' | 'thinking' | 'executing' =
    inProgressToolUseIDs.size > 0 ? 'executing' : (isThinking ? 'working' : 'idle')

  // 运行计时（用于 working/executing 状态显示秒数）
  const [statusStart, setStatusStart] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  // 辅助函数：自动注册新的可折叠内容并设置焦点
  const registerAndFocusNewCollapsible = useCallback((contentId: string) => {
    // 注册新的可折叠内容
    registerCollapsible(contentId, {
      collapsed: true,
      autoCollapse: true,
      maxLines: 15,
      focusable: true
    })
    
    // 自动设置为焦点，这样用户可以立即使用 Ctrl+R
    setCollapsibleFocus(contentId)
    
    console.log(`🔧 已注册并聚焦新的可折叠内容: ${contentId}`)
    console.log(`💡 提示: 按 Ctrl+R 展开详细内容`)
  }, [registerCollapsible, setCollapsibleFocus])

  useEffect(() => {
    if (activityStatus === 'idle') {
      setStatusStart(null)
      setElapsedSeconds(0)
      return
    }

    // 开始计时（仅首次进入活动状态时）
    const start = statusStart ?? Date.now()
    if (!statusStart) setStatusStart(start)

    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    }, 1000)

    return () => clearInterval(timer)
  }, [activityStatus])
  
  return (
    <Box flexDirection="column" width="100%" minHeight={3}>
      {/* Header */}
      <Box flexDirection="row" alignItems="center" marginBottom={1}>
        <Text color="cyan" bold>
          ✨ {PRODUCT_NAME}
        </Text>
        <Box marginLeft={2}>
          <Text color={theme.dimText}>
            AI 写作助手
          </Text>
        </Box>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1}>
        {normalizedMessages.map((message, index) => {
          // 只渲染用户和助手消息
          if (message.type === 'user' || message.type === 'assistant') {
            // 检查当前消息是否正在流式显示
            const isStreaming = streamingMessageId === message.uuid
            
            return (
              <Message
                key={`${message.type}-${message.uuid}`}
                message={message}
                messages={normalizedMessages}
                addMargin={index > 0}
                tools={tools as any}
                verbose={false}
                debug={false}
                erroredToolUseIDs={erroredToolUseIDs}
                inProgressToolUseIDs={inProgressToolUseIDs}
                unresolvedToolUseIDs={unresolvedToolUseIDs}
                shouldAnimate={isThinking && index === normalizedMessages.length - 1}
                shouldShowDot={message.type === 'assistant' && index === normalizedMessages.length - 1}
                enableCollapsible={true}
                onCollapsibleToggle={(collapsed, id) => toggleCollapsible(id)}
                onCollapsibleFocus={setCollapsibleFocus}
                focusedCollapsibleId={focusedCollapsibleId || undefined}
                onNewCollapsibleContent={registerAndFocusNewCollapsible}
                isStreaming={isStreaming}
                streamingCursor={true}
              />
            )
          }
          return null
        })}
      </Box>

      {/* Plan Mode Confirmation - 只在需要确认时显示 */}
      {showPlanConfirmation && pendingPlan && (
        <Box marginTop={1} marginBottom={1}>
          <PlanModeConfirmation
            plan={pendingPlan}
            onConfirm={handlePlanConfirmation}
            onCancel={handlePlanConfirmationCancel}
          />
        </Box>
      )}

      {/* Todo Panel — 紧贴输入框上方，减少间距 */}
      <Box marginTop={0} marginBottom={0} paddingTop={0}>
        <TodoPanel
          todos={todos}
          stats={todoStats}
          isVisible={showTodos}
          compact={true}
          minimal={true}
          onToggle={() => setShowTodos(v => !v)}
          status={activityStatus}
          elapsedSeconds={elapsedSeconds}
        />
      </Box>

      {/* Input */}
      <Box marginTop={0}>
        <PromptInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isThinking}
          isDisabled={isThinking}
          mode="writing"
          onModeChange={() => {}}
          messages={[]}
          commands={commands}
          placeholder={isThinking ? '思考中...' : '输入消息...'}
        />
      </Box>

      {/* Shortcut Hints with Mode Status */}
      <Box marginTop={-1}>
        <ShortcutHints
          currentMode={currentMode}
          showTodos={showTodos}
          isLoading={isThinking}
          elapsedTime={planModeStartTime > 0 ? Date.now() - planModeStartTime : 0}
        />
      </Box>

      {/* Model Config Modal */}
      {showModelConfig && (
        <Box
          justifyContent="center"
          alignItems="center"
          marginTop={2}
        >
          <Box
            borderStyle="round"
            borderColor={theme.claude}
            padding={1}
            width={60}
          >
            {/* ModelConfig component would go here */}
            <Text>模型配置界面</Text>
            <Text color={theme.dimText}>按 Ctrl+C 关闭</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
