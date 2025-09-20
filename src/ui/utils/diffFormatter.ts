/**
 * WriteFlow Diff 格式化器
 * 基于 Claude Code 风格的文件差异显示
 */

import chalk from 'chalk'
import { figures } from '../constants/figures.js'

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'hunk'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
  isNoNewline?: boolean
}

export interface DiffOptions {
  maxWidth?: number
  theme?: 'light' | 'dark'
  showLineNumbers?: boolean
  contextLines?: number
  compact?: boolean
}

export interface FileDiff {
  oldPath: string
  newPath: string
  type: 'add' | 'remove' | 'modify' | 'rename'
  lines: DiffLine[]
  additions: number
  deletions: number
}

/**
 * 解析 Git diff 格式
 */
export function parseDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = []
  const lines = diffText.split('\n')
  
  let currentFile: FileDiff | null = null
  let currentHunk: DiffLine[] = []
  let oldLineNumber = 0
  let newLineNumber = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 文件头
    if (line.startsWith('diff --git')) {
      if (currentFile && currentHunk.length > 0) {
        currentFile.lines.push(...currentHunk)
        files.push(currentFile)
      }
      
      const paths = line.match(/a\/(.+?) b\/(.+)/)
      currentFile = {
        oldPath: paths?.[1] || '',
        newPath: paths?.[2] || '',
        type: 'modify',
        lines: [],
        additions: 0,
        deletions: 0
      }
      currentHunk = []
    }
    
    // 索引行
    else if (line.startsWith('index ')) {
      if (currentFile) {
        currentFile.lines.push({
          type: 'header',
          content: line
        })
      }
    }
    
    // 文件模式
    else if (line.startsWith('---') || line.startsWith('+++')) {
      if (currentFile) {
        currentFile.lines.push({
          type: 'header',
          content: line
        })
      }
    }
    
    // Hunk 头
    else if (line.startsWith('@@')) {
      const hunkMatch = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)/)
      if (hunkMatch && currentFile) {
        oldLineNumber = parseInt(hunkMatch[1])
        newLineNumber = parseInt(hunkMatch[2])
        
        if (currentHunk.length > 0) {
          currentFile.lines.push(...currentHunk)
          currentHunk = []
        }
        
        currentFile.lines.push({
          type: 'hunk',
          content: line,
          oldLineNumber,
          newLineNumber
        })
      }
    }
    
    // 内容行
    else if (currentFile && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      const type = line.startsWith('+') ? 'add' : 
                   line.startsWith('-') ? 'remove' : 'context'
      const content = line.slice(1)
      
      const diffLine: DiffLine = {
        type,
        content,
        oldLineNumber: type !== 'add' ? oldLineNumber : undefined,
        newLineNumber: type !== 'remove' ? newLineNumber : undefined
      }
      
      currentHunk.push(diffLine)
      
      if (type === 'add') {
        currentFile.additions++
        newLineNumber++
      } else if (type === 'remove') {
        currentFile.deletions++
        oldLineNumber++
      } else {
        oldLineNumber++
        newLineNumber++
      }
    }
    
    // No newline at end of file
    else if (line.includes('No newline at end of file') && currentHunk.length > 0) {
      currentHunk[currentHunk.length - 1].isNoNewline = true
    }
  }
  
  // 处理最后一个文件
  if (currentFile) {
    if (currentHunk.length > 0) {
      currentFile.lines.push(...currentHunk)
    }
    files.push(currentFile)
  }
  
  return files
}

/**
 * 格式化文件差异
 */
export function formatDiff(fileDiff: FileDiff, options: DiffOptions = {}): string {
  const {
    maxWidth = process.stdout.columns - 2,
    theme = 'dark',
    showLineNumbers = true,
    compact = false
  } = options
  
  const result: string[] = []
  
  // 文件头
  result.push(formatFileHeader(fileDiff, theme))
  
  // 统计信息
  if (fileDiff.additions > 0 || fileDiff.deletions > 0) {
    const stats = formatDiffStats(fileDiff.additions, fileDiff.deletions, theme)
    result.push(stats)
  }
  
  // 处理行
  for (const line of fileDiff.lines) {
    const formatted = formatDiffLine(line, options)
    if (formatted) {
      result.push(formatted)
    }
  }
  
  return result.join('\n')
}

/**
 * 格式化文件头
 */
function formatFileHeader(fileDiff: FileDiff, theme: 'light' | 'dark'): string {
  const icon = getFileIcon(fileDiff.type)
  const colors = getThemeColors(theme)
  
  let header = `${colors.fileIcon(icon)} ${colors.fileName}`
  
  if (fileDiff.type === 'rename' && fileDiff.oldPath !== fileDiff.newPath) {
    header += `${fileDiff.oldPath} → ${fileDiff.newPath}`
  } else {
    header += fileDiff.newPath || fileDiff.oldPath
  }
  
  return colors.fileName(header)
}

/**
 * 格式化差异统计
 */
function formatDiffStats(additions: number, deletions: number, theme: 'light' | 'dark'): string {
  const colors = getThemeColors(theme)
  const total = additions + deletions
  
  if (total === 0) return ''
  
  const additionsText = additions > 0 ? colors.addition(`+${additions}`) : ''
  const deletionsText = deletions > 0 ? colors.deletion(`-${deletions}`) : ''
  
  const parts = [additionsText, deletionsText].filter(Boolean)
  
  return chalk.dim(`(${parts.join(', ')})`)
}

/**
 * 格式化差异行
 */
function formatDiffLine(line: DiffLine, options: DiffOptions): string {
  const { showLineNumbers = true, maxWidth = 80, theme = 'dark' } = options
  const colors = getThemeColors(theme)
  
  let prefix = ''
  let content = line.content
  let style = (text: string) => text
  
  switch (line.type) {
    case 'add':
      prefix = '+'
      style = colors.addition
      break
    case 'remove':
      prefix = '-'
      style = colors.deletion
      break
    case 'context':
      prefix = ' '
      style = colors.context
      break
    case 'header':
      return colors.header(line.content)
    case 'hunk':
      return colors.hunk(line.content)
  }
  
  // 构建行号
  let lineNumbers = ''
  if (showLineNumbers && (line.type === 'add' || line.type === 'remove' || line.type === 'context')) {
    const oldNum = line.oldLineNumber?.toString().padStart(4) || '    '
    const newNum = line.newLineNumber?.toString().padStart(4) || '    '
    lineNumbers = colors.lineNumber(`${oldNum} ${newNum} `)
  }
  
  // 限制内容宽度
  if (maxWidth && content.length > maxWidth - lineNumbers.length - 2) {
    content = content.slice(0, maxWidth - lineNumbers.length - 5) + '...'
  }
  
  const formattedLine = `${lineNumbers}${prefix}${content}`
  
  // 应用样式
  if (line.type === 'add' || line.type === 'remove') {
    return style(formattedLine)
  }
  
  return formattedLine + (line.isNoNewline ? colors.noNewline(' ⚠ no newline') : '')
}

/**
 * 创建简化的差异视图
 */
export function createSimpleDiff(oldContent: string, newContent: string, fileName: string): FileDiff {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  
  const diffLines: DiffLine[] = []
  let additions = 0
  let deletions = 0
  
  // 简单的逐行比较
  const maxLines = Math.max(oldLines.length, newLines.length)
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]
    
    if (oldLine === undefined) {
      // 新增行
      diffLines.push({
        type: 'add',
        content: newLine,
        newLineNumber: i + 1
      })
      additions++
    } else if (newLine === undefined) {
      // 删除行
      diffLines.push({
        type: 'remove',
        content: oldLine,
        oldLineNumber: i + 1
      })
      deletions++
    } else if (oldLine === newLine) {
      // 相同行
      diffLines.push({
        type: 'context',
        content: oldLine,
        oldLineNumber: i + 1,
        newLineNumber: i + 1
      })
    } else {
      // 修改行
      diffLines.push({
        type: 'remove',
        content: oldLine,
        oldLineNumber: i + 1
      })
      diffLines.push({
        type: 'add',
        content: newLine,
        newLineNumber: i + 1
      })
      additions++
      deletions++
    }
  }
  
  return {
    oldPath: fileName,
    newPath: fileName,
    type: 'modify',
    lines: diffLines,
    additions,
    deletions
  }
}

/**
 * 获取文件图标
 */
function getFileIcon(type: FileDiff['type']): string {
  switch (type) {
    case 'add': return figures.plus
    case 'remove': return figures.cross
    case 'rename': return figures.arrowRight
    case 'modify':
    default: return figures.dot
  }
}

/**
 * 获取主题颜色
 */
function getThemeColors(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      addition: chalk.green,
      deletion: chalk.red, context: chalk.gray,
      header: chalk.bold.blue,
      hunk: chalk.cyan,
      lineNumber: chalk.dim.gray,
      fileName: chalk.bold,
      fileIcon: chalk.blue,
      noNewline: chalk.yellow
    }
  } else {
    return {
      addition: chalk.green,
      deletion: chalk.red, context: chalk.dim,
      header: chalk.bold.white,
      hunk: chalk.cyan,
      lineNumber: chalk.dim.gray,
      fileName: chalk.bold.white,
      fileIcon: chalk.blue,
      noNewline: chalk.yellow
    }
  }
}