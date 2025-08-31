import { describe, test, expect, beforeEach } from '@jest/globals'
import { WU2ContextCompressor } from '@/core/context/wU2-compressor.js'
import { ArticleContext } from '@/types/agent.js'
import { ResearchItem } from '@/types/context.js'

describe('WU2ContextCompressor', () => {
  let compressor: WU2ContextCompressor
  
  beforeEach(() => {
    compressor = new WU2ContextCompressor()
  })

  test('应该正确计算是否需要压缩', () => {
    const smallContext: ArticleContext = {
      currentArticle: '短文章内容',
      researchMaterial: [],
      dialogueHistory: []
    }
    
    expect(compressor.shouldCompress(smallContext)).toBe(false)
    
    // 创建大上下文（超过92%阈值，需要超过117760 tokens）
    const largeContext: ArticleContext = {
      currentArticle: '中文测试内容'.repeat(30000), // 约120000 tokens
      researchMaterial: Array(50).fill(0).map(() => ({
        content: '研究材料内容'.repeat(1000) // 每个约5000 tokens
      })),
      dialogueHistory: []
    }
    
    expect(compressor.shouldCompress(largeContext)).toBe(true)
  })

  test('应该正确压缩研究材料', async () => {
    const researchItems: ResearchItem[] = Array(100).fill(0).map((_, i) => ({
      id: `item-${i}`,
      content: `研究内容详细描述 ${i} ` + '这是非常长的研究内容，包含大量的文字描述和分析'.repeat(200), // 更长的内容
      source: 'web',
      createdAt: Date.now() - i * 24 * 60 * 60 * 1000, // 按天递减
      referenceCount: Math.random() * 10,
      relevanceScore: Math.random(),
      keywords: [`keyword${i}`]
    }))

    const context: ArticleContext = {
      currentArticle: '主文章内容' + '大量文本内容'.repeat(20000), // 确保总量够大
      researchMaterial: researchItems,
      dialogueHistory: []
    }

    const { compressed, result } = await compressor.compress(context)
    
    expect(result.compressionRatio).toBeGreaterThan(0)
    expect(compressed.researchMaterial!.length).toBeLessThan(researchItems.length)
    expect(result.itemsRemoved).toBeGreaterThan(0)
  })

  test('应该保留核心上下文信息', async () => {
    const context: ArticleContext = {
      currentArticle: '重要文章内容',
      activeOutline: { title: '重要大纲' },
      writingGoals: ['目标1', '目标2'],
      userPreferences: { style: 'technical' },
      researchMaterial: Array(100).fill(0).map(() => ({
        content: 'x'.repeat(1000)
      }))
    }

    const { compressed } = await compressor.compress(context)
    
    // 核心内容应该保持不变
    expect(compressed.currentArticle).toBe(context.currentArticle)
    expect(compressed.activeOutline).toEqual(context.activeOutline)
    expect(compressed.writingGoals).toEqual(context.writingGoals)
    expect(compressed.userPreferences).toEqual(context.userPreferences)
  })

  test('应该记录压缩统计', async () => {
    const context: ArticleContext = {
      currentArticle: '主文章内容' + '大量文本内容以确保触发压缩'.repeat(25000), // 足够大的内容
      researchMaterial: Array(100).fill(0).map(() => ({
        content: '详细研究内容'.repeat(1000)
      }))
    }

    await compressor.compress(context)
    await compressor.compress(context)
    
    const stats = compressor.getCompressionStats()
    expect(stats.totalCompressions).toBe(2)
    expect(stats.averageRatio).toBeGreaterThan(0)
    expect(stats.averageTime).toBeGreaterThan(0)
  })

  test('应该正确获取上下文指标', () => {
    const context: ArticleContext = {
      currentArticle: '测试文章内容',
      researchMaterial: [{ content: '研究内容' }]
    }

    const metrics = compressor.getContextMetrics(context)
    
    expect(metrics.currentTokens).toBeGreaterThan(0)
    expect(metrics.maxTokens).toBe(128000)
    expect(metrics.utilizationRatio).toBeGreaterThanOrEqual(0)
    expect(metrics.utilizationRatio).toBeLessThanOrEqual(1)
  })

  test('小上下文不应该被压缩', async () => {
    const context: ArticleContext = {
      currentArticle: '短文章',
      researchMaterial: []
    }

    const { compressed, result } = await compressor.compress(context)
    
    expect(result.compressionRatio).toBe(0)
    expect(result.itemsRemoved).toBe(0)
    expect(compressed).toEqual(context)
  })
})