/**
 * WriteFlow 流式适配器模块
 * 
 * 提供统一的多厂商 AI 模型流式响应处理能力
 * 支持 OpenAI、Anthropic Claude、DeepSeek、Google Gemini 等主流厂商
 */

// 核心接口和基类
export {
  StreamAdapter,
  ProviderType
} from './StreamAdapter.js'

export type {
  StreamChunk,
  StreamAdapterConfig,
  StreamAdapterEvents,
  AdapterFactory
} from './StreamAdapter.js'

// 具体实现
export { 
  OpenAIStreamAdapter,
  createOpenAIStreamAdapter 
} from './OpenAIStreamAdapter.js'

export { 
  ClaudeStreamAdapter,
  createClaudeStreamAdapter 
} from './ClaudeStreamAdapter.js'

export { 
  DeepSeekStreamAdapter,
  createDeepSeekStreamAdapter 
} from './DeepSeekStreamAdapter.js'

export { 
  GeminiStreamAdapter,
  createGeminiStreamAdapter 
} from './GeminiStreamAdapter.js'

export { 
  ZhipuStreamAdapter,
  createZhipuStreamAdapter 
} from './ZhipuStreamAdapter.js'

export { 
  UniversalOpenAIAdapter,
  PROVIDER_CONFIGS,
  createUniversalOpenAIAdapter,
  createZhipuAdapter,
  createKimiAdapter,
  createQwenAdapter 
} from './UniversalOpenAIAdapter.js'

export type { 
  ProviderConfig
} from './UniversalOpenAIAdapter.js'

// 工厂类和便捷函数
export {
  StreamAdapterFactory,
  streamAdapterFactory,
  createStreamAdapter,
  createStreamAdapterFromModel,
  createAutoStreamAdapter
} from './StreamAdapterFactory.js'

// 流式服务
export {
  StreamingService,
  getStreamingService,
  streamAI
} from './StreamingService.js'

export type {
  StreamingRequest,
  StreamingResponse,
  StreamingServiceEvents,
  StreamingConfig
} from './StreamingService.js'

// 兼容的流式 AI 服务
export {
  StreamingAIService,
  getStreamingAIService,
  askAIStream,
  askAIStreamComplete
} from './StreamingAIService.js'

export type {
  StreamingAIServiceEvents,
  StreamingAIChunk
} from './StreamingAIService.js'

/**
 * 版本信息
 */
export const STREAM_ADAPTER_VERSION = '1.0.0'

/**
 * 支持的特性列表
 */
export const SUPPORTED_FEATURES = {
  providers: ['openai', 'anthropic', 'deepseek', 'gemini', 'zhipu', 'kimi', 'qwen'],
  protocols: ['sse', 'json-stream'],
  capabilities: [
    'incremental-parsing',
    'buffered-parsing', 
    'error-recovery',
    'auto-detection',
    'reasoning-content',
    'usage-tracking',
    'cache-statistics'
  ]
} as const