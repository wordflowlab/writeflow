import chalk from 'chalk'

// 基础 ANSI 去除与显示宽度计算（简版，处理 CJK 与 emoji）
import { debugLog } from './log.js'

const ANSI_REGEX = /\x1B\[[0-9;]*m/g

function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, '')
}

function isFullWidth(codePoint: number): boolean {
  // 参考 East Asian Width 简化集合（来源于广泛实现）
  return (
    codePoint >= 0x1100 && (
      codePoint <= 0x115f || // Hangul Jamo
      codePoint === 0x2329 || codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) || // CJK ... Yi
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul Syllables
      (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compatibility Ideographs
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) || // Fullwidth Forms
      (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    )
  )
}

function charWidth(codePoint: number): number {
  // 控制字符
  if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return 0
  // 组合音标、变体选择器、零宽连字
  if (
    (codePoint >= 0x300 && codePoint <= 0x36f) || // Combining Diacritical Marks
    codePoint === 0x200d || // ZWJ
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) // Variation Selectors
  ) {
    return 0
  }
  // 盒线字符、几何形状、块元素等都按 1 列显示
  if ((codePoint >= 0x2500 && codePoint <= 0x257f) || // Box Drawing
      (codePoint >= 0x2580 && codePoint <= 0x259f) || // Block Elements
      (codePoint >= 0x25a0 && codePoint <= 0x25ff)) { // Geometric Shapes
    return 1
  }
  // CJK 全角范围
  if (isFullWidth(codePoint)) return 2
  // Emoji（大部分）按 2 列处理
  if (codePoint >= 0x1f300 && codePoint <= 0x1ffff) return 2
  return 1
}

function stringWidth(input: string): number {
  let width = 0
  const str = stripAnsi(input)
  for (const ch of str) {
    width += charWidth(ch.codePointAt(0)!)
  }
  return width
}

function truncateToWidth(input: string, maxWidth: number): string {
  let width = 0
  let out = ''
  const raw = input
  // 保留 ANSI 颜色：先拆为无色文本的索引并同步复制字符
  // 简化处理：逐字符复制（含 ANSI），仅按可见字符累积宽度
  for (let i = 0; i < raw.length; ) {
    // 处理 ANSI 片段
    const ansiMatch = raw.slice(i).match(/^\x1B\[[0-9;]*m/)
    if (ansiMatch) {
      out += ansiMatch[0]
      i += ansiMatch[0].length
      continue
    }
    const cp = raw.codePointAt(i)!
    const ch = String.fromCodePoint(cp)
    const w = charWidth(cp)
    if (width + w > maxWidth) break
    out += ch
    width += w
    i += ch.length
  }
  return out
}

/**
 * 在 CLI 启动后输出欢迎横幅（不依赖额外包，尽量还原旧版样式）
 */
export function displayWelcomeBanner(): void {
  const title = chalk.bold(`${chalk.cyan('欢迎使用')} ${chalk.cyanBright('WriteFlow')} AI 写作助手`)
  const subtitle = chalk.gray('专为技术型作家设计的智能写作工具')
  const hint = chalk.gray('输入 ') + chalk.white('/help') + chalk.gray(' 获取帮助 · 开始您的创作之旅')
  const tip = chalk.yellow('💡 支持技术文档、创意写作、学术论文等多种写作模式')

  // 盒子宽度（适度固定，避免中文宽度计算误差）
  const width = 66
  const hr = '─'.repeat(width)
  const pad = (s: string) => {
    // 超长则按显示宽度截断，保证右边界稳定
    const clipped = truncateToWidth(s, width)
    const spaces = Math.max(0, width - stringWidth(clipped))
    return clipped + ' '.repeat(spaces)
  }

  const borderColor = chalk.hex('#3ea6ff')
  const top = borderColor(`┌${  '─'.repeat(width + 2)  }┐`)
  const bottom = borderColor(`└${  '─'.repeat(width + 2)  }┘`)
  const left = borderColor('│ ')
  const right = borderColor(' │')

  const lines = [title, '', subtitle, hint, '', chalk.gray(hr), '', tip]

  debugLog(top)
  for (const line of lines) {
    debugLog(left + pad(line) + right)
  }
  debugLog(bottom)
}
