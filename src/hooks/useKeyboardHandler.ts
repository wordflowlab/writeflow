/**
 * 键盘交互管理 Hook - 集中处理折叠相关的键盘事件
 * 采用现代化的键盘交互模式
 */

import { useInput } from 'ink'
import { useState, useCallback, useRef, useEffect } from 'react'

export interface KeyboardConfig {
  /**
   * 是否启用键盘交互
   */
  enabled?: boolean
  
  /**
   * 切换折叠的快捷键 (默认 Ctrl+R)
   */
  toggleKey?: string
  
  /**
   * 全局切换的快捷键 (默认 Ctrl+Shift+R)
   */
  globalToggleKey?: string
  
  /**
   * 聚焦时长 (毫秒，默认 2000)
   */
  focusDuration?: number
}

export interface KeyboardState {
  /**
   * 当前是否折叠
   */
  isCollapsed: boolean
  
  /**
   * 是否聚焦
   */
  isFocused: boolean
  
  /**
   * 全局折叠状态
   */
  globalCollapsed: boolean | null
  
  /**
   * 切换折叠状态
   */
  toggleCollapse: () => void
  
  /**
   * 设置聚焦状态
   */
  setFocused: (focused: boolean) => void
  
  /**
   * 全局切换折叠
   */
  toggleGlobalCollapse: () => void
}

/**
 * 单个可折叠元素的键盘处理
 */
export function useCollapsibleKeyboard(
  initialCollapsed: boolean = false,
  onToggle?: (collapsed: boolean) => void,
  config: KeyboardConfig = {},
): KeyboardState {
  const {
    enabled = true,
    toggleKey = 'r',
    focusDuration = 2000,
  } = config
  
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const [isFocused, setIsFocused] = useState(false)
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | null>(null)
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // 切换折叠状态
  const toggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed
    setIsCollapsed(newCollapsed)
    onToggle?.(newCollapsed)
  }, [isCollapsed, onToggle])
  
  // 设置聚焦状态
  const setFocused = useCallback((focused: boolean) => {
    setIsFocused(focused)
    
    // 清除之前的定时器
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current)
    }
    
    // 如果聚焦，设置自动取消聚焦
    if (focused && focusDuration > 0) {
      focusTimeoutRef.current = setTimeout(() => {
        setIsFocused(false)
      }, focusDuration)
    }
  }, [focusDuration])
  
  // 全局切换折叠
  const toggleGlobalCollapse = useCallback(() => {
    setGlobalCollapsed(prev => prev === null ? true : !prev)
  }, [])
  
  // 键盘事件处理
  useInput((input, key) => {
    if (!enabled) return
    
    // Ctrl+R 切换当前元素折叠状态
    if ((key as any).ctrl && !(key as any).shift && input.toLowerCase() === toggleKey) {
      toggleCollapse()
      setFocused(true)
      return
    }
    
    // Ctrl+Shift+R 全局切换
    if ((key as any).ctrl && (key as any).shift && input.toLowerCase() === toggleKey) {
      toggleGlobalCollapse()
      return
    }
    
    // 方向键聚焦
    if ((key as any).upArrow || (key as any).downArrow) {
      setFocused(true)
    }
  })
  
  // 全局状态影响本地状态
  useEffect(() => {
    if (globalCollapsed !== null) {
      setIsCollapsed(globalCollapsed)
      onToggle?.(globalCollapsed)
    }
  }, [globalCollapsed, onToggle])
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current)
      }
    }
  }, [])
  
  return {
    isCollapsed,
    isFocused,
    globalCollapsed,
    toggleCollapse,
    setFocused,
    toggleGlobalCollapse,
  }
}

/**
 * 全局键盘处理器 - 管理多个折叠元素
 */
export function useGlobalKeyboardHandler(config: KeyboardConfig = {}) {
  const {
    enabled = true,
    globalToggleKey = 'r',
  } = config
  
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | null>(null)
  const [registeredElements] = useState(new Set<string>())
  
  // 注册可折叠元素
  const registerElement = useCallback((id: string) => {
    registeredElements.add(id)
    return () => registeredElements.delete(id)
  }, [registeredElements])
  
  // 全局键盘事件处理
  useInput((input, key) => {
    if (!enabled) return
    
    // Ctrl+Shift+R 全局切换所有元素
    if ((key as any).ctrl && (key as any).shift && input.toLowerCase() === globalToggleKey) {
      setGlobalCollapsed(prev => prev === null ? true : !prev)
    }
  })
  
  return {
    globalCollapsed,
    setGlobalCollapsed,
    registerElement,
    elementCount: registeredElements.size,
  }
}

/**
 * 快捷键映射
 */
export const KEYBOARD_SHORTCUTS = {
  TOGGLE_COLLAPSE: 'Ctrl+R',
  GLOBAL_TOGGLE: 'Ctrl+Shift+R',
  FOCUS_UP: '↑',
  FOCUS_DOWN: '↓',
  EXPAND_ALL: 'Ctrl+Shift+E',
  COLLAPSE_ALL: 'Ctrl+Shift+C',
} as const

/**
 * 键盘提示生成器
 */
export function generateKeyboardHints(
  isCollapsed: boolean,
  isFocused: boolean = false,
  showGlobal: boolean = false,
): string[] {
  const hints: string[] = []
  
  if (isFocused) {
    hints.push(
      isCollapsed 
        ? `${KEYBOARD_SHORTCUTS.TOGGLE_COLLAPSE} 展开`
        : `${KEYBOARD_SHORTCUTS.TOGGLE_COLLAPSE} 折叠`,
    )
    
    if (showGlobal) {
      hints.push(`${KEYBOARD_SHORTCUTS.GLOBAL_TOGGLE} 全局切换`)
    }
  }
  
  return hints
}

/**
 * 键盘事件调试器
 */
export function useKeyboardDebugger(enabled: boolean = false) {
  const [lastKey, setLastKey] = useState<string>('')
  
  useInput((input, key) => {
    if (!enabled) return
    
    const keyInfo = []
    if ((key as any).ctrl) keyInfo.push('Ctrl')
    if ((key as any).shift) keyInfo.push('Shift')
    // if (key.alt) keyInfo.push('Alt') // alt 属性在 ink 中不存在
    if ((key as any).meta) keyInfo.push('Meta')
    
    if (input) {
      keyInfo.push(input)
    } else if ((key as any).upArrow) {
      keyInfo.push('↑')
    } else if ((key as any).downArrow) {
      keyInfo.push('↓')
    } else if ((key as any).leftArrow) {
      keyInfo.push('←')
    } else if ((key as any).rightArrow) {
      keyInfo.push('→')
    } else if ((key as any).return) {
      keyInfo.push('Enter')
    } else if ((key as any).escape) {
      keyInfo.push('Esc')
    } else if (key.tab) {
      keyInfo.push('Tab')
    }
    
    setLastKey(keyInfo.join('+'))
  })
  
  return lastKey
}

/**
 * 批量折叠控制器
 */
export function useBatchCollapseController() {
  const [controllers] = useState(new Map<string, (collapsed: boolean) => void>())
  
  const register = useCallback((id: string, controller: (collapsed: boolean) => void) => {
    controllers.set(id, controller)
    return () => controllers.delete(id)
  }, [controllers])
  
  const collapseAll = useCallback(() => {
    controllers.forEach(controller => controller(true))
  }, [controllers])
  
  const expandAll = useCallback(() => {
    controllers.forEach(controller => controller(false))
  }, [controllers])
  
  const toggleAll = useCallback(() => {
    // 如果超过一半是折叠的，则全部展开，否则全部折叠
    // 这里简化为直接切换到折叠状态
    controllers.forEach(controller => controller(true))
  }, [controllers])
  
  return {
    register,
    collapseAll,
    expandAll,
    toggleAll,
    count: controllers.size,
  }
}