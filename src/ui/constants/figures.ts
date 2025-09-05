/**
 * WriteFlow 图标常量
 * 基于 figures 包但添加了自定义图标
 */

import baseFigures from 'figures'

export const figures = {
  ...baseFigures,
  // 基础符号
  dot: '●',
  bullet: '•',
  tick: '✓',
  cross: '✖',
  plus: '+',
  minus: '-',
  
  // 箭头
  arrowUp: '↑',
  arrowDown: '↓',
  arrowLeft: '←',
  arrowRight: '→',
  
  // 进度和状态
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  warning: '⚠',
  info: 'ℹ',
  success: '✅',
  error: '❌',
  
  // 文件操作
  file: '📄',
  folder: '📁',
  folderOpen: '📂',
  
  // 代码相关
  code: '⚒',
  codeblock: '```',
  diff: '±',
  
  // 边框字符
  boxVertical: '│',
  boxHorizontal: '─',
  boxTopLeft: '┌',
  boxTopRight: '┐',
  boxBottomLeft: '└',
  boxBottomRight: '┘',
  boxCross: '┼',
  boxVerticalRight: '├',
  boxVerticalLeft: '┤',
  boxHorizontalDown: '┬',
  boxHorizontalUp: '┴',
  
  // 引用
  quote: '▏',
  
  // 特殊
  ellipsis: '…',
  middot: '·',
  section: '§'
}