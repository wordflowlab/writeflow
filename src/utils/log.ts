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
 * 获取环境变量控制的日志级别
 */
function getLogLevelFromEnv(): LogLevel {
  // 完全静默模式
  if (process.env.WRITEFLOW_QUIET === 'true') {
    return LogLevel.ERROR
  }
  
  // 调试模式
  if (process.env.WRITEFLOW_DEBUG === 'true' || process.env.DEBUG === 'true') {
    return LogLevel.DEBUG
  }
  
  // 详细模式
  if (process.env.WRITEFLOW_DEBUG_STREAM === 'verbose') {
    return LogLevel.DEBUG
  }
  
  // 默认只显示错误，保持控制台干净
  return LogLevel.ERROR
}

/**
 * 当前日志级别
 */
let currentLogLevel = getLogLevelFromEnv()

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
 * 便捷调试日志函数 - 用于替换debugLog
 * 只在调试模式下输出，生产环境零性能开销
 */
export function debugLog(message: string, ..._args: any[]): void {
  if (currentLogLevel >= LogLevel.DEBUG) {
    console.log(message, ..._args)
  }
}

/**
 * 便捷信息日志函数 - 用于重要的用户反馈
 */
export function infoLog(message: string, ..._args: any[]): void {
  if (currentLogLevel >= LogLevel.INFO) {
    console.log(message, ..._args)
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
    debugLog: (message: string, ..._args: any[]) => debugLog(`${prefix}: ${message}`, ..._args),
  }
}