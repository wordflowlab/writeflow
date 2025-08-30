import { describe, test, expect, beforeEach } from '@jest/globals'
import { DeepseekClientTool } from '../../../src/tools/writing/deepseek-client'
import { AIWritingConfig } from '../../../src/types/writing'

describe('DeepseekClientTool', () => {
  let deepseekTool: DeepseekClientTool
  let config: AIWritingConfig

  beforeEach(() => {
    config = {
      anthropicApiKey: 'sk-test-key',
      apiProvider: 'deepseek',
      apiBaseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 4000
    }
    
    deepseekTool = new DeepseekClientTool(config)
  })

  test('应该正确初始化工具', () => {
    expect(deepseekTool.name).toBe('deepseek_client')
    expect(deepseekTool.description).toBe('Deepseek v3.1 API 客户端')
    expect(deepseekTool.securityLevel).toBe('ai-powered')
  })

  test('应该成功执行聊天请求', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '你好，请介绍一下 AI 的发展历程' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata).toBeDefined()
    expect(result.metadata?.model).toBe('deepseek-chat')
    expect(result.metadata?.usage).toBeDefined()
    expect(result.metadata?.responseTime).toBeGreaterThan(0)
    expect(result.metadata?.requestId).toBeTruthy()
  })

  test('应该支持系统提示', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '写一篇关于机器学习的文章' }
      ],
      systemPrompt: '你是一位专业的技术写作专家'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.messages[0].role).toBe('system')
    expect(result.metadata?.requestParams.messages[0].content).toBe('你是一位专业的技术写作专家')
  })

  test('应该支持不同的模型', async () => {
    const models = ['deepseek-chat', 'deepseek-reasoner']
    
    for (const model of models) {
      const result = await deepseekTool.execute({
        messages: [
          { role: 'user', content: '解释一下量子计算的原理' }
        ],
        model
      })
      
      expect(result.success).toBe(true)
      expect(result.metadata?.model).toBe(model)
    }
  })

  test('应该支持自定义参数', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '生成一个创意故事' }
      ],
      temperature: 0.9,
      maxTokens: 2000
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.requestParams.temperature).toBe(0.9)
    expect(result.metadata?.requestParams.max_tokens).toBe(2000)
  })

  test('应该验证必需参数', async () => {
    const result = await deepseekTool.execute({})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少消息参数')
  })

  test('应该验证空消息数组', async () => {
    const result = await deepseekTool.execute({
      messages: []
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少消息参数')
  })

  test('应该验证API密钥', async () => {
    const configWithoutKey = { ...config, anthropicApiKey: '' }
    const toolWithoutKey = new DeepseekClientTool(configWithoutKey)
    
    const result = await toolWithoutKey.execute({
      messages: [
        { role: 'user', content: '测试' }
      ]
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('未配置 API 密钥')
  })

  test('应该正确验证配置', async () => {
    const validResult = await deepseekTool.validateConfig()
    expect(validResult.valid).toBe(true)

    // 测试缺少API密钥
    const configWithoutKey = { ...config, anthropicApiKey: '' }
    const toolWithoutKey = new DeepseekClientTool(configWithoutKey)
    const invalidResult1 = await toolWithoutKey.validateConfig()
    expect(invalidResult1.valid).toBe(false)
    expect(invalidResult1.error).toContain('缺少 API 密钥')

    // 测试缺少模型
    const configWithoutModel = { ...config, model: '' }
    const toolWithoutModel = new DeepseekClientTool(configWithoutModel)
    const invalidResult2 = await toolWithoutModel.validateConfig()
    expect(invalidResult2.valid).toBe(false)
    expect(invalidResult2.error).toContain('缺少模型配置')

    // 测试不支持的模型
    const configWithInvalidModel = { ...config, model: 'invalid-model' }
    const toolWithInvalidModel = new DeepseekClientTool(configWithInvalidModel)
    const invalidResult3 = await toolWithInvalidModel.validateConfig()
    expect(invalidResult3.valid).toBe(false)
    expect(invalidResult3.error).toContain('不支持的模型')
  })

  test('应该返回支持的模型列表', () => {
    const supportedModels = deepseekTool.getSupportedModels()
    expect(supportedModels).toContain('deepseek-chat')
    expect(supportedModels).toContain('deepseek-reasoner')
    expect(supportedModels).toContain('deepseek-v3-chat')
    expect(supportedModels).toContain('deepseek-v3-reasoner')
  })

  test('应该正确验证输入参数', async () => {
    // 有效输入
    const validResult = await deepseekTool.validateInput({
      messages: [
        { role: 'user', content: '有效消息' }
      ]
    })
    expect(validResult).toBe(true)

    // 无效输入 - 缺少消息
    const invalidResult1 = await deepseekTool.validateInput({})
    expect(invalidResult1).toBe(false)

    // 无效输入 - 空消息数组
    const invalidResult2 = await deepseekTool.validateInput({
      messages: []
    })
    expect(invalidResult2).toBe(false)

    // 无效输入 - 非数组消息
    const invalidResult3 = await deepseekTool.validateInput({
      messages: 'not-an-array'
    })
    expect(invalidResult3).toBe(false)
  })

  test('应该正确获取模型信息', () => {
    const chatInfo = deepseekTool.getModelInfo('deepseek-chat')
    expect(chatInfo.name).toBe('Deepseek Chat v3.1')
    expect(chatInfo.contextWindow).toBe(128000)
    expect(chatInfo.description).toBeTruthy()
    expect(chatInfo.features.length).toBeGreaterThan(0)

    const reasonerInfo = deepseekTool.getModelInfo('deepseek-reasoner')
    expect(reasonerInfo.name).toBe('Deepseek Reasoner v3.1')
    expect(reasonerInfo.contextWindow).toBe(128000)
    expect(reasonerInfo.features).toContain('深度推理')

    const unknownInfo = deepseekTool.getModelInfo('unknown-model')
    expect(unknownInfo.name).toBe('Unknown Model')
    expect(unknownInfo.contextWindow).toBe(4096)
  })

  test('应该正确估算token使用量', () => {
    // 测试中文文本
    const chineseText = '这是一个测试文本，包含中文字符'
    const chineseTokens = deepseekTool.estimateTokens(chineseText)
    expect(chineseTokens).toBeGreaterThan(0)
    expect(chineseTokens).toBeLessThan(chineseText.length * 2)

    // 测试英文文本
    const englishText = 'This is a test text with English words'
    const englishTokens = deepseekTool.estimateTokens(englishText)
    expect(englishTokens).toBeGreaterThan(0)

    // 测试混合文本
    const mixedText = 'Hello 你好 world 世界'
    const mixedTokens = deepseekTool.estimateTokens(mixedText)
    expect(mixedTokens).toBeGreaterThan(0)
  })

  test('应该支持复杂的对话历史', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'system', content: '你是一个专业的写作助手' },
        { role: 'user', content: '请帮我写一篇关于人工智能的文章' },
        { role: 'assistant', content: '好的，我来为您创作一篇人工智能的文章...' },
        { role: 'user', content: '请加强技术细节部分' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.messages).toHaveLength(4)
  })

  test('应该处理大纲生成请求', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '请为"深度学习在自然语言处理中的应用"这个主题生成详细大纲' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('大纲')
    expect(result.content).toBeTruthy()
  })

  test('应该处理文本改写请求', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '请将以下内容改写为学术风格：人工智能很厉害' }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('改写')
    expect(result.content).toBeTruthy()
  })

  test('应该正确处理API错误', async () => {
    // 使用无效的API密钥来触发错误
    const invalidConfig = { 
      ...config, 
      anthropicApiKey: 'invalid-key',
      apiBaseUrl: 'https://invalid.api.url'
    }
    const invalidTool = new DeepseekClientTool(invalidConfig)
    
    const result = await invalidTool.execute({
      messages: [
        { role: 'user', content: '测试错误处理' }
      ]
    })
    
    // 应该回退到模拟响应
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestId).toContain('deepseek_')
  })

  test('应该支持高温度创意生成', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '创作一个科幻故事开头' }
      ],
      temperature: 0.95,
      model: 'deepseek-chat'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.temperature).toBe(0.95)
  })

  test('应该支持推理模型的复杂任务', async () => {
    const result = await deepseekTool.execute({
      messages: [
        { role: 'user', content: '请分析以下逻辑推理题：如果所有A都是B，所有B都是C，那么所有A都是什么？' }
      ],
      model: 'deepseek-reasoner',
      temperature: 0.1
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toBeTruthy()
    expect(result.metadata?.requestParams.model).toBe('deepseek-reasoner')
  })
})