# WriteFlow 流式适配器系统

为 WriteFlow 提供统一的多厂商 AI 模型流式响应处理能力。

## 🎯 核心功能

- **多厂商支持**: OpenAI、Anthropic Claude、DeepSeek、Google Gemini、智谱 AI (GLM)、Kimi/Moonshot、Qwen/通义千问
- **协议无关**: 统一接口隐藏各厂商 SSE 协议差异
- **自动检测**: 根据模型名称或响应格式自动选择适配器
- **高性能**: 支持增量解析和缓冲解析两种策略
- **企业级特性**: 错误处理、重试机制、配置管理、状态监控
- **完整类型**: TypeScript 完整类型定义

## 🚀 快速开始

### 基础使用

```typescript
import { getStreamingService } from './index.js'

// 获取流式服务
const streamingService = getStreamingService()

// 监听流式数据块
streamingService.on('chunk', (response) => {
  console.log(response.content)        // 文本内容
  console.log(response.reasoning)      // 推理内容（如 DeepSeek）
  console.log(response.usage)          // Token 使用统计
  console.log(response.done)           // 是否完成
})

// 监听完成事件
streamingService.on('complete', (response) => {
  console.log('✅ 流式完成!')
  console.log(`📊 使用统计: ${response.usage?.inputTokens}→${response.usage?.outputTokens} tokens`)
  console.log(`💰 成本: $${response.cost?.toFixed(6)}`)
})

// 开始流式请求
await streamingService.startStream({
  prompt: "请简洁地解释什么是 TypeScript。",
  model: 'claude-3-sonnet',
  maxTokens: 200,
  temperature: 0.7
})
```

### 兼容性使用

```typescript
import { getWriteFlowAIService } from '../ai/WriteFlowAIService.js'

const aiService = getWriteFlowAIService()

// 现有代码，只需添加 stream: true
const response = await aiService.processRequest({
  prompt: "写一段关于 AI 的介绍",
  stream: true,  // 启用流式
  model: 'deepseek-chat',
  maxTokens: 150
})

console.log(response.content)
```

### 便捷函数

```typescript
import { askAIStreamComplete } from './index.js'

// 等待完整响应的流式请求
const response = await askAIStreamComplete("什么是微服务架构？", {
  model: 'deepseek-reasoner',
  maxTokens: 150,
  temperature: 0.3
})

console.log(response.content)
console.log(`Token 使用: ${response.usage.inputTokens}→${response.usage.outputTokens}`)
```

## 📚 支持的模型

### OpenAI 模型
```typescript
const openai = getStreamingService()
await openai.startStream({ 
  prompt: "任务", 
  model: 'gpt-4o' 
})
```

### Anthropic Claude 模型  
```typescript
const claude = getStreamingService()
await claude.startStream({ 
  prompt: "任务", 
  model: 'claude-3-sonnet' 
})
```

### DeepSeek 模型（支持推理内容）
```typescript
const deepseek = getStreamingService()
deepseek.on('chunk', (response) => {
  if (response.reasoning) {
    console.log('💭 推理:', response.reasoning)
  }
  console.log('📝 回答:', response.content)
})

await deepseek.startStream({ 
  prompt: "任务", 
  model: 'deepseek-reasoner' 
})
```

### Google Gemini 模型
```typescript
const gemini = getStreamingService()
await gemini.startStream({ 
  prompt: "任务", 
  model: 'gemini-pro' 
})
```

### 智谱 AI (GLM) 模型
```typescript
const zhipu = getStreamingService()
await zhipu.startStream({ 
  prompt: "任务", 
  model: 'glm-4.5' 
})
```

### Kimi/Moonshot 模型（长文本）
```typescript
const kimi = getStreamingService()
await kimi.startStream({ 
  prompt: "任务", 
  model: 'moonshot-v1-128k'  // 支持 128k 上下文
})
```

### Qwen/通义千问 模型
```typescript
const qwen = getStreamingService()
await qwen.startStream({ 
  prompt: "任务", 
  model: 'qwen-turbo' 
})
```

## 🔧 高级配置

### 错误处理和重试

```typescript
import { getStreamingService } from './index.js'

const streamingService = getStreamingService({
  maxRetries: 5,           // 最大重试次数
  retryDelay: 2000,        // 重试延时（指数退避）
  timeout: 120000,         // 超时时间（2分钟）
  bufferSize: 16384,       // 缓冲区大小
  enableReconnect: true    // 启用自动重连
})

streamingService.on('error', (error) => {
  console.error('流式错误:', error.message)
  
  // 检查是否会自动重试
  const status = streamingService.getStreamingStatus()
  if (status.retryCount < 5) {
    console.log(`将进行第 ${status.retryCount + 1} 次重试`)
  }
})
```

### 状态监控

```typescript
// 监控流式状态
const status = streamingService.getStreamingStatus()
console.log('是否正在流式:', status.isStreaming)
console.log('重试次数:', status.retryCount)
console.log('配置参数:', status.config)

// 动态更新配置
streamingService.updateConfig({
  timeout: 180000,  // 增加超时时间到3分钟
  maxRetries: 10    // 增加最大重试次数
})
```

### 性能优化

```typescript
// 大文本场景使用更大缓冲区
const service = getStreamingService({
  bufferSize: 32768,        // 32KB 缓冲区
  parseStrategy: 'buffered' // 缓冲解析策略
})

// 实时场景使用增量解析
const realtimeService = getStreamingService({
  bufferSize: 4096,           // 4KB 缓冲区
  parseStrategy: 'incremental' // 增量解析策略
})
```

## 📈 协议格式

### OpenAI 格式
```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]
```

### Anthropic Claude 格式
```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}
```

### DeepSeek 格式（扩展 OpenAI）
```
data: {"choices":[{"delta":{"reasoning_content":"Let me think..."}}]}
data: {"choices":[{"delta":{"content":"Hello World"}}]}
data: [DONE]
```

### Gemini 格式
```json
{"candidates":[{"content":{"parts":[{"text":"Hello World"}]},"finishReason":"STOP"}]}
```

## 🧪 测试和示例

```bash
# 运行功能测试
npx tsx src/services/streaming/test.ts

# 运行使用示例
npx tsx src/services/streaming/examples.ts
```

## 📁 文件结构

```
src/services/streaming/
├── StreamAdapter.ts          # 基础适配器接口
├── OpenAIStreamAdapter.ts    # OpenAI 协议适配器
├── ClaudeStreamAdapter.ts    # Anthropic 协议适配器
├── DeepSeekStreamAdapter.ts  # DeepSeek 协议适配器
├── GeminiStreamAdapter.ts    # Gemini 协议适配器
├── ZhipuStreamAdapter.ts     # 智谱 AI 协议适配器
├── UniversalOpenAIAdapter.ts # 通用 OpenAI 兼容适配器
├── StreamAdapterFactory.ts   # 工厂模式和自动检测
├── StreamingService.ts       # 统一流式服务
├── StreamingAIService.ts     # 兼容性服务封装
├── examples.ts               # 使用示例
├── test.ts                   # 功能测试
└── index.ts                  # 模块导出
```

## ✅ 特性矩阵

| 厂商 | 基础流式 | 推理内容 | 缓存统计 | 工具调用 | 视觉输入 | 长文本 |
|------|----------|----------|----------|----------|----------|--------|
| OpenAI | ✅ | ❌ | ❌ | 🔄 计划中 | 🔄 计划中 | ❌ |
| Anthropic | ✅ | ❌ | ✅ | 🔄 计划中 | 🔄 计划中 | ✅ |
| DeepSeek | ✅ | ✅ | ✅ | 🔄 计划中 | ❌ | ❌ |
| Gemini | ✅ | ❌ | ❌ | 🔄 计划中 | 🔄 计划中 | ❌ |
| 智谱 AI (GLM) | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Kimi/Moonshot | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Qwen/通义千问 | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |

## 🔄 扩展新厂商

要添加新的厂商支持：

1. 继承 `StreamAdapter` 基类
2. 实现 `parseStream()` 和 `isStreamEnd()` 方法
3. 在 `StreamAdapterFactory` 中添加检测逻辑
4. 更新 `modelCapabilities.ts` 添加模型配置

```typescript
export class NewProviderStreamAdapter extends StreamAdapter {
  parseStream(data: string): StreamChunk[] {
    // 实现协议解析逻辑
  }
  
  isStreamEnd(data: string): boolean {
    // 实现结束检测逻辑
  }
}
```

## 📄 许可证

本项目使用与 WriteFlow 相同的许可证。