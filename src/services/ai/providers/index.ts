import type { ProviderAdapter } from './ProviderAdapter.js'
import { OpenAIAdapter } from './OpenAIAdapter.js'

class DefaultAdapter implements ProviderAdapter {
  sanitizeText(text: string): string { return text || '' }
  extractInlineToolCalls(text: string) { return { cleaned: text || '', calls: [] as any[] } }
  async parseJSONResponse(response: any): Promise<any> {
    try {
      if (response && typeof response === 'object') {
        if (typeof (response as any).json === 'function') {
          return await (response as any).json()
        }
        if ('data' in response && typeof (response as any).data === 'string') {
          try {
            return JSON.parse((response as any).data)
          } catch {
            return { raw: (response as any).data }
          }
        }
      }
      if (typeof response === 'string') {
        try {
          return JSON.parse(response)
        } catch {
          return { raw: response }
        }
      }
      return response ?? null
    } catch (e) {
      return { error: String(e), raw: response ?? null }
    }
  }
}

export function getProviderAdapter(provider: string | undefined): ProviderAdapter {
  switch ((provider || '').toLowerCase()) {
    case 'openai':
    case 'oai':
      return new OpenAIAdapter()
    default:
      return new DefaultAdapter()
  }
}
