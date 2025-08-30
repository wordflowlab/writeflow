import { useInput } from 'ink'
import { UIMode } from '../types/index.js'

export interface KeyboardHandlers {
  onModeSwitch: () => void
  onClearInput: () => void
  onClearScreen: () => void
  onSubmitInput: (input: string) => void
  onUpdateInput: (updater: (prev: string) => string) => void
}

export function useKeyboard(
  currentInput: string,
  handlers: KeyboardHandlers,
  isLoading: boolean = false
) {
  useInput((input, key) => {
    if (isLoading) return // 加载时禁用所有键盘输入

    // Shift+Tab 模式切换
    if (key.shift && key.tab) {
      handlers.onModeSwitch()
      return
    }

    // Enter 提交输入
    if (key.return) {
      if (currentInput.trim()) {
        handlers.onSubmitInput(currentInput.trim())
        handlers.onClearInput()
      }
      return
    }

    // Backspace/Delete 删除字符
    if (key.backspace || key.delete) {
      handlers.onUpdateInput(prev => prev.slice(0, -1))
      return
    }

    // Ctrl+C 清空当前输入
    if (key.ctrl && input === 'c') {
      handlers.onClearInput()
      return
    }

    // Ctrl+L 清屏
    if (key.ctrl && input === 'l') {
      handlers.onClearScreen()
      return
    }

    // Ctrl+U 清空整行
    if (key.ctrl && input === 'u') {
      handlers.onClearInput()
      return
    }

    // 普通字符输入
    if (input && !key.ctrl && !key.meta && !key.shift && !key.tab) {
      handlers.onUpdateInput(prev => prev + input)
    }
  })
}

// 模式相关的键盘行为配置
export interface ModeKeyboardConfig {
  mode: UIMode
  shortcuts: Array<{
    key: string
    description: string
    action: () => void
  }>
}

export function useModeKeyboard(config: ModeKeyboardConfig) {
  const modeShortcuts = getModeShortcuts(config.mode)
  
  return {
    availableShortcuts: [...modeShortcuts, ...config.shortcuts],
    currentMode: config.mode
  }
}

function getModeShortcuts(mode: UIMode): Array<{ key: string; description: string }> {
  const baseShortcuts = [
    { key: 'Shift+Tab', description: '切换模式' },
    { key: 'Ctrl+C', description: '清空输入' },
    { key: 'Ctrl+L', description: '清屏' },
    { key: 'Enter', description: '提交' }
  ]

  switch (mode) {
    case UIMode.Plan:
      return [
        ...baseShortcuts,
        { key: 'Ctrl+P', description: '退出计划模式' }
      ]
      
    case UIMode.AcceptEdits:
      return [
        ...baseShortcuts,
        { key: 'Space', description: '切换自动接受' }
      ]
      
    case UIMode.BypassPermissions:
      return [
        ...baseShortcuts,
        { key: 'Ctrl+B', description: '切换绕过权限' }
      ]
      
    default:
      return baseShortcuts
  }
}