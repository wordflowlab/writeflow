#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 编译后的 JavaScript 文件路径
const jsFile = join(__dirname, '..', 'dist', 'cli', 'index.js')

// 直接导入并执行编译后的模块
try {
  // 在 Windows 上将绝对路径转换为 file:// URL
  const jsFileURL = pathToFileURL(jsFile).href
  await import(jsFileURL)
} catch (error) {
  console.error('启动 WriteFlow 失败:', error.message)
  process.exit(1)
}