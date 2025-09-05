/**
 * WriteFlow 模型能力配置
 * 针对写作场景优化的模型能力系统
 */

export interface ModelCapabilities {
  // 基础能力
  contextLength: number
  maxOutputTokens: number
  
  // API 架构
  apiArchitecture: {
    primary: 'chat_completions' | 'responses_api'
    fallback?: 'chat_completions'
  }
  
  // 功能支持
  supportsStreaming: boolean
  supportsSystemMessages: boolean
  supportsFunctionCalling: boolean
  supportsVision: boolean
  supportsAssistantPrefill: boolean
  supportsPromptCaching: boolean
  
  // 流式能力
  streamingProtocol?: {
    type: 'sse' | 'websocket'
    format: 'openai' | 'anthropic' | 'deepseek' | 'gemini'
    supportsReasoning?: boolean
    supportsCacheStats?: boolean
  }
  
  // 成本信息
  pricing?: {
    inputCostPerToken: number
    outputCostPerToken: number
    cacheReadCostPerToken?: number
    cacheCreateCostPerToken?: number
  }
  
  // 写作特化能力
  writingCapabilities: {
    creativityLevel: 'low' | 'medium' | 'high'
    technicalWriting: boolean
    academicWriting: boolean
    multilingualSupport: boolean
    styleAdaptation: boolean
  }
}

/**
 * 预定义的模型能力配置
 */
const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Anthropic Claude 最新模型
  'claude-opus-4-1-20250805': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: {
      primary: 'responses_api',
      fallback: 'chat_completions'
    },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    streamingProtocol: {
      type: 'sse',
      format: 'anthropic'
    },
    pricing: {
      inputCostPerToken: 0.000015,
      outputCostPerToken: 0.000075,
      cacheReadCostPerToken: 0.0000015,
      cacheCreateCostPerToken: 0.00000375
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'claude-opus-4-1-20250805-thinking': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: {
      primary: 'responses_api',
      fallback: 'chat_completions'
    },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    pricing: {
      inputCostPerToken: 0.000015,
      outputCostPerToken: 0.000075,
      cacheReadCostPerToken: 0.0000015,
      cacheCreateCostPerToken: 0.00000375
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'claude-opus-4-20250514': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: {
      primary: 'responses_api',
      fallback: 'chat_completions'
    },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    pricing: {
      inputCostPerToken: 0.000015,
      outputCostPerToken: 0.000075,
      cacheReadCostPerToken: 0.0000015,
      cacheCreateCostPerToken: 0.00000375
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'claude-sonnet-4-20250514': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: {
      primary: 'responses_api',
      fallback: 'chat_completions'
    },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    pricing: {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadCostPerToken: 0.0000003,
      cacheCreateCostPerToken: 0.00000075
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'claude-3-5-sonnet-20241022': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: {
      primary: 'responses_api',
      fallback: 'chat_completions'
    },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    streamingProtocol: {
      type: 'sse',
      format: 'anthropic'
    },
    pricing: {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadCostPerToken: 0.0000003,
      cacheCreateCostPerToken: 0.00000075
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'claude-3-5-haiku-20241022': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: {
      primary: 'responses_api',
      fallback: 'chat_completions'
    },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    pricing: {
      inputCostPerToken: 0.00000025,
      outputCostPerToken: 0.00000125,
      cacheReadCostPerToken: 0.000000025,
      cacheCreateCostPerToken: 0.0000000625
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: false,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  // 保留旧版本兼容性
  'claude-3-5-haiku-latest': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'responses_api' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    pricing: {
      inputCostPerToken: 0.0000008,
      outputCostPerToken: 0.000004,
      cacheReadCostPerToken: 0.0000001,
      cacheCreateCostPerToken: 0.00000125
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'claude-3-5-sonnet-latest': {
    contextLength: 200000,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'responses_api' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: true,
    supportsPromptCaching: true,
    pricing: {
      inputCostPerToken: 0.000003,
      outputCostPerToken: 0.000015,
      cacheReadCostPerToken: 0.0000003,
      cacheCreateCostPerToken: 0.00000375
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },


  // DeepSeek 模型
  'deepseek-chat': {
    contextLength: 65536,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: true,
    streamingProtocol: {
      type: 'sse',
      format: 'deepseek',
      supportsCacheStats: true
    },
    pricing: {
      inputCostPerToken: 0.00000027,
      outputCostPerToken: 0.0000011,
      cacheReadCostPerToken: 0.00000007
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'deepseek-reasoner': {
    contextLength: 65536,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: true,
    streamingProtocol: {
      type: 'sse',
      format: 'deepseek',
      supportsReasoning: true,
      supportsCacheStats: true
    },
    pricing: {
      inputCostPerToken: 0.00000055,
      outputCostPerToken: 0.00000219,
      cacheReadCostPerToken: 0.00000014
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  // OpenAI 模型
  'gpt-4o': {
    contextLength: 128000,
    maxOutputTokens: 16384,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.0000025,
      outputCostPerToken: 0.00001
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'gpt-4o-mini': {
    contextLength: 128000,
    maxOutputTokens: 16384,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    pricing: {
      inputCostPerToken: 0.00000015,
      outputCostPerToken: 0.0000006
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: false,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  // Kimi (Moonshot) 模型
  'moonshot-v1-8k': {
    contextLength: 8192,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.000012,
      outputCostPerToken: 0.000012
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'moonshot-v1-32k': {
    contextLength: 32768,
    maxOutputTokens: 32768,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.000024,
      outputCostPerToken: 0.000024
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'moonshot-v1-128k': {
    contextLength: 128000,
    maxOutputTokens: 16384,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00006,
      outputCostPerToken: 0.00006
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  // 智谱 AI (GLM) 模型
  'glm-4.5': {
    contextLength: 128000,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00005,
      outputCostPerToken: 0.00005
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'glm-4.5v': {
    contextLength: 128000,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00005,
      outputCostPerToken: 0.00005
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'glm-4v': {
    contextLength: 8192,
    maxOutputTokens: 4096,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00005,
      outputCostPerToken: 0.00005
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'glm-4-long': {
    contextLength: 128000,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00001,
      outputCostPerToken: 0.00001
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'charglm-4': {
    contextLength: 8192,
    maxOutputTokens: 4096,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: false,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00005,
      outputCostPerToken: 0.00005
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: false,
      academicWriting: false,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'glm-z1-air': {
    contextLength: 128000,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00001,
      outputCostPerToken: 0.00001
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  // Qwen 系列模型
  'qwen-turbo': {
    contextLength: 8192,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.000002,
      outputCostPerToken: 0.000002
    },
    writingCapabilities: {
      creativityLevel: 'medium',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'qwen-plus': {
    contextLength: 32768,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.000008,
      outputCostPerToken: 0.000008
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  },

  'qwen-max': {
    contextLength: 8192,
    maxOutputTokens: 8192,
    apiArchitecture: { primary: 'chat_completions' },
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsAssistantPrefill: false,
    supportsPromptCaching: false,
    streamingProtocol: {
      type: 'sse',
      format: 'openai'
    },
    pricing: {
      inputCostPerToken: 0.00002,
      outputCostPerToken: 0.00006
    },
    writingCapabilities: {
      creativityLevel: 'high',
      technicalWriting: true,
      academicWriting: true,
      multilingualSupport: true,
      styleAdaptation: true
    }
  }
}

/**
 * 获取模型能力配置
 */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  const capabilities = MODEL_CAPABILITIES[modelName]
  
  if (!capabilities) {
    // 返回默认能力配置
    return {
      contextLength: 4096,
      maxOutputTokens: 4096,
      apiArchitecture: { primary: 'chat_completions' },
      supportsStreaming: true,
      supportsSystemMessages: true,
      supportsFunctionCalling: false,
      supportsVision: false,
      supportsAssistantPrefill: false,
      supportsPromptCaching: false,
      writingCapabilities: {
        creativityLevel: 'medium',
        technicalWriting: true,
        academicWriting: false,
        multilingualSupport: false,
        styleAdaptation: false
      }
    }
  }
  
  return capabilities
}

/**
 * 获取所有支持的模型
 */
export function getSupportedModels(): string[] {
  return Object.keys(MODEL_CAPABILITIES)
}

/**
 * 检查模型是否支持特定功能
 */
export function supportsFeature(modelName: string, feature: keyof ModelCapabilities): boolean {
  const capabilities = getModelCapabilities(modelName)
  return Boolean(capabilities[feature])
}

/**
 * 获取适合写作的模型推荐
 */
export function getWritingRecommendations(writingType: 'creative' | 'technical' | 'academic'): string[] {
  const recommendations = Object.entries(MODEL_CAPABILITIES)
    .filter(([_, capabilities]) => {
      switch (writingType) {
        case 'creative':
          return capabilities.writingCapabilities.creativityLevel === 'high'
        case 'technical':
          return capabilities.writingCapabilities.technicalWriting
        case 'academic':
          return capabilities.writingCapabilities.academicWriting
        default:
          return true
      }
    })
    .map(([modelName]) => modelName)
    .sort((a, b) => {
      // 按上下文长度排序，优先推荐长上下文模型
      const capA = MODEL_CAPABILITIES[a]
      const capB = MODEL_CAPABILITIES[b]
      return capB.contextLength - capA.contextLength
    })

  return recommendations
}

/**
 * 估算模型使用成本
 */
export function estimateCost(
  modelName: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  const capabilities = getModelCapabilities(modelName)
  
  if (!capabilities.pricing) {
    return 0
  }
  
  const inputCost = inputTokens * capabilities.pricing.inputCostPerToken
  const outputCost = outputTokens * capabilities.pricing.outputCostPerToken
  
  return inputCost + outputCost
}