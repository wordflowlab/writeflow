/**
 * 可折叠内容相关类型定义
 * 扩展现有的 ContentBlock 系统以支持可折叠功能
 */

import type { ContentBlock } from './UIMessage.js'

// 折叠状态接口
export interface CollapsibleState {
  id: string
  collapsed: boolean
  autoCollapse: boolean
  maxLines: number
  shortcutKey?: string
  focusable?: boolean
}

// 内容渲染元数据
export interface ContentRenderMetadata {
  estimatedLines: number
  hasLongContent: boolean
  contentType: CollapsibleContentType
  toolName?: string
  language?: string
  filePath?: string
}

// 扩展的内容块接口
export interface ExtendedContentBlock {
  collapsible?: CollapsibleState
  renderMetadata?: ContentRenderMetadata
}

// 可折叠内容类型
export type CollapsibleContentType = 
  | 'tool-execution'
  | 'tool-output'
  | 'code-block'
  | 'code'
  | 'file-content'
  | 'error-message'
  | 'error'
  | 'analysis-result'
  | 'analysis'
  | 'long-text'
  | 'text'
  | 'bash-output'
  | 'creative-content'   // 新增：创作内容（小说、文章等）
  | 'creative-writing'   // 新增：创意写作
  | 'article'           // 新增：文章
  | 'novel'             // 新增：小说

// 键盘快捷键配置
export interface KeyboardShortcuts {
  toggle: string          // 默认 'ctrl+r'
  toggleAll: string       // 默认 'ctrl+shift+r'
  navigate: {
    next: string         // 默认 '↓'
    prev: string         // 默认 '↑'
  }
}

// 可折叠内容选项
export interface CollapsibleOptions {
  maxLines?: number
  defaultCollapsed?: boolean
  autoCollapse?: boolean
  contentType?: CollapsibleContentType
  shortcuts?: Partial<KeyboardShortcuts>
  showPreview?: boolean
  previewLines?: number
}

// 全局折叠状态管理
export interface CollapsibleManager {
  states: Map<string, CollapsibleState>
  focusedId: string | null
  globalCollapsed: boolean
}

// 折叠状态变化事件
export interface CollapsibleStateChangeEvent {
  contentId: string
  collapsed: boolean
  contentType: CollapsibleContentType
  trigger: 'user' | 'auto' | 'global'
}

// 内容分析结果
export interface ContentAnalysis {
  shouldAutoCollapse: boolean
  estimatedLines: number
  contentType: CollapsibleContentType
  hasCodeBlocks: boolean
  hasLongLines: boolean
  complexity: 'simple' | 'medium' | 'complex'
}

// 默认配置 - 提高阈值减少过度折叠
export const DEFAULT_COLLAPSIBLE_OPTIONS: Required<CollapsibleOptions> = {
  maxLines: 30,              // 提高默认阈值从15->30行
  defaultCollapsed: false,
  autoCollapse: true,
  contentType: 'long-text',
  shortcuts: {
    toggle: 'ctrl+r',
    toggleAll: 'ctrl+shift+r',
    navigate: {
      next: '↓',
      prev: '↑',
    },
  },
  showPreview: true,
  previewLines: 3,
}

// 内容类型检测规则
export const CONTENT_TYPE_PATTERNS = {
  'tool-execution': /^(🔧|⚡|📖|🔍|✏️|✂️)/,
  'code-block': /^```|\n.*?```/s,
  'file-content': /^(📄|File:|文件:)/,
  'error-message': /^(❌|Error:|错误:|Exception)/,
  'analysis-result': /^(📊|分析|Analysis|Summary)|项目分析/,
  // 新增：创作内容检测模式
  'creative-content': /^(📝|✍️|🎭|📖|📚)|(写作|创作|小说|文章|故事|散文|诗歌|剧本)/,
  'creative-writing': /(创意写作|文学创作|自由写作|想象力|灵感|创造性)/,
  'article': /(文章|论文|评论|报告|专栏|博客|教程|指南)/,
  'novel': /(小说|故事|情节|角色|对话|章节|续写|创作小说)/,
} as const

// 自动折叠阈值配置
export const AUTO_COLLAPSE_THRESHOLDS: Record<string, number> = {
  lines: 20,              // 提高阈值从 8 -> 20，减少过度折叠
  characters: 800,        // 提高字符限制从 500 -> 800  
  codeBlockLines: 10,     // 提高代码块阈值从 6 -> 10
  toolOutputLines: 8,     // 提高工具输出阈值从 5 -> 8
  errorMessageLines: 5,   // 提高错误消息阈值从 3 -> 5
  creativeContentLines: 999999,  // 创作内容永远不折叠
}