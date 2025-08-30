import React from 'react'
import { render } from 'ink'
import { App } from './App.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'

export async function startWriteFlowUI(writeFlowApp: WriteFlowApp) {
  try {
    // 检查是否支持Raw Mode
    if (!process.stdin.isTTY) {
      throw new Error('Raw mode not supported')
    }
    
    const { waitUntilExit } = render(
      <App writeFlowApp={writeFlowApp} />
    )
    
    return await waitUntilExit()
  } catch (error) {
    // 回退到传统CLI界面
    console.log('UI模式不支持，启动传统模式...')
    return await writeFlowApp.startLegacySession()
  }
}