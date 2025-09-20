import { useState, useCallback } from 'react'

type UseTextInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  onExit?: () => void
  onExitMessage?: (show: boolean, key?: string) => void
  onMessage?: (show: boolean, message?: string) => void
  onHistoryUp?: () => void
  onHistoryDown?: () => void
  onHistoryReset?: () => void
  focus?: boolean
  mask?: string
  multiline?: boolean
  cursorChar: string
  highlightPastedText?: boolean
  invert: (text: string) => string
  themeText: (text: string) => string
  columns: number
  onImagePaste?: (base64Image: string) => void
  disableCursorMovementForUpDownKeys?: boolean
  externalOffset: number
  onOffsetChange: (offset: number) => void
}

type UseTextInputResult = {
  renderedValue: string
  onInput: (input: string, key: string) => void
  offset: number
  setOffset: (offset: number) => void
}

/**
 * 简化版的文本输入 hook
 * 用于 WriteFlow 的模型配置界面
 */
export function useTextInput({
  value: originalValue,
  onChange,
  onSubmit,
  onExit,
  onExitMessage,
  onMessage,
  onHistoryUp,
  onHistoryDown,
  onHistoryReset,
  mask = '',
  multiline = false,
  cursorChar,
  invert,
  themeText,
  columns,
  onImagePaste,
  disableCursorMovementForUpDownKeys = false,
  externalOffset,
  onOffsetChange,
}: UseTextInputProps): UseTextInputResult {
  const [ctrlCPressed, setCtrlCPressed] = useState(false)
  
  const offset = externalOffset
  const setOffset = onOffsetChange

  // 处理双击 Ctrl+C 退出
  const handleCtrlC = useCallback(() => {
    if (ctrlCPressed) {
      // 第二次按 Ctrl+C，退出
      onExit?.()
      return
    }
    
    // 第一次按 Ctrl+C，显示提示
    setCtrlCPressed(true)
    onExitMessage?.(true, 'Ctrl-C')
    
    // 2秒后重置状态
    setTimeout(() => {
      setCtrlCPressed(false)
      onExitMessage?.(false)
    }, 2000)
  }, [ctrlCPressed, onExit, onExitMessage])

  const onInput = useCallback(
    (input: string, key: string) => {
      // 处理特殊按键
      if ((key as any).ctrl && input === 'c') {
        handleCtrlC()
        return
      }

      // 处理 Enter 键
      if ((key as any).return) {
        if (multiline && !(key as any).shift) {
          // 多行模式下，Enter 添加换行
          const newValue = originalValue + '\n'
          onChange(newValue)
          setOffset(newValue.length)
        } else {
          // 提交
          onSubmit?.(originalValue)
        }
        return
      }

      // 处理方向键
      if ((key as any).upArrow) {
        if (disableCursorMovementForUpDownKeys) {
          onHistoryUp?.()
          return
        }
        // 光标上移逻辑（简化版）
        const newOffset = Math.max(0, offset - columns)
        setOffset(newOffset)
        return
      }

      if ((key as any).downArrow) {
        if (disableCursorMovementForUpDownKeys) {
          onHistoryDown?.()
          return
        }
        // 光标下移逻辑（简化版）
        const newOffset = Math.min(originalValue.length, offset + columns)
        setOffset(newOffset)
        return
      }

      if ((key as any).leftArrow) {
        const newOffset = Math.max(0, offset - 1)
        setOffset(newOffset)
        return
      }

      if ((key as any).rightArrow) {
        const newOffset = Math.min(originalValue.length, offset + 1)
        setOffset(newOffset)
        return
      }

      // 处理退格键
      if ((key as any).backspace || (key as any).delete) {
        if (offset > 0) {
          const newValue = originalValue.slice(0, offset - 1) + originalValue.slice(offset)
          onChange(newValue)
          setOffset(offset - 1)
        }
        return
      }

      // 处理普通字符输入
      if (input && !(key as any).ctrl && !(key as any).meta && !(key as any).escape) {
        const newValue = originalValue.slice(0, offset) + input + originalValue.slice(offset)
        onChange(newValue)
        setOffset(offset + input.length)
        
        // 重置历史状态
        onHistoryReset?.()
        
        // 重置退出状态
        if (ctrlCPressed) {
          setCtrlCPressed(false)
          onExitMessage?.(false)
        }
      }
    },
    [
      originalValue,
      offset,
      onChange,
      onSubmit,
      onHistoryUp,
      onHistoryDown,
      onHistoryReset,
      setOffset,
      multiline,
      disableCursorMovementForUpDownKeys,
      columns,
      ctrlCPressed,
      handleCtrlC,
      onExitMessage,
    ]
  )

  // 渲染值，包括光标和遮罩
  const renderedValue = useCallback(() => {
    let displayValue = originalValue
    
    // 应用遮罩
    if (mask) {
      displayValue = mask.repeat(originalValue.length)
    }

    // 添加光标
    if (cursorChar && offset <= displayValue.length) {
      const beforeCursor = displayValue.slice(0, offset)
      const atCursor = displayValue.slice(offset, offset + 1) || ' '
      const afterCursor = displayValue.slice(offset + 1)
      
      displayValue = beforeCursor + invert(atCursor) + afterCursor
    }

    // 应用主题
    return themeText(displayValue)
  }, [originalValue, mask, cursorChar, offset, invert, themeText])()

  return {
    renderedValue,
    onInput,
    offset,
    setOffset,
  }
}