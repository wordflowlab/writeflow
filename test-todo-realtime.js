#!/usr/bin/env node

/**
 * 测试TODO实时更新修复效果
 * 验证用户能够实时看到任务状态变化
 */

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

console.log('🧪 测试TODO实时更新修复效果')
console.log('=' .repeat(50))

async function testTodoRealTimeUpdates() {
  try {
    // 1. 初始化应用
    console.log('🚀 初始化WriteFlow应用...')
    const app = new WriteFlowApp()
    
    // 2. 设置测试环境
    process.env.WRITEFLOW_STREAM = 'true'  // 启用流式
    process.env.WRITEFLOW_AI_OFFLINE = 'false'  // 启用AI
    
    let messageCount = 0
    let hasTimeout = false
    let startTime = Date.now()
    let todoUpdatesDetected = 0
    
    console.log('\n📝 发送测试请求 - 应该产生TODO列表...')
    
    // 3. 设置总体超时 - 最多60秒
    const overallTimeout = setTimeout(() => {
      hasTimeout = true
      console.log('\n⏰ 测试超时 (60s) - 检查TODO更新检测情况')
    }, 60000)
    
    const onToken = (chunk) => {
      messageCount++
      
      // 🚀 检测TODO相关更新
      if (chunk.includes('📝 正在更新任务列表') || 
          chunk.includes('🎯 **任务列表') ||
          chunk.includes('✅ 任务列表更新成功') ||
          chunk.includes('📊 任务统计')) {
        todoUpdatesDetected++
        console.log(`\n🔍 [检测到TODO更新 #${todoUpdatesDetected}]:`)
        console.log(`   内容片段: "${chunk.slice(0, 100)}..."`)
      }
      
      if (messageCount % 20 === 0) {
        process.stdout.write('.')
      }
    }
    
    // 4. 发送会产生TODO的请求
    const testPrompt = '帮我规划一个简单的写作任务：写一篇关于人工智能的文章。请用TodoWrite创建任务列表。'
    
    console.time('🕒 响应时间')
    const result = await app.handleFreeTextInput(testPrompt, { onToken })
    console.timeEnd('🕒 响应时间')
    
    clearTimeout(overallTimeout)
    
    // 5. 分析结果
    const duration = Date.now() - startTime
    const success = !hasTimeout && result && result.length > 0
    
    console.log(`\n\n📊 TODO实时更新测试结果:`)
    console.log(`   是否超时: ${hasTimeout ? '❌ 是' : '✅ 否'}`)
    console.log(`   响应长度: ${result ? result.length : 0} 字符`)
    console.log(`   消息数量: ${messageCount}`)
    console.log(`   TODO更新检测次数: ${todoUpdatesDetected}`)
    console.log(`   总时长: ${Math.round(duration / 1000)}s`)
    
    // 6. TODO实时更新验证
    if (todoUpdatesDetected > 0) {
      console.log(`\n🎉 TODO实时更新修复成功！`)
      console.log(`   ✅ 检测到 ${todoUpdatesDetected} 次TODO更新`)
      console.log(`   ✅ 用户能够实时看到任务状态变化`)
      console.log(`   ✅ UI过滤问题已解决`)
      return true
    } else {
      console.log(`\n⚠️ 未检测到TODO更新显示`)
      console.log(`   可能的原因:`)
      console.log(`   - AI没有调用TodoWrite工具`)
      console.log(`   - UI过滤仍然存在问题`)
      console.log(`   - 流式消息传递有问题`)
      return false
    }
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message)
    return false
  }
}

// 运行测试
testTodoRealTimeUpdates()
  .then(success => {
    console.log(`\n🏁 TODO实时更新测试${success ? '✅ 成功' : '❌ 失败'}`)
    process.exit(success ? 0 : 1)
  })
  .catch(console.error)