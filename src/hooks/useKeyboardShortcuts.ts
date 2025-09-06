import { useEffect } from 'react'
import { useInput } from 'ink'

interface KeyboardShortcuts {
  'ctrl+t'?: () => void
  'ctrl+d'?: () => void
  'ctrl+r'?: () => void
  'escape'?: () => void
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  preventDefault?: boolean
}

/**
 * Hook for handling keyboard shortcuts in Ink applications
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcuts,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options

  useInput((input, key) => {
    if (!enabled) return

    // Handle Ctrl combinations
    if (key.ctrl) {
      const shortcut = `ctrl+${input.toLowerCase()}`
      const handler = shortcuts[shortcut as keyof KeyboardShortcuts]
      
      if (handler) {
        handler()
        return
      }
    }

    // Handle special keys
    if (key.escape && shortcuts.escape) {
      shortcuts.escape()
      return
    }

    // Handle other combinations as needed
    // Add more key combinations here if required
  })
}

/**
 * Hook specifically for TODO panel shortcuts
 */
export function useTodoShortcuts({
  onToggleTodos,
  enabled = true
}: {
  onToggleTodos: () => void
  enabled?: boolean
}) {
  useKeyboardShortcuts(
    {
      'ctrl+t': onToggleTodos
    },
    { enabled }
  )
}

/**
 * Check if input is currently focused to prevent shortcut conflicts
 */
export function useInputFocus() {
  // This is a simplified approach for Ink
  // In a real terminal app, you might need more sophisticated focus detection
  return false // For now, assume shortcuts are always available
}