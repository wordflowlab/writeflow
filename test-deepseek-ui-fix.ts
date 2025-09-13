#!/usr/bin/env tsx

/**
 * 测试 DeepSeek UI显示和内联工具调用修复
 * 验证进度反馈和内联工具调用解析是否正常工作
 */

import { WriteFlowAIService } from './src/services/ai/WriteFlowAIService.js'

async function testDeepSeekUIFix() {
  console.log('🧪 测试 DeepSeek UI显示和内联工具调用修复...\n')
  
  // 设置 DeepSeek 环境
  process.env.AI_PROVIDER = 'deepseek'
  process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key'
  process.env.WRITEFLOW_SESSION_ID = 'test-ui-session-' + Date.now()
  
  try {
    const aiService = new WriteFlowAIService()
    
    // 测试内联工具调用处理
    const testPrompt = `请帮我写一个关于"AI写作助手"的简短文章。

请先创建任务规划，然后开始写作。文章应该包含：
1. AI写作助手的优势
2. 使用场景
3. 未来展望`
    
    console.log('📝 测试提示词:')
    console.log(testPrompt)
    console.log('\n' + '='.repeat(60) + '\n')
    
    const startTime = Date.now()
    
    const response = await aiService.processRequest({
      prompt: testPrompt,
      enableSmartAnalysis: true,
      enableToolCalls: true,
      temperature: 0.7,
      maxTokens: 2000
    })
    
    const duration = Date.now() - startTime
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 测试结果:')
    console.log(`⏱️  耗时: ${duration}ms`)
    console.log(`🔧 工具交互: ${response.hasToolInteraction ? '是' : '否'}`)
    console.log(`💰 成本: $${response.cost?.toFixed(6) || '0'}`)
    console.log(`📈 Token: 输入${response.usage?.inputTokens || 0}, 输出${response.usage?.outputTokens || 0}`)
    
    console.log('\n📄 AI 完整响应:')
    console.log(response.content)
    
    // 分析响应内容结构
    const hasProgressIndicators = response.content.includes('🤖') || response.content.includes('🔧') || response.content.includes('📋')
    const hasToolExecutionFeedback = response.content.includes('正在执行') || response.content.includes('执行完成')
    const hasMultiStepProcess = response.content.includes('第1轮') || response.content.includes('第2轮')
    const hasInlineToolArtifacts = response.content.includes('<｜tool') || response.content.includes('tool▁')
    const hasCompleteArticle = response.content.includes('AI写作助手') && response.content.length > 300
    
    console.log('\n✅ 修复验证:')
    console.log(`📋 进度反馈显示: ${hasProgressIndicators ? '通过' : '❌ 失败'}`)
    console.log(`🔧 工具执行反馈: ${hasToolExecutionFeedback ? '通过' : '❌ 失败'}`)
    console.log(`🔄 多轮处理过程: ${hasMultiStepProcess ? '通过' : '❌ 失败'}`)
    console.log(`🧹 内联工具清理: ${!hasInlineToolArtifacts ? '通过' : '❌ 失败 - 仍有工具标记残留'}`)
    console.log(`📝 文章内容完整: ${hasCompleteArticle ? '通过' : '❌ 失败'}`)
    console.log(`🎯 多轮工具调用: ${response.hasToolInteraction ? '通过' : '❌ 失败'}`)
    
    // 详细分析
    if (hasInlineToolArtifacts) {
      console.log('\n⚠️  检测到的工具标记残留:')
      const toolMatches = response.content.match(/<｜[^｜]*｜>|tool▁[^▁]*▁/g)
      if (toolMatches) {
        toolMatches.forEach((match, i) => {
          console.log(`   ${i + 1}. ${match}`)
        })
      }
    }
    
    const testPassed = hasProgressIndicators && hasCompleteArticle && !hasInlineToolArtifacts && response.hasToolInteraction
    console.log(`\n🎯 总体测试结果: ${testPassed ? '✅ 通过' : '❌ 失败'}`)
    
    if (testPassed) {
      console.log('\n🎉 修复成功！改进效果:')
      console.log('✨ 1. 用户可以看到完整的AI处理过程')
      console.log('✨ 2. 内联工具调用被正确解析和清理')
      console.log('✨ 3. 进度反馈信息显示在最终输出中')
      console.log('✨ 4. 多轮工具调用正常工作')
    } else {
      console.log('\n⚠️  仍需改进的问题:')
      if (!hasProgressIndicators) console.log('- 进度反馈机制需要调整')
      if (hasInlineToolArtifacts) console.log('- 内联工具调用清理不完整')  
      if (!response.hasToolInteraction) console.log('- 工具调用功能异常')
      if (!hasCompleteArticle) console.log('- AI内容生成不完整')
    }
    
    return testPassed
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    console.error('Stack:', error instanceof Error ? error.stack : String(error))
    return false
  }
}

// 运行测试
testDeepSeekUIFix().then(success => {
  console.log(`\n🏁 测试完成: ${success ? '成功' : '失败'}`)
  process.exit(success ? 0 : 1)
}).catch(error => {
  console.error('💥 测试执行错误:', error)
  process.exit(1)
})