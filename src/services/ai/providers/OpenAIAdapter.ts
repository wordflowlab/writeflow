import type { ProviderAdapter, InlineToolCall } from './ProviderAdapter.js'

// OpenAI 家族（兼容模式）通常不会在纯文本中内联暴露工具调用标记
// 因此这里的适配器基本为 no-op，占位以保持结构一致
export class OpenAIAdapter implements ProviderAdapter {
  sanitizeText(text: string): string {
    return text || ''
  }

  extractInlineToolCalls(text: string): { cleaned: string; calls: InlineToolCall[] } {
    return { cleaned: text || '', calls: [] }
  }

  async parseJSONResponse(response: any): Promise<any> {
    return response.json()
  }
}
