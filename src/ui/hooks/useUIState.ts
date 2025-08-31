import { useState, useCallback, useRef } from 'react'
import { UIMode, InputMode, UIState, UIMessage } from '../types/index.js'

// 消息ID计数器，确保唯一性
let messageIdCounter = 0

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
      id: `msg-${++messageIdCounter}-${Date.now()}`,
      timestamp: new Date()
    }
    
    setState(prev => {
      // 增强的去重逻辑：基于内容、类型和时间窗口
      const now = Date.now()
      const timeWindow = 2000 // 2秒时间窗口
      
      const isDuplicate = prev.messages.some(msg => {
        const timeDiff = now - msg.timestamp.getTime()
        return (
          msg.type === message.type && 
          msg.content === message.content &&
          timeDiff < timeWindow && // 在时间窗口内
          // 只检查最近的3条消息以提高性能
          prev.messages.indexOf(msg) >= Math.max(0, prev.messages.length - 3)
        )
      })
      
      if (isDuplicate) {
        console.warn('检测到重复消息，跳过添加:', message.type, message.content.substring(0, 50))
        return prev // 跳过重复消息
      }
      
      return { 
        ...prev, 
        messages: [...prev.messages, newMessage] 
      }
    })
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