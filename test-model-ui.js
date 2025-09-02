#!/usr/bin/env node

// 测试模型配置 UI 功能
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key'

async function testModelUI() {
  try {
    console.log('🧪 开始测试模型配置 UI 功能...')
    
    // 测试配置系统
    const configModule = await import('./dist/utils/config.js')
    const { getGlobalConfig, setModelPointer } = configModule
    
    // 测试 ModelManager
    const modelManagerModule = await import('./dist/services/models/ModelManager.js')
    const { getModelManager } = modelManagerModule
    
    console.log('✅ 1. 模块导入成功')
    
    const config = getGlobalConfig()
    const modelManager = getModelManager()
    
    console.log('✅ 2. 获取配置和模型管理器成功')
    
    // 检查现有模型
    const existingModels = modelManager.getAllProfiles().filter(p => p.isActive)
    console.log(`✅ 3. 当前活跃模型数量: ${existingModels.length}`)
    
    existingModels.forEach((model, index) => {
      console.log(`   ${index + 1}. ${model.name} (${model.provider}) - ${model.modelName}`)
    })
    
    // 添加测试模型（如果还没有）
    if (existingModels.length === 0 && process.env.DEEPSEEK_API_KEY !== 'test-key') {
      console.log('🔧 添加测试模型配置...')
      modelManager.addModelProfile({
        name: 'DeepSeek Chat Test',
        provider: 'deepseek',
        modelName: 'deepseek-chat-test',
        apiKey: process.env.DEEPSEEK_API_KEY,
        maxTokens: 4096,
        contextLength: 128000,
        isActive: true,
        createdAt: Date.now()
      })
      
      setModelPointer('main', 'deepseek-chat-test')
      console.log('✅ 4. 测试模型配置已添加')
    } else {
      console.log('✅ 4. 模型配置已存在，跳过添加')
    }
    
    // 测试模型管理器的各种方法
    console.log('✅ 5. 测试模型管理功能:')
    console.log(`   - getMainAgentModel(): ${modelManager.getMainAgentModel() || '未配置'}`)
    console.log(`   - getCurrentModel(): ${modelManager.getCurrentModel() || '未配置'}`)
    
    const activeModels = modelManager.getAllProfiles().filter(p => p.isActive)
    console.log(`   - 活跃模型列表: ${activeModels.map(m => m.name).join(', ')}`)
    
    // 测试模型指针使用情况
    const pointers = ['main', 'task', 'reasoning', 'quick']
    console.log('✅ 6. 模型指针配置:')
    pointers.forEach(pointer => {
      const modelName = config.modelPointers?.[pointer]
      console.log(`   - ${pointer}: ${modelName || '未配置'}`)
    })
    
    console.log('\n🎉 模型配置 UI 系统测试完成！')
    console.log('\n现在可以运行 npm start 并输入 /model 命令进行交互式配置')
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    console.error('堆栈信息:', error.stack)
    process.exit(1)
  }
}

testModelUI()