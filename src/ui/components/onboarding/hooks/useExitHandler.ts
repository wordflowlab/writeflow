import { useInput } from 'ink'
import { useState, useRef } from 'react'

interface ExitState {
  pending: boolean
  keyName: 'Ctrl-C' | 'Ctrl-D' | null
}

const DOUBLE_PRESS_TIMEOUT_MS = 2000

/**
 * WriteFlow 退出处理 Hook
 * 双击 Ctrl+C 或 Ctrl+D 退出，单击显示提示
 */
export function useExitHandler(onExit: () => void): ExitState {
  const [exitState, setExitState] = useState<ExitState>({
    pending: false,
    keyName: null,
  })

  const lastPressRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const createDoublePress = (keyName: 'Ctrl-C' | 'Ctrl-D') => {
    return () => {
      const now = Date.now()
      const timeSinceLastPress = now - lastPressRef.current

      if (timeSinceLastPress <= DOUBLE_PRESS_TIMEOUT_MS && timeoutRef.current) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
        onExit()
        setExitState({ pending: false, keyName: null })
      } else {
        setExitState({ pending: true, keyName })
        timeoutRef.current = setTimeout(() => {
          setExitState({ pending: false, keyName: null })
        }, DOUBLE_PRESS_TIMEOUT_MS) as NodeJS.Timeout
      }

      lastPressRef.current = now
    }
  }

  const handleCtrlC = createDoublePress('Ctrl-C')
  const handleCtrlD = createDoublePress('Ctrl-D')

  useInput((input, key) => {
    if ((key as any).ctrl && input === 'c') handleCtrlC()
    if ((key as any).ctrl && input === 'd') handleCtrlD()
  })

  return exitState
}