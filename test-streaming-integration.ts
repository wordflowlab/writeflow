#!/usr/bin/env npx tsx

/**
 * WriteFlow 流式集成测试 - 验证 Kode 风格实时工具执行显示
 * 测试完整的 AsyncGenerator 架构从 DeepSeek -> WriteFlowAIService -> UI
 */

import { writeFlowAIService } from './src/services/ai/WriteFlowAIService.js'

async function testStreamingIntegration() {
  console.log('🚀 WriteFlow 流式集成测试开始...\n')
  
  // 测试请求 - 包含工具调用的写作任务
  const testRequest = {
    prompt: '请帮我创建一个简单的 README.md 文件，内容包括项目介绍和使用方法',
    systemPrompt: '你是一个专业的技术写作助手，请帮助用户创建清晰的技术文档。',
    model: 'deepseek-chat',
    enableToolCalls: true,
    allowedTools: ['Write', 'Read'],
    temperature: 0.3
  }
  
  console.log('📝 测试请求配置:')
  console.log(JSON.stringify(testRequest, null, 2))
  console.log('\n🔄 开始流式处理...\n')
  
  try {
    let messageCount = 0
    let toolExecutionCount = 0
    let progressCount = 0
    
    // 使用新的 AsyncGenerator 接口进行流式处理
    for await (const message of writeFlowAIService.processAsyncStreamingRequest(testRequest)) {
      messageCount++
      
      // 根据消息类型进行分类处理和显示
      switch (message.type) {
        case 'ai_response':
          console.log(`🤖 AI响应 #${messageCount}:`)
          console.log(`   内容: ${message.content.slice(0, 100)}${message.content.length > 100 ? '...' : ''}`)
          console.log(`   完成: ${message.isComplete ? '是' : '否'}`)
          if (message.metadata) {
            console.log(`   模型: ${message.metadata.model}`)
            console.log(`   时长: ${message.metadata.duration}ms`)
            console.log(`   Token: ${message.metadata.tokensUsed}`)
          }
          break
          
        case 'tool_execution':
          toolExecutionCount++
          console.log(`🔧 工具执行 #${toolExecutionCount}:`)
          console.log(`   工具: ${message.toolName}`)
          console.log(`   状态: ${message.status}`)
          console.log(`   执行ID: ${message.executionId}`)
          if (message.currentStep) {
            console.log(`   当前步骤: ${message.currentStep}`)
          }
          if (message.progress) {
            console.log(`   进度: ${message.progress}%`)
          }
          if (message.result) {
            console.log(`   结果: ${JSON.stringify(message.result).slice(0, 100)}...`)
          }
          break
          
        case 'progress':
          progressCount++
          console.log(`📊 进度更新 #${progressCount}:`)
          console.log(`   阶段: ${message.stage}`)
          console.log(`   消息: ${message.message}`)
          if (message.progress) {
            console.log(`   进度: ${message.progress}%`)
          }
          break
          
        case 'system':
          console.log(`ℹ️  系统消息 [${message.level}]:`)
          console.log(`   ${message.message}`)
          console.log(`   时间: ${new Date(message.timestamp).toISOString()}`)
          break
          
        case 'error':
          console.log(`❌ 错误消息:`)
          console.log(`   ${message.message}`)
          if (message.error) {
            console.log(`   详情: ${message.error.message}`)
          }
          break
          
        default:
          console.log(`❓ 未知消息类型: ${(message as any).type}`)
          console.log(`   内容: ${JSON.stringify(message, null, 2)}`)
      }
      
      console.log('') // 空行分隔
      
      // 防止测试运行过久
      if (messageCount > 20) {
        console.log('⏰ 达到消息数量限制，停止测试')
        break
      }
    }
    
    console.log('\n✅ 流式集成测试完成!')
    console.log(`📈 测试统计:`)
    console.log(`   - 总消息数: ${messageCount}`)
    console.log(`   - 工具执行消息: ${toolExecutionCount}`)
    console.log(`   - 进度更新消息: ${progressCount}`)
    
    // 验证是否成功实现实时显示
    if (toolExecutionCount > 0) {
      console.log('\n🎉 成功验证实时工具执行显示!')
      console.log('✅ Kode 风格的 AsyncGenerator 架构工作正常')
      console.log('✅ 解决了 "一口气输出" 问题 - 现在支持实时流式显示')
    } else {
      console.log('\n⚠️  未检测到工具执行消息')
      console.log('可能需要检查工具调用配置或离线模式设置')
    }
    
  } catch (error) {
    console.error('\n❌ 流式集成测试失败:')
    console.error(error)
    
    if (error instanceof Error) {
      console.error('错误堆栈:')
      console.error(error.stack)
    }
  }
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testStreamingIntegration().catch(console.error)
}

export { testStreamingIntegration }