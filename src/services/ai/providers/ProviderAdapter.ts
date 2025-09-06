export type InlineToolCall = {
  name: string
  args: any
}

export interface ProviderAdapter {
  // 清理模型在文本中内联暴露的工具标记或其它噪音
  sanitizeText(text: string): string

  // 从文本中提取内联工具调用（若不支持，返回空）
  extractInlineToolCalls(text: string): { cleaned: string; calls: InlineToolCall[] }

  // 解析 HTTP 响应为 JSON（按 provider 处理 SSE 等变体）
  parseJSONResponse(response: any): Promise<any>
}
