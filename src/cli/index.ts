#!/usr/bin/env node

/**
 * WriteFlow AI 写作助手
 * 主入口文件
 */

import { debugLog, logError } from './../utils/log.js'
import { WriteFlowCLI } from './writeflow-cli.js'

async function main() {
  const cli = new WriteFlowCLI()
  await cli.run()
}

// 处理未捕获的错误
process.on('unhandledRejection', (reason, _promise) => {
  logError('未处理的Promise拒绝:', reason)
  if (!(global as any).WRITEFLOW_INTERACTIVE) process.exit(1)
})

process.on('uncaughtException', (error) => {
  logError('未捕获的异常:', error)
  if (!(global as any).WRITEFLOW_INTERACTIVE) process.exit(1)
})

// 优雅关闭
process.on('SIGINT', () => {
  debugLog('\n👋 WriteFlow 正在关闭...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  debugLog('\n👋 WriteFlow 正在关闭...')
  process.exit(0)
})

// 启动应用
main().catch((error) => {
  logError('WriteFlow 启动失败:', error)
  process.exit(1)
})