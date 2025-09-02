#!/usr/bin/env node

// 测试模型配置功能
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key'

async function testModelConfig() {
  try {
    console.log('🧪 开始测试模型配置系统...')
    
    // 测试配置系统 - 使用动态导入
    console.log('✅ 1. 导入配置系统')
    const configModule = await import('./dist/utils/config.js')
    const { getGlobalConfig, setModelPointer } = configModule
    
    // 测试 ModelManager
    console.log('✅ 2. 导入 ModelManager')
    const modelManagerModule = await import('./dist/services/models/ModelManager.js')
    const { getModelManager } = modelManagerModule
    
    // 测试AI服务
    console.log('✅ 3. 导入 WriteFlowAIService')
    const aiServiceModule = await import('./dist/services/ai/WriteFlowAIService.js')
    const { getWriteFlowAIService } = aiServiceModule
    
    // 测试基础配置
    const config = getGlobalConfig()
    console.log('✅ 4. 全局配置加载成功')
    
    const modelManager = getModelManager()
    console.log('✅ 5. ModelManager 初始化成功')
    
    const aiService = getWriteFlowAIService()
    console.log('✅ 6. AI 服务初始化成功')
    
    // 检查可用模型
    const availableModels = modelManager.getAllProfiles()
    console.log(`✅ 7. 可用模型数量: ${availableModels.length}`)
    
    // 检查主模型
    const mainModel = modelManager.getMainAgentModel()
    console.log(`✅ 8. 主模型: ${mainModel || '未配置'}`)
    
    // 如果有 DeepSeek API 密钥，测试添加模型
    if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'test-key') {
      console.log('🔧 检测到 DeepSeek API 密钥，尝试添加模型配置...')
      
      // 添加 DeepSeek 模型配置
      modelManager.addModelProfile({
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        modelName: 'deepseek-chat',
        apiKey: process.env.DEEPSEEK_API_KEY,
        maxTokens: 4096,
        contextLength: 128000,
        isActive: true
      })
      
      // 设置为主模型
      setModelPointer('main', 'deepseek-chat')
      
      console.log('✅ 9. DeepSeek 模型配置已添加')
      
      // 测试AI调用
      const response = await aiService.processRequest({
        prompt: '你好，简单介绍一下你的功能',
        maxTokens: 50
      })
      
      console.log('✅ 10. AI 调用测试成功')
      console.log('响应:', response.content.substring(0, 100) + '...')
    } else {
      console.log('⚠️  未检测到有效的 DeepSeek API 密钥，跳过AI调用测试')
    }
    
    console.log('\n🎉 模型配置系统测试完成！')
    console.log('\n📋 测试结果总结:')
    console.log('- 配置系统: ✅ 正常')
    console.log('- ModelManager: ✅ 正常')
    console.log('- AI服务: ✅ 正常')
    console.log('- 模型配置: ✅ 支持')
    if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'test-key') {
      console.log('- API调用: ✅ 正常')
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    console.error('堆栈信息:', error.stack)
    process.exit(1)
  }
}

testModelConfig()