import React from 'react'
import { InputMode } from '../types/index.js'

interface InputProcessorProps {
  onInputDetected: (input: string, mode: InputMode) => void
}

export function InputProcessor({ onInputDetected }: InputProcessorProps) {
  // 输入模式检测逻辑 - 基于Claude Code实现
  const detectInputMode = (input: string): InputMode => {
    if (input.startsWith('!')) return InputMode.Bash
    if (input.startsWith('#')) return InputMode.Memory
    return InputMode.Prompt
  }

  // 处理输入并提取内容
  const processInput = (rawInput: string) => {
    const mode = detectInputMode(rawInput)
    
    // 对于bash和memory模式，移除前缀字符
    const processedInput = (mode === InputMode.Bash || mode === InputMode.Memory) 
      ? rawInput.slice(1) 
      : rawInput

    onInputDetected(processedInput, mode)
  }

  // 输入处理器本身不渲染UI，仅提供逻辑
  return null
}

// 导出处理逻辑供其他组件使用
export const useInputProcessor = (
  onInputDetected: (input: string, mode: InputMode) => void
) => {
  const detectInputMode = (input: string): InputMode => {
    if (input.startsWith('!')) return InputMode.Bash
    if (input.startsWith('#')) return InputMode.Memory
    return InputMode.Prompt
  }

  const processInput = (rawInput: string) => {
    const mode = detectInputMode(rawInput)
    
    // 对于bash和memory模式，移除前缀字符
    const processedInput = (mode === InputMode.Bash || mode === InputMode.Memory) 
      ? rawInput.slice(1) 
      : rawInput

    onInputDetected(processedInput, mode)
  }

  return { processInput, detectInputMode }
}