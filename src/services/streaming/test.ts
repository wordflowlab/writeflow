#!/usr/bin/env node

/**
 * WriteFlow 流式适配器功能测试
 * 运行: node src/services/streaming/test.ts
 */

import { createStreamAdapterFromModel, ProviderType } from './index.js'

function testOpenAIAdapter() {
  console.log('\n🧪 测试 OpenAI 适配器...')
  
  const adapter = createStreamAdapterFromModel('gpt-4')
  let content = ''
  
  adapter.on('chunk', (chunk) => {
    content += chunk.content
    if (chunk.done) {
      console.log('✅ OpenAI 流解析完成:', content)
    }
  })
  
  const openaiData = `data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]`
  
  adapter.processData(openaiData)
}

function testClaudeAdapter() {
  console.log('\n🧪 测试 Claude 适配器...')
  
  const adapter = createStreamAdapterFromModel('claude-3-sonnet')
  let content = ''
  
  adapter.on('chunk', (chunk) => {
    content += chunk.content
    if (chunk.done) {
      console.log('✅ Claude 流解析完成:', content)
    }
  })
  
  const claudeData = `event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta  
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" World"}}

event: message_stop
data: {"type":"message_stop"}`
  
  adapter.processData(claudeData)
}

function testDeepSeekAdapter() {
  console.log('\n🧪 测试 DeepSeek 适配器...')
  
  const adapter = createStreamAdapterFromModel('deepseek-chat')
  let content = ''
  let reasoning = ''
  
  adapter.on('chunk', (chunk) => {
    content += chunk.content
    reasoning += chunk.reasoning || ''
    if (chunk.done) {
      console.log('✅ DeepSeek 流解析完成:')
      console.log('   推理内容:', reasoning)
      console.log('   回答内容:', content)
    }
  })
  
  const deepseekData = `data: {"choices":[{"delta":{"reasoning_content":"Let me think..."}}]}
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]`
  
  adapter.processData(deepseekData)
}

function testGeminiAdapter() {
  console.log('\n🧪 测试 Gemini 适配器...')
  
  const adapter = createStreamAdapterFromModel('gemini-pro')
  let content = ''
  
  adapter.on('chunk', (chunk) => {
    content += chunk.content
    if (chunk.done) {
      console.log('✅ Gemini 流解析完成:', content)
    }
  })
  
  const geminiData = `{"candidates":[{"content":{"parts":[{"text":"Hello World"}]},"finishReason":"STOP"}]}`
  
  adapter.processData(geminiData)
}

function testProviderDetection() {
  console.log('\n🧪 测试自动协议检测...')
  
  const testCases = [
    { model: 'gpt-4', expected: ProviderType.OPENAI },
    { model: 'claude-3-sonnet', expected: ProviderType.ANTHROPIC },
    { model: 'deepseek-chat', expected: ProviderType.DEEPSEEK },
    { model: 'gemini-pro', expected: ProviderType.GEMINI }
  ]
  
  for (const testCase of testCases) {
    const adapter = createStreamAdapterFromModel(testCase.model)
    console.log(`✅ ${testCase.model} -> 检测为 ${testCase.expected} 协议`)
  }
}

async function runTests() {
  console.log('🚀 WriteFlow 流式适配器功能测试开始...\n')
  
  testProviderDetection()
  testOpenAIAdapter()
  testClaudeAdapter() 
  testDeepSeekAdapter()
  testGeminiAdapter()
  
  console.log('\n🎉 所有测试完成！')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error)
}

export { runTests }