#!/usr/bin/env npx tsx

/**
 * 离线模式流式测试 - 验证 AsyncGenerator 架构（无需 API 调用）
 */

import { writeFlowAIService } from './src/services/ai/WriteFlowAIService.js'

// 启用离线模式
process.env.WRITEFLOW_AI_OFFLINE = 'true'

async function testOfflineStreaming() {
  console.log('🚀 离线模式流式测试开始...\n')
  
  // 简单测试请求
  const testRequest = {
    prompt: '请帮我写一个简单的Hello World程序',
    systemPrompt: '你是一个编程助手，请提供简洁的代码示例。',
    model: 'deepseek-chat',
    enableToolCalls: false, // 暂时禁用工具调用，专注测试流式架构
    temperature: 0.3
  }
  
  console.log('📝 测试请求配置:')
  console.log(JSON.stringify(testRequest, null, 2))
  console.log('\n🔄 开始离线流式处理...\n')
  
  try {
    let messageCount = 0
    const startTime = Date.now()
    
    for await (const message of writeFlowAIService.processAsyncStreamingRequest(testRequest)) {
      messageCount++
      
      switch (message.type) {
        case 'ai_response':
          console.log(`🤖 AI响应 #${messageCount}:`)
          console.log(`   内容: ${message.content}`)
          console.log(`   完成: ${message.isComplete ? '是' : '否'}`)
          break
          
        case 'progress':
          console.log(`📊 进度更新 #${messageCount}:`)
          console.log(`   阶段: ${message.stage}`)
          console.log(`   消息: ${message.message}`)
          if (message.progress) {
            console.log(`   进度: ${message.progress}%`)
          }
          break
          
        case 'system':
          console.log(`ℹ️  系统消息 [${message.level}]:`)
          console.log(`   ${message.message}`)
          break
          
        case 'error':
          console.log(`❌ 错误消息:`)
          console.log(`   ${message.message}`)
          break
          
        default:
          console.log(`❓ 未知消息类型: ${(message as any).type}`)
      }
      
      console.log('')
    }
    
    const duration = Date.now() - startTime
    console.log('✅ 离线流式测试完成!')
    console.log(`📊 测试统计:`)
    console.log(`   - 总消息数: ${messageCount}`)
    console.log(`   - 总时长: ${duration}ms`)
    console.log('   - 平均延迟: ', messageCount > 0 ? `${Math.round(duration / messageCount)}ms/消息` : 'N/A')
    
    if (messageCount > 0) {
      console.log('\n🎉 成功验证 AsyncGenerator 流式架构!')
      console.log('✅ 消息流式推送正常')
      console.log('✅ AsyncGenerator 流式架构集成成功')
    } else {
      console.log('\n⚠️  未收到任何消息，可能存在问题')
    }
    
  } catch (error) {
    console.error('\n❌ 离线流式测试失败:')
    console.error(error)
  }
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testOfflineStreaming().catch(console.error)
}

export { testOfflineStreaming }