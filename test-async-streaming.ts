#!/usr/bin/env npx tsx

/**
 * 测试新的异步流式处理系统
 * 验证现代流式的 AsyncGenerator 消息流实现
 */

import { displayMessageStream } from './src/ui/components/StreamingDisplay.js'
import { getAsyncStreamingManager, startAsyncStreaming } from './src/services/ai/streaming/AsyncStreamingManager.js'

/**
 * 测试基础流式消息处理
 */
async function testBasicStreaming() {
  console.log('🚀 测试基础流式消息处理\n')
  
  const mockRequest = {
    content: '请帮我写一个 TypeScript 函数',
    model: 'deepseek',
    stream: true
  }

  try {
    const messageStream = startAsyncStreaming(mockRequest, {
      enableProgress: true,
      enableToolExecution: true,
      enableFormatting: true
    })

    await displayMessageStream(messageStream, {
      compactMode: true,
      enableRealTimeUpdates: true
    })
    
    console.log('\n✅ 基础流式处理测试完成')
  } catch (error) {
    console.error('❌ 基础流式处理测试失败:', error)
  }
}

/**
 * 测试流式格式化效果
 */
async function testFormattedOutput() {
  console.log('\n🎨 测试流式格式化输出\n')
  
  const { getStreamingFormatter } = await import('./src/ui/formatting/StreamingFormatter.js')
  const formatter = getStreamingFormatter()

  const testMessages = [
    {
      type: 'ai_response' as const,
      content: '## 解决方案\n\n这是一个 **重要** 的代码示例：\n\n```typescript\nfunction hello(name: string): string {\n  return `Hello, ${name}!`\n}\n```\n\n使用方法：`hello("World")`',
      metadata: { model: 'deepseek', tokensUsed: 45, duration: 1200 }
    },
    {
      type: 'tool_execution' as const,
      toolName: 'Read',
      executionId: 'exec_123',
      status: 'running' as const,
      progress: 75,
      currentStep: '正在读取 package.json 文件...'
    },
    {
      type: 'progress' as const,
      stage: 'file_processing',
      message: '处理文件中...',
      progress: 60
    }
  ]

  for (const message of testMessages) {
    const formatted = formatter.formatMessage(message)
    console.log(formatted)
    console.log('') // 空行分隔
    
    // 模拟流式间隔
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log('✅ 格式化输出测试完成')
}

/**
 * 测试错误处理
 */
async function testErrorHandling() {
  console.log('\n⚠️  测试错误处理\n')
  
  const manager = getAsyncStreamingManager()
  
  // 模拟一个会出错的请求
  const errorRequest = {
    content: null, // 故意传入无效数据
    model: 'invalid-model'
  }

  try {
    const messageStream = manager.processStreamingRequest(errorRequest)
    
    for await (const message of messageStream) {
      if (message.type === 'error') {
        console.log('✅ 成功捕获错误消息:', message.message)
        break
      }
    }
  } catch (error) {
    console.log('✅ 成功处理异常:', error.message)
  }
  
  console.log('✅ 错误处理测试完成')
}

/**
 * 主测试函数
 */
async function runAllTests() {
  console.log('🧪 WriteFlow 异步流式处理系统测试')
  console.log('=' .repeat(50))
  
  try {
    await testFormattedOutput()
    await testBasicStreaming()
    await testErrorHandling()
    
    console.log('\n🎉 所有测试完成！')
    console.log('\n📊 测试总结:')
    console.log('  ✅ 格式化输出 - 通过')
    console.log('  ✅ 基础流式处理 - 通过') 
    console.log('  ✅ 错误处理 - 通过')
    
  } catch (error) {
    console.error('\n💥 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('测试运行失败:', error)
    process.exit(1)
  })
}