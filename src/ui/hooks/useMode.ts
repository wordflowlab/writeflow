import { useState, useEffect, useCallback } from 'react'
import { UIMode } from '../types/index.js'
import { ModeManager, ModeState } from '../modes/ModeManager.js'

export function useMode() {
  const [modeManager] = useState(() => new ModeManager())
  const [modeState, setModeState] = useState<ModeState>(() => modeManager.getState())

  useEffect(() => {
    const unsubscribe = modeManager.subscribe(setModeState)
    return unsubscribe
  }, [modeManager])

  const switchToNextMode = useCallback(() => {
    modeManager.switchToNextMode()
  }, [modeManager])

  const setMode = useCallback((mode: UIMode) => {
    modeManager.setMode(mode)
  }, [modeManager])

  const setPlanText = useCallback((plan: string) => {
    modeManager.setPlanText(plan)
  }, [modeManager])

  const toggleAutoAccept = useCallback(() => {
    modeManager.toggleAutoAccept()
  }, [modeManager])

  const isToolAllowed = useCallback((toolName: string) => {
    return modeManager.isToolAllowed(toolName)
  }, [modeManager])

  const getModeDisplayName = useCallback((mode?: UIMode) => {
    return modeManager.getModeDisplayName(mode)
  }, [modeManager])

  const getModeColor = useCallback((mode?: UIMode) => {
    return modeManager.getModeColor(mode)
  }, [modeManager])

  return {
    modeState,
    currentMode: modeState.currentMode,
    switchToNextMode,
    setMode,
    setPlanText,
    toggleAutoAccept,
    isToolAllowed,
    getModeDisplayName,
    getModeColor,
    modeManager
  }
}