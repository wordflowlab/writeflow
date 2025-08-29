import { describe, test, expect, beforeEach } from '@jest/globals'
import { WebSearchTool } from '@/tools/research/web-search.js'

describe('WebSearchTool', () => {
  let searchTool: WebSearchTool

  beforeEach(() => {
    searchTool = new WebSearchTool()
  })

  test('应该执行基本搜索', async () => {
    const result = await searchTool.execute({
      query: 'AI技术发展',
      maxResults: 5
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.results).toBeDefined()
    expect(result.metadata?.results.length).toBeLessThanOrEqual(5)
  })

  test('应该验证输入', async () => {
    const valid = await searchTool.validateInput({ query: 'valid query' })
    expect(valid).toBe(true)

    const invalid = await searchTool.validateInput({ query: '' })
    expect(invalid).toBe(false)
  })
})