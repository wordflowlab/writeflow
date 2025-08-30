import { describe, test, expect, beforeEach } from '@jest/globals'
import { GLMClientTool } from '../../../src/tools/writing/glm-client'
import { AIWritingConfig } from '../../../src/types/writing'

describe('GLMClientTool', () => {
  let glmTool: GLMClientTool
  let config: AIWritingConfig

  beforeEach(() => {
    config = {
      anthropicApiKey: 'sk-test-key',
      apiProvider: 'glm4.5',
      apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4.5',
      temperature: 0.7,
      maxTokens: 4000
    }
    
    glmTool = new GLMClientTool(config)
  })

  test('应该正确初始化工具', () => {
    expect(glmTool.name).toBe('glm_client')
    expect(glmTool.description).toBe('GLM-4.5 API 客户端')
    expect(glmTool.securityLevel).toBe('ai-powered')
  })

  test('应该成功执行聊天请求', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '你好，请介绍一下智谱AI的发展历程' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata).toBeDefined()
    expect(result.metadata?.model).toBe('glm-4.5')
    expect(result.metadata?.usage).toBeDefined()
    expect(result.metadata?.responseTime).toBeGreaterThan(0)
    expect(result.metadata?.requestId).toBeTruthy()
  })

  test('应该支持系统提示', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '写一篇关于认知科学的学术论文' }
      ],
      systemPrompt: '你是一位清华大学的认知科学专家，具有深厚的理论功底'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.messages[0].role).toBe('system')
    expect(result.metadata?.requestParams.messages[0].content).toBe('你是一位清华大学的认知科学专家，具有深厚的理论功底')
  })

  test('应该支持不同的GLM模型', async () => {
    const models = ['glm-4', 'glm-4.5', 'glm-4-air', 'glm-4-flash']
    
    for (const model of models) {
      const result = await glmTool.execute({
        messages: [
          { role: 'user', content: '解释一下transformer架构的核心原理' }
        ],
        model
      })
      
      expect(result.success).toBe(true)
      expect(result.metadata?.model).toBe(model)
    }
  })

  test('应该支持自定义参数', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '创作一个关于人工智能伦理的哲学思辨' }
      ],
      temperature: 0.8,
      maxTokens: 3000
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.requestParams.temperature).toBe(0.8)
    expect(result.metadata?.requestParams.max_tokens).toBe(3000)
  })

  test('应该验证必需参数', async () => {
    const result = await glmTool.execute({})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少消息参数')
  })

  test('应该验证空消息数组', async () => {
    const result = await glmTool.execute({
      messages: []
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少消息参数')
  })

  test('应该验证API密钥', async () => {
    const configWithoutKey = { ...config, anthropicApiKey: '' }
    const toolWithoutKey = new GLMClientTool(configWithoutKey)
    
    const result = await toolWithoutKey.execute({
      messages: [
        { role: 'user', content: '测试' }
      ]
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('未配置 API 密钥')
  })

  test('应该正确验证配置', async () => {
    const validResult = await glmTool.validateConfig()
    expect(validResult.valid).toBe(true)

    // 测试缺少API密钥
    const configWithoutKey = { ...config, anthropicApiKey: '' }
    const toolWithoutKey = new GLMClientTool(configWithoutKey)
    const invalidResult1 = await toolWithoutKey.validateConfig()
    expect(invalidResult1.valid).toBe(false)
    expect(invalidResult1.error).toContain('缺少 API 密钥')

    // 测试缺少模型
    const configWithoutModel = { ...config, model: '' }
    const toolWithoutModel = new GLMClientTool(configWithoutModel)
    const invalidResult2 = await toolWithoutModel.validateConfig()
    expect(invalidResult2.valid).toBe(false)
    expect(invalidResult2.error).toContain('缺少模型配置')

    // 测试不支持的模型
    const configWithInvalidModel = { ...config, model: 'invalid-model' }
    const toolWithInvalidModel = new GLMClientTool(configWithInvalidModel)
    const invalidResult3 = await toolWithInvalidModel.validateConfig()
    expect(invalidResult3.valid).toBe(false)
    expect(invalidResult3.error).toContain('不支持的模型')
  })

  test('应该返回支持的模型列表', () => {
    const supportedModels = glmTool.getSupportedModels()
    expect(supportedModels).toContain('glm-4')
    expect(supportedModels).toContain('glm-4.5')
    expect(supportedModels).toContain('glm-4-air')
    expect(supportedModels).toContain('glm-4-flash')
    expect(supportedModels).toContain('glm4')
    expect(supportedModels).toContain('chatglm')
  })

  test('应该正确验证输入参数', async () => {
    // 有效输入
    const validResult = await glmTool.validateInput({
      messages: [
        { role: 'user', content: '有效消息' }
      ]
    })
    expect(validResult).toBe(true)

    // 无效输入 - 缺少消息
    const invalidResult1 = await glmTool.validateInput({})
    expect(invalidResult1).toBe(false)

    // 无效输入 - 空消息数组
    const invalidResult2 = await glmTool.validateInput({
      messages: []
    })
    expect(invalidResult2).toBe(false)

    // 无效输入 - 非数组消息
    const invalidResult3 = await glmTool.validateInput({
      messages: 'not-an-array'
    })
    expect(invalidResult3).toBe(false)
  })

  test('应该正确获取模型信息', () => {
    const glm4Info = glmTool.getModelInfo('glm-4')
    expect(glm4Info.name).toBe('智谱GLM-4')
    expect(glm4Info.contextWindow).toBe(128000)
    expect(glm4Info.description).toBeTruthy()
    expect(glm4Info.features.length).toBeGreaterThan(0)

    const glm45Info = glmTool.getModelInfo('glm-4.5')
    expect(glm45Info.name).toBe('智谱GLM-4.5')
    expect(glm45Info.contextWindow).toBe(128000)
    expect(glm45Info.features).toContain('超强推理')

    const airInfo = glmTool.getModelInfo('glm-4-air')
    expect(airInfo.name).toBe('智谱GLM-4 Air')
    expect(airInfo.features).toContain('快速响应')

    const flashInfo = glmTool.getModelInfo('glm-4-flash')
    expect(flashInfo.name).toBe('智谱GLM-4 Flash')
    expect(flashInfo.features).toContain('毫秒响应')

    const visionInfo = glmTool.getModelInfo('glm-4v')
    expect(visionInfo.name).toBe('智谱GLM-4V')
    expect(visionInfo.features).toContain('图像理解')

    const unknownInfo = glmTool.getModelInfo('unknown-model')
    expect(unknownInfo.name).toBe('Unknown GLM Model')
    expect(unknownInfo.contextWindow).toBe(2000)
  })

  test('应该正确估算token使用量', () => {
    // 测试中文文本
    const chineseText = '这是一个测试文本，包含中文字符'
    const chineseTokens = glmTool.estimateTokens(chineseText)
    expect(chineseTokens).toBeGreaterThan(0)
    expect(chineseTokens).toBeLessThan(chineseText.length * 2)

    // 测试英文文本
    const englishText = 'This is a test text with English words'
    const englishTokens = glmTool.estimateTokens(englishText)
    expect(englishTokens).toBeGreaterThan(0)

    // 测试混合文本
    const mixedText = 'Hello 你好 world 世界'
    const mixedTokens = glmTool.estimateTokens(mixedText)
    expect(mixedTokens).toBeGreaterThan(0)
  })

  test('应该返回正确的定价信息', () => {
    const glm4Pricing = glmTool.getPricingInfo('glm-4')
    expect(glm4Pricing.inputPrice).toBe(0.1)
    expect(glm4Pricing.outputPrice).toBe(0.1)
    expect(glm4Pricing.currency).toBe('CNY')

    const glm45Pricing = glmTool.getPricingInfo('glm-4.5')
    expect(glm45Pricing.inputPrice).toBe(0.05)
    expect(glm45Pricing.outputPrice).toBe(0.05)
    expect(glm45Pricing.currency).toBe('CNY')

    const airPricing = glmTool.getPricingInfo('glm-4-air')
    expect(airPricing.inputPrice).toBe(0.001)
    expect(airPricing.outputPrice).toBe(0.001)
    expect(airPricing.currency).toBe('CNY')

    const flashPricing = glmTool.getPricingInfo('glm-4-flash')
    expect(flashPricing.inputPrice).toBe(0.0001)
    expect(flashPricing.outputPrice).toBe(0.0001)
    expect(flashPricing.currency).toBe('CNY')
  })

  test('应该返回正确的功能特性', () => {
    const glm4Features = glmTool.getSupportedFeatures('glm-4')
    expect(glm4Features.multimodal).toBe(false)
    expect(glm4Features.functionCalling).toBe(true)
    expect(glm4Features.codeGeneration).toBe(true)
    expect(glm4Features.webBrowsing).toBe(false)
    expect(glm4Features.imageGeneration).toBe(false)

    const glmvFeatures = glmTool.getSupportedFeatures('glm-4v')
    expect(glmvFeatures.multimodal).toBe(true)
    expect(glmvFeatures.functionCalling).toBe(false)
    expect(glmvFeatures.codeGeneration).toBe(true)
  })

  test('应该支持复杂的对话历史', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'system', content: '你是一个专业的学术写作助手' },
        { role: 'user', content: '请帮我写一篇关于认知计算的论文' },
        { role: 'assistant', content: '好的，我来为您撰写认知计算的学术论文...' },
        { role: 'user', content: '请重点阐述认知架构的设计原理' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.messages).toHaveLength(4)
  })

  test('应该处理大纲生成请求', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '请为"深度学习在自然语言理解中的应用研究"这个主题生成详细大纲' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('大纲')
    expect(result.content).toContain('GLM-4.5')
    expect(result.content).toBeTruthy()
  })

  test('应该处理文本改写请求', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '请将以下内容改写为学术风格：ChatGLM非常厉害' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('改写')
    expect(result.content).toContain('GLM-4.5')
    expect(result.content).toBeTruthy()
  })

  test('应该正确处理API错误', async () => {
    // 使用无效的API密钥来触发错误
    const invalidConfig = { 
      ...config, 
      anthropicApiKey: 'invalid-key',
      apiBaseUrl: 'https://invalid.api.url'
    }
    const invalidTool = new GLMClientTool(invalidConfig)
    
    const result = await invalidTool.execute({
      messages: [
        { role: 'user', content: '测试错误处理' }
      ]
    })
    
    // 应该回退到模拟响应
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestId).toContain('glm_')
  })

  test('应该支持高温度创意生成', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '创作一个关于人工智能哲学思考的深度文章' }
      ],
      temperature: 0.9,
      model: 'glm-4.5'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.temperature).toBe(0.9)
  })

  test('应该支持快速响应模型', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '请快速总结一下机器学习的基本概念' }
      ],
      model: 'glm-4-flash',
      temperature: 0.3
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.model).toBe('glm-4-flash')
  })

  test('应该支持多模态模型', async () => {
    const result = await glmTool.execute({
      messages: [
        { role: 'user', content: '分析一下计算机视觉的发展趋势' }
      ],
      model: 'glm-4v',
      temperature: 0.5
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.model).toBe('glm-4v')
  })
})