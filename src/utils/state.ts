import { debugLog, logError, logWarn, infoLog } from './log.js'

/**
 * WriteFlow 状态管理工具
 */

/**
 * 获取当前工作目录
 */
export function getCwd(): string {
  return process.cwd()
}

/**
 * 设置当前工作目录
 */
export function setCwd(path: string): void {
  try {
    process.chdir(path)
  } catch (error) {
    logError('设置工作目录失败:', error)
  }
}

/**
 * 获取会话状态
 */
export function getSessionState<T>(key: string, defaultValue: T): T {
  // 简化实现，使用内存存储
  const sessionState = (global as any).__writeflow_session_state__ || {}
  return sessionState[key] !== undefined ? sessionState[key] : defaultValue
}

/**
 * 设置会话状态
 */
export function setSessionState<T>(key: string, value: T): void {
  if (!(global as any).__writeflow_session_state__) {
    (global as any).__writeflow_session_state__ = {}
  }
  (global as any).__writeflow_session_state__[key] = value
}