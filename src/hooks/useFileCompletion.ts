/**
 * 文件补全 Hook
 * 专门处理 @ 文件引用的自动补全功能
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useInput } from 'ink'
import { fileCompletionService, type FileCompletionItem } from '../services/FileCompletionService.js'
import { debugLog } from '../utils/log.js'

export interface FileCompletionState {
  /** 补全建议列表 */
  suggestions: FileCompletionItem[]
  /** 当前选中的索引 */
  selectedIndex: number
  /** 是否激活补全 */
  isActive: boolean
  /** 当前查询上下文 */
  context: FileCompletionContext | null
  /** 是否正在加载 */
  isLoading: boolean
}

export interface FileCompletionContext {
  /** 查询字符串 */
  query: string
  /** @ 符号在输入中的位置 */
  atPosition: number
  /** 查询部分的结束位置 */
  endPosition: number
}

interface UseFileCompletionProps {
  /** 当前输入值 */
  input: string
  /** 光标位置 */
  cursorOffset: number
  /** 输入变化回调 */
  onInputChange: (value: string) => void
  /** 光标位置变化回调 */
  setCursorOffset: (offset: number) => void
  /** 是否启用文件补全 */
  enabled?: boolean
}

const INITIAL_STATE: FileCompletionState = {
  suggestions: [],
  selectedIndex: 0,
  isActive: false, context: null,
  isLoading: false,
}

export function useFileCompletion({
  input,
  cursorOffset,
  onInputChange,
  setCursorOffset,
  enabled = true,
}: UseFileCompletionProps) {
  const [state, setState] = useState<FileCompletionState>(INITIAL_STATE)
  const loadingRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  
  /**
   * 检测当前光标位置是否在文件引用上下文中
   */
  const detectFileContext = useCallback((text: string, cursor: number): FileCompletionContext | null => {
    if (!enabled) return null
    
    // 向前查找最近的 @ 符号
    let atPosition = -1
    for (let i = cursor - 1; i >= 0; i--) {
      if (text[i] === '@') {
        atPosition = i
        break
      }
      // 如果遇到空格或换行，停止搜索
      if (text[i] === ' ' || text[i] === '\\n' || text[i] === '\\t') {
        break
      }
    }
    
    if (atPosition === -1) return null
    
    // 向前查找查询结束位置
    let endPosition = cursor
    for (let i = cursor; i < text.length; i++) {
      if (text[i] === ' ' || text[i] === '\\n' || text[i] === '\\t') {
        endPosition = i
        break
      }
      if (i === text.length - 1) {
        endPosition = text.length
        break
      }
    }
    
    const query = text.slice(atPosition + 1, endPosition)
    
    return {
      query,
      atPosition,
      endPosition,
    }
  }, [enabled])
  
  /**
   * 更新补全建议
   */
  const updateSuggestions = useCallback(async (context: FileCompletionContext) => {
    if (!enabled) return
    
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const suggestions = await fileCompletionService.getCompletions(context.query, {
        maxResults: 10,
        searchMode: 'fuzzy',
      })
      
      setState(prev => ({
        ...prev,
        suggestions,
        selectedIndex: 0,
        isLoading: false,
        isActive: suggestions.length > 0,
      }))
      
    } catch (_error) {
      debugLog(`文件补全失败: ${_error}`)
      setState(prev => ({
        ...prev,
        suggestions: [],
        selectedIndex: 0,
        isLoading: false,
        isActive: false,
      }))
    }
  }, [enabled])
  
  /**
   * 应用选中的补全
   */
  const applyCompletion = useCallback((item: FileCompletionItem) => {
    if (!state.context) return
    
    const { atPosition, endPosition } = state.context
    const beforeAt = input.slice(0, atPosition)
    const afterQuery = input.slice(endPosition)
    
    // 构建新的输入值
    const completionText = item.type === 'directory' ? `${item.name}/` : item.name
    const newInput = `${beforeAt}@${completionText}${afterQuery}`
    
    // 计算新的光标位置
    const newCursorOffset = atPosition + 1 + completionText.length
    
    onInputChange(newInput)
    setCursorOffset(newCursorOffset)
    
    // 关闭补全
    setState(INITIAL_STATE)
  }, [input, state.context, onInputChange, setCursorOffset])
  
  /**
   * 关闭补全
   */
  const closeCompletion = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])
  
  /**
   * 导航补全列表
   */
  const navigateCompletion = useCallback((direction: 'up' | 'down') => {
    setState(prev => {
      if (!prev.isActive || prev.suggestions.length === 0) return prev
      
      let newIndex: number
      if (direction === 'up') {
        newIndex = prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.suggestions.length - 1
      } else {
        newIndex = prev.selectedIndex < prev.suggestions.length - 1 ? prev.selectedIndex + 1 : 0
      }
      
      return { ...prev, selectedIndex: newIndex }
    })
  }, [])
  
  /**
   * 应用当前选中的补全
   */
  const applySelectedCompletion = useCallback(() => {
    if (state.isActive && state.suggestions.length > 0) {
      const selectedItem = state.suggestions[state.selectedIndex]
      if (selectedItem) {
        applyCompletion(selectedItem)
        return true
      }
    }
    return false
  }, [state.isActive, state.suggestions, state.selectedIndex, applyCompletion])
  
  // 监听输入和光标位置变化
  useEffect(() => {
    const context = detectFileContext(input, cursorOffset)
    
    if (context) {
      setState(prev => ({ ...prev, context }))
      
      // 防抖加载建议
      if (loadingRef.current) {
        clearTimeout(loadingRef.current)
      }
      
      loadingRef.current = setTimeout(() => {
        updateSuggestions(context)
      }, 200)
      
    } else {
      // 没有检测到文件上下文，关闭补全
      setState(INITIAL_STATE)
    }
    
    return () => {
      if (loadingRef.current) {
        clearTimeout(loadingRef.current)
      }
    }
  }, [input, cursorOffset, detectFileContext, updateSuggestions])
  
  // 键盘事件处理
  useInput((input, key) => {
    if (!state.isActive) return
    
    if ((key as any).upArrow) {
      navigateCompletion('up')
    } else if ((key as any).downArrow) {
      navigateCompletion('down')
    } else if (key.tab || (key as any).return) {
      applySelectedCompletion()
    } else if ((key as any).escape) {
      closeCompletion()
    }
  })
  
  return {
    state,
    applyCompletion,
    closeCompletion,
    navigateCompletion,
    applySelectedCompletion,
  }
}