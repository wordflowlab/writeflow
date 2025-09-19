/**
 * 可折叠内容键盘快捷键 Hook
 * 管理全局的可折叠内容交互逻辑
 */

import { debugLog } from './../utils/log.js'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useInput } from 'ink'
import type { 
  CollapsibleManager, 
  CollapsibleState,
  CollapsibleStateChangeEvent,
  KeyboardShortcuts,
} from '../types/CollapsibleContent.js'
import { DEFAULT_COLLAPSIBLE_OPTIONS } from '../types/CollapsibleContent.js'

interface UseCollapsibleShortcutsOptions {
  shortcuts?: Partial<KeyboardShortcuts>
  enableGlobalShortcuts?: boolean
  onStateChange?: (event: CollapsibleStateChangeEvent) => void
}

export function useCollapsibleShortcuts({
  shortcuts = DEFAULT_COLLAPSIBLE_OPTIONS.shortcuts,
  enableGlobalShortcuts = true,
  onStateChange,
}: UseCollapsibleShortcutsOptions = {}) {
  
  // 全局折叠状态管理
  const [manager, setManager] = useState<CollapsibleManager>({
    states: new Map(),
    focusedId: null,
    globalCollapsed: false,
  })
  
  // 用于追踪注册的可折叠内容
  const registeredContents = useRef<Set<string>>(new Set())
  
  // 合并默认快捷键配置
  const mergedShortcuts: KeyboardShortcuts = {
    toggle: shortcuts?.toggle || DEFAULT_COLLAPSIBLE_OPTIONS.shortcuts.toggle || 'ctrl+r',
    toggleAll: shortcuts?.toggleAll || DEFAULT_COLLAPSIBLE_OPTIONS.shortcuts.toggleAll || 'ctrl+shift+r',
    navigate: {
      next: shortcuts?.navigate?.next || DEFAULT_COLLAPSIBLE_OPTIONS.shortcuts.navigate?.next || '↓',
      prev: shortcuts?.navigate?.prev || DEFAULT_COLLAPSIBLE_OPTIONS.shortcuts.navigate?.prev || '↑',
    },
  }
  
  // 注册可折叠内容
  const registerCollapsible = useCallback((
    id: string, 
    initialState?: Partial<CollapsibleState>,
  ) => {
    const state: CollapsibleState = {
      id,
      collapsed: false,
      autoCollapse: true,
      maxLines: 15,
      focusable: true,
      ...initialState,
    }
    
    setManager(prev => ({
      ...prev,
      states: new Map(prev.states).set(id, state),
    }))
    
    registeredContents.current.add(id)
    
    return state
  }, [])
  
  // 注销可折叠内容
  const unregisterCollapsible = useCallback((id: string) => {
    setManager(prev => {
      const newStates = new Map(prev.states)
      newStates.delete(id)
      
      return {
        ...prev,
        states: newStates,
        focusedId: prev.focusedId === id ? null : prev.focusedId,
      }
    })
    
    registeredContents.current.delete(id)
  }, [])
  
  // 更新特定内容的折叠状态
  const updateCollapsibleState = useCallback((
    id: string, 
    updates: Partial<CollapsibleState>,
    trigger: CollapsibleStateChangeEvent['trigger'] = 'user',
  ) => {
    setManager(prev => {
      const currentState = prev.states.get(id)
      if (!currentState) return prev
      
      const newState = { ...currentState, ...updates }
      const newStates = new Map(prev.states).set(id, newState)
      
      // 触发状态变化事件
      if (updates.collapsed !== undefined && onStateChange) {
        const event: CollapsibleStateChangeEvent = {
          contentId: id,
          collapsed: updates.collapsed,
          contentType: 'long-text', // 默认类型，实际使用时应该传入正确的类型
          trigger,
        }
        onStateChange(event)
      }
      
      return {
        ...prev,
        states: newStates,
      }
    })
  }, [onStateChange])
  
  // 切换特定内容的折叠状态
  const toggleCollapsible = useCallback((id: string) => {
    const currentState = manager.states.get(id)
    if (currentState) {
      updateCollapsibleState(id, { 
        collapsed: !currentState.collapsed, 
      }, 'user')
    }
  }, [manager.states, updateCollapsibleState])
  
  // 设置焦点
  const setFocus = useCallback((id: string | null) => {
    setManager(prev => ({
      ...prev,
      focusedId: id,
    }))
  }, [])
  
  // 导航到下一个可折叠内容
  const navigateNext = useCallback(() => {
    const ids = Array.from(manager.states.keys())
    if (ids.length === 0) return
    
    const currentIndex = manager.focusedId 
      ? ids.indexOf(manager.focusedId)
      : -1
    
    const nextIndex = (currentIndex + 1) % ids.length
    setFocus(ids[nextIndex])
  }, [manager.states, manager.focusedId, setFocus])
  
  // 导航到上一个可折叠内容
  const navigatePrev = useCallback(() => {
    const ids = Array.from(manager.states.keys())
    if (ids.length === 0) return
    
    const currentIndex = manager.focusedId 
      ? ids.indexOf(manager.focusedId)
      : -1
    
    const prevIndex = currentIndex <= 0 
      ? ids.length - 1 
      : currentIndex - 1
    
    setFocus(ids[prevIndex])
  }, [manager.states, manager.focusedId, setFocus])
  
  // 全局切换所有内容的折叠状态
  const toggleAll = useCallback(() => {
    const newGlobalCollapsed = !manager.globalCollapsed
    
    setManager(prev => {
      const newStates = new Map()
      
      // 更新所有内容的折叠状态
      for (const [id, state] of prev.states) {
        newStates.set(id, {
          ...state,
          collapsed: newGlobalCollapsed,
        })
        
        // 触发每个内容的状态变化事件
        if (onStateChange) {
          const event: CollapsibleStateChangeEvent = {
            contentId: id,
            collapsed: newGlobalCollapsed,
            contentType: 'long-text',
            trigger: 'global',
          }
          onStateChange(event)
        }
      }
      
      return {
        ...prev,
        states: newStates,
        globalCollapsed: newGlobalCollapsed,
      }
    })
  }, [manager.globalCollapsed, onStateChange])
  
  // 键盘事件处理
  useInput((input, key) => {
    if (!enableGlobalShortcuts) return
    
    // Ctrl+R: 切换当前焦点的内容
    if (key.ctrl && input === 'r') {
      if (manager.focusedId) {
        toggleCollapsible(manager.focusedId)
      } else if (manager.states.size > 0) {
        // 如果没有焦点，自动选择最后一个内容（通常是最新的工具输出）
        const allIds = Array.from(manager.states.keys())
        const lastId = allIds[allIds.length - 1]
        setFocus(lastId)
        toggleCollapsible(lastId)
        
        // 添加调试信息
        debugLog(`🔧 自动选择并切换最后一个可折叠内容: ${lastId}`)
      }
      return
    }
    
    // Ctrl+Shift+R: 全局切换
    if (key.ctrl && key.shift && input === 'R') {
      toggleAll()
      return
    }
    
    // 方向键导航
    if (key.upArrow) {
      navigatePrev()
      return
    }
    
    if (key.downArrow) {
      navigateNext()
      return
    }
    
    // Tab 键循环焦点
    if (key.tab) {
      navigateNext()
      return
    }
    
    // Shift+Tab 反向循环焦点
    if (key.shift && key.tab) {
      navigatePrev()
      return
    }
  })
  
  // 获取当前焦点内容的状态
  const getFocusedState = useCallback(() => {
    return manager.focusedId ? manager.states.get(manager.focusedId) : null
  }, [manager.focusedId, manager.states])
  
  // 获取所有内容的统计信息
  const getStats = useCallback(() => {
    const total = manager.states.size
    const collapsed = Array.from(manager.states.values())
      .filter(state => state.collapsed).length
    const expanded = total - collapsed
    
    return {
      total,
      collapsed,
      expanded,
      globalCollapsed: manager.globalCollapsed,
      focusedId: manager.focusedId,
    }
  }, [manager])
  
  // 清理函数 - 在组件卸载时调用
  const cleanup = useCallback(() => {
    registeredContents.current.clear()
    setManager({
      states: new Map(),
      focusedId: null,
      globalCollapsed: false,
    })
  }, [])
  
  // 组件卸载时清理
  useEffect(() => {
    return cleanup
  }, [cleanup])
  
  return {
    // 状态
    manager,
    focusedId: manager.focusedId,
    globalCollapsed: manager.globalCollapsed,
    
    // 注册/注销
    registerCollapsible,
    unregisterCollapsible,
    
    // 状态操作
    updateCollapsibleState,
    toggleCollapsible,
    toggleAll,
    
    // 焦点管理
    setFocus,
    navigateNext,
    navigatePrev,
    getFocusedState,
    
    // 工具函数
    getStats,
    cleanup,
    
    // 快捷键配置
    shortcuts: mergedShortcuts,
  }
}

/**
 * 简化版 Hook - 用于单个可折叠内容
 */
export function useSimpleCollapsible(
  initialCollapsed: boolean = false,
) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  
  const toggle = useCallback(() => {
    setCollapsed(prev => !prev)
  }, [])
  
  // 监听 Ctrl+R
  useInput((input, key) => {
    if (key.ctrl && input === 'r') {
      toggle()
    }
  })
  
  return {
    collapsed,
    toggle,
    setCollapsed,
  }
}

/**
 * 用于管理单个内容焦点的 Hook
 */
export function useCollapsibleFocus(
  id: string,
  onFocusChange?: (focused: boolean) => void,
) {
  const [focused, setFocused] = useState(false)
  
  const focus = useCallback(() => {
    setFocused(true)
    onFocusChange?.(true)
  }, [onFocusChange])
  
  const blur = useCallback(() => {
    setFocused(false)
    onFocusChange?.(false)
  }, [onFocusChange])
  
  // 监听 Enter 键获取焦点，Escape 键失去焦点
  useInput((input, key) => {
    if (key.return) {
      focus()
    } else if (key.escape) {
      blur()
    }
  })
  
  return {
    focused,
    focus,
    blur,
  }
}