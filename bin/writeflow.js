#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 编译后的 JavaScript 文件路径
const jsFile = join(__dirname, '..', 'dist', 'cli', 'index.js')

// 直接导入并执行编译后的模块
try {
  await import(jsFile)
} catch (error) {
  console.error('启动 WriteFlow 失败:', error.message)
  process.exit(1)
}