// WriteFlow theme system with intelligent theme detection
import { getGlobalConfig } from './config.js'

export type ThemeNames = 'dark' | 'light' | 'dark-accessible' | 'light-accessible' | 'auto'

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

// Light theme variant - optimized for light backgrounds
const lightTheme: Theme = {
  text: '#1a1a1a',
  secondaryText: '#666666',
  dimText: '#999999',
  muted: '#888888',
  claude: '#007acc',        // Changed from bright green to blue for better readability
  success: '#2c7a39',       // Deep green for success messages
  error: '#cc0000',         // Pure red for errors
  warning: '#e65100',       // Orange for warnings
  border: '#cccccc',
  secondaryBorder: '#e0e0e0',
  background: '#ffffff',
  writing: '#007acc',
  editing: '#e65100',
  reviewing: '#2c7a39',
  suggestion: '#007acc',
  highlight: '#fff176',     // Softer yellow for highlights
  selection: '#b3d9ff',
  loading: '#666666',
  thinking: '#007acc',
  ready: '#2c7a39',
}

// Dark accessible theme - high contrast version
const darkAccessibleTheme: Theme = {
  text: '#ffffff',
  secondaryText: '#cccccc',
  dimText: '#999999',
  muted: '#888888',
  claude: '#00ff87',        // Keep bright green for high visibility
  success: '#00ff87',
  error: '#ff4444',         // Brighter red for better contrast
  warning: '#ffaa00',       // Brighter orange
  border: '#555555',
  secondaryBorder: '#777777',
  background: '#000000',
  writing: '#00ff87',
  editing: '#ffaa00',
  reviewing: '#00aaff',
  suggestion: '#00ff87',
  highlight: '#ffff00',
  selection: '#0088ff',
  loading: '#cccccc',
  thinking: '#00ff87',
  ready: '#00ff87',
}

// Light accessible theme - high contrast version  
const lightAccessibleTheme: Theme = {
  text: '#000000',
  secondaryText: '#333333',
  dimText: '#666666',
  muted: '#555555',
  claude: '#0066cc',        // Darker blue for high contrast
  success: '#006600',       // Darker green
  error: '#cc0000',         // Pure red
  warning: '#cc4400',       // Darker orange
  border: '#999999',
  secondaryBorder: '#cccccc',
  background: '#ffffff',
  writing: '#0066cc',
  editing: '#cc4400',
  reviewing: '#006600',
  suggestion: '#0066cc',
  highlight: '#ffcc00',     // Darker yellow
  selection: '#99ccff',
  loading: '#333333',
  thinking: '#0066cc',
  ready: '#006600',
}

// Theme getter function
export function getTheme(themeName?: ThemeNames): Theme {
  // 如果没有指定主题名，从配置文件读取用户设置
  if (!themeName) {
    try {
      const config = getGlobalConfig()
      themeName = config.theme || 'dark'
    } catch {
      // 如果读取配置失败，使用默认主题
      themeName = 'dark'
    }
  }
  
  switch (themeName) {
    case 'light':
      return lightTheme
    case 'dark-accessible':
      return darkAccessibleTheme
    case 'light-accessible':
      return lightAccessibleTheme
    case 'auto':
      return getAutoDetectedTheme()
    case 'dark':
    default:
      return writeFlowTheme
  }
}

/**
 * Auto-detect system theme based on environment
 */
function getAutoDetectedTheme(): Theme {
  const detectedTheme = detectSystemTheme()
  return detectedTheme === 'light' ? lightTheme : writeFlowTheme
}

/**
 * Detect system theme preference
 * Returns 'dark', 'light', or 'unknown'
 */
export function detectSystemTheme(): 'dark' | 'light' | 'unknown' {
  try {
    // macOS detection
    if (process.platform === 'darwin') {
      const { execSync } = require('child_process')
      try {
        const result = execSync('defaults read -g AppleInterfaceStyle', { 
          encoding: 'utf8', 
          timeout: 1000,
          stdio: 'pipe' 
        })
        return result.trim() === 'Dark' ? 'dark' : 'light'
      } catch {
        // If command fails, assume light mode (default on macOS)
        return 'light'
      }
    }

    // Windows detection via registry
    if (process.platform === 'win32') {
      const { execSync } = require('child_process')
      try {
        const result = execSync(
          'reg query HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize /v AppsUseLightTheme',
          { encoding: 'utf8', timeout: 1000, stdio: 'pipe' }
        )
        // If AppsUseLightTheme is 0, dark mode is enabled
        return result.includes('0x0') ? 'dark' : 'light'
      } catch {
        return 'unknown'
      }
    }

    // Linux/Unix - check environment variables
    const desktop = process.env.XDG_CURRENT_DESKTOP?.toLowerCase()
    const theme = process.env.GTK_THEME?.toLowerCase()
    
    if (theme && theme.includes('dark')) {
      return 'dark'
    }
    
    if (desktop && ['gnome', 'kde', 'xfce'].includes(desktop)) {
      // For major Linux DEs, we could implement specific detection
      // For now, default to unknown
      return 'unknown'
    }

    // Terminal-specific detection
    const termProgram = process.env.TERM_PROGRAM?.toLowerCase()
    const colorTerm = process.env.COLORTERM?.toLowerCase()
    
    // Some terminals hint at their theme
    if (termProgram === 'iterm.app' || termProgram === 'vscode') {
      // These could have theme detection, but it's complex
      return 'unknown'
    }

    return 'unknown'
  } catch (error) {
    return 'unknown'
  }
}

/**
 * Check if the current terminal supports colors
 */
export function supportsColor(): boolean {
  try {
    return !!(process.stdout?.isTTY && 
           process.env.TERM !== 'dumb' &&
           (process.env.COLORTERM !== undefined || 
            process.env.TERM?.includes('color') ||
            process.env.TERM?.includes('256')))
  } catch {
    return false
  }
}

/**
 * Get theme recommendation based on detection
 */
export function getRecommendedTheme(): ThemeNames {
  const detected = detectSystemTheme()
  
  if (detected === 'light') {
    return 'light'
  } else if (detected === 'dark') {
    return 'dark'
  } else {
    // If we can't detect, default to dark (current behavior)
    return 'dark'
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