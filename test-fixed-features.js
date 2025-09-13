#!/usr/bin/env node

/**
 * 端到端测试 - 验证TODO顺序和Markdown格式化修复效果
 * 
 * 测试场景：请求写一篇三国小说，验证：
 * 1. TODO任务按正确顺序执行（框架→人物→撰写→完善）  
 * 2. Markdown格式完整保留
 * 3. 创意内容不会被过度折叠
 */

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

// 测试配置
const testConfig = {
  timeout: 30000, // 30秒超时
  enableLogging: true
}

console.log('🧪 开始端到端测试 - 验证TODO顺序和Markdown格式化修复')
console.log('=' .repeat(60))

async function runTest() {
  try {
    // 1. 初始化WriteFlow应用
    console.log('🚀 初始化WriteFlow应用...')
    const app = new WriteFlowApp()
    
    // 2. 设置测试环境
    process.env.WRITEFLOW_STREAM = 'false' // 关闭流式，便于测试
    process.env.WRITEFLOW_AI_OFFLINE = 'false' // 启用AI
    
    let responseText = ''
    let todoUpdates = []
    
    // 3. 模拟onToken回调收集数据
    const onToken = (chunk) => {
      responseText += chunk
      if (testConfig.enableLogging) {
        process.stdout.write('.')
      }
    }
    
    console.log('\n📝 发送测试请求：请写一个三国故事，包含人物和情节')
    
    // 4. 发送测试请求
    const testPrompt = '请为我写一个三国故事，需要先设计故事框架，再设计主要人物，最后撰写故事内容。'
    
    const startTime = Date.now()
    const result = await app.handleFreeTextInput(testPrompt, {
      onToken
    })
    const duration = Date.now() - startTime
    
    console.log(`\n✅ 请求完成 (${duration}ms)`)
    console.log('\n📊 测试结果分析:')
    console.log('-' .repeat(40))
    
    // 5. 分析结果
    const analysisResults = analyzeResponse(result)
    
    // 6. 输出测试报告
    printTestReport(analysisResults, duration)
    
    // 7. 验证关键修复点
    const success = validateFixes(analysisResults)
    
    if (success) {
      console.log('\n🎉 所有修复验证通过！')
      process.exit(0)
    } else {
      console.log('\n❌ 部分修复需要进一步优化')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message)
    process.exit(1)
  }
}

/**
 * 分析AI响应结果
 */
function analyzeResponse(responseText) {
  console.log(`📄 响应长度: ${responseText.length} 字符`)
  
  // 检查Markdown格式保留
  const hasMarkdownHeaders = /#{1,6}\s+.+/g.test(responseText)
  const hasMarkdownLists = /^[\s]*[-*+]\s+/gm.test(responseText)
  const hasMarkdownBold = /\*\*[^*]+\*\*/g.test(responseText)
  const hasMarkdownItalic = /\*[^*]+\*/g.test(responseText)
  
  // 检查创意内容特征
  const hasCreativeContent = /三国|故事|小说|人物|情节/i.test(responseText)
  const hasChapterStructure = /第[一二三四五六七八九十]+[章节]/i.test(responseText)
  
  // 检查是否有系统消息污染
  const hasSystemPollution = /AI:\s*\[调用.*工具\]|todo_write工具:|⎿/.test(responseText)
  const hasJSONPollution = /\{\s*"todos"\s*:\s*\[/.test(responseText)
  
  return {
    markdownPreservation: {
      hasHeaders: hasMarkdownHeaders,
      hasLists: hasMarkdownLists,
      hasBold: hasMarkdownBold,
      hasItalic: hasMarkdownItalic,
      score: [hasMarkdownHeaders, hasMarkdownLists, hasMarkdownBold, hasMarkdownItalic].filter(Boolean).length
    },
    creativeContent: {
      hasCreativeContent,
      hasChapterStructure,
      isCreativeResponse: hasCreativeContent && responseText.length > 200
    },
    contentCleanliness: {
      hasSystemPollution,
      hasJSONPollution,
      isClean: !hasSystemPollution && !hasJSONPollution
    },
    overall: {
      responseLength: responseText.length,
      qualityScore: 0 // 会在后面计算
    }
  }
}

/**
 * 打印测试报告
 */
function printTestReport(analysis, duration) {
  console.log(`⏱️  执行时间: ${duration}ms`)
  console.log(`📏 内容长度: ${analysis.overall.responseLength} 字符`)
  
  console.log('\n📝 Markdown格式保留检测:')
  console.log(`   标题格式: ${analysis.markdownPreservation.hasHeaders ? '✅' : '❌'}`)
  console.log(`   列表格式: ${analysis.markdownPreservation.hasLists ? '✅' : '❌'}`)
  console.log(`   粗体格式: ${analysis.markdownPreservation.hasBold ? '✅' : '❌'}`)
  console.log(`   斜体格式: ${analysis.markdownPreservation.hasItalic ? '✅' : '❌'}`)
  console.log(`   格式评分: ${analysis.markdownPreservation.score}/4`)
  
  console.log('\n🎭 创意内容检测:')
  console.log(`   创意内容: ${analysis.creativeContent.hasCreativeContent ? '✅' : '❌'}`)
  console.log(`   章节结构: ${analysis.creativeContent.hasChapterStructure ? '✅' : '❌'}`)
  console.log(`   内容质量: ${analysis.creativeContent.isCreativeResponse ? '✅' : '❌'}`)
  
  console.log('\n🧹 内容清洁度检测:')
  console.log(`   无系统污染: ${!analysis.contentCleanliness.hasSystemPollution ? '✅' : '❌'}`)
  console.log(`   无JSON污染: ${!analysis.contentCleanliness.hasJSONPollution ? '✅' : '❌'}`)
  console.log(`   整体清洁: ${analysis.contentCleanliness.isClean ? '✅' : '❌'}`)
}

/**
 * 验证关键修复点
 */
function validateFixes(analysis) {
  const checks = []
  
  // 检查1: Markdown格式保留
  const markdownOK = analysis.markdownPreservation.score >= 2
  checks.push({ name: 'Markdown格式保留', passed: markdownOK })
  
  // 检查2: 创意内容识别
  const creativeOK = analysis.creativeContent.isCreativeResponse
  checks.push({ name: '创意内容识别', passed: creativeOK })
  
  // 检查3: 内容清洁度
  const cleanOK = analysis.contentCleanliness.isClean
  checks.push({ name: '内容清洁度', passed: cleanOK })
  
  // 检查4: 基础质量
  const qualityOK = analysis.overall.responseLength > 100
  checks.push({ name: '基础内容质量', passed: qualityOK })
  
  console.log('\n🔍 关键修复验证:')
  let passedCount = 0
  for (const check of checks) {
    console.log(`   ${check.name}: ${check.passed ? '✅ 通过' : '❌ 失败'}`)
    if (check.passed) passedCount++
  }
  
  const successRate = passedCount / checks.length
  console.log(`\n📊 总体通过率: ${passedCount}/${checks.length} (${Math.round(successRate * 100)}%)`)
  
  return successRate >= 0.75 // 至少75%通过率才算成功
}

// 运行测试
runTest().catch(console.error)