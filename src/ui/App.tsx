import React from 'react'
import { WriteFlowREPL } from './WriteFlowREPL.js'
import { WriteFlowApp } from '../cli/writeflow-app.js'

interface AppProps {
  writeFlowApp: WriteFlowApp
}

export default function App({ writeFlowApp }: AppProps) {
  // 使用专业级 WriteFlow REPL，提供完整的 AI 写作助手体验
  return <WriteFlowREPL writeFlowApp={writeFlowApp} />
}