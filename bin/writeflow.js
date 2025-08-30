#!/usr/bin/env node

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// TypeScript 源文件路径
const tsFile = join(__dirname, '..', 'src', 'cli', 'index.ts')

// 使用 tsx 执行 TypeScript 文件
const child = spawn('npx', ['tsx', tsFile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true
})

child.on('exit', (code) => {
  process.exit(code || 0)
})

child.on('error', (error) => {
  console.error('启动 WriteFlow 失败:', error.message)
  process.exit(1)
})