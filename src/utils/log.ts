/**
 * WriteFlow 日志工具
 * WriteFlow 日志系统
 */

import { randomUUID } from 'crypto'

// 会话 ID
export const SESSION_ID = randomUUID()

/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * 当前日志级别
 */
let currentLogLevel = LogLevel.INFO

/**
 * 设置日志级别
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level
}

/**
 * 记录错误
 */
export function logError(message: string, error?: any): void {
  if (currentLogLevel >= LogLevel.ERROR) {
    console.error(`[ERROR] ${message}`, error || '')
  }
}

/**
 * 记录警告
 */
export function logWarn(message: string, data?: any): void {
  if (currentLogLevel >= LogLevel.WARN) {
    console.warn(`[WARN] ${message}`, data || '')
  }
}

/**
 * 记录信息
 */
export function logInfo(message: string, data?: any): void {
  if (currentLogLevel >= LogLevel.INFO) {
    console.log(`[INFO] ${message}`, data || '')
  }
}

/**
 * 记录调试信息
 */
export function logDebug(message: string, data?: any): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(`[DEBUG] ${message}`, data || '')
  }
}

/**
 * 创建子日志器
 */
export function createLogger(prefix: string) {
  return {
    error: (message: string, error?: any) => logError(`${prefix}: ${message}`, error),
    warn: (message: string, data?: any) => logWarn(`${prefix}: ${message}`, data),
    info: (message: string, data?: any) => logInfo(`${prefix}: ${message}`, data),
    debug: (message: string, data?: any) => logDebug(`${prefix}: ${message}`, data),
  }
}