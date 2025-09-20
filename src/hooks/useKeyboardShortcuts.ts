import { useInput } from 'ink'

interface KeyboardShortcuts {
  'ctrl+t'?: () => void
  'ctrl+d'?: () => void
  'ctrl+r'?: () => void
  'escape'?: () => void
  'shift+tab'?: () => void
  'tab'?: () => void
  'ctrl+p'?: () => void
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
  options: UseKeyboardShortcutsOptions = {},
) {
  const { enabled = true, preventDefault = true } = options

  useInput((input, key) => {
    if (!enabled) return

    // Handle Ctrl combinations
    if ((key as any).ctrl) {
      const shortcut = `ctrl+${input.toLowerCase()}`
      const handler = shortcuts[shortcut as keyof KeyboardShortcuts]
      
      if (handler) {
        handler()
        return
      }
    }

    // Handle Shift+Tab combination
    if ((key as any).shift && key.tab && shortcuts['shift+tab']) {
      shortcuts['shift+tab']()
      return
    }

    // Handle Tab key
    if (key.tab && !(key as any).shift && shortcuts.tab) {
      shortcuts.tab()
      return
    }

    // Handle special keys
    if ((key as any).escape && shortcuts.escape) {
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
  enabled = true,
}: {
  onToggleTodos: () => void
  enabled?: boolean
}) {
  useKeyboardShortcuts(
    {
      'ctrl+t': onToggleTodos,
    },
    { enabled },
  )
}

/**
 * Hook for mode switching shortcuts
 */
export function useModeShortcuts({
  onModeCycle,
  onExitPlanMode,
  enabled = true,
}: {
  onModeCycle: () => void
  onExitPlanMode?: () => void
  enabled?: boolean
}) {
  const shortcuts: KeyboardShortcuts = {
    'shift+tab': onModeCycle,
  }
  
  if (onExitPlanMode) {
    shortcuts.escape = onExitPlanMode
  }
  
  useKeyboardShortcuts(shortcuts, { enabled })
}

/**
 * Check if input is currently focused to prevent shortcut conflicts
 */
export function useInputFocus() {
  // This is a simplified approach for Ink
  // In a real terminal app, you might need more sophisticated focus detection
  return false // For now, assume shortcuts are always available
}