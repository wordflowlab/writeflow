#!/usr/bin/env node

/**
 * JSON污染修复验证测试
 * 
 * 测试场景：要求AI生成包含JSON格式的内容，验证：
 * 1. 不会误将文本中的JSON识别为工具调用
 * 2. 流式输出不会中断 
 * 3. 最终显示内容干净，无JSON污染
 */

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

console.log('🧪 JSON污染修复验证测试')
console.log('=' .repeat(50))

async function testJSONPollutionFix() {
  try {
    // 1. 初始化WriteFlow应用
    console.log('🚀 初始化WriteFlow应用...')
    const app = new WriteFlowApp()
    
    // 2. 设置测试环境
    process.env.WRITEFLOW_STREAM = 'true' // 启用流式输出
    process.env.WRITEFLOW_AI_OFFLINE = 'false' // 启用AI
    
    let responseText = ''
    let characterCount = 0
    let jsonDetected = false
    
    // 3. 监控流式输出
    const onToken = (chunk) => {
      responseText += chunk
      characterCount++
      
      // 检测是否包含JSON格式内容
      if (chunk.includes('{"type"') || chunk.includes('"tool_use"')) {
        jsonDetected = true
      }
      
      if (characterCount % 50 === 0) {
        process.stdout.write('.')
      }
    }
    
    // 4. 发送会产生JSON内容的测试请求
    console.log('\n📝 发送包含JSON内容的测试请求...')
    
    const testPrompt = `请为我写一个关于API设计的技术文档，要求包含以下JSON示例：

{"type":"tool_use","id":"call_123","name":"example_api"}

文档应该说明如何使用这个JSON格式的API调用。`
    
    console.time('🕒 响应时间')
    const startTime = Date.now()
    
    const result = await app.handleFreeTextInput(testPrompt, { onToken })
    
    const duration = Date.now() - startTime
    console.timeEnd('🕒 响应时间')
    
    // 5. 分析测试结果
    console.log(`\n📊 测试结果分析:`)
    console.log('-' .repeat(40))
    
    const analysisResults = analyzeResults(result, jsonDetected, duration)
    printTestResults(analysisResults)
    
    return analysisResults.success
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message)
    console.error('Stack:', error.stack)
    return false
  }
}

/**
 * 分析测试结果
 */
function analyzeResults(responseText, jsonDetected, duration) {
  // 检查响应是否包含原始JSON格式
  const hasJSONPollution = responseText.includes('{"type":"tool_use"') && 
                          responseText.includes('"id":"call_')
  
  // 检查是否成功完成响应 
  const isCompleteResponse = responseText.length > 100 && 
                            !responseText.includes('[Request interrupted by user for tool use]')
  
  // 检查内容质量
  const hasAPIDocContent = responseText.includes('API') && 
                          (responseText.includes('文档') || responseText.includes('设计'))
  
  // 检查是否包含示例JSON（作为文档内容）
  const hasExampleJSON = responseText.includes('{"type":"tool_use"') ||
                        responseText.includes('example_api')
  
  return {
    responseLength: responseText.length,
    duration,
    hasJSONPollution,
    isCompleteResponse,
    hasAPIDocContent,
    hasExampleJSON,
    jsonDetected,
    success: isCompleteResponse && !hasJSONPollution && hasAPIDocContent
  }
}

/**
 * 打印测试结果
 */
function printTestResults(results) {
  console.log(`📄 响应长度: ${results.responseLength} 字符`)
  console.log(`⏱️  执行时间: ${Math.round(results.duration / 1000)}s`)
  
  console.log('\n🔍 关键指标检查:')
  console.log(`   流式输出完整: ${results.isCompleteResponse ? '✅' : '❌'}`)
  console.log(`   无JSON污染: ${!results.hasJSONPollution ? '✅' : '❌'}`)
  console.log(`   API文档内容: ${results.hasAPIDocContent ? '✅' : '❌'}`)
  console.log(`   包含JSON示例: ${results.hasExampleJSON ? '✅' : '❌'}`)
  
  console.log('\n🎯 修复验证结果:')
  if (results.success) {
    console.log('✅ JSON污染修复验证通过!')
    console.log('   ✅ 流式输出正常完成，无中断')
    console.log('   ✅ 文本中的JSON内容未被误识别为工具调用') 
    console.log('   ✅ 最终输出干净，无系统JSON污染')
  } else {
    console.log('❌ JSON污染修复需要进一步优化')
    if (!results.isCompleteResponse) {
      console.log('   ❌ 流式输出被中断')
    }
    if (results.hasJSONPollution) {
      console.log('   ❌ 检测到JSON污染')
    }
    if (!results.hasAPIDocContent) {
      console.log('   ❌ 内容质量不达标')
    }
  }
}

// 运行测试
testJSONPollutionFix()
  .then(success => {
    console.log(`\n🏁 测试${success ? '成功' : '需要优化'}`)
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('\n💥 测试异常:', error)
    process.exit(1)
  })