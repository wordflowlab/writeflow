import { useState, useEffect } from 'react'

interface TerminalSize {
  columns: number
  rows: number
}

// Default terminal size
const DEFAULT_SIZE: TerminalSize = {
  columns: 80,
  rows: 24
}

export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>(() => {
    // Get initial size from process.stdout if available
    if (process.stdout && process.stdout.columns && process.stdout.rows) {
      return {
        columns: process.stdout.columns,
        rows: process.stdout.rows
      }
    }
    return DEFAULT_SIZE
  })
  
  useEffect(() => {
    // Handle terminal resize events
    const handleResize = () => {
      if (process.stdout && process.stdout.columns && process.stdout.rows) {
        setSize({
          columns: process.stdout.columns,
          rows: process.stdout.rows
        })
      }
    }
    
    // Listen for resize events
    process.stdout?.on('resize', handleResize)
    
    // Initial size check
    handleResize()
    
    return () => {
      process.stdout?.off('resize', handleResize)
    }
  }, [])
  
  return size
}

// Utility functions for terminal size calculations
export function getMaxWidth(columns: number, padding: number = 4): number {
  return Math.max(40, columns - padding)
}

export function getContentWidth(columns: number, sidebarWidth: number = 0): number {
  return Math.max(20, columns - sidebarWidth - 4)
}

export function isNarrowTerminal(columns: number): boolean {
  return columns < 80
}

export function isWideTerminal(columns: number): boolean {
  return columns > 120
}

// Responsive breakpoints for WriteFlow
export const TERMINAL_BREAKPOINTS = {
  SMALL: 60,
  MEDIUM: 80, 
  LARGE: 100,
  XLARGE: 120
} as const

export function getTerminalBreakpoint(columns: number): keyof typeof TERMINAL_BREAKPOINTS {
  if (columns >= TERMINAL_BREAKPOINTS.XLARGE) return 'XLARGE'
  if (columns >= TERMINAL_BREAKPOINTS.LARGE) return 'LARGE'  
  if (columns >= TERMINAL_BREAKPOINTS.MEDIUM) return 'MEDIUM'
  return 'SMALL'
}