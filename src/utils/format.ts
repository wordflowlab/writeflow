/**
 * 通用格式化工具函数
 * 提供时间、文件大小等常用格式化功能
 */

/**
 * 格式化持续时间（毫秒 -> 可读格式）
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  
  if (seconds < 60) {
    return `${seconds}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

/**
 * 格式化文件大小（字节 -> 可读格式）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const base = 1024
  const index = Math.floor(Math.log(bytes) / Math.log(base))
  const size = bytes / Math.pow(base, index)
  
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/**
 * 格式化数字（带千位分隔符）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, total: number, decimals: number = 1): string {
  if (total === 0) return '0%'
  const percentage = (value / total) * 100
  return `${percentage.toFixed(decimals)}%`
}

/**
 * 格式化相对时间（多久之前）
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) {
    return '刚才'
  }
  
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}分钟前`
  }
  
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}小时前`
  }
  
  const days = Math.floor(diff / 86400000)
  if (days < 30) {
    return `${days}天前`
  }
  
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months}个月前`
  }
  
  const years = Math.floor(days / 365)
  return `${years}年前`
}

/**
 * 截断长文本
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * 格式化 JSON（美化输出）
 */
export function formatJSON(obj: any, indent: number = 2): string {
  try {
    return JSON.stringify(obj, null, indent)
  } catch (_error) {
    return String(obj)
  }
}