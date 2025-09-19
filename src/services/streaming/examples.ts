#!/usr/bin/env node

import { debugLog, logError } from '../../utils/log.js'

/**
 * WriteFlow 流式服务使用示例
 * 演示各种流式 AI 服务的使用方法
 */

import { 
  getStreamingService, 
  getStreamingAIService,
  askAIStream,
  askAIStreamComplete,
  StreamingResponse,
  StreamingAIChunk
} from './index.js'

/**
 * 示例1: 基础流式服务使用
 */
async function example1_BasicStreaming() {
  debugLog('\n🔥 示例1: 基础流式服务使用')
  
  const streamingService = getStreamingService()
  
  // 监听流式数据块
  streamingService.on('chunk', (response: StreamingResponse) => {
    if (response.content) {
      process.stdout.write(response.content.slice(-1))  // 显示增量内容
    }
    
    if (response.reasoning) {
      debugLog('\n💭 推理:', response.reasoning)
    }
  })
  
  // 监听完成事件
  streamingService.on('complete', (response: StreamingResponse) => {
    debugLog('\n\n✅ 流式完成!')
    debugLog(`📊 使用统计: ${response.usage?.inputTokens}→${response.usage?.outputTokens} tokens`)
    debugLog(`💰 成本: $${response.cost?.toFixed(6)}`)
    debugLog(`⏱️ 耗时: ${response.duration}ms`)
  })
  
  // 监听错误
  streamingService.on('error', (error: Error) => {
    logError('❌ 流式错误:', error.message)
  })
  
  try {
    await streamingService.startStream({
      prompt: "请简洁地解释什么是 TypeScript。",
      model: 'claude-3-sonnet',
      maxTokens: 200,
      temperature: 0.7
    })
  } catch (_error) {
    logError('启动流式服务失败:', _error)
  }
}

/**
 * 示例2: 兼容性流式 AI 服务
 */
async function example2_CompatibleStreaming() {
  debugLog('\n🔥 示例2: 兼容性流式 AI 服务')
  
  const streamingAIService = getStreamingAIService()
  
  streamingAIService.on('chunk', (chunk: StreamingAIChunk) => {
    process.stdout.write(chunk.delta)  // 显示增量文本
  })
  
  streamingAIService.on('complete', (response) => {
    debugLog('\n\n✅ AI 请求完成!')
    debugLog(`📄 完整内容长度: ${response.content.length} 字符`)
    debugLog(`🤖 使用模型: ${response.model}`)
  })
  
  streamingAIService.on('error', (error) => {
    logError('\n❌ AI 服务错误:', error.message)
  })
  
  try {
    await streamingAIService.processStreamingRequest({
      prompt: "写一段关于 Node.js 流的简短介绍。",
      stream: true,
      model: 'deepseek-chat',
      maxTokens: 150
    })
  } catch (_error) {
    logError('处理流式请求失败:', _error)
  }
}

/**
 * 示例3: 便捷流式函数使用
 */
async function example3_ConvenienceFunctions() {
  debugLog('\n🔥 示例3: 便捷流式函数使用')
  
  try {
    debugLog('\n📡 方法: askAIStreamComplete')
    const completeResponse = await askAIStreamComplete("什么是微服务架构？", {
      model: 'deepseek-reasoner',
      maxTokens: 150,
      temperature: 0.3
    })
    
    debugLog('✅ 完整响应接收完毕:')
    debugLog(completeResponse.content)
    debugLog(`📊 Token 使用: ${completeResponse.usage.inputTokens}→${completeResponse.usage.outputTokens}`)
    
  } catch (_error) {
    logError('便捷函数使用失败:', _error)
  }
}

/**
 * 示例4: 智谱 AI (GLM) 流式服务
 */
async function example4_ZhipuStreaming() {
  debugLog('\n🔥 示例4: 智谱 AI (GLM) 流式服务')
  
  const streamingService = getStreamingService()
  
  streamingService.on('chunk', (response: StreamingResponse) => {
    if (response.content) {
      process.stdout.write(response.content.slice(-1))  // 显示增量内容
    }
  })
  
  streamingService.on('complete', (response: StreamingResponse) => {
    debugLog('\n\n✅ 智谱 AI 流式完成!')
    debugLog(`📊 使用统计: ${response.usage?.inputTokens}→${response.usage?.outputTokens} tokens`)
    debugLog(`💰 成本: $${response.cost?.toFixed(6)}`)
  })
  
  streamingService.on('error', (error: Error) => {
    logError('❌ 智谱 AI 流式错误:', error.message)
  })
  
  try {
    await streamingService.startStream({
      prompt: "请简洁地介绍智谱 AI 和 GLM 模型的特点。",
      model: 'glm-4.5',
      maxTokens: 200,
      temperature: 0.7
    })
  } catch (_error) {
    logError('智谱 AI 流式服务失败:', _error)
  }
}

/**
 * 示例5: Kimi/Moonshot 流式服务
 */
async function example5_KimiStreaming() {
  debugLog('\n🔥 示例5: Kimi/Moonshot 流式服务')
  
  const streamingAIService = getStreamingAIService()
  
  streamingAIService.on('chunk', (chunk: StreamingAIChunk) => {
    process.stdout.write(chunk.delta)
  })
  
  streamingAIService.on('complete', (response) => {
    debugLog('\n\n✅ Kimi 请求完成!')
    debugLog(`📄 完整内容长度: ${response.content.length} 字符`)
    debugLog(`🤖 使用模型: ${response.model}`)
  })
  
  streamingAIService.on('error', (error) => {
    logError('\n❌ Kimi 服务错误:', error.message)
  })
  
  try {
    await streamingAIService.processStreamingRequest({
      prompt: "请介绍 Kimi 模型的长文本处理能力。",
      stream: true,
      model: 'moonshot-v1-8k',
      maxTokens: 150
    })
  } catch (_error) {
    logError('Kimi 流式请求失败:', _error)
  }
}

/**
 * 示例6: Qwen 流式服务
 */
async function example6_QwenStreaming() {
  debugLog('\n🔥 示例6: Qwen/通义千问 流式服务')
  
  try {
    debugLog('\n📡 方法: askAIStreamComplete with Qwen')
    const completeResponse = await askAIStreamComplete("什么是大型语言模型？请简要介绍。", {
      model: 'qwen-turbo',
      maxTokens: 200,
      temperature: 0.5
    })
    
    debugLog('✅ Qwen 完整响应接收完毕:')
    debugLog(completeResponse.content)
    debugLog(`📊 Token 使用: ${completeResponse.usage.inputTokens}→${completeResponse.usage.outputTokens}`)
    
  } catch (_error) {
    logError('Qwen 流式函数使用失败:', _error)
  }
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  debugLog('🚀 WriteFlow 扩展流式服务使用示例\n')
  
  debugLog('⚠️  注意: 示例需要有效的 API 密钥和模型配置')
  debugLog('   请确保设置了相应的环境变量:')
  debugLog('   - ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY (原有)')
  debugLog('   - ZHIPU_API_KEY (智谱 AI)')
  debugLog('   - KIMI_API_KEY, MOONSHOT_API_KEY (Kimi)')
  debugLog('   - QWEN_API_KEY (通义千问)')
  debugLog('   或在模型配置中设置了 API 密钥\n')
  
  const examples = [
    { name: '基础流式服务', fn: example1_BasicStreaming },
    { name: '兼容性流式 AI 服务', fn: example2_CompatibleStreaming },
    { name: '便捷流式函数', fn: example3_ConvenienceFunctions },
    { name: '智谱 AI (GLM) 流式服务', fn: example4_ZhipuStreaming },
    { name: 'Kimi/Moonshot 流式服务', fn: example5_KimiStreaming },
    { name: 'Qwen/通义千问 流式服务', fn: example6_QwenStreaming }
  ]
  
  for (let i = 0; i < examples.length; i++) {
    const example = examples[i]
    
    try {
      debugLog(`\n${'='.repeat(50)}`)
      debugLog(`▶️  正在运行: ${example.name}`)
      debugLog('='.repeat(50))
      
      await example.fn()
      
    } catch (_error) {
      logError(`❌ ${example.name} 执行失败:`, (error as Error).message)
    }
    
    if (i < examples.length - 1) {
      debugLog('\n⏱️  等待 2 秒后继续下一个示例...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  debugLog('\n🎉 所有示例执行完成！')
}

// 如果直接运行此文件，执行所有示例
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(logError)
}

export { 
  example1_BasicStreaming,
  example2_CompatibleStreaming,
  example3_ConvenienceFunctions,
  example4_ZhipuStreaming,
  example5_KimiStreaming,
  example6_QwenStreaming,
  runAllExamples
}