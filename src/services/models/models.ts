/**
 * WriteFlow 支持的 AI 模型定义
 * 简化版的模型配置，专注于写作场景
 */

export interface ModelDefinition {
  model: string
  provider: string
  displayName: string
  description: string
  contextLength: number
  maxOutputTokens: number
  
  // 成本信息
  inputCostPerToken: number
  outputCostPerToken: number
  cacheReadCostPerToken?: number
  
  // 能力标记
  capabilities: {
    streaming: boolean
    vision: boolean
    functionCalling: boolean
    caching: boolean
  }
  
  // 写作特色
  writingStrengths: string[]
  recommendedFor: ('creative' | 'technical' | 'academic' | 'general')[]
}

/**
 * WriteFlow 支持的模型配置
 */
export const WRITEFLOW_MODELS: ModelDefinition[] = [
  // Anthropic Claude 系列
  {
    model: 'claude-3-5-haiku-latest',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    description: '快速响应的写作助手，适合日常写作',
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.0000008,
    outputCostPerToken: 0.000004,
    cacheReadCostPerToken: 0.0000001,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      caching: true
    },
    writingStrengths: ['快速响应', '结构清晰', '多语言支持'],
    recommendedFor: ['general', 'technical']
  },

  {
    model: 'claude-3-5-sonnet-latest',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    description: '平衡性能与创意的全能写作助手',
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000003,
    outputCostPerToken: 0.000015,
    cacheReadCostPerToken: 0.0000003,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      caching: true
    },
    writingStrengths: ['创意写作', '逻辑严谨', '风格多样', '长文档处理'],
    recommendedFor: ['creative', 'technical', 'academic', 'general']
  },

  {
    model: 'claude-sonnet-4-20250514',
    provider: 'bigdream',
    displayName: 'Claude Sonnet 4',
    description: '最新一代 Claude 模型，写作能力最强',
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000003,
    outputCostPerToken: 0.000015,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      caching: true
    },
    writingStrengths: ['顶级创意', '深度分析', '风格精准', '复杂推理'],
    recommendedFor: ['creative', 'technical', 'academic']
  },

  // DeepSeek 系列
  {
    model: 'deepseek-chat',
    provider: 'deepseek',
    displayName: 'DeepSeek Chat',
    description: '高性价比的中文写作助手',
    contextLength: 65536,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000027,
    outputCostPerToken: 0.0000011,
    cacheReadCostPerToken: 0.00000007,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      caching: true
    },
    writingStrengths: ['中文优化', '成本低廉', '技术文档', '代码解释'],
    recommendedFor: ['technical', 'general']
  },

  {
    model: 'deepseek-reasoner',
    provider: 'deepseek',
    displayName: 'DeepSeek Reasoner',
    description: '擅长逻辑推理的写作助手',
    contextLength: 65536,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.00000055,
    outputCostPerToken: 0.00000219,
    cacheReadCostPerToken: 0.00000014,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      caching: true
    },
    writingStrengths: ['逻辑推理', '论证分析', '学术写作', '思维导图'],
    recommendedFor: ['academic', 'technical']
  },

  // OpenAI 系列
  {
    model: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4 Omni',
    description: '多模态能力强的全能写作助手',
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputCostPerToken: 0.0000025,
    outputCostPerToken: 0.00001,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      caching: false
    },
    writingStrengths: ['多模态', '创意无限', '实时信息', '多语言'],
    recommendedFor: ['creative', 'technical', 'general']
  },

  {
    model: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4 Omni Mini',
    description: '轻量级但功能完整的写作助手',
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputCostPerToken: 0.00000015,
    outputCostPerToken: 0.0000006,
    capabilities: {
      streaming: true,
      vision: true,
      functionCalling: true,
      caching: false
    },
    writingStrengths: ['性价比高', '响应快速', '功能全面'],
    recommendedFor: ['general']
  },

  // Kimi (Moonshot) 系列
  {
    model: 'moonshot-v1-8k',
    provider: 'kimi',
    displayName: 'Kimi 8K',
    description: '中文优化的快速写作助手',
    contextLength: 8192,
    maxOutputTokens: 8192,
    inputCostPerToken: 0.000001, // 估计值
    outputCostPerToken: 0.000002,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      caching: false
    },
    writingStrengths: ['中文专精', '快速响应', '本土化'],
    recommendedFor: ['general']
  },

  {
    model: 'moonshot-v1-32k',
    provider: 'kimi',
    displayName: 'Kimi 32K',
    description: '中等上下文的中文写作助手',
    contextLength: 32768,
    maxOutputTokens: 32768,
    inputCostPerToken: 0.000002,
    outputCostPerToken: 0.000002,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      caching: false
    },
    writingStrengths: ['中文专精', '长文档', '本土化'],
    recommendedFor: ['general', 'technical']
  },

  {
    model: 'moonshot-v1-128k',
    provider: 'kimi',
    displayName: 'Kimi 128K',
    description: '长上下文的中文写作助手',
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputCostPerToken: 0.000005,
    outputCostPerToken: 0.000005,
    capabilities: {
      streaming: true,
      vision: false,
      functionCalling: true,
      caching: false
    },
    writingStrengths: ['中文专精', '超长文档', '本土化', '文档整理'],
    recommendedFor: ['general', 'technical', 'academic']
  }
]

/**
 * 提供商配置
 */
export const PROVIDERS = {
  anthropic: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    requiresAuth: true
  },
  bigdream: {
    name: 'BigDream (Claude)',
    baseURL: 'https://api.bigdream.ai',
    apiKeyEnvVar: 'BIGDREAM_API_KEY',
    requiresAuth: true
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    requiresAuth: true
  },
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    requiresAuth: true
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnvVar: 'KIMI_API_KEY',
    requiresAuth: true
  },
  ollama: {
    name: 'Ollama (本地)',
    baseURL: 'http://localhost:11434/v1',
    apiKeyEnvVar: '',
    requiresAuth: false
  }
} as const

/**
 * 根据写作类型获取推荐模型
 */
export function getRecommendedModels(writingType: 'creative' | 'technical' | 'academic' | 'general'): ModelDefinition[] {
  return WRITEFLOW_MODELS
    .filter(model => model.recommendedFor.includes(writingType))
    .sort((a, b) => {
      // 按上下文长度和写作优势排序
      const aScore = a.contextLength / 1000 + a.writingStrengths.length
      const bScore = b.contextLength / 1000 + b.writingStrengths.length
      return bScore - aScore
    })
}

/**
 * 根据预算获取推荐模型
 */
export function getBudgetFriendlyModels(maxCostPerThousandTokens: number = 0.01): ModelDefinition[] {
  return WRITEFLOW_MODELS
    .filter(model => model.inputCostPerToken * 1000 <= maxCostPerThousandTokens)
    .sort((a, b) => a.inputCostPerToken - b.inputCostPerToken)
}

/**
 * 获取指定提供商的模型
 */
export function getModelsByProvider(provider: string): ModelDefinition[] {
  return WRITEFLOW_MODELS.filter(model => model.provider === provider)
}

/**
 * 查找模型定义
 */
export function findModelDefinition(modelName: string): ModelDefinition | null {
  return WRITEFLOW_MODELS.find(model => model.model === modelName) || null
}

/**
 * 获取默认写作模型
 */
export function getDefaultWritingModel(): ModelDefinition {
  // 优先 Claude 3.5 Sonnet，兼顾性能和成本
  return WRITEFLOW_MODELS.find(model => model.model === 'claude-3-5-sonnet-latest') || WRITEFLOW_MODELS[0]
}