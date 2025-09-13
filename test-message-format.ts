#!/usr/bin/env npx tsx

/**
 * 消息格式测试 - 验证消息转换是否正确
 */

import {
  Message,
  createUserMessage,
  createAssistantMessage,
  normalizeMessagesForAPI
} from './src/utils/messages.js'

function testMessageFormats() {
  console.log('🧪 消息格式测试开始...\n')
  
  // 1. 测试基本用户消息
  const userMessage = createUserMessage('测试用户消息')
  console.log('1️⃣ 基本用户消息:')
  console.log(JSON.stringify(userMessage, null, 2))
  console.log('')
  
  // 2. 测试包含工具结果的用户消息
  const toolResultMessage = createUserMessage([{
    type: 'tool_result',
    content: '工具执行结果',
    tool_use_id: 'test_tool_id'
  }])
  console.log('2️⃣ 工具结果消息:')
  console.log(JSON.stringify(toolResultMessage, null, 2))
  console.log('')
  
  // 3. 测试助手消息
  const assistantMessage = createAssistantMessage('测试助手响应')
  console.log('3️⃣ 助手消息:')
  console.log(JSON.stringify(assistantMessage, null, 2))
  console.log('')
  
  // 4. 测试消息历史
  const messages: Message[] = [
    userMessage,
    assistantMessage,
    toolResultMessage
  ]
  
  console.log('4️⃣ 完整消息历史:')
  console.log(JSON.stringify(messages, null, 2))
  console.log('')
  
  // 5. 测试 API 格式转换
  const apiMessages = normalizeMessagesForAPI(messages)
  console.log('5️⃣ API 格式转换结果:')
  console.log(JSON.stringify(apiMessages, null, 2))
  console.log('')
  
  // 6. 检查每个 API 消息的 content 类型
  console.log('6️⃣ 内容类型分析:')
  apiMessages.forEach((msg, index) => {
    console.log(`   消息 ${index + 1}:`)
    console.log(`     角色: ${msg.role}`)
    console.log(`     内容类型: ${typeof msg.content}`)
    console.log(`     内容是数组: ${Array.isArray(msg.content)}`)
    if (Array.isArray(msg.content)) {
      console.log(`     数组长度: ${msg.content.length}`)
      msg.content.forEach((block, i) => {
        console.log(`       Block ${i}: type=${(block as any).type}`)
      })
    }
    console.log('')
  })
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testMessageFormats()
}

export { testMessageFormats }