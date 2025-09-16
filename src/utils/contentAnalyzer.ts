/**
 * 内容分析器 - 智能判断内容是否需要折叠
 * 采用先进设计的内容分析逻辑
 */

import { 
  CollapsibleContentType, 
  CONTENT_TYPE_PATTERNS 
} from '../types/CollapsibleContent.js'

export interface ContentAnalysis {
  shouldCollapse: boolean
  estimatedLines: number
  contentType: CollapsibleContentType
  previewText: string
  hasCodeBlocks: boolean
  hasLongLines: boolean
  complexity: 'simple' | 'medium' | 'complex'
}

/**
 * 折叠阈值配置 - 基于最佳实践的经验值，提高阈值减少过度折叠
 */
export const COLLAPSE_THRESHOLDS = {
  toolResult: { lines: 15, chars: 1200 },      // 工具结果：提高从10->15行
  codeBlock: { lines: 20, chars: 1500 },       // 代码块：提高从15->20行
  errorMessage: { lines: 8, chars: 600 },      // 错误消息：提高从5->8行
  fileContent: { lines: 25, chars: 2000 },     // 文件内容：提高从20->25行  
  bashOutput: { lines: 12, chars: 800 },       // 命令输出：提高从8->12行
  longText: { lines: 30, chars: 1500 },        // 长文本：大幅提高从12->30行
  creativeContent: { lines: 999999, chars: 999999 }  // 创作内容：永不折叠
}

/**
 * 检测内容类型 - 优先检测创作内容
 */
export function detectContentType(content: string): CollapsibleContentType {
  // 优先检测分析结果 - 避免被创作内容模式错误匹配
  if (CONTENT_TYPE_PATTERNS['analysis-result'].test(content)) {
    return 'analysis-result'
  }

  // 再检测创作内容 - 使用统一的模式匹配
  for (const [type, pattern] of Object.entries(CONTENT_TYPE_PATTERNS)) {
    if (type.includes('creative') || type === 'article' || type === 'novel') {
      if (pattern.test(content)) {
        return type as CollapsibleContentType
      }
    }
  }
  
  // Markdown 内容检测 - 新增专门的 Markdown 识别
  const hasMarkdownFeatures = () => {
    // 检测标题（# ## ###）
    const hasHeadings = /^#{1,6}\s+.+$/gm.test(content)
    // 检测列表（- * +）
    const hasLists = /^[\s]*[-*+]\s+.+$/gm.test(content)
    // 检测代码块（```）
    const hasCodeBlocks = /```[\s\S]*?```/g.test(content)
    // 检测表格（|）
    const hasTables = /\|.*\|/g.test(content)
    // 检测链接和图片
    const hasLinksOrImages = /!?\[[^\]]*\]\([^)]*\)/g.test(content)
    // 检测粗体、斜体
    const hasFormatting = /\*\*.*?\*\*|\*.*?\*|__.*?__|_.*?_/g.test(content)

    return hasHeadings || hasLists || hasCodeBlocks || hasTables || hasLinksOrImages || hasFormatting
  }

  // 如果包含丰富的 Markdown 特征，优先返回适合的类型
  if (hasMarkdownFeatures()) {
    // 如果包含很多结构化内容，可能是文章或分析结果
    if (/^#{1,2}\s+.+$/gm.test(content) && content.split('\n').length > 10) {
      return 'analysis' // 使用 analysis 类型，避免折叠
    }
    // 否则返回通用文本，确保不会被过度折叠
    return 'text'
  }

  // 代码块检测
  if (/```[\s\S]*?```/.test(content) || /^\s*(function|class|import|export|const|let|var)\s+/m.test(content)) {
    return 'code-block'
  }
  
  // 错误信息检测
  if (/^(Error:|ERROR:|错误:|❌|✗)/m.test(content) || content.includes('Stack trace') || content.includes('Exception')) {
    return 'error-message'
  }
  
  // Bash 输出检测
  if (/^\$\s+/.test(content) || /^(bash|sh|zsh|fish):/m.test(content) || content.includes('command not found')) {
    return 'bash-output'
  }
  
  // 文件内容检测
  if (content.includes('import ') || content.includes('export ') || /\.(js|ts|py|rs|go|java|css|html)/.test(content)) {
    return 'file-content'
  }
  
  // 长文本检测
  if (content.split('\n').length > 15 || content.length > 1000) {
    return 'long-text'
  }
  
  // 默认为工具执行
  return 'tool-execution'
}

/**
 * 判断是否应该自动折叠 - 创作内容永不折叠
 */
export function shouldAutoCollapse(content: string, type: CollapsibleContentType): boolean {
  const lines = content.split('\n').length
  const chars = content.length
  
  // 创作内容永不折叠
  switch (type) {
    case 'creative-content':
    case 'creative-writing':
    case 'article':
    case 'novel':
      return false  // 创作内容永远不折叠
    
    case 'tool-execution':
    case 'tool-output':
      return lines > COLLAPSE_THRESHOLDS.toolResult.lines || chars > COLLAPSE_THRESHOLDS.toolResult.chars
    
    case 'code-block':
      return lines > COLLAPSE_THRESHOLDS.codeBlock.lines || chars > COLLAPSE_THRESHOLDS.codeBlock.chars
    
    case 'error-message':
      return lines > COLLAPSE_THRESHOLDS.errorMessage.lines || chars > COLLAPSE_THRESHOLDS.errorMessage.chars
    
    case 'file-content':
      return lines > COLLAPSE_THRESHOLDS.fileContent.lines || chars > COLLAPSE_THRESHOLDS.fileContent.chars
    
    case 'bash-output':
      return lines > COLLAPSE_THRESHOLDS.bashOutput.lines || chars > COLLAPSE_THRESHOLDS.bashOutput.chars
    
    case 'long-text':
      return lines > COLLAPSE_THRESHOLDS.longText.lines || chars > COLLAPSE_THRESHOLDS.longText.chars

    case 'analysis':
    case 'analysis-result':
      // 分析结果通常包含重要的结构化信息，使用非常高的折叠阈值
      // 因为这类内容对用户非常重要，应尽可能避免折叠
      return lines > 80 || chars > 4000

    case 'text':
      // 包含 Markdown 格式的文本，使用适中的折叠阈值
      return lines > 25 || chars > 1500

    default:
      // 提高默认阈值
      return lines > 20 || chars > 1200
  }
}

/**
 * 生成预览文本
 */
export function generatePreview(content: string, maxLines: number = 3, maxChars: number = 200): string {
  const lines = content.split('\n')
  
  // 如果内容很短，直接返回
  if (lines.length <= maxLines && content.length <= maxChars) {
    return content
  }
  
  // 截取前几行
  let preview = lines.slice(0, maxLines).join('\n')
  
  // 如果单行太长，也需要截取
  if (preview.length > maxChars) {
    preview = preview.substring(0, maxChars) + '...'
  }
  
  // 计算剩余内容
  const remainingLines = Math.max(0, lines.length - maxLines)
  const remainingChars = Math.max(0, content.length - preview.length)
  
  // 添加提示信息
  let suffix = ''
  if (remainingLines > 0) {
    suffix = ` (+${remainingLines} lines)`
  } else if (remainingChars > 0) {
    suffix = ` (+${remainingChars} chars)`
  }
  
  return preview + suffix
}

/**
 * 分析内容的复杂度
 */
export function analyzeComplexity(content: string): ContentAnalysis['complexity'] {
  const lines = content.split('\n')
  const hasCodeBlocks = /```[\s\S]*?```/.test(content)
  const hasLongLines = lines.some(line => line.length > 120)
  const hasNestedStructure = content.includes('  ') && content.includes('    ') // 检测缩进
  
  if (hasCodeBlocks || lines.length > 50 || hasNestedStructure) {
    return 'complex'
  } else if (lines.length > 20 || hasLongLines) {
    return 'medium'
  } else {
    return 'simple'
  }
}

/**
 * 综合分析内容
 */
export function analyzeContent(content: string): ContentAnalysis {
  const contentType = detectContentType(content)
  const shouldCollapse = shouldAutoCollapse(content, contentType)
  const lines = content.split('\n')
  const estimatedLines = lines.length
  const hasCodeBlocks = /```[\s\S]*?```/.test(content)
  const hasLongLines = lines.some(line => line.length > 120)
  const complexity = analyzeComplexity(content)
  
  // 生成预览文本
  const previewLines = contentType === 'error-message' ? 2 : 3
  const previewText = generatePreview(content, previewLines)
  
  return {
    shouldCollapse,
    estimatedLines,
    contentType,
    previewText,
    hasCodeBlocks,
    hasLongLines,
    complexity
  }
}

/**
 * 获取内容类型对应的 emoji
 */
export function getContentTypeEmoji(type: CollapsibleContentType): string {
  switch (type) {
    case 'tool-execution':
    case 'tool-output': return '🔧'
    case 'code-block':
    case 'code': return '💻'
    case 'file-content': return '📄'
    case 'error-message':
    case 'error': return '❌'
    case 'bash-output': return '⚡'
    case 'long-text':
    case 'text': return '📝'
    case 'analysis-result':
    case 'analysis': return '📊'
    default: return '📦'
  }
}

/**
 * 获取内容类型的友好名称
 */
export function getContentTypeName(type: CollapsibleContentType): string {
  switch (type) {
    case 'tool-execution': return '工具执行'
    case 'tool-output': return '工具执行结果'
    case 'code-block':
    case 'code': return '代码块'
    case 'file-content': return '文件内容'
    case 'error-message':
    case 'error': return '错误信息'
    case 'bash-output': return '命令输出'
    case 'long-text':
    case 'text': return '长文本'
    case 'analysis-result':
    case 'analysis': return '分析结果'
    default: return '内容'
  }
}