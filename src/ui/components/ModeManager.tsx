import React, { useCallback } from 'react'
import { UIMode } from '../types/index.js'

interface ModeManagerProps {
  currentMode: UIMode
  onModeChange: (mode: UIMode) => void
}

export function ModeManager({ currentMode, onModeChange }: ModeManagerProps) {
  // 模式循环顺序: default → acceptEdits → plan → bypassPermissions → default
  const switchToNextMode = useCallback(() => {
    const modeOrder: UIMode[] = [
      UIMode.Default,
      UIMode.AcceptEdits,
      UIMode.Plan,
      UIMode.BypassPermissions
    ]
    
    const currentIndex = modeOrder.indexOf(currentMode)
    const nextIndex = (currentIndex + 1) % modeOrder.length
    onModeChange(modeOrder[nextIndex])
  }, [currentMode, onModeChange])

  // 模式管理器本身不渲染UI，仅提供逻辑
  // 实际的模式切换由PromptInterface处理键盘输入触发
  return null
}

// 导出模式切换逻辑供其他组件使用
export const useModeManager = (
  currentMode: UIMode,
  onModeChange: (mode: UIMode) => void
) => {
  const switchToNextMode = useCallback(() => {
    const modeOrder: UIMode[] = [
      UIMode.Default,
      UIMode.AcceptEdits,
      UIMode.Plan,
      UIMode.BypassPermissions
    ]
    
    const currentIndex = modeOrder.indexOf(currentMode)
    const nextIndex = (currentIndex + 1) % modeOrder.length
    onModeChange(modeOrder[nextIndex])
  }, [currentMode, onModeChange])

  return { switchToNextMode }
}