import React from 'react'
import { render } from 'ink'
import App from './App.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { debugLog } from '../utils/log.js'

export async function startWriteFlowUI(writeFlowApp: WriteFlowApp) {
  try {
    // 强制启用TTY模式
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      debugLog('⚠️ TTY模式不支持，但强制启动React+Ink UI...')
    }
    
    // 确保输入输出流配置正确
    process.stdin.setRawMode && process.stdin.setRawMode(true)
    process.stdin.resume()
    
    console.clear()
    debugLog('🚀 启动WriteFlow\n')
    
    const { waitUntilExit } = render(
      <App writeFlowApp={writeFlowApp} />,
      {
        exitOnCtrlC: true,
        // 采用最佳实践，开启 Ink 对 console 的补丁，避免日志直接写入 stdout 造成界面跳到顶部
        patchConsole: true
      }
    )
    
    return await waitUntilExit()
  } catch (error) {
    // 更详细的错误信息
    console.error('❌ UI启动失败:', error)
    debugLog('📋 回退到传统CLI界面...')
    return await writeFlowApp.startLegacySession()
  }
}