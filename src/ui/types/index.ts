import React from 'react'

// UI模式枚举
export enum UIMode {
  Default = 'default',
  AcceptEdits = 'acceptEdits', 
  Plan = 'plan',
  BypassPermissions = 'bypassPermissions'
}

// 输入模式枚举
export enum InputMode {
  Prompt = 'prompt',
  Bash = 'bash',
  Memory = 'memory'
}

// 消息类型
export interface UIMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'jsx'
  content: string
  timestamp: Date
  mode?: InputMode
  jsx?: React.ReactElement  // 支持 JSX 内容
  data?: any               // 支持结构化数据
}

// UI状态
export interface UIState {
  currentMode: UIMode
  inputMode: InputMode
  messages: UIMessage[]
  isLoading: boolean
  statusText: string
}

// 主题配置
export interface Theme {
  primary: string
  secondary: string
  success: string
  warning: string
  error: string
  planMode: string
  secondaryText: string
}