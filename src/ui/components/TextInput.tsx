import React, { useState, useEffect, useCallback } from 'react'
import { Text } from 'ink'
import { getTheme } from '../../utils/theme.js'

// Simplified cursor management
class WriterCursor {
  constructor(
    public text: string,
    public columns: number,
    public offset: number = 0
  ) {}
  
  static fromText(text: string, columns: number, offset: number = 0): WriterCursor {
    return new WriterCursor(text, columns, Math.min(offset, text.length))
  }
  
  insert(str: string): WriterCursor {
    const newText = this.text.slice(0, this.offset) + str + this.text.slice(this.offset)
    return new WriterCursor(newText, this.columns, this.offset + str.length)
  }
  
  backspace(): WriterCursor {
    if (this.offset === 0) return this
    const newText = this.text.slice(0, this.offset - 1) + this.text.slice(this.offset)
    return new WriterCursor(newText, this.columns, this.offset - 1)
  }
  
  left(): WriterCursor {
    return new WriterCursor(this.text, this.columns, Math.max(0, this.offset - 1))
  }
  
  right(): WriterCursor {
    return new WriterCursor(this.text, this.columns, Math.min(this.text.length, this.offset + 1))
  }
  
  startOfLine(): WriterCursor {
    const lines = this.text.slice(0, this.offset).split('\n')
    const currentLineStart = this.offset - (lines[lines.length - 1]?.length || 0)
    return new WriterCursor(this.text, this.columns, currentLineStart)
  }
  
  endOfLine(): WriterCursor {
    const textFromOffset = this.text.slice(this.offset)
    const nextNewline = textFromOffset.indexOf('\n')
    const endOfLineOffset = nextNewline === -1 ? this.text.length : this.offset + nextNewline
    return new WriterCursor(this.text, this.columns, endOfLineOffset)
  }
  
  render(cursorChar: string, mask: string = '', invert: (text: string) => string): string {
    const displayText = mask ? mask.repeat(this.text.length) : this.text
    
    if (this.offset >= displayText.length) {
      return displayText + invert(cursorChar)
    }
    
    return (
      displayText.slice(0, this.offset) +
      invert(displayText[this.offset] || cursorChar) +
      displayText.slice(this.offset + 1)
    )
  }
  
  equals(other: WriterCursor): boolean {
    return this.text === other.text && this.offset === other.offset
  }
}

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  onExit?: () => void
  multiline?: boolean
  placeholder?: string
  focus?: boolean
  mask?: string
  columns: number
  isDimmed?: boolean
  cursorOffset: number
  onChangeCursorOffset: (offset: number) => void
  onPaste?: (text: string) => void
  onSpecialKey?: (input: string, key: any) => boolean
}

export default function TextInput({
  value: originalValue,
  onChange,
  onSubmit,
  onExit,
  multiline = false,
  placeholder = '',
  focus = true,
  mask = '',
  columns,
  isDimmed = false,
  cursorOffset,
  onChangeCursorOffset,
  onPaste,
  onSpecialKey
}: TextInputProps) {
  const theme = getTheme()
  const cursor = WriterCursor.fromText(originalValue, columns, cursorOffset)
  
  const invert = useCallback((text: string) => text, [])
  
  const handleInput = useCallback((inputChar: string, key: any) => {
    // Handle special keys first
    if (onSpecialKey && onSpecialKey(inputChar, key)) {
      return
    }
    
    // Handle backspace
    if ((key as any).backspace || (key as any).delete || inputChar === '\b' || inputChar === '\x7f') {
      const nextCursor = cursor.backspace()
      if (!cursor.equals(nextCursor)) {
        onChangeCursorOffset(nextCursor.offset)
        onChange(nextCursor.text)
      }
      return
    }
    
    // Handle Enter
    if ((key as any).return) {
      if (multiline && (key as any).shift) {
        // Shift+Enter for new line in multiline mode
        const nextCursor = cursor.insert('\n')
        onChangeCursorOffset(nextCursor.offset)
        onChange(nextCursor.text)
      } else {
        // Regular Enter for submit
        onSubmit?.(originalValue)
      }
      return
    }
    
    // Handle escape
    if ((key as any).escape) {
      onExit?.()
      return
    }
    
    // Handle arrow keys
    if ((key as any).leftArrow) {
      const nextCursor = cursor.left()
      onChangeCursorOffset(nextCursor.offset)
      return
    }
    
    if ((key as any).rightArrow) {
      const nextCursor = cursor.right()
      onChangeCursorOffset(nextCursor.offset)
      return
    }
    
    // Handle Ctrl combinations
    if ((key as any).ctrl) {
      switch (inputChar) {
        case 'a': // Ctrl+A - start of line
          onChangeCursorOffset(cursor.startOfLine().offset)
          return
        case 'e': // Ctrl+E - end of line
          onChangeCursorOffset(cursor.endOfLine().offset)
          return
        case 'c': // Ctrl+C - exit
          onExit?.()
          return
        case 'v': // Ctrl+V - paste (simplified)
          // This would be handled by clipboard integration in full implementation
          return
      }
    }
    
    // Handle regular character input
    if (inputChar && inputChar >= ' ') {
      const nextCursor = cursor.insert(inputChar.replace(/\r/g, '\n'))
      if (!cursor.equals(nextCursor)) {
        onChangeCursorOffset(nextCursor.offset)
        onChange(nextCursor.text)
      }
    }
  }, [
    originalValue,
    cursor,
    onChange,
    onSubmit,
    onExit,
    onChangeCursorOffset,
    onSpecialKey,
    multiline
  ])
  
  // Set up input handling
  useEffect(() => {
    if (!focus || isDimmed) return
    
    process.stdin.setRawMode?.(true)
    process.stdin.setEncoding('utf8')
    process.stdin.resume()
    
    const handleData = (data: string) => {
      const key = {
        return: data === '\r' || data === '\n',
        backspace: data === '\u007f' || data === '\b',
        delete: data === '\u007f',
        leftArrow: data === '\u001b[D',
        rightArrow: data === '\u001b[C',
        upArrow: data === '\u001b[A',
        downArrow: data === '\u001b[B',
        escape: data === '\u001b',
        ctrl: data.charCodeAt(0) < 32,
        shift: false, // Would need more complex detection
        tab: data === '\t'
      }
      
      handleInput(data, key)
    }
    
    process.stdin.on('data', handleData)
    
    return () => {
      process.stdin.off('data', handleData)
    }
  }, [handleInput, focus, isDimmed])
  
  const renderedValue = cursor.render('|', mask, invert)
  
  if (!originalValue && placeholder && !focus) {
    return <Text dimColor>{placeholder}</Text>
  }
  
  return (
    <Text dimColor={isDimmed}>
      {renderedValue || (placeholder && !focus ? placeholder : '')}
    </Text>
  )
}