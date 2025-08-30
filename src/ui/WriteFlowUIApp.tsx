import React from 'react'
import { render } from 'ink'
import { App } from './App.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'

export async function startWriteFlowUI(writeFlowApp: WriteFlowApp) {
  try {
    // 强制启用TTY模式
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log('⚠️ TTY模式不支持，但强制启动React+Ink UI...')
    }
    
    // 确保输入输出流配置正确
    process.stdin.setRawMode && process.stdin.setRawMode(true)
    process.stdin.resume()
    
    console.clear()
    console.log('🚀 启动WriteFlow React+Ink UI...\n')
    
    const { waitUntilExit } = render(
      <App writeFlowApp={writeFlowApp} />,
      {
        exitOnCtrlC: true,
        patchConsole: false
      }
    )
    
    return await waitUntilExit()
  } catch (error) {
    // 更详细的错误信息
    console.error('❌ UI启动失败:', error)
    console.log('📋 回退到传统CLI界面...')
    return await writeFlowApp.startLegacySession()
  }
}