import { useState, useCallback } from 'react'
import { UIMode, InputMode, UIState, UIMessage } from '../types/index.js'

export function useUIState() {
  const [state, setState] = useState<UIState>({
    currentMode: UIMode.Default,
    inputMode: InputMode.Prompt,
    messages: [],
    isLoading: false,
    statusText: 'Ready'
  })

  const updateMode = useCallback((mode: UIMode) => {
    setState(prev => ({ ...prev, currentMode: mode }))
  }, [])

  const updateInputMode = useCallback((mode: InputMode) => {
    setState(prev => ({ ...prev, inputMode: mode }))
  }, [])

  const addMessage = useCallback((message: Omit<UIMessage, 'id' | 'timestamp'>) => {
    const newMessage: UIMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    setState(prev => ({ 
      ...prev, 
      messages: [...prev.messages, newMessage] 
    }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }))
  }, [])

  const setStatus = useCallback((status: string) => {
    setState(prev => ({ ...prev, statusText: status }))
  }, [])

  return {
    state,
    updateMode,
    updateInputMode,
    addMessage,
    setLoading,
    setStatus
  }
}