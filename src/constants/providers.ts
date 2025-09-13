// WriteFlow 支持的 AI 提供商配置
// 中文本土化的提供商信息

export const providers = {
  anthropic: {
    name: 'Anthropic Claude',
    nameZh: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com',
    description: 'Claude 系列模型，擅长长文本理解和复杂推理',
    requiresApiKey: true,
    envVar: 'ANTHROPIC_API_KEY',
  },
  openai: {
    name: 'OpenAI',
    nameZh: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    description: 'GPT 系列模型，通用性强，支持多种任务',
    requiresApiKey: true,
    envVar: 'OPENAI_API_KEY',
  },
  deepseek: {
    name: 'DeepSeek',
    nameZh: '深度求索',
    baseURL: 'https://api.deepseek.com',
    description: '国产大模型，推理能力强，成本低廉',
    requiresApiKey: true,
    envVar: 'DEEPSEEK_API_KEY',
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    nameZh: 'Kimi (月之暗面)',
    baseURL: 'https://api.moonshot.cn/v1',
    description: '支持超长上下文，擅长文档处理和分析',
    requiresApiKey: true,
    envVar: 'KIMI_API_KEY',
  },
  gemini: {
    name: 'Google Gemini',
    nameZh: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    description: 'Google 的多模态 AI，支持文本、图像、视频',
    requiresApiKey: true,
    envVar: 'GEMINI_API_KEY',
  },
  groq: {
    name: 'Groq',
    nameZh: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    description: '超高速推理，基于专用硬件的 AI 服务',
    requiresApiKey: true,
    envVar: 'GROQ_API_KEY',
  },
  mistral: {
    name: 'Mistral AI',
    nameZh: 'Mistral AI',
    baseURL: 'https://api.mistral.ai/v1',
    description: '欧洲的开源 AI 公司，注重隐私和透明度',
    requiresApiKey: true,
    envVar: 'MISTRAL_API_KEY',
  },
  xai: {
    name: 'xAI',
    nameZh: 'xAI',
    baseURL: 'https://api.x.ai/v1',
    description: 'Elon Musk 创立的 AI 公司，Grok 模型',
    requiresApiKey: true,
    envVar: 'XAI_API_KEY',
  },
  ollama: {
    name: 'Ollama',
    nameZh: 'Ollama (本地)',
    baseURL: 'http://localhost:11434/v1',
    description: '本地运行的开源模型，保护隐私，无需 API 密钥',
    requiresApiKey: false,
    isLocal: true,
  },
  custom: {
    name: 'Custom OpenAI-Compatible API',
    nameZh: '自定义 OpenAI 兼容 API',
    baseURL: '', // 用户自定义
    description: '兼容 OpenAI API 格式的第三方服务',
    requiresApiKey: true,
    isCustom: true,
  },
  'custom-openai': {
    name: 'Custom OpenAI API',
    nameZh: '自定义 OpenAI API',
    baseURL: '', // 用户自定义
    description: '完全自定义的 OpenAI 兼容服务端点',
    requiresApiKey: true,
    isCustom: true,
  },
}

// 提供商类型定义
export type ProviderType = keyof typeof providers

// 获取提供商的显示名称（支持中文）
export function getProviderDisplayName(provider: ProviderType, useZh = true): string {
  const config = providers[provider]
  return useZh && config.nameZh ? config.nameZh : config.name
}

// 获取提供商的环境变量名
export function getProviderEnvVar(provider: ProviderType): string | null {
  const config = providers[provider] as any
  return config.envVar || null
}

// 检查提供商是否需要 API 密钥
export function providerRequiresApiKey(provider: ProviderType): boolean {
  return providers[provider].requiresApiKey
}

// 检查提供商是否为本地服务
export function isLocalProvider(provider: ProviderType): boolean {
  const config = providers[provider] as any
  return config.isLocal || false
}

// 检查提供商是否为自定义服务
export function isCustomProvider(provider: ProviderType): boolean {
  const config = providers[provider] as any
  return config.isCustom || false
}

// 获取所有提供商列表
export function getAllProviders(): ProviderType[] {
  return Object.keys(providers) as ProviderType[]
}

// 获取需要 API 密钥的提供商
export function getProvidersRequiringApiKey(): ProviderType[] {
  return getAllProviders().filter(provider => providerRequiresApiKey(provider))
}

// 获取本地提供商
export function getLocalProviders(): ProviderType[] {
  return getAllProviders().filter(provider => isLocalProvider(provider))
}