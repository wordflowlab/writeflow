import React, { useState, useEffect, useRef } from 'react'
import { render } from 'ink'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { 
  ToolExecutionMessage, 
  EnhancedAssistantMessage,
  ToolStatusMessage,
  UserPromptMessage,
  SystemMessage,
  type ToolExecutionInfo 
} from './components/WriterMessage.js'

const createCLIExecutionInfo = (
  toolName: string,
  status: ToolExecutionInfo['status'],
  messageText?: string,
  extra: Partial<ToolExecutionInfo> = {}
): ToolExecutionInfo => ({
  id: `cli-${toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  toolName,
  status,
  message: messageText,
  ...extra
})

interface WriteFlowCommandLineProps {
  writeFlowApp: WriteFlowApp
  onExit?: () => void
}

interface ConversationMessage {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool-execution' | 'tool-status'
  content: string
  timestamp: Date
  toolExecutions?: ToolExecutionInfo[]
  toolName?: string
  toolStatus?: 'started' | 'completed' | 'failed'
  duration?: number
}


/**
 * 启动命令行模式的辅助函数
 */
export async function startEnhancedCommandLineMode(app: WriteFlowApp) {
  console.log('✨ WriteFlow AI 写作助手 (增强命令行模式)')
  console.log('输入消息，按 Enter 发送')
  
  process.stdin.setEncoding('utf8')
  
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  })

  // 创建命令行组件实例
  let currentComponent: any = null
  let messages: any[] = []

  rl.prompt()
  rl.on('line', async (input: string) => {
    const trimmedInput = input.trim()
    
    if (trimmedInput === '/exit' || trimmedInput === '/quit') {
      console.log('👋 再见！')
      rl.close()
      process.exit(0)
      return
    }

    if (trimmedInput === '') {
      rl.prompt()
      return
    }

    try {
      // 添加用户消息
      messages.push({
        id: `msg-${Date.now()}`,
        type: 'user',
        content: trimmedInput,
        timestamp: new Date()
      })

      // 渲染用户消息
      const userMessage = React.createElement(UserPromptMessage, {
        content: trimmedInput,
        addMargin: true
      })
      
      render(userMessage)

      // 处理输入并显示结果
      if (trimmedInput.startsWith('/')) {
        // 显示工具执行开始状态
        const toolStatusStart = React.createElement(ToolStatusMessage, {
          toolName: trimmedInput.slice(1).split(' ')[0],
          status: 'started',
          message: `执行 ${trimmedInput.slice(1).split(' ')[0]} 工具`,
          addMargin: true
        })
        
        const toolRender = render(toolStatusStart)
        
        const startTime = Date.now()
        const result = await app.executeCommand(trimmedInput)
        const duration = Date.now() - startTime
        
        // 更新工具执行完成状态
        toolRender.unmount()
        
        // 解析工具参数
        const commandParts = trimmedInput.slice(1).split(' ')
        const toolName = commandParts[0]
        const toolParams = commandParts.slice(1).join(' ')
        
        // 根据工具类型构造输入参数
        let toolInput: any = {}
        switch (toolName.toLowerCase()) {
          case 'glob':
            toolInput = { pattern: toolParams }
            break
          case 'read':
            toolInput = { path: toolParams }
            break
          case 'grep':
          case 'search':
            toolInput = { pattern: toolParams }
            break
          default:
            toolInput = { query: toolParams }
        }
        
        const toolStatusComplete = React.createElement(ToolStatusMessage, {
          toolName,
          status: 'completed',
          message: `${toolName} 工具执行完成`,
          duration,
          addMargin: true,
          toolInput
        })
        
        render(toolStatusComplete)
        
        if (result && result.trim()) {
          const assistantMessage = React.createElement(EnhancedAssistantMessage, {
            content: result,
            addMargin: true
          })
          
          render(assistantMessage)
        }
      } else {
        // 自由文本输入，不显示模拟的工具执行进度
        // 实际的工具执行将通过 AI 服务的回调机制显示

        console.log('🔧 准备调用 app.handleFreeTextInput，输入:', trimmedInput)
        const result = await app.handleFreeTextInput(trimmedInput, {
          onToolUpdate: (toolName: string, status: string, message?: string) => {
            // 将工具状态更新显示到终端
            console.log(`🔧 [CLI] 工具状态更新: ${toolName} - ${status}${message ? ` (${message})` : ''}`)
          }
        })
        console.log('✅ app.handleFreeTextInput 调用完成，结果:', result ? '有结果' : '无结果')
        
        if (result && result.trim()) {
          const assistantMessage = React.createElement(EnhancedAssistantMessage, {
            content: result,
            addMargin: true
          })
          
          render(assistantMessage)
        }
      }
    } catch (_error) {
      const errorMessage = React.createElement(SystemMessage, {
        content: `处理失败: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        addMargin: true
      })
      
      render(errorMessage)
    }

    rl.prompt()
  })

  rl.on('close', () => {
    console.log('\n👋 再见！')
    process.exit(0)
  })
}
