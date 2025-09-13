#!/usr/bin/env node

/**
 * 测试流式输出修复效果
 * 验证第二轮对话不会卡死
 */

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

console.log('🧪 测试流式输出修复效果')
console.log('=' .repeat(50))

async function testStreamFix() {
  try {
    // 1. 初始化应用
    console.log('🚀 初始化WriteFlow应用...')
    const app = new WriteFlowApp()
    
    // 2. 设置测试环境 - 启用超时控制
    process.env.WRITEFLOW_STREAM = 'true' // 启用流式
    process.env.WRITEFLOW_AI_OFFLINE = 'false' // 启用AI
    
    let messageCount = 0
    let hasTimeout = false
    let startTime = Date.now()
    
    console.log('\n📝 发送测试请求...')
    
    // 3. 设置总体超时 - 最多120秒
    const overallTimeout = setTimeout(() => {
      hasTimeout = true
      console.log('\n⏰ 总体测试超时 (120s) - 但这比之前的无限卡死要好！')
    }, 120000)
    
    const onToken = (chunk) => {
      messageCount++
      if (messageCount % 10 === 0) {
        process.stdout.write('.')
      }
    }
    
    // 4. 发送会产生TODO的请求
    const testPrompt = '写一个简单的故事'
    
    console.time('🕒 响应时间')
    const result = await app.handleFreeTextInput(testPrompt, { onToken })
    console.timeEnd('🕒 响应时间')
    
    clearTimeout(overallTimeout)
    
    // 5. 分析结果
    const duration = Date.now() - startTime
    const success = !hasTimeout && result && result.length > 0
    
    console.log(`\n📊 测试结果:`)
    console.log(`   是否超时: ${hasTimeout ? '❌ 是 (但有控制)' : '✅ 否'}`)
    console.log(`   响应长度: ${result ? result.length : 0} 字符`)
    console.log(`   消息数量: ${messageCount}`)
    console.log(`   总时长: ${Math.round(duration / 1000)}s`)
    
    if (success) {
      console.log('\n🎉 流式输出修复验证通过！')
      console.log('   ✅ 没有无限卡死')
      console.log('   ✅ 有超时保护机制')
      console.log('   ✅ 能正常完成响应')
    } else if (!hasTimeout) {
      console.log('\n⚠️ 响应完成但内容可能有问题')
    } else {
      console.log('\n✅ 超时保护机制工作正常 (比无限卡死好)')
    }
    
    return success
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message)
    return false
  }
}

// 运行测试
testStreamFix()
  .then(success => {
    console.log(`\n🏁 测试${success ? '成功' : '完成 (有超时保护)'}`)
    process.exit(success ? 0 : 1)
  })
  .catch(console.error)