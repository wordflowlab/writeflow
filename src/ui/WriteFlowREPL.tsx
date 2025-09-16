/**
 * WriteFlow REPL - 重构版本
 * 采用 AsyncGenerator 流式架构，使用新的消息类型系统和渲染组件
 */

import { Box, Text } from 'ink'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { getTheme } from '../utils/theme.js'
import { debugLog, logError, logWarn, infoLog } from '../utils/log.js'
import { getVersion } from '../utils/version.js'
import { PromptInput } from './components/PromptInput.js'
import { TodoPanel } from './components/TodoPanel.js'
import { PlanModeConfirmation, ConfirmationOption } from './components/PlanModeConfirmation.js'
import { ShortcutHints } from './components/ShortcutHints.js'
import { ModelConfig } from './components/ModelConfig.js'
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
import { ToolExecutionMessage, ToolStatusMessage } from './components/WriterMessage.js'
import type { ToolExecutionInfo } from './components/WriterMessage.js'

// 导入工具系统
import { getAvailableTools, getToolOrchestrator } from '../tools/index.js'
import { systemReminderService } from '../services/SystemReminderService.js'
import type { Tool } from '../Tool.js'
import { PermissionRequest as PermissionRequestComponent } from './components/permissions/PermissionRequest.js'

const PRODUCT_NAME = 'WriteFlow'
const MAX_TOOL_STATUS_HISTORY = 8

interface ToolStatusEntry {
  id: string
  toolName: string
  status: 'started' | 'completed' | 'failed'
  message?: string
  duration?: number
}

interface WriteFlowREPLProps {
  writeFlowApp: WriteFlowApp
  onExit?: () => void
}

export function WriteFlowREPL({ writeFlowApp, onExit }: WriteFlowREPLProps) {
  const theme = getTheme()
  
  // 🚀 消息窗口化 - 限制消息数量防止性能下降
  const MAX_MESSAGES = 50 // 最多保留50条消息，超出自动清理
  const [messages, setMessages] = useState<UIMessage[]>([])
  
  // 🚀 性能监控：跟踪渲染性能和内存使用
  const [renderTime, setRenderTime] = useState(0)
  const [lastRenderStart, setLastRenderStart] = useState(0)
  
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
      debugLog(`🔧 可折叠内容 ${event.contentId} ${event.collapsed ? '已折叠' : '已展开'}`)
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
  
  // 权限确认状态（类似 Kode 的 ToolUseConfirm）
  const [toolUseConfirm, setToolUseConfirm] = useState<{
    toolName: string
    filePath: string
    description: string
    onAllow: (type: 'temporary' | 'session') => void
    onDeny: () => void
  } | null>(null)

  // 工具调用状态管理
  const [erroredToolUseIDs, setErroredToolUseIDs] = useState<Set<string>>(new Set())
  const [inProgressToolUseIDs, setInProgressToolUseIDs] = useState<Set<string>>(new Set())
  const [unresolvedToolUseIDs, setUnresolvedToolUseIDs] = useState<Set<string>>(new Set())
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionInfo[]>([])
  const [toolStatusHistory, setToolStatusHistory] = useState<ToolStatusEntry[]>([])
  const [toolProgressTitle, setToolProgressTitle] = useState<string>('')
  const [toolProgressSubtitle, setToolProgressSubtitle] = useState<string>('')
  const [showToolExecutionPanel, setShowToolExecutionPanel] = useState<boolean>(false)
  const toolExecutionStateRef = useRef<Map<string, { id: string; startTime: number; completed: boolean }>>(new Map())
  const lastToolNameRef = useRef<string | null>(null)
  
  // 流式显示状态管理
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  // 🚀 文本选择模式 - 暂停更新以支持复制
  const [textSelectionMode, setTextSelectionMode] = useState<boolean>(false)

  // 🚀 消息去重状态 - 防止重复显示相同的系统状态消息
  const processedStatusMessagesRef = useRef<Set<string>>(new Set())
  
  // 获取可用工具
  const tools = useMemo(() => getAvailableTools(), [])
  
  // 获取可用命令
  const commands = useMemo(() => {
    try {
      return writeFlowApp.getAllCommands()
    } catch (error) {
      logWarn('Failed to get commands:', error)
      return []
    }
  }, [writeFlowApp])

  const resetToolExecutionState = useCallback(() => {
    setToolExecutions([])
    setToolStatusHistory([])
    setToolProgressTitle('')
    setToolProgressSubtitle('')
    setShowToolExecutionPanel(false)
    toolExecutionStateRef.current.clear()
    lastToolNameRef.current = null
    // 🚀 清理消息去重状态
    processedStatusMessagesRef.current.clear()
  }, [])

  const addToolStatusEntry = useCallback((
    toolName: string,
    status: ToolStatusEntry['status'],
    message?: string,
    duration?: number
  ) => {
    setToolStatusHistory(prev => {
      const existingIndex = prev.findIndex(item => item.toolName === toolName && item.status === status)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          message,
          duration
        }
        return next
      }

      const entry: ToolStatusEntry = {
        id: `tool-status-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        toolName,
        status,
        message,
        duration
      }
      const next = [...prev, entry]
      if (next.length > MAX_TOOL_STATUS_HISTORY) {
        return next.slice(next.length - MAX_TOOL_STATUS_HISTORY)
      }
      return next
    })
  }, [])

  const upsertToolExecution = useCallback((
    id: string,
    base: ToolExecutionInfo,
    updates: Partial<ToolExecutionInfo> = {}
  ) => {
    setToolExecutions(prev => {
      const index = prev.findIndex(exec => exec.id === id)
      if (index >= 0) {
        const next = [...prev]
        next[index] = { ...next[index], ...updates }
        return next
      }
      return [...prev, { ...base, ...updates }]
    })
  }, [])

  const normalizeToolName = useCallback((rawName: string) => {
    const cleaned = rawName
      .replace(/[`'"\\]/g, '')
      .replace(/工具$/, '')
      .replace(/工具执行$/, '')
      .replace(/执行中$/, '')
      .replace(/执行$/, '')
      .replace(/处理中$/, '')
      .replace(/完成$/, '')
      .trim()

    if (!cleaned) return ''

    const normalized = cleaned.replace(/\s+/g, ' ').trim()
    const lower = normalized.toLowerCase()

    if (/(todo[_\s]?write|任务列表更新)/i.test(normalized)) return 'todo_write'
    if (/(todo[_\s]?read|读取任务列表)/i.test(normalized)) return 'todo_read'
    if (/(exit[_\s]?plan[_\s]?mode|退出.*plan|退出计划)/i.test(normalized)) return 'exit_plan_mode'
    if (/glob/.test(lower)) return 'Glob'
    if (/grep/.test(lower)) return 'Grep'
    if (/read/.test(lower) || /读取/.test(normalized)) return 'Read'
    if (/write/.test(lower) || /写入/.test(normalized)) return 'Write'
    if (/edit/.test(lower) || /编辑/.test(normalized)) return 'Edit'
    if (/multi\s*edit/i.test(normalized)) return 'MultiEdit'

    const firstToken = normalized.split(' ')[0]
    const knownNames = ['Glob', 'Grep', 'Read', 'Write', 'Edit', 'MultiEdit', 'Bash']
    if (knownNames.includes(firstToken)) {
      return firstToken
    }

    if (knownNames.map(name => name.toLowerCase()).includes(lower)) {
      return normalized
    }

    return normalized
  }, [])

  const createToolExecutionId = useCallback(() => {
    return `tool-exec-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }, [])

  const startToolExecution = useCallback((toolName: string, message: string) => {
    const id = createToolExecutionId()
    toolExecutionStateRef.current.set(toolName, { id, startTime: Date.now(), completed: false })
    lastToolNameRef.current = toolName
    upsertToolExecution(id, {
      id,
      toolName,
      status: 'running',
      message
    })
    addToolStatusEntry(toolName, 'started', message)
    setToolProgressSubtitle(message)
    setShowToolExecutionPanel(true)
  }, [addToolStatusEntry, createToolExecutionId, setToolProgressSubtitle, setShowToolExecutionPanel, upsertToolExecution])

  const finalizeToolExecution = useCallback((
    toolName: string,
    status: 'completed' | 'failed',
    message: string,
    extra: Partial<ToolExecutionInfo> = {},
    options: { clearState?: boolean } = {}
  ) => {
    const state = toolExecutionStateRef.current.get(toolName)
    const id = state?.id || createToolExecutionId()
    const duration = state ? Math.max(0, Date.now() - state.startTime) : undefined

    if (state) {
      if (options.clearState || status === 'failed') {
        toolExecutionStateRef.current.delete(toolName)
      } else {
        toolExecutionStateRef.current.set(toolName, {
          id,
          startTime: state.startTime,
          completed: true
        })
      }
    } else if (!options.clearState && status !== 'failed') {
      toolExecutionStateRef.current.set(toolName, {
        id,
        startTime: Date.now(),
        completed: true
      })
    }

    upsertToolExecution(id, {
      id,
      toolName,
      status,
    }, {
      status,
      message,
      duration,
      ...extra
    })

    addToolStatusEntry(toolName, status, message, duration)
    setToolProgressSubtitle(message)
    setShowToolExecutionPanel(true)
    lastToolNameRef.current = toolName
  }, [addToolStatusEntry, createToolExecutionId, setToolProgressSubtitle, setShowToolExecutionPanel, upsertToolExecution])
  const processToolResultJson = useCallback((rawJson: string) => {
    try {
      const data = JSON.parse(rawJson)
      if (!data || typeof data !== 'object') {
        return null
      }

      const toolNameFromJson = typeof (data as any).toolName === 'string'
        ? normalizeToolName((data as any).toolName)
        : ''

      const toolName = toolNameFromJson || lastToolNameRef.current || 'Read'

      const relativePath = typeof (data as any).relativePath === 'string' ? (data as any).relativePath : ''
      const absolutePath = typeof (data as any).absolutePath === 'string' ? (data as any).absolutePath : ''
      const path = relativePath || absolutePath || ''

      let totalLines = typeof (data as any).totalLines === 'number'
        ? (data as any).totalLines
        : undefined

      const shownRange = (data as any).shownRange
      if (typeof totalLines !== 'number' && shownRange && typeof shownRange === 'object') {
        const start = Number((shownRange as any).start)
        const end = Number((shownRange as any).end)
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          totalLines = Math.max(0, end - start + 1)
        }
      }

      let message = ''
      if (typeof (data as any).message === 'string' && (data as any).message.trim()) {
        message = (data as any).message.trim()
      } else if (path) {
        message = path
      } else {
        message = '工具执行完成'
      }

      if (typeof totalLines === 'number' && totalLines > 0) {
        message = `${message} · ${totalLines} 行`
      }

      const contentPreview = typeof (data as any).contentPreview === 'string'
        ? (data as any).contentPreview.trim()
        : ''
      const details = contentPreview
        ? contentPreview.split('\n').slice(0, 8).join('\n')
        : undefined

      return {
        toolName,
        message,
        details,
        path,
        lineCount: typeof totalLines === 'number' ? totalLines : undefined
      }
    } catch (error) {
      if (process.env.WRITEFLOW_DEBUG_STREAM === 'verbose') {
        debugLog('解析工具结果 JSON 失败:', error)
      }
      return null
    }
  }, [normalizeToolName])

  const processToolProgressText = useCallback((text: string, updateState: boolean) => {
    if (!text) return ''

    // 去除 ANSI 转义
    let remainingText = text.replace(/\u001B\[[0-9;]*m/g, '')

    const consumePattern = (regex: RegExp, handler: (match: string, ...groups: string[]) => void) => {
      remainingText = remainingText.replace(regex, (...args) => {
        if (updateState) {
          handler(...args)
        }
        return ''
      })
    }

    consumePattern(/预处理请求和分析内容\.\.\./g, () => {
      // 🚀 防重复机制 - 只有在没有处理过这个消息时才设置
      const messageKey = 'preprocessing-request'
      if (!processedStatusMessagesRef.current.has(messageKey)) {
        setToolProgressTitle('')
        setShowToolExecutionPanel(true)
        processedStatusMessagesRef.current.add(messageKey)
      }
    })

    consumePattern(/开始实时\s*AI\s*处理和工具执行\.\.\./g, () => {
      // 🚀 防重复机制
      const messageKey = 'realtime-ai-processing'
      if (!processedStatusMessagesRef.current.has(messageKey)) {
        setToolProgressSubtitle('')
        setShowToolExecutionPanel(true)
        processedStatusMessagesRef.current.add(messageKey)
      }
    })

    consumePattern(/AI响应生成中[^。\n]*\.\.\./g, (match) => {
      // 🚀 防重复机制 - 对于AI响应生成消息，使用匹配的文本作为key
      const messageKey = `ai-response-${match.trim()}`
      if (!processedStatusMessagesRef.current.has(messageKey)) {
        setToolProgressSubtitle(match.trim())
        setShowToolExecutionPanel(true)
        processedStatusMessagesRef.current.add(messageKey)
      }
    })

    consumePattern(/处理完成\s*\([^)]+\)/g, (match) => {
      // 🚀 防重复机制
      const messageKey = `processing-completed-${match.trim()}`
      if (!processedStatusMessagesRef.current.has(messageKey)) {
        setToolProgressSubtitle(match.trim())
        setShowToolExecutionPanel(true)
        processedStatusMessagesRef.current.add(messageKey)
      }
    })

    consumePattern(/🔧\s*(?:正在执行\s*)?([^\s。:：,，]+?)(?:\s*(?:工具|tool))?(?:执行(?:中)?|处理中)?(?:\.{3})?/gi, (match, rawName) => {
      const normalizedName = normalizeToolName(rawName) || rawName.trim() || `tool-${Date.now()}`
      const messageText = match.replace(/^🔧\s*/, '').trim()
      startToolExecution(normalizedName, messageText)
    })

    consumePattern(/✅\s*([^\s。:：,，]+?)(?:工具执行完成|执行完成|完成)/g, (match, rawName) => {
      let resolvedName = rawName?.trim() || ''
      if (!resolvedName && lastToolNameRef.current) {
        resolvedName = lastToolNameRef.current
      }
      const normalizedName = normalizeToolName(resolvedName) || lastToolNameRef.current || resolvedName || `tool-${Date.now()}`
      const messageText = match.replace(/^✅\s*/, '').trim()
      finalizeToolExecution(normalizedName, 'completed', messageText)
    })

    consumePattern(/❌\s*([^\s。:：,，]+?)(?:工具执行失败|执行失败|失败)/g, (match, rawName) => {
      let resolvedName = rawName?.trim() || ''
      if (!resolvedName && lastToolNameRef.current) {
        resolvedName = lastToolNameRef.current
      }
      const normalizedName = normalizeToolName(resolvedName) || lastToolNameRef.current || resolvedName || `tool-${Date.now()}`
      const messageText = match.replace(/^❌\s*/, '').trim()
      finalizeToolExecution(normalizedName, 'failed', messageText, {}, { clearState: true })
    })

    // 处理工具结果 JSON
    const jsonRegex = /{[\s\S]*?"absolutePath"[\s\S]*?}/g
    let jsonMatch: RegExpExecArray | null
    while ((jsonMatch = jsonRegex.exec(remainingText)) !== null) {
      const rawJson = jsonMatch[0]
      const parsed = processToolResultJson(rawJson)
      if (parsed && updateState) {
        const { toolName, message, details, path, lineCount } = parsed
        finalizeToolExecution(toolName, 'completed', message, {
          details,
          path,
          lineCount
        }, { clearState: true })
      }
      remainingText = remainingText.replace(rawJson, '')
      jsonRegex.lastIndex = 0
    }

    // 移除工具调用 JSON 片段
    const toolJsonRegex = /{[\s\S]*?"type"\s*:\s*"tool_use"[\s\S]*?}/g
    remainingText = remainingText.replace(toolJsonRegex, '')

    return remainingText
  }, [
    addToolStatusEntry,
    normalizeToolName,
    processToolResultJson,
    setToolProgressSubtitle,
    setToolProgressTitle,
    setShowToolExecutionPanel,
    upsertToolExecution
  ])

  // TODO 面板是否展开
  const [showTodos, setShowTodos] = useState<boolean>(false)

  // 键盘快捷键：Ctrl+T 切换 TODO 面板
  useTodoShortcuts({
    onToggleTodos: () => setShowTodos(v => !v)
  })

  // 🚀 键盘快捷键：Ctrl+P 切换文本选择模式
  useModeShortcuts({
    onModeCycle: () => setTextSelectionMode(v => {
      debugLog(`📋 文本选择模式: ${v ? '关闭' : '开启'}`)
      return !v
    })
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
      logError('处理 Plan 模式确认失败:', error)
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
    debugLog('🔄 模式切换开始:', {
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
                logWarn('Plan模式退出被拒绝，但允许强制切换')
                // 直接设置应用层状态为非Plan模式
                const planManager = writeFlowApp.getPlanModeManager()
                if (planManager) {
                  planManager.reset() // 强制重置Plan模式
                }
              }
            } else {
              // 没有计划内容，直接强制退出
              debugLog('没有计划内容，强制退出Plan模式')
              const planManager = writeFlowApp.getPlanModeManager()
              if (planManager) {
                planManager.reset()
              }
            }
          } catch (error) {
            logError('退出Plan模式异常，强制重置:', error)
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
      debugLog(`🔄 模式切换: ${currentMode} → ${nextMode}`)
      
    } catch (error) {
      logError('模式切换失败:', error)
      
      // 状态恢复逻辑：确保UI状态与应用层一致
      const actualPlanMode = writeFlowApp.isInPlanMode()
      if (actualPlanMode) {
        setCurrentMode(PlanMode.Plan)
      } else {
        setCurrentMode(PlanMode.Default)
        setPlanModeStartTime(0)
      }
      
      // 通知用户
      logWarn('模式切换失败，已恢复到正确状态')
    }
  }, [currentMode, isThinking, writeFlowApp, pendingPlan])

  // 键盘快捷键：Shift+Tab 切换模式，ESC 退出 Plan 模式
  useModeShortcuts({
    onModeCycle: handleModeCycle,
    onExitPlanMode: currentMode === PlanMode.Plan ? async () => {
      try {
        debugLog('ESC键强制退出Plan模式')
        
        // 直接强制重置，不管是否有计划内容
        const planManager = writeFlowApp.getPlanModeManager()
        if (planManager) {
          planManager.reset()
        }
        
        // 强制更新UI状态
        setCurrentMode(PlanMode.Default)
        setPlanModeStartTime(0)
        
        debugLog('Plan模式已强制退出')
      } catch (error) {
        logError('ESC强制退出失败:', error)
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
      debugLog('🔍 TODO Manager:', todoManager ? 'found' : 'not found')
      if (todoManager) {
        const todosData = await (todoManager.getAllTodos?.() || todoManager.getTodos?.() || [])
        const list = Array.isArray(todosData) ? todosData : []
        debugLog('📝 TODOs loaded:', list.length, 'items')
        setTodos(list)
        updateTodoStats(list)
        setShowTodos(prev => prev || list.length > 0)
      } else {
        // 兜底：直接用共享会话ID创建一个 TodoManager 读取
        try {
          const { TodoManager } = await import('../tools/TodoManager.js')
          const manager = new TodoManager(process.env.WRITEFLOW_SESSION_ID)
          const list = await manager.getAllTodos()
          debugLog('📝 Fallback TODOs loaded:', list.length, 'items')
          setTodos(list)
          updateTodoStats(list)
          setShowTodos(prev => prev || list.length > 0)
        } catch (e) {
          debugLog('📝 TODO Manager 未找到，使用空数组')
          setTodos([])
        }
      }
    } catch (error) {
      logWarn('获取 TODOs 失败:', error)
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
    debugLog('🚀 WriteFlowREPL 组件初始化')
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
        debugLog('💭 AI 思考:', thinkingText)
      }
    }

    const handlePlanModeChanged = (data: { isActive: boolean; approved?: boolean; reminders?: any[] }) => {
      debugLog('🔄 Plan mode changed:', data)
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
      debugLog('📋 Exit plan mode requested with plan length:', plan.length)
      setPendingPlan(plan)
      setShowPlanConfirmation(true)
    }

    const handlePermissionRequest = (request: any) => {
      debugLog('🔐 收到权限请求:', request)
      setToolUseConfirm({
        toolName: request.toolName,
        filePath: request.filePath,
        description: request.description,
        onAllow: (type: 'temporary' | 'session') => {
          const decision = type === 'session' ? 'allow-session' : 'allow'
          writeFlowApp.handlePermissionResponse(request.id, decision)
          setToolUseConfirm(null)
        },
        onDeny: () => {
          writeFlowApp.handlePermissionResponse(request.id, 'deny')
          setToolUseConfirm(null)
        }
      })
    }

    writeFlowApp.on('launch-model-config', handleLaunchModelConfig)
    writeFlowApp.on('ai-thinking', handleThinking)
    writeFlowApp.on('plan-mode-changed', handlePlanModeChanged)
    writeFlowApp.on('exit-plan-mode', handleExitPlanMode)
    writeFlowApp.on('permission-request', handlePermissionRequest)

    return () => {
      writeFlowApp.off('launch-model-config', handleLaunchModelConfig)
      writeFlowApp.off('ai-thinking', handleThinking)
      writeFlowApp.off('plan-mode-changed', handlePlanModeChanged)
      writeFlowApp.off('exit-plan-mode', handleExitPlanMode)
      writeFlowApp.off('permission-request', handlePermissionRequest)
    }
  }, [writeFlowApp])

  // 移除状态监控，避免干扰消息渲染
  
  // 🚀 优化节流处理器 - 平衡性能与文本复制体验
  const createThrottledTokenHandler = useCallback(() => {
    // 🎯 防闪烁配置 - 减少更新频率以支持文本复制
    const THROTTLE_INTERVAL = 150 // 降低到150ms，支持流畅文本选择
    const BATCH_SIZE_THRESHOLD = 80 // 增加批量大小，减少更新次数
    
    // 🚀 性能优化：使用数组拼接替代字符串拼接
    const textChunks: string[] = []
    let updateTimer: NodeJS.Timeout | null = null
    let lastUpdateTime = 0
    
    const performUpdate = () => {
      if (updateTimer) {
        clearTimeout(updateTimer)
        updateTimer = null
      }
      
      // 🚀 性能监控：检测处理时间
      const startTime = performance.now()
      
      // 🔧 简化内容过滤 - 只过滤必要的系统消息  
      let displayText = textChunks.join('')
      
      // 🚨 断路器：内容过长时启用降级模式
      if (displayText.length > 50000) {
        displayText = `${displayText.slice(-30000)}\n\n... [内容过长，已截取最后30000字符]`
      }
      
      // 🚀 Kode架构：基于消息类型的智能过滤，完全消除JSON泄露
      // 检测并过滤所有原始JSON工具调用数据
      if (displayText.includes('{"type":"tool_use"') || 
          displayText.includes('{"id":"call_') || 
          displayText.includes('"todos":[') ||
          /\{\s*"type"\s*:\s*"tool_use"/g.test(displayText)) {
        
        debugLog(`🔍 [UI过滤] 检测到JSON工具调用数据，执行Kode风格过滤...`)
        
        // 🌟 Kode风格：激进过滤策略 - 宁可过度过滤也不能泄露技术细节
        displayText = displayText
          .split('\n')
          .filter(line => {
            const trimmed = line.trim()
            
            // 过滤所有JSON格式的工具调用
            const isJsonToolCall = (
              trimmed.startsWith('{"type":"tool_use"') ||
              trimmed.startsWith('{"id":"call_') ||
              trimmed.startsWith('{"todos":') ||
              trimmed.startsWith('{"name":"todo_') ||
              (trimmed.startsWith('{') && trimmed.includes('"type":"tool_use"')) ||
              (trimmed.startsWith('{') && trimmed.includes('"id":"call_')) ||
              // 过滤JSON片段
              /^\s*["{[].*("type"|"id"|"todos"|"input").*["}]\s*$/.test(trimmed) ||
              // 过滤明显的工具调用JSON结构
              /call_\w+/.test(trimmed) && trimmed.includes('{')
            )
            
            if (isJsonToolCall) {
              debugLog(`🔍 [UI过滤] 过滤JSON行:`, trimmed.substring(0, 100) + '...')
              return false
            }
            
            return true
          })
          .join('\n')
          .trim()
          
        debugLog(`✅ [UI过滤] JSON过滤完成，内容长度: ${displayText.length}`)
      }
      
      // 📦 高效状态更新
      if (displayText) {
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          
          if (!isAssistantMessage(lastMessage)) {
            return prev
          }
          
          const currentContent = lastMessage.message.content?.[0]
          const currentText = (currentContent && isTextBlock(currentContent)) ? currentContent.text : ''
          
          // 只在内容真正改变时更新
          if (currentText === displayText) {
            return prev
          }
          
          // 高效更新最后一条消息
          const updatedMessages = [...prev]
          updatedMessages[prev.length - 1] = {
            ...lastMessage,
            message: {
              ...lastMessage.message,
              content: [createTextBlock(displayText)]
            }
          }
          
          // 消息窗口化管理
          if (updatedMessages.length > MAX_MESSAGES) {
            return updatedMessages.slice(-MAX_MESSAGES)
          }
          
          return updatedMessages
        })
        
        // 🚀 性能监控：记录处理耗时
        const processingTime = Date.now() - startTime
        if (processingTime > 20) {
          logWarn(`⚠️ UI更新耗时: ${processingTime}ms, 内容长度: ${displayText.length}`)
        }
      }
    }
    
    return (chunk: string) => {
      if (!chunk) return

      let filteredChunk = processToolProgressText(chunk, true)
      if (!filteredChunk.trim() && chunk.trim()) {
        filteredChunk = chunk
      }

      // 🚀 防闪烁优化：忽略空内容和重复内容
      if (!filteredChunk || filteredChunk.trim() === '') return
      
      // 🎯 文本选择模式下暂停更新，避免干扰复制操作
      if (textSelectionMode) {
        debugLog('📋 文本选择模式激活，暂停流式更新')
        return
      }
      
      textChunks.push(filteredChunk)
      
      // 🎯 智能批量更新策略
      const now = Date.now()
      const totalLength = textChunks.reduce((sum, c) => sum + c.length, 0)
      const shouldForceUpdate = totalLength >= BATCH_SIZE_THRESHOLD
      const shouldTimeUpdate = now - lastUpdateTime >= THROTTLE_INTERVAL
      
      if (shouldForceUpdate || shouldTimeUpdate) {
        lastUpdateTime = now
        performUpdate()
      } else {
        // 🚀 防闪烁：延迟最终更新，避免高频调用
        if (updateTimer) clearTimeout(updateTimer)
        updateTimer = setTimeout(() => {
          if (textChunks.length > 0) {
            performUpdate()
          }
        }, THROTTLE_INTERVAL)
      }
    }
  }, [processToolProgressText, setMessages, textSelectionMode])

  // 处理消息提交
  const handleSubmit = useCallback(async (message: string) => {
    if (!message.trim()) return

    // 🚀 添加用户消息并实现窗口化
    const userMessage = createUserMessage(message.trim())
    setMessages(prev => {
      const newMessages = [...prev, userMessage]
      // 消息窗口化：超出限制时自动清理
      if (newMessages.length > MAX_MESSAGES) {
        debugLog(`🧹 [消息清理] 用户消息导致超限，清理${newMessages.length - MAX_MESSAGES}条最早消息`)
        return newMessages.slice(-MAX_MESSAGES)
      }
      return newMessages
    })
    setInput('')
    setIsThinking(true)
    resetToolExecutionState()

    try {
      const trimmedMessage = message.trim()
      
      // 🔧 检测 slash command
      if (trimmedMessage.startsWith('/')) {
        try {
          // 执行 slash command
          const commandResult = await writeFlowApp.executeCommand(trimmedMessage)
          
          // 添加命令结果消息
          const commandResultMessage = createAssistantMessage([
            createTextBlock(commandResult)
          ])
          setMessages(prev => [...prev, commandResultMessage])
          
          return // 早期返回，不继续处理为自由文本
        } catch (error) {
          // 如果命令执行失败，添加错误消息
          const errorMessage = createAssistantMessage([
            createTextBlock(`命令执行失败: ${error instanceof Error ? error.message : '未知错误'}`)
          ])
          setMessages(prev => [...prev, errorMessage])
          return
        }
      }
      
      // 🚀 预创建流式助手消息并实现窗口化
      let streamingMessage = createAssistantMessage([])
      setMessages(prev => {
        const newMessages = [...prev, streamingMessage]
        // 消息窗口化：超出限制时自动清理
        if (newMessages.length > MAX_MESSAGES) {
          debugLog(`🧹 [消息清理] 流式消息导致超限，清理${newMessages.length - MAX_MESSAGES}条最早消息`)
          return newMessages.slice(-MAX_MESSAGES)
        }
        return newMessages
      })
      
      // 设置流式状态
      setStreamingMessageId(streamingMessage.uuid)
      
      // 🚀 使用优化的节流token处理器
      let pendingTodoUpdate: any = null // TODO更新状态
      const onToken = createThrottledTokenHandler()

      // 调用 WriteFlowApp 的 handleFreeTextInput 方法
      const finalText = await writeFlowApp.handleFreeTextInput(trimmedMessage, {
        onToken
      })
      
      // 🚀 智能处理最终文本，强化markdown格式保护
      if (finalText && finalText.trim()) {
        let sanitizedFinalText = processToolProgressText(finalText, false)
        if (!sanitizedFinalText.trim()) {
          sanitizedFinalText = finalText
        }
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (!isAssistantMessage(last)) {
            return prev // 不是助手消息，无需更新
          }
          
          const currentContent = last.message.content?.[0]
          const currentText = (currentContent && isTextBlock(currentContent)) ? currentContent.text : ''
          
          // 检查当前内容是否需要更新
          const shouldUpdate = !currentText || 
                              currentText.trim() === '' ||
                              currentText.includes('思考中...') ||
                              currentText.includes('正在处理...')
            
            // 应用与onToken相同的过滤逻辑，确保一致性
            const lines = sanitizedFinalText.split('\n')
            const filteredLines: string[] = []
            let skippingJsonBlock = false
            
            for (const line of lines) {
              const trimmed = line.trim()

              if (!skippingJsonBlock && trimmed.startsWith('{') && (
                trimmed.includes('"absolutePath"') ||
                trimmed.includes('"contentPreview"') ||
                trimmed.includes('"relativePath"') ||
                trimmed.includes('"totalLines"')
              )) {
                skippingJsonBlock = true
                if (trimmed.endsWith('}')) {
                  skippingJsonBlock = false
                }
                continue
              }

              if (skippingJsonBlock) {
                if (trimmed.endsWith('}')) {
                  skippingJsonBlock = false
                }
                continue
              }
              
              // 🛡️ 跳过所有工具调用JSON行 - 与onToken过滤逻辑保持一致
              if (trimmed.startsWith('{') && (
                trimmed.includes('"todos"') ||
                trimmed.includes('"type":"tool_use"') ||
                trimmed.includes('"id":"call_') ||
                trimmed.includes('"name":"todo_')
              ) && trimmed.endsWith('}')) {
                try {
                  const jsonData = JSON.parse(trimmed)
                  if (jsonData.todos && Array.isArray(jsonData.todos)) {
                    continue // 跳过TODO JSON行
                  }
                  if (jsonData.type === 'tool_use') {
                    debugLog(`🛡️ [最终清理] 过滤tool_use JSON`)
                    continue // 跳过tool_use JSON行
                  }
                } catch (e) {
                  // JSON解析失败，保留原始内容
                }
              }
              
              // 🛡️ 额外保护：检测不完整的工具调用JSON模式
              if (trimmed.includes('{"type":"tool_use"') || trimmed.includes('"id":"call_')) {
                debugLog(`🛡️ [最终清理] 过滤不完整的工具调用JSON`)
                continue
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
          
          // 🎯 关键优化：只有内容真正改变时才更新
          if (!shouldUpdate || !cleanedText || currentText === cleanedText) {
            return prev // 避免不必要的重新渲染
          }
          
          // 🚀 优化最终文本日志：仅在调试模式下输出
          if (process.env.WRITEFLOW_DEBUG_STREAM === 'verbose') {
            debugLog(`🎯 [最终文本] 更新内容，保护markdown格式，长度: ${cleanedText.length}`)
          }
          
          // 🔧 高效更新：只修改最后一条消息
          const updatedMessages = [...prev]
          updatedMessages[prev.length - 1] = {
            ...last,
            message: {
              ...last.message,
              content: [createTextBlock(cleanedText)]
            }
          }
          
          return updatedMessages
        })

        // 若文本包含 TODO 更新的信号，则刷新面板
        if (/Todos have been modified|任务列表已更新|"todos"\s*:\s*\[/.test(sanitizedFinalText)) {
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
          logError('处理 TODO 更新失败:', error)
        }
      }

    } catch (error) {
      logError('处理消息失败:', error)
      
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

  // debugLog('🎨 WriteFlowREPL 渲染中，todos.length:', todos.length, 'messages.length:', messages.length)
  
  // 计算动态状态文案
  const activityStatus: 'idle' | 'working' | 'executing' =
    inProgressToolUseIDs.size > 0 ? 'executing' : (isThinking ? 'working' : 'idle')

  // 运行计时（用于 working/executing 状态显示秒数）
  const [statusStart, setStatusStart] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  
  // 设置工具权限确认回调（类似 Kode 的 useCanUseTool）
  useEffect(() => {
    const orchestrator = getToolOrchestrator()
    
    // 设置权限确认回调
    orchestrator.setConfig({
      ...orchestrator.getConfig(),
      permissionRequestCallback: async (request: {
        toolName: string
        filePath: string
        description: string
      }) => {
        return new Promise<'temporary' | 'session' | 'deny'>((resolve) => {
          setToolUseConfirm({
            toolName: request.toolName,
            filePath: request.filePath,
            description: request.description,
            onAllow: (type: 'temporary' | 'session') => {
              setToolUseConfirm(null)
              resolve(type)
            },
            onDeny: () => {
              setToolUseConfirm(null)
              resolve('deny')
            }
          })
        })
      }
    })
    
    return () => {
      // 清理回调
      orchestrator.setConfig({
        ...orchestrator.getConfig(),
        permissionRequestCallback: undefined
      })
    }
  }, [])


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
    
    debugLog(`🔧 已注册并聚焦新的可折叠内容: ${contentId}`)
    debugLog(`💡 提示: 按 Ctrl+R 展开详细内容`)
  }, [registerCollapsible, setCollapsibleFocus])
  
  // 🚀 React性能优化 - 活动状态计算memo化
  const shouldShowActivity = useMemo(() => {
    return activityStatus !== 'idle' && statusStart !== null
  }, [activityStatus, statusStart])
  
  // 🚀 计算状态显示文本
  const activityDisplayText = useMemo(() => {
    if (!shouldShowActivity) return ''
    
    const baseText = activityStatus === 'working' 
      ? '🤔 AI思考中' 
      : activityStatus === 'executing' 
        ? '⚙️ 工具执行中'
        : '✨ AI生成中'
    return elapsedSeconds > 0 ? `${baseText} (${elapsedSeconds}s)` : baseText
  }, [activityStatus, shouldShowActivity, elapsedSeconds])

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
  
  const shouldShowToolPanel = showToolExecutionPanel || toolExecutions.length > 0 || toolStatusHistory.length > 0
  
  return (
    <Box flexDirection="column" width="100%" minHeight={3}>
      {/* Header */}
      <Box flexDirection="row" alignItems="center" marginBottom={1}>
        <Text color="cyan" bold>
          ✨ {PRODUCT_NAME} 
        </Text>
        <Text color={theme.success} dimColor>
          v{getVersion()}
        </Text>
        <Box marginLeft={2}>
          <Text color={theme.dimText}>
            AI 写作助手
          </Text>
        </Box>
      </Box>

      {/* 🚀 优化消息容器：移除flexGrow减少布局计算，提升性能 */}
      <Box flexDirection="column">
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
        {shouldShowToolPanel && (
          <Box flexDirection="column" marginTop={normalizedMessages.length > 0 ? 1 : 0}>
            <ToolExecutionMessage
              executions={toolExecutions}
              title={toolProgressTitle}
              progressTitle={toolProgressSubtitle}
              addMargin={normalizedMessages.length > 0}
            />
            {toolStatusHistory.map((entry, index) => (
              <ToolStatusMessage
                key={entry.id}
                toolName={entry.toolName}
                status={entry.status}
                message={entry.message}
                duration={entry.duration}
                addMargin={index !== 0}
              />
            ))}
          </Box>
        )}
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
      
      {/* 权限确认界面（类似 Kode 的 PermissionRequest） */}
      {toolUseConfirm && (
        <Box marginTop={1} marginBottom={1}>
          <PermissionRequestComponent
            toolName={toolUseConfirm.toolName}
            filePath={toolUseConfirm.filePath}
            description={toolUseConfirm.description}
            onAllow={toolUseConfirm.onAllow}
            onDeny={toolUseConfirm.onDeny}
          />
        </Box>
      )}

      {/* 🚀 文本选择模式提示 */}
      {textSelectionMode && (
        <Box marginTop={1} marginBottom={1}>
          <Text color="yellow" backgroundColor="blue">
            📋 文本选择模式已激活 - 流式更新已暂停，方便复制文本。按 Ctrl+P 退出。
          </Text>
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
        <ModelConfig
          onClose={() => setShowModelConfig(false)}
        />
      )}
    </Box>
  )
}
