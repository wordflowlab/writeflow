import { debugLog } from '../utils/log.js'

/**
 * WriteFlow 简化版本的 Statsig 服务
 * 提供基本的事件记录接口，但不进行实际的数据收集
 */

// 简化的事件记录函数
export function logEvent(eventName: string, data?: Record<string, any>): void {
  // 在开发模式下可以输出到控制台，生产环境下静默
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--debug')) {
    debugLog(`[WriteFlow Event] ${eventName}`, data ? JSON.stringify(data) : '')
  }
  
  // WriteFlow 暂时不需要实际的分析数据收集
  // 这个函数主要是为了兼容旧版本代码的接口
}

// 其他可能需要的 statsig 接口，都提供空实现
export function initialize(): Promise<void> {
  return Promise.resolve()
}

export function getFeatureGate(gateName: string): boolean {
  return false // WriteFlow 暂时不使用特性门控
}

export function getConfig(configName: string): Record<string, any> {
  return {} // WriteFlow 暂时不使用远程配置
}

export default {
  logEvent,
  initialize,
  getFeatureGate,
  getConfig,
}