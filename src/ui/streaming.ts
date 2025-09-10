/**
 * WriteFlow 流式输出系统完整导出
 * 统一导出所有流式相关的组件和工具
 */

// 核心流式组件
export {
  StreamingText,
  StreamingMarkdown,
  StreamingCodeBlock,
  StreamingOutputManager,
} from './components/streaming/index.js'

export type {
  StreamingTextProps,
  StreamingMarkdownProps,
  StreamingCodeBlockProps,
  StreamingOutputManagerProps,
  StreamState,
} from './components/streaming/index.js'

// 流式管道系统
export {
  StreamingPipeline,
  getStreamingPipeline,
  createStreamProcessor,
} from './utils/streamingPipeline.js'

export type {
  StreamChunk,
  RenderBuffer,
  StreamingPipelineOptions,
} from './utils/streamingPipeline.js'

// React Hooks
export {
  useStreamingOutput,
  useSimpleStreaming,
} from './hooks/useStreamingOutput.js'

export type {
  StreamingOutputOptions,
  StreamingOutputState,
  StreamingOutputControls,
} from './hooks/useStreamingOutput.js'

export {
  useAIStreaming,
  useAIChat,
  useAICodeGen,
} from './hooks/useAIStreaming.js'

export type {
  AIStreamingOptions,
  AIStreamingState,
} from './hooks/useAIStreaming.js'

// AI 服务集成
export {
  StreamingAIService,
  getStreamingAIService,
  streamAI,
  askAIWithStreaming,
} from '../services/ai/StreamingAIService.js'

export type {
  StreamingAIRequest,
  StreamingAIResponse,
} from '../services/ai/StreamingAIService.js'

// 性能优化
export {
  PerformanceOptimizer,
  RenderFrequencyController,
  ContentIntegrityValidator,
  getPerformanceOptimizer,
} from './utils/performanceOptimizer.js'

export type {
  PerformanceMetrics,
  RenderControlOptions,
  ContentIntegrityOptions,
} from './utils/performanceOptimizer.js'

// AI 聊天组件
export {
  StreamingAIChat,
} from './components/ai/StreamingAIChat.js'

export type {
  StreamingAIChatProps,
} from './components/ai/StreamingAIChat.js'

// 演示和工具
// export {
//   runStreamingDemo,
//   runInteractiveDemo
// } from './demo/streamingDemo.js'

export {
  runFormatDemo,
} from './demo/formatDemo.js'

// 现有的格式化工具
export {
  getOutputFormatter,
  OutputFormatter,
} from './utils/outputFormatter.js'

export type {
  OutputFormatOptions,
  FormattedOutput,
} from './utils/outputFormatter.js'

// 主题管理
export {
  getThemeManager,
  getThemeColors,
  isDarkTheme,
  ThemeManager,
} from './theme/themeManager.js'

export type {
  ThemeName,
  ThemeColors,
  Theme,
} from './theme/themeManager.js'