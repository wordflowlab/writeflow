import { useState, useEffect } from 'react'
import { UIMode } from '../types/index.js'

interface HintConfig {
  text: string
  condition: () => boolean
  color: string
  priority: number // 优先级，数字越大越优先
}

interface UsePromptHintsProps {
  mode: UIMode
  isLoading: boolean
  messageCount: number
  hasInput: boolean
}

export function usePromptHints({ mode, isLoading, messageCount, hasInput }: UsePromptHintsProps) {
  const [currentHint, setCurrentHint] = useState<HintConfig | null>(null)

  // 定义所有可能的提示文案
  const hints: HintConfig[] = [
    // 最高优先级 - 加载状态
    {
      text: "正在处理中... (esc to interrupt)",
      condition: () => isLoading,
      color: "yellow",
      priority: 10
    },
    {
      text: "思考中... (ctrl+c to stop)",
      condition: () => isLoading,
      color: "yellow", 
      priority: 9
    },
    {
      text: "生成回答中... (esc to interrupt)",
      condition: () => isLoading,
      color: "yellow",
      priority: 8
    },
    
    // 模式相关提示
    {
      text: "📋 plan mode on (shift+tab to cycle)",
      condition: () => !isLoading && mode === UIMode.Plan,
      color: "yellow",
      priority: 7
    },
    {
      text: "✅ accept edits on (shift+tab to cycle)",
      condition: () => !isLoading && mode === UIMode.AcceptEdits,
      color: "green",
      priority: 7
    },
    {
      text: "🔓 bypass permissions on (shift+tab to cycle)", 
      condition: () => !isLoading && mode === UIMode.BypassPermissions,
      color: "red",
      priority: 7
    },
    
    // 交互提示
    {
      text: "Press up to edit previous messages",
      condition: () => !isLoading && !hasInput && messageCount > 0,
      color: "gray",
      priority: 5
    },
    {
      text: "! 执行bash · # 记录笔记 · / 使用命令",
      condition: () => !isLoading && !hasInput,
      color: "gray",
      priority: 4
    },
    {
      text: "shift+tab 切换模式",
      condition: () => !isLoading && !hasInput && mode === UIMode.Default,
      color: "gray",
      priority: 3
    },
    {
      text: "ctrl+l 清屏 · ctrl+r 刷新",
      condition: () => !isLoading && !hasInput,
      color: "gray",
      priority: 2
    },
    {
      text: "/help 查看帮助 · /exit 退出",
      condition: () => !isLoading && !hasInput,
      color: "gray",
      priority: 1
    }
  ]

  // 获取当前可用的提示
  const getAvailableHints = () => {
    return hints
      .filter(hint => hint.condition())
      .sort((a, b) => b.priority - a.priority) // 按优先级排序
  }

  // 轮换提示文案
  useEffect(() => {
    let localIndex = 0
    const availableHints = getAvailableHints()
    
    if (availableHints.length === 0) {
      setCurrentHint(null)
      return
    }

    // 立即设置第一个提示
    setCurrentHint(availableHints[0])

    // 如果只有一个提示，不需要轮换
    if (availableHints.length === 1) {
      return
    }

    // 如果是加载状态，快速轮换
    const interval = isLoading ? 2000 : 4000
    
    const timer = setInterval(() => {
      const newAvailable = getAvailableHints()
      if (newAvailable.length > 0) {
        localIndex = (localIndex + 1) % newAvailable.length
        setCurrentHint(newAvailable[localIndex])
      }
    }, interval)

    return () => clearInterval(timer)
  }, [mode, isLoading, messageCount, hasInput])

  return {
    currentHint,
    hasHint: currentHint !== null
  }
}