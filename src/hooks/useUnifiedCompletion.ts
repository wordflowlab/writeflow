/**
 * 统一补全 Hook
 * 管理命令补全的状态和交互逻辑
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useInput } from 'ink'
import { SlashCommand } from '../types/command.js'
import { commandRegistry, CommandSuggestion } from '../utils/commandRegistry.js'

export interface CompletionState {
  suggestions: CommandSuggestion[]
  selectedIndex: number
  isActive: boolean
  context: CompletionContext | null
  preview: {
    isActive: boolean
    originalInput: string
    wordRange: [number, number]
  } | null
}

export interface CompletionContext {
  type: 'command' | 'subcommand'
  prefix: string
  commandName?: string
  startPos: number
  endPos: number
}

interface UseUnifiedCompletionProps {
  input: string
  cursorOffset: number
  onInputChange: (value: string) => void
  setCursorOffset: (offset: number) => void
  commands: SlashCommand[]
  onSubmit?: (value: string) => void
  enabled?: boolean
}

const INITIAL_STATE: CompletionState = {
  suggestions: [],
  selectedIndex: 0,
  isActive: false,
  context: null,
  preview: null,
}

export function useUnifiedCompletion({
  input,
  cursorOffset,
  onInputChange,
  setCursorOffset,
  commands,
  onSubmit,
  enabled = true,
}: UseUnifiedCompletionProps) {
  const [state, setState] = useState<CompletionState>(INITIAL_STATE)
  const lastInputRef = useRef('')
  const suppressUntilRef = useRef(0)

  // 注册命令到注册表
  useEffect(() => {
    commandRegistry.clear()
    commandRegistry.registerCommands(commands)
  }, [commands])

  // 状态更新辅助函数
  const updateState = useCallback((updates: Partial<CompletionState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // 重置补全
  const resetCompletion = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: [],
      selectedIndex: 0,
      isActive: false,
      context: null,
      preview: null,
    }))
  }, [])

  // 激活补全
  const activateCompletion = useCallback((suggestions: CommandSuggestion[], context: CompletionContext) => {
    setState(prev => ({
      ...prev,
      suggestions,
      selectedIndex: 0,
      isActive: true,
      context,
      preview: null,
    }))
  }, [])

  // 检测光标处的词
  const getWordAtCursor = useCallback((): CompletionContext | null => {
    if (!input || !enabled) return null
    
    // 只匹配光标前的内容
    let start = cursorOffset
    
    // 向后移动找到词的开始
    while (start > 0) {
      const char = input[start - 1]
      // 在空格处停止
      if (/\s/.test(char)) break
      
      // 对于斜杠命令
      if (char === '/') {
        start--
        break
      }
      
      start--
    }
    
    // 从开始到光标位置的词
    const word = input.slice(start, cursorOffset)
    if (!word) return null
    
    // 检测命令类型
    if (word.startsWith('/')) {
      const commandPart = word.slice(1)
      const spaceIndex = commandPart.indexOf(' ')
      
      if (spaceIndex === -1) {
        // 主命令补全
        return {
          type: 'command',
          prefix: commandPart,
          startPos: start,
          endPos: cursorOffset,
        }
      } else {
        // 子命令补全
        const commandName = commandPart.slice(0, spaceIndex)
        const subPrefix = commandPart.slice(spaceIndex + 1)
        return {
          type: 'subcommand',
          prefix: subPrefix,
          commandName,
          startPos: start + spaceIndex + 2, // +2 for '/' and space
          endPos: cursorOffset,
        }
      }
    }
    
    return null
  }, [input, cursorOffset, enabled])

  // 生成命令建议
  const generateCommandSuggestions = useCallback((prefix: string): CommandSuggestion[] => {
    return commandRegistry.searchCommands(prefix, 10)
  }, [])

  // 生成子命令建议
  const generateSubcommandSuggestions = useCallback((commandName: string, prefix: string): CommandSuggestion[] => {
    const subcommands = commandRegistry.getSubcommandSuggestions(commandName, prefix)
    const command = commandRegistry.getCommand(commandName)
    
    if (!command) return []
    
    return subcommands.map(sub => ({
      command,
      score: 100,
      algorithm: 'subcommand',
      displayValue: `${sub}`,
      value: sub,
    }))
  }, [])

  // 生成所有建议
  const generateSuggestions = useCallback((context: CompletionContext): CommandSuggestion[] => {
    if (context.type === 'command') {
      return generateCommandSuggestions(context.prefix)
    } else if (context.type === 'subcommand' && context.commandName) {
      return generateSubcommandSuggestions(context.commandName, context.prefix)
    }
    return []
  }, [generateCommandSuggestions, generateSubcommandSuggestions])

  // 应用补全
  const completeWith = useCallback((suggestion: CommandSuggestion, context: CompletionContext) => {
    let completion: string
    
    if (context.type === 'command') {
      completion = `/${suggestion.value} `
    } else {
      completion = `${suggestion.value  } `
    }
    
    const newInput = input.slice(0, context.startPos) + completion + input.slice(context.endPos)
    onInputChange(newInput)
    setCursorOffset(context.startPos + completion.length)
    resetCompletion()
  }, [input, onInputChange, setCursorOffset, resetCompletion])

  // 处理 Tab 键
  useInput((_, key) => {
    if (!enabled || !key.tab || key.shift) return false
    
    const context = getWordAtCursor()
    if (!context) return false
    
    // 如果菜单已显示，循环选择
    if (state.isActive && state.suggestions.length > 0) {
      const nextIndex = (state.selectedIndex + 1) % state.suggestions.length
      updateState({ selectedIndex: nextIndex })
      return true
    }
    
    // 生成新建议
    const suggestions = generateSuggestions(context)
    
    if (suggestions.length === 0) {
      return false
    } else if (suggestions.length === 1) {
      // 单个匹配：立即完成
      completeWith(suggestions[0], context)
      return true
    } else {
      // 显示菜单
      activateCompletion(suggestions, context)
      return true
    }
  })

  // 处理方向键和确认键
  useInput((_, key) => {
    if (!enabled || !state.isActive || state.suggestions.length === 0) return false
    
    // Enter 键 - 确认选择
    if (key.return) {
      const selectedSuggestion = state.suggestions[state.selectedIndex]
      if (selectedSuggestion && state.context) {
        completeWith(selectedSuggestion, state.context)
      }
      return true
    }
    
    // 上方向键
    if (key.upArrow) {
      const nextIndex = state.selectedIndex === 0 
        ? state.suggestions.length - 1 
        : state.selectedIndex - 1
      updateState({ selectedIndex: nextIndex })
      return true
    }
    
    // 下方向键
    if (key.downArrow) {
      const nextIndex = (state.selectedIndex + 1) % state.suggestions.length
      updateState({ selectedIndex: nextIndex })
      return true
    }
    
    // Esc 键 - 取消补全
    if (key.escape) {
      resetCompletion()
      return true
    }
    
    return false
  })

  // 处理删除键
  useInput((_, key) => {
    if (key.backspace || key.delete) {
      if (state.isActive) {
        resetCompletion()
        // 短暂抑制以避免立即重新触发
        suppressUntilRef.current = Date.now() + 200
        return true
      }
    }
    return false
  })

  // 自动触发补全
  useEffect(() => {
    // 避免无限循环
    if (lastInputRef.current === input) return
    lastInputRef.current = input
    
    // 如果在抑制期内，跳过
    if (Date.now() < suppressUntilRef.current) {
      return
    }
    
    const context = getWordAtCursor()
    
    if (context && context.type === 'command' && context.prefix.length >= 0) {
      const suggestions = generateSuggestions(context)
      
      if (suggestions.length === 0) {
        resetCompletion()
      } else if (suggestions.length === 1 && context.prefix === suggestions[0].value) {
        // 完全匹配，隐藏
        resetCompletion()
      } else {
        activateCompletion(suggestions, context)
      }
    } else if (state.context) {
      // 上下文发生重大变化
      const contextChanged = !context ||
        state.context.type !== context.type ||
        state.context.startPos !== context.startPos
      
      if (contextChanged) {
        resetCompletion()
      }
    }
  }, [input, cursorOffset, enabled, getWordAtCursor, generateSuggestions, activateCompletion, resetCompletion, state.context])

  return {
    suggestions: state.suggestions,
    selectedIndex: state.selectedIndex,
    isActive: state.isActive,
    context: state.context,
  }
}