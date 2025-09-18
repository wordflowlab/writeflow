/**
 * WriteFlow 流式 AI 聊天组件
 * 展示完整的流式 AI 系统集成
 */

import React, { useState } from 'react'
import { Text, Box, useInput } from 'ink'
import { useAIStreaming } from '../../hooks/useAIStreaming.js'
import { StreamingOutputManager } from '../streaming/StreamingOutputManager.js'

export interface StreamingAIChatProps {
  systemPrompt?: string
  model?: string
  theme?: 'light' | 'dark'
  enableToolCalls?: boolean
  allowedTools?: string[]
  showDebugInfo?: boolean
  onResponse?: (content: string) => void
}

export const StreamingAIChat: React.FC<StreamingAIChatProps> = ({
  systemPrompt = "你是 WriteFlow AI 助手，专门帮助用户进行写作和代码开发。",
  model,
  theme = 'dark',
  enableToolCalls = false,
  allowedTools = [],
  showDebugInfo = false,
  onResponse
}) => {
  const [userInput, setUserInput] = useState('')
  const [isInputMode, setIsInputMode] = useState(true)
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    streamId?: string
  }>>([])

  // AI 流式处理
  const aiStreaming = useAIStreaming({
    systemPrompt,
    model,
    theme,
    enableToolCalls,
    allowedTools,
    enableRealTimeFormatting: true,
    renderDelay: 25,
    chunkSize: 30,
    onStart: () => {
      setIsInputMode(false)
    },
    onComplete: (response) => {
      // 添加 AI 响应到历史
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          streamId: response.streamId
        }
      ])
      
      setIsInputMode(true)
      onResponse?.(response.content)
    },
    onError: (error) => {
      console.error('AI 请求失败:', error)
      setIsInputMode(true)
    }
  })

  // 处理用户输入
  useInput((input, key) => {
    if (key.return && isInputMode) {
      if (userInput.trim()) {
        // 添加用户消息到历史
        setChatHistory(prev => [
          ...prev,
          {
            role: 'user',
            content: userInput,
            timestamp: Date.now()
          }
        ])

        // 发起 AI 请求
        aiStreaming.ask(userInput)
        setUserInput('')
      }
    } else if (key.ctrl && input === 'c') {
      // Ctrl+C 停止流式处理
      if (aiStreaming.state.isStreaming) {
        aiStreaming.stop()
        setIsInputMode(true)
      } else {
        process.exit(0)
      }
    } else if (key.ctrl && input === 'r') {
      // Ctrl+R 重置聊天
      aiStreaming.reset()
      setChatHistory([])
      setUserInput('')
      setIsInputMode(true)
    } else if (isInputMode && !key.ctrl && !key.meta) {
      if (key.backspace) {
        setUserInput(prev => prev.slice(0, -1))
      } else if (input && input.length === 1) {
        setUserInput(prev => prev + input)
      }
    }
  })

  const statusColor = aiStreaming.state.isStreaming ? 'cyan' : 
                     aiStreaming.state.isComplete ? 'green' :
                     aiStreaming.state.error ? 'red' : 'gray'

  return (
    <Box flexDirection="column" height={process.stdout.rows - 2}>
      {/* 标题栏 */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          WriteFlow AI Chat - {model || 'Default Model'}
        </Text>
        <Text color="gray" dimColor> | </Text>
        <Text color={statusColor}>
          {aiStreaming.state.isStreaming ? '正在思考...' :
           aiStreaming.state.isComplete ? '已完成' :
           aiStreaming.state.error ? '出错了' : '等待输入'}
        </Text>
      </Box>

      {/* 聊天历史 */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
        {chatHistory.length === 0 && (
          <Box marginBottom={1}>
            <Text dimColor>
              欢迎使用 WriteFlow AI Chat! 输入问题并按回车开始对话。
              {'\n'}快捷键：Ctrl+C 停止/退出 | Ctrl+R 重置聊天
            </Text>
          </Box>
        )}

        {chatHistory.map((message, index) => (
          <Box key={index} marginBottom={1} flexDirection="column">
            {/* 消息头 */}
            <Box marginBottom={0}>
              <Text color={message.role === 'user' ? 'blue' : 'green'} bold>
                {message.role === 'user' ? '👤 你' : '🤖 AI'}
              </Text>
              <Text dimColor> - {new Date(message.timestamp).toLocaleTimeString()}</Text>
              {message.streamId && showDebugInfo && (
                <Text dimColor> ({message.streamId})</Text>
              )}
            </Box>

            {/* 消息内容 */}
            <Box paddingLeft={3}>
              {message.role === 'assistant' ? (
                <StreamingOutputManager
                  streamId={message.streamId || `static-${index}`}
                  content={message.content}
                  contentType="auto"
                  delay={0} // 历史消息立即显示
                  theme={theme}
                  enableSyntaxHighlight={true}
                  showProgress={false}
                  debug={showDebugInfo}
                />
              ) : (
                <Text>{message.content}</Text>
              )}
            </Box>
          </Box>
        ))}

        {/* 当前流式响应 */}
        {aiStreaming.state.isStreaming && (
          <Box marginBottom={1} flexDirection="column">
            <Box marginBottom={0}>
              <Text color="green" bold>🤖 AI</Text>
              <Text dimColor> - 正在响应...</Text>
              {showDebugInfo && (
                <Text dimColor> (进度: {aiStreaming.progress.toFixed(1)}%)</Text>
              )}
            </Box>
            <Box paddingLeft={3}>
              <StreamingOutputManager
                streamId={aiStreaming.streamId}
                content={aiStreaming.content}
                contentType="auto"
                delay={25}
                theme={theme}
                enableSyntaxHighlight={true}
                showProgress={showDebugInfo}
                debug={showDebugInfo}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* 输入区域 */}
      <Box borderStyle="single" borderColor={isInputMode ? "green" : "gray"} paddingX={1}>
        <Text color={isInputMode ? "green" : "gray"}>
          {isInputMode ? "💬 输入消息: " : "⏳ 请等待: "}
        </Text>
        <Text>
          {isInputMode ? userInput : "AI 正在处理中..."}
          {isInputMode && (
            <Text color="green">
              {Date.now() % 1000 < 500 ? '|' : ' '}
            </Text>
          )}
        </Text>
      </Box>

      {/* 调试信息 */}
      {showDebugInfo && (
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Box flexDirection="column">
            <Text dimColor>
              Debug: {aiStreaming.serviceStatus.activeStreams} 活动流 |
              内存: {(aiStreaming.serviceStatus.pipelineStats.memoryUsage / 1024).toFixed(1)}KB |
              流 ID: {aiStreaming.streamId}
            </Text>
            {aiStreaming.state.error && (
              <Text color="red">错误: {aiStreaming.state.error.message}</Text>
            )}
            {aiStreaming.state.response?.streamingMetrics && (
              <Text dimColor>
                指标: {aiStreaming.state.response.streamingMetrics.totalChunks} 块 |
                平均: {aiStreaming.state.response.streamingMetrics.averageChunkSize} 字符 |
                格式化: {aiStreaming.state.response.streamingMetrics.formatTime}ms
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}

