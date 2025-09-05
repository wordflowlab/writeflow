#!/usr/bin/env node

/**
 * 测试字符级流式输出
 * 验证完整的端到端流式渲染管道
 */

import React from 'react'
import { render } from 'ink'
import { Text, Box } from 'ink'
import { StreamingText } from '../ui/components/streaming/StreamingText.js'
import { StreamingService } from '../services/streaming/StreamingService.js'

const TEST_CONTENT = "这是一个完整的字符级流式输出测试。你应该能看到每个字符逐个出现，就像在 Claude Code 中看到的效果一样。这验证了我们新实现的 uiChunk 事件系统是否正常工作！"

const CharacterStreamingTest = () => {
  const [streamingService] = React.useState(() => new StreamingService())
  const [testStarted, setTestStarted] = React.useState(false)
  const [testComplete, setTestComplete] = React.useState(false)

  React.useEffect(() => {
    if (testStarted) return

    setTestStarted(true)
    console.log('🚀 开始字符级流式输出测试...\n')
    
    // 模拟流式数据输入
    simulateStreamingData()
  }, [])

  const simulateStreamingData = async () => {
    // 模拟字符级数据发送
    let accumulatedContent = ''
    
    for (let i = 0; i < TEST_CONTENT.length; i++) {
      const char = TEST_CONTENT[i]
      accumulatedContent += char
      
      // 发出 UI 优化的块事件
      streamingService.emit('uiChunk', {
        streamId: 'test-stream',
        content: accumulatedContent,
        delta: char,
        timestamp: Date.now(),
        characterCount: accumulatedContent.length,
        renderHint: {
          contentType: 'text' as const,
          suggestedDelay: 15,
          priority: 'normal' as const
        },
        performance: {
          networkLatency: 50,
          processingTime: i * 15,
          bufferSize: accumulatedContent.length
        }
      })
      
      // 字符间延迟
      await new Promise(resolve => setTimeout(resolve, 15))
    }
    
    // 发出完成事件
    setTimeout(() => {
      streamingService.emit('complete', {
        content: accumulatedContent,
        model: 'test',
        done: true
      })
      setTestComplete(true)
      
      setTimeout(() => {
        console.log('\n✅ 字符级流式输出测试完成!')
        console.log('如果你看到文字是逐个字符出现的，那么流式渲染系统正常工作！')
        process.exit(0)
      }, 2000)
    }, 500)
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(
      Text,
      { color: 'green', bold: true },
      '🧪 WriteFlow 字符级流式输出测试'
    ),
    React.createElement(
      Text,
      { dimColor: true },
      '观察下方文字是否逐个字符出现...'
    ),
    React.createElement(
      Box,
      { marginTop: 1, borderStyle: 'single', borderColor: 'cyan', padding: 1 },
      React.createElement(StreamingText, {
        streamingService: streamingService,
        renderMode: 'character',
        delay: 0, // 无额外延迟，使用事件中的建议延迟
        theme: 'dark',
        cursor: !testComplete,
        onComplete: () => {
          console.log('\n📝 StreamingText 组件渲染完成!')
        },
        onChunk: (delta: string, totalLength: number) => {
          // 显示调试信息
          if (totalLength % 10 === 0) {
            console.log(`📊 已渲染 ${totalLength} 个字符 | 最新: "${delta}"`)
          }
        }
      })
    ),
    testComplete && React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'green' },
        '✅ 流式输出测试完成！系统正常工作。'
      )
    )
  )
}

console.log('🚀 启动字符级流式输出测试...\n')

// 渲染测试应用
const { unmount } = render(React.createElement(CharacterStreamingTest))

// 15秒后自动退出
setTimeout(() => {
  unmount()
  console.log('\n⏰ 测试超时，自动退出')
  process.exit(0)
}, 15000)

// 处理退出信号
process.on('SIGINT', () => {
  unmount()
  console.log('\n\n测试被中断')
  process.exit(0)
})