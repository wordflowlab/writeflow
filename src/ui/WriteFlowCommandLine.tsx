import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, render } from 'ink'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { getTheme } from '../utils/theme.js'
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
 * WriteFlow 命令行模式 React 组件
 * 提供类似 Claude Code 的工具执行显示效果
 */
export function WriteFlowCommandLine({ 
  writeFlowApp, 
  onExit 
}: WriteFlowCommandLineProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesRef = useRef<ConversationMessage[]>([])
  
  const theme = getTheme()

  // 添加消息到对话历史
  const addMessage = (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
    const newMessage: ConversationMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    }
    
    messagesRef.current.push(newMessage)
    setMessages([...messagesRef.current])
  }

  // 更新最后一条消息
  const updateLastMessage = (updates: Partial<ConversationMessage>) => {
    if (messagesRef.current.length > 0) {
      const lastIndex = messagesRef.current.length - 1
      messagesRef.current[lastIndex] = {
        ...messagesRef.current[lastIndex],
        ...updates
      }
      setMessages([...messagesRef.current])
    }
  }

  // 处理用户输入
  const handleUserInput = async (input: string) => {
    try {
      setIsProcessing(true)
      
      // 添加用户消息
      addMessage({
        type: 'user',
        content: input
      })

      // 检查是否是斜杠命令
      if (input.startsWith('/')) {
        await handleSlashCommand(input)
      } else {
        await handleFreeTextInput(input)
      }
    } catch (error) {
      addMessage({
        type: 'system',
        content: `处理失败: ${error instanceof Error ? error.message : String(error)}`
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // 处理斜杠命令
  const handleSlashCommand = async (command: string) => {
    // 解析工具执行
    const toolName = command.slice(1).split(' ')[0]
    
    // 添加工具执行开始消息
    addMessage({
      type: 'tool-status',
      content: `执行 ${toolName} 工具`,
      toolName,
      toolStatus: 'started'
    })

    const startTime = Date.now()
    
    try {
      const result = await writeFlowApp.executeCommand(command)
      const duration = Date.now() - startTime
      
      // 更新工具状态为完成
      updateLastMessage({
        toolStatus: 'completed',
        duration
      })
      
      // 添加结果消息
      if (result && result.trim()) {
        addMessage({
          type: 'assistant',
          content: result
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      // 更新工具状态为失败
      updateLastMessage({
        toolStatus: 'failed',
        duration
      })
      
      throw error
    }
  }

  // 处理自由文本输入
  const handleFreeTextInput = async (input: string) => {
    // 添加处理指示器
    addMessage({
      type: 'tool-execution',
      content: '预处理请求和分析内容...',
      toolExecutions: [
        createCLIExecutionInfo('Glob', 'pending', '准备搜索文件'),
        createCLIExecutionInfo('Read', 'pending', '准备读取内容')
      ]
    })

    try {
      // 模拟工具执行过程的实时更新
      const mockToolExecution = async () => {
        // 更新 Glob 工具状态
        updateLastMessage({
          toolExecutions: [
            createCLIExecutionInfo('Glob', 'running', '正在搜索文件'),
            createCLIExecutionInfo('Read', 'pending', '等待搜索完成')
          ]
        })

        await new Promise(resolve => setTimeout(resolve, 500))

        // 更新完成状态
        updateLastMessage({
          toolExecutions: [
            createCLIExecutionInfo('Glob', 'completed', '找到 25 个匹配文件', { duration: 150 }),
            createCLIExecutionInfo('Read', 'running', '正在读取文件内容')
          ]
        })

        await new Promise(resolve => setTimeout(resolve, 300))

        updateLastMessage({
          toolExecutions: [
            createCLIExecutionInfo('Glob', 'completed', '找到 25 个匹配文件', { duration: 150 }),
            createCLIExecutionInfo('Read', 'completed', '读取完成', { duration: 280 })
          ]
        })
      }

      // 执行模拟和实际处理
      const [, result] = await Promise.all([
        mockToolExecution(),
        writeFlowApp.handleFreeTextInput(input, {
          onToolUpdate: (toolName: string, status: string, message?: string) => {
            // 将工具状态更新传递到UI
            console.log(`🔧 [UI] 工具状态更新: ${toolName} - ${status}${message ? ` (${message})` : ''}`)
          }
        })
      ])
      
      // 添加 AI 响应
      if (result && result.trim()) {
        addMessage({
          type: 'assistant',
          content: result
        })
      }
    } catch (error) {
      // 更新工具执行为失败状态
      updateLastMessage({
        toolExecutions: [
          createCLIExecutionInfo('Glob', 'failed', '执行失败'),
          createCLIExecutionInfo('Read', 'failed', '执行失败')
        ]
      })
      throw error
    }
  }

  // 渲染消息
  const renderMessage = (message: ConversationMessage) => {
    switch (message.type) {
      case 'user':
        return (
          <UserPromptMessage
            key={message.id}
            content={message.content}
            addMargin={true}
          />
        )
      
      case 'assistant':
        return (
          <EnhancedAssistantMessage
            key={message.id}
            content={message.content}
            addMargin={true}
          />
        )
      
      case 'tool-execution':
        return (
          <ToolExecutionMessage
            key={message.id}
            executions={message.toolExecutions || []}
            title={message.content}
            addMargin={true}
          />
        )
      
      case 'tool-status':
        return (
          <ToolStatusMessage
            key={message.id}
            toolName={message.toolName || ''}
            status={message.toolStatus || 'started'}
            message={message.content}
            duration={message.duration}
            addMargin={true}
          />
        )
      
      case 'system':
        return (
          <SystemMessage
            key={message.id}
            content={message.content}
            type={message.content.includes('失败') ? 'error' : 'info'}
            addMargin={true}
          />
        )
      
      default:
        return null
    }
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* 对话历史 */}
      {messages.map(renderMessage)}
      
      {/* 处理状态指示 */}
      {isProcessing && (
        <Box marginTop={1}>
          <Text color={theme.dimText}>正在处理...</Text>
        </Box>
      )}
    </Box>
  )
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
    } catch (error) {
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
