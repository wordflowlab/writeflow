#!/usr/bin/env node

/**
 * 验证JSON工具调用泄露修复效果
 * 基于Kode架构的消息类型分离测试
 */

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

console.log('🧪 测试JSON工具调用泄露修复效果')
console.log('=' .repeat(60))

async function testJsonLeakFix() {
  try {
    // 1. 初始化应用
    console.log('🚀 初始化WriteFlow应用...')
    const app = new WriteFlowApp()
    
    // 2. 设置测试环境
    process.env.WRITEFLOW_STREAM = 'true'
    process.env.WRITEFLOW_AI_OFFLINE = 'false'
    
    let messageCount = 0
    let hasTimeout = false
    let startTime = Date.now()
    let jsonLeaksDetected = 0
    let progressMessagesDetected = 0
    
    console.log('\n📝 发送测试请求 - 专门测试TODO工具调用...')
    
    // 3. 设置超时
    const overallTimeout = setTimeout(() => {
      hasTimeout = true
      console.log('\n⏰ 测试超时 (90s)')
    }, 90000)
    
    const onToken = (chunk) => {
      messageCount++
      
      // 🔍 检测JSON泄露（用户不应该看到的技术细节）
      const jsonLeakPatterns = [
        '{"type":"tool_use"',
        '{"id":"call_',
        '"todos":[{',
        '"name":"todo_write"',
        '"input":{',
        'call_00_',
        '"priority":"high"',
        '"content":"创建'
      ]
      
      let hasJsonLeak = false
      for (const pattern of jsonLeakPatterns) {
        if (chunk.includes(pattern)) {
          hasJsonLeak = true
          jsonLeaksDetected++
          console.log(`\n❌ [JSON泄露检测] 发现技术细节泄露:`)
          console.log(`   模式: "${pattern}"`)
          console.log(`   内容: "${chunk.substring(0, 150)}..."`)
          break
        }
      }
      
      // 🔍 检测Progress消息（用户应该看到的友好信息）
      const progressPatterns = [
        '📋 [WriteFlowAIService] 推送Progress消息',  // WriteFlowAIService层的进度推送
        '🔧 正在执行',
        '📋 任务列表更新中',
        '📊 当前任务状态',
        '✅ 任务列表更新完成',
        '📈 完成度:',
        '⏳ 待处理:',
        '🔄 进行中:',
        '预处理请求',  // 新增的实际进度消息
        '开始实时 AI 处理'  // 新增的实际进度消息
      ]
      
      for (const pattern of progressPatterns) {
        if (chunk.includes(pattern)) {
          progressMessagesDetected++
          console.log(`\n✅ [Progress消息检测] 发现用户友好信息:`)
          console.log(`   类型: "${pattern}"`)
          console.log(`   内容: "${chunk.substring(0, 100)}..."`)
          break
        }
      }
      
      if (messageCount % 50 === 0) {
        process.stdout.write('.')
      }
    }
    
    // 4. 发送会产生TODO工具调用的测试请求
    const testPrompt = '请帮我创建一个写作任务计划：写一篇关于AI发展历程的文章。请用TodoWrite工具创建详细的任务列表。'
    
    console.time('🕒 响应时间')
    const result = await app.handleFreeTextInput(testPrompt, { onToken })
    console.timeEnd('🕒 响应时间')
    
    clearTimeout(overallTimeout)
    
    // 5. 分析测试结果
    const duration = Date.now() - startTime
    const success = !hasTimeout && result && result.length > 0
    
    console.log(`\n\n📊 JSON泄露修复测试结果:`)
    console.log(`   是否超时: ${hasTimeout ? '❌ 是' : '✅ 否'}`)
    console.log(`   响应长度: ${result ? result.length : 0} 字符`)
    console.log(`   消息数量: ${messageCount}`)
    console.log(`   JSON泄露检测: ${jsonLeaksDetected} 次`)
    console.log(`   Progress消息检测: ${progressMessagesDetected} 次`)
    console.log(`   总时长: ${Math.round(duration / 1000)}s`)
    
    // 6. 判定修复成功标准
    const isFixSuccessful = (
      !hasTimeout &&
      jsonLeaksDetected === 0 &&  // 🚀 关键：绝对不能有JSON泄露
      progressMessagesDetected > 0  // 🚀 必须有用户友好的Progress消息
    )
    
    if (isFixSuccessful) {
      console.log(`\n🎉 JSON泄露修复验证成功！`)
      console.log(`   ✅ 完全消除了JSON技术细节泄露`)
      console.log(`   ✅ 成功检测到 ${progressMessagesDetected} 个用户友好Progress消息`)
      console.log(`   ✅ Kode风格架构工作正常`)
      console.log(`   ✅ 消息类型分离机制有效`)
      return true
    } else {
      console.log(`\n⚠️ 修复验证结果分析:`)
      if (jsonLeaksDetected > 0) {
        console.log(`   ❌ 仍有 ${jsonLeaksDetected} 个JSON泄露问题`)
      }
      if (progressMessagesDetected === 0) {
        console.log(`   ❌ 未检测到Progress消息`)
      }
      if (hasTimeout) {
        console.log(`   ❌ 测试超时`)
      }
      return false
    }
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message)
    return false
  }
}

// 运行测试
testJsonLeakFix()
  .then(success => {
    console.log(`\n🏁 JSON泄露修复测试${success ? '✅ 成功' : '❌ 失败'}`)
    if (success) {
      console.log('\n🎊 WriteFlow现在采用了Kode级别的消息净化架构！')
    }
    process.exit(success ? 0 : 1)
  })
  .catch(console.error)