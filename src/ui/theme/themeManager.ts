/**
 * WriteFlow 主题管理系统
 * 基于 Claude Code 风格的终端主题配置
 */

import chalk from 'chalk'
import { figures } from '../constants/figures.js'

export type ThemeName = 'dark' | 'light' | 'auto'

export interface ThemeColors {
  // 基础文本颜色
  primary: typeof chalk.white
  secondary: typeof chalk.gray
  muted: typeof chalk.dim
  
  // 语义颜色
  success: typeof chalk.green
  error: typeof chalk.red
  warning: typeof chalk.yellow
  info: typeof chalk.blue
  
  // 代码和语法高亮
  code: {
    keyword: typeof chalk.magenta
    string: typeof chalk.green
    number: typeof chalk.cyan
    comment: typeof chalk.gray
    operator: typeof chalk.yellow
    function: typeof chalk.blue
    variable: typeof chalk.white
  }
  
  // 差异显示
  diff: {
    added: typeof chalk.green
    removed: typeof chalk.red
    modified: typeof chalk.yellow
    context: typeof chalk.dim
    header: typeof chalk.bold.white
  }
  
  // UI 元素
  border: typeof chalk.gray
  progress: typeof chalk.cyan
  spinner: typeof chalk.cyan
  
  // 文件操作
  file: {
    created: typeof chalk.green
    modified: typeof chalk.blue
    deleted: typeof chalk.red
    renamed: typeof chalk.yellow
  }
}

export interface Theme {
  name: ThemeName
  colors: ThemeColors
  icons: typeof figures
  isDark: boolean
}

/**
 * 深色主题配置 (默认)
 */
const darkTheme: Theme = {
  name: 'dark',
  isDark: true,
  icons: figures,
  colors: {
    primary: chalk.white,
    secondary: chalk.gray,
    muted: chalk.dim,
    
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
    
    code: {
      keyword: chalk.magenta,
      string: chalk.green,
      number: chalk.cyan,
      comment: chalk.gray,
      operator: chalk.yellow,
      function: chalk.blue,
      variable: chalk.white
    },
    
    diff: {
      added: chalk.green,
      removed: chalk.red,
      modified: chalk.yellow, context: chalk.dim,
      header: chalk.bold.white
    },
    
    border: chalk.gray,
    progress: chalk.cyan,
    spinner: chalk.cyan,
    
    file: {
      created: chalk.green,
      modified: chalk.blue,
      deleted: chalk.red,
      renamed: chalk.yellow
    }
  }
}

/**
 * 浅色主题配置
 */
const lightTheme: Theme = {
  name: 'light',
  isDark: false,
  icons: figures,
  colors: {
    primary: chalk.black,
    secondary: chalk.blackBright,
    muted: chalk.gray,
    
    success: chalk.green,
    error: chalk.red,
    warning: chalk.rgb(184, 134, 11), // 更深的黄色
    info: chalk.blue,
    
    code: {
      keyword: chalk.magenta,
      string: chalk.green,
      number: chalk.cyan,
      comment: chalk.gray,
      operator: chalk.rgb(184, 134, 11),
      function: chalk.blue,
      variable: chalk.black
    },
    
    diff: {
      added: chalk.green,
      removed: chalk.red,
      modified: chalk.rgb(184, 134, 11), context: chalk.gray,
      header: chalk.bold.black
    },
    
    border: chalk.blackBright,
    progress: chalk.blue,
    spinner: chalk.blue,
    
    file: {
      created: chalk.green,
      modified: chalk.blue,
      deleted: chalk.red,
      renamed: chalk.rgb(184, 134, 11)
    }
  }
}

/**
 * 主题管理器
 */
export class ThemeManager {
  private currentTheme: Theme
  private themes: Map<ThemeName, Theme>

  constructor(initialTheme: ThemeName = 'auto') {
    this.themes = new Map([
      ['dark', darkTheme],
      ['light', lightTheme]
    ])
    
    this.currentTheme = this.resolveTheme(initialTheme)
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): Theme {
    return this.currentTheme
  }

  /**
   * 设置主题
   */
  setTheme(themeName: ThemeName): void {
    this.currentTheme = this.resolveTheme(themeName)
  }

  /**
   * 获取当前主题的颜色
   */
  getColors(): ThemeColors {
    return this.currentTheme.colors
  }

  /**
   * 获取主题名称
   */
  getThemeName(): ThemeName {
    return this.currentTheme.name
  }

  /**
   * 检查是否为深色主题
   */
  isDarkTheme(): boolean {
    return this.currentTheme.isDark
  }

  /**
   * 解析主题（处理 auto 模式）
   */
  private resolveTheme(themeName: ThemeName): Theme {
    if (themeName === 'auto') {
      // 自动检测终端主题
      const autoTheme = this.detectTerminalTheme()
      return this.themes.get(autoTheme) || darkTheme
    }
    
    return this.themes.get(themeName) || darkTheme
  }

  /**
   * 检测终端主题
   */
  private detectTerminalTheme(): 'dark' | 'light' {
    // 检查环境变量
    const colorscheme = process.env.COLORSCHEME?.toLowerCase()
    if (colorscheme === 'light') return 'light'
    if (colorscheme === 'dark') return 'dark'

    // 检查 WriteFlow 主题环境变量
    const writeflowTheme = process.env.WRITEFLOW_THEME?.toLowerCase()
    if (writeflowTheme === 'light') return 'light'
    if (writeflowTheme === 'dark') return 'dark'

    // 检查常见的终端环境变量
    const termProgram = process.env.TERM_PROGRAM?.toLowerCase()
    if (termProgram?.includes('vscode')) {
      // VS Code 终端，默认深色
      return 'dark'
    }

    // 检查 macOS 系统主题
    if (process.platform === 'darwin') {
      try {
        const { execSync } = require('child_process')
        const result = execSync('defaults read -g AppleInterfaceStyle 2>/dev/null', { 
          encoding: 'utf8', 
          timeout: 1000 
        }).trim()
        return result === 'Dark' ? 'dark' : 'light'
      } catch {
        // 检测失败，使用默认
      }
    }

    // 默认使用深色主题
    return 'dark'
  }

  /**
   * 添加自定义主题
   */
  addTheme(name: string, theme: Omit<Theme, 'name'>): void {
    if (name === 'dark' || name === 'light' || name === 'auto') {
      throw new Error('Cannot override built-in theme names')
    }
    
    this.themes.set(name as ThemeName, {
      ...theme,
      name: name as ThemeName
    })
  }

  /**
   * 列出所有可用主题
   */
  listThemes(): ThemeName[] {
    return Array.from(this.themes.keys())
  }

  /**
   * 重置为默认主题
   */
  reset(): void {
    this.currentTheme = darkTheme
  }

  /**
   * 根据终端能力调整颜色
   */
  adaptToTerminal(): void {
    const colorLevel = chalk.level
    
    if (colorLevel === 0) {
      // 无颜色支持，禁用所有颜色
      this.disableColors()
    } else if (colorLevel === 1) {
      // 基础颜色支持，简化颜色配置
      this.simplifyColors()
    }
    // level 2 和 3 支持完整颜色，无需调整
  }

  /**
   * 禁用颜色（纯文本模式）
   */
  private disableColors(): void {
    const noColor = (text: string) => text
    const colors = this.currentTheme.colors
    
    // 创建无颜色版本的主题
    const noColorTheme: Theme = {
      ...this.currentTheme,
      colors: {
        primary: noColor as any,
        secondary: noColor as any,
        muted: noColor as any,
        success: noColor as any,
        error: noColor as any,
        warning: noColor as any,
        info: noColor as any,
        code: {
          keyword: noColor as any,
          string: noColor as any,
          number: noColor as any,
          comment: noColor as any,
          operator: noColor as any,
          function: noColor as any,
          variable: noColor as any
        },
        diff: {
          added: noColor as any,
          removed: noColor as any,
          modified: noColor as any, context: noColor as any,
          header: noColor as any
        },
        border: noColor as any,
        progress: noColor as any,
        spinner: noColor as any,
        file: {
          created: noColor as any,
          modified: noColor as any,
          deleted: noColor as any,
          renamed: noColor as any
        }
      }
    }
    
    this.currentTheme = noColorTheme
  }

  /**
   * 简化颜色（基础颜色支持）
   */
  private simplifyColors(): void {
    // 将复杂颜色替换为基础颜色
    // 这里可以根据需要进行调整
  }
}

// 全局主题管理器实例
let globalThemeManager: ThemeManager | null = null

/**
 * 获取全局主题管理器
 */
export function getThemeManager(): ThemeManager {
  if (!globalThemeManager) {
    // 从环境变量读取初始主题
    const initialTheme = (process.env.WRITEFLOW_THEME as ThemeName) || 'auto'
    globalThemeManager = new ThemeManager(initialTheme)
    globalThemeManager.adaptToTerminal()
  }
  return globalThemeManager
}

/**
 * 便捷函数：获取当前主题颜色
 */
export function getThemeColors(): ThemeColors {
  return getThemeManager().getColors()
}

/**
 * 便捷函数：检查是否为深色主题
 */
export function isDarkTheme(): boolean {
  return getThemeManager().isDarkTheme()
}