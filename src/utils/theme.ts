// WriteFlow theme system with intelligent theme detection
import { getGlobalConfig } from './config.js'

export type ThemeNames = 'dark' | 'light' | 'dark-accessible' | 'light-accessible' | 'auto'

export interface Theme {
  // Core colors
  text: string
  secondaryText: string
  dimText: string
  muted: string
  
  // Brand colors
  claude: string
  success: string
  error: string
  warning: string
  info: string
  
  // UI colors
  border: string
  secondaryBorder: string
  background: string
  
  // Message-specific colors
  userMessage: string
  assistantMessage: string
  systemMessage: string
  codeBlock: string
  quote: string
  
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
  processing: string
}

// WriteFlow color palette - optimized for better visibility
const writeFlowTheme: Theme = {
  // Core text colors - increased brightness and contrast
  text: '#ffffff',          // Pure white for maximum readability
  secondaryText: '#e0e0e0', // Brighter gray for better visibility
  dimText: '#b0b0b0',       // Much lighter dim text for better readability
  muted: '#a0a0a0',         // Brighter muted text
  
  // Brand colors - WriteFlow specific with better contrast
  claude: '#00ff87',        // Bright green for WriteFlow branding
  success: '#00ff87',       // Same as claude for consistency  
  error: '#ff5555',         // Brighter red for better visibility
  warning: '#ffaa00',       // Brighter orange for warnings
  info: '#33ccff',          // Brighter blue for info messages
  
  // UI elements with better contrast
  border: '#404040',        // Lighter border for better definition
  secondaryBorder: '#606060', // Even lighter secondary borders
  background: '#000000',
  
  // Message-specific colors with enhanced visibility
  userMessage: '#e0e0e0',   // Much brighter for user messages
  assistantMessage: '#ffffff', // Pure white for assistant messages
  systemMessage: '#cccccc', // Brighter gray for system messages
  codeBlock: '#00ff87',     // Brand green for code
  quote: '#b0b0b0',         // Brighter gray for quotes
  
  // Writing mode colors with better visibility
  writing: '#00ff87',       // Bright green for creative writing
  editing: '#ffaa00',       // Brighter orange for editing mode
  reviewing: '#33aaff',     // Brighter blue for review mode
  
  // Interactive elements with enhanced visibility
  suggestion: '#00ff87',    // Same as brand color
  highlight: '#ffff00',     // Bright yellow for highlighting
  selection: '#3388ff',     // Brighter blue for selections
  
  // Status indicators with better contrast
  loading: '#cccccc',       // Much brighter gray for loading
  thinking: '#00ff87',      // Brand color for AI thinking
  ready: '#00ff87',         // Brand color for ready state
  processing: '#ffaa00',    // Brighter orange for processing
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
  info: '#0066cc',          // Blue for info messages
  border: '#cccccc',
  secondaryBorder: '#e0e0e0',
  background: '#ffffff',
  // Message-specific colors
  userMessage: '#333333',   // Dark gray for user messages
  assistantMessage: '#1a1a1a', // Almost black for assistant messages
  systemMessage: '#666666', // Medium gray for system messages
  codeBlock: '#007acc',     // Blue for code
  quote: '#666666',         // Gray for quotes
  writing: '#007acc',
  editing: '#e65100',
  reviewing: '#2c7a39',
  suggestion: '#007acc',
  highlight: '#fff176',     // Softer yellow for highlights
  selection: '#b3d9ff',
  loading: '#666666',
  thinking: '#007acc',
  ready: '#2c7a39',
  processing: '#e65100',    // Orange for processing
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
  info: '#00ccff',          // Bright blue for info
  border: '#555555',
  secondaryBorder: '#777777',
  background: '#000000',
  // Message-specific colors
  userMessage: '#dddddd',   // Bright gray for user messages
  assistantMessage: '#ffffff', // Pure white for assistant messages
  systemMessage: '#aaaaaa', // Light gray for system messages
  codeBlock: '#00ff87',     // Bright green for code
  quote: '#aaaaaa',         // Light gray for quotes
  writing: '#00ff87',
  editing: '#ffaa00',
  reviewing: '#00aaff',
  suggestion: '#00ff87',
  highlight: '#ffff00',
  selection: '#0088ff',
  loading: '#cccccc',
  thinking: '#00ff87',
  ready: '#00ff87',
  processing: '#ffaa00',    // Orange for processing
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
  info: '#0044aa',          // Dark blue for info
  border: '#999999',
  secondaryBorder: '#cccccc',
  background: '#ffffff',
  // Message-specific colors
  userMessage: '#222222',   // Very dark gray for user messages
  assistantMessage: '#000000', // Pure black for assistant messages
  systemMessage: '#444444', // Dark gray for system messages
  codeBlock: '#0066cc',     // Dark blue for code
  quote: '#444444',         // Dark gray for quotes
  writing: '#0066cc',
  editing: '#cc4400',
  reviewing: '#006600',
  suggestion: '#0066cc',
  highlight: '#ffcc00',     // Darker yellow
  selection: '#99ccff',
  loading: '#333333',
  thinking: '#0066cc',
  ready: '#006600',
  processing: '#cc4400',    // Orange for processing
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
          stdio: 'pipe', 
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
          { encoding: 'utf8', timeout: 1000, stdio: 'pipe' },
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
  INFO: '#00aaff',
  TEXT: '#ffffff',
  DIM: '#666666',
  USER_MESSAGE: '#cccccc',
  ASSISTANT_MESSAGE: '#ffffff',
  SYSTEM_MESSAGE: '#888888',
  CODE_BLOCK: '#00ff87',
  QUOTE: '#888888',
  PROCESSING: '#ff9500',
} as const