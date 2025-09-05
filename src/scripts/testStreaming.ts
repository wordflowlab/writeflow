#!/usr/bin/env node

/**
 * WriteFlow 流式输出测试启动器
 */

import React from 'react'
import { render } from 'ink'
import StreamingTest from '../ui/test/streamingTest.js'

console.log('🚀 启动 WriteFlow 流式输出测试...\n')

// 渲染测试应用
const { unmount } = render(React.createElement(StreamingTest))

// 处理退出信号
process.on('SIGINT', () => {
  unmount()
  console.log('\n\n测试已退出。')
  process.exit(0)
})

process.on('SIGTERM', () => {
  unmount()
  process.exit(0)
})