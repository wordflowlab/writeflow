// WriteFlow theme system inspired by Kode
export type ThemeNames = 'dark' | 'light'

export interface Theme {
  // Core colors
  text: string
  secondaryText: string
  dimText: string
  muted: string  // 添加 muted 颜色
  
  // Brand colors
  claude: string
  success: string
  error: string
  warning: string
  
  // UI colors
  border: string
  secondaryBorder: string
  background: string
  
  // Mode-specific colors
  writing: string
  editing: string  
  reviewing: string
  
  // Interactive elements
  suggestion: string
  highlight: string
  selection: string
  
  // Status colors
  loading: string
  thinking: string
  ready: string
}

// WriteFlow color palette
const writeFlowTheme: Theme = {
  // Core text colors
  text: '#ffffff',
  secondaryText: '#a0a0a0',
  dimText: '#666666',
  muted: '#808080',
  
  // Brand colors - WriteFlow specific
  claude: '#00ff87',        // Bright green for WriteFlow branding
  success: '#00ff87',       // Same as claude for consistency  
  error: '#ff6b6b',         // Red for errors
  warning: '#ff9500',       // Orange for warnings
  
  // UI elements
  border: '#333333',
  secondaryBorder: '#555555',
  background: '#000000',
  
  // Writing mode colors
  writing: '#00ff87',       // Bright green for creative writing
  editing: '#ff9500',       // Orange for editing mode
  reviewing: '#007acc',     // Blue for review mode
  
  // Interactive elements
  suggestion: '#00ff87',    // Same as brand color
  highlight: '#ffff00',     // Yellow for highlighting
  selection: '#0066cc',     // Blue for selections
  
  // Status indicators
  loading: '#a0a0a0',       // Gray for loading
  thinking: '#00ff87',      // Brand color for AI thinking
  ready: '#00ff87',          // Brand color for ready state
}

// Light theme variant
const lightTheme: Theme = {
  text: '#1a1a1a',
  secondaryText: '#666666',
  dimText: '#999999',
  muted: '#888888',
  claude: '#007acc',
  success: '#007acc',
  error: '#cc0000',
  warning: '#ff6600',
  border: '#cccccc',
  secondaryBorder: '#e0e0e0',
  background: '#ffffff',
  writing: '#007acc',
  editing: '#ff6600',
  reviewing: '#00aa88',
  suggestion: '#007acc',
  highlight: '#ffff00',
  selection: '#b3d9ff',
  loading: '#666666',
  thinking: '#007acc',
  ready: '#007acc',
}

// Theme getter function
export function getTheme(themeName?: ThemeNames): Theme {
  switch (themeName) {
    case 'light':
      return lightTheme
    case 'dark':
    default:
      return writeFlowTheme
  }
}

// Utility functions for theme manipulation
export function fadeColor(color: string, opacity: number): string {
  // Simple opacity adjustment - in a full implementation this would handle hex/rgb conversion
  return color
}

export function contrastColor(color: string): string {
  // Simple contrast calculation - return black or white based on color brightness
  return color === '#000000' ? '#ffffff' : '#000000'
}

// Theme variants for different contexts
export function getWritingTheme(): Partial<Theme> {
  return {
    claude: writeFlowTheme.writing,
    border: writeFlowTheme.writing,
  }
}

export function getEditingTheme(): Partial<Theme> {
  return {
    claude: writeFlowTheme.editing,
    border: writeFlowTheme.editing,
  }
}

export function getReviewingTheme(): Partial<Theme> {
  return {
    claude: writeFlowTheme.reviewing,
    border: writeFlowTheme.reviewing,
  }
}

// Export theme constants for direct use
export const COLORS = {
  WRITING: '#00ff87',
  EDITING: '#ff9500', 
  REVIEWING: '#007acc',
  ERROR: '#ff6b6b',
  SUCCESS: '#00ff87',
  WARNING: '#ff9500',
  TEXT: '#ffffff',
  DIM: '#666666',
} as const