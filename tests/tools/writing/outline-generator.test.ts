import { describe, test, expect, beforeEach } from '@jest/globals'
import { OutlineGeneratorTool } from '@/tools/writing/outline-generator.js'
import { AIWritingConfig } from '@/types/writing.js'

describe('OutlineGeneratorTool', () => {
  let outlineTool: OutlineGeneratorTool
  let config: AIWritingConfig

  beforeEach(() => {
    config = {
      anthropicApiKey: 'test-key',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: 4000
    }
    
    outlineTool = new OutlineGeneratorTool(config)
  })

  test('应该成功生成文章大纲', async () => {
    const result = await outlineTool.execute({
      topic: 'AI代理技术发展',
      style: '技术性',
      targetLength: 3000,
      audience: '技术人员'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('AI代理技术发展')
    expect(result.metadata?.outline).toBeDefined()
    expect(result.metadata?.outline.sections).toHaveLength(4)
  })

  test('应该支持不同的写作风格', async () => {
    const styles = ['技术性', '学术', '通俗', '营销']
    
    for (const style of styles) {
      const result = await outlineTool.execute({
        topic: '人工智能应用',
        style,
        targetLength: 2000
      })
      
      expect(result.success).toBe(true)
      expect(result.metadata?.style).toBe(style)
    }
  })

  test('应该包含完整的大纲结构', async () => {
    const result = await outlineTool.execute({
      topic: '区块链技术',
      targetLength: 2500
    })
    
    expect(result.success).toBe(true)
    
    const outline = result.metadata?.outline
    expect(outline).toBeDefined()
    expect(outline.title).toBeTruthy()
    expect(outline.alternativeTitles).toHaveLength(3)
    expect(outline.introduction).toBeDefined()
    expect(outline.sections.length).toBeGreaterThanOrEqual(3)
    expect(outline.conclusion).toBeDefined()
    expect(outline.writingTips.length).toBeGreaterThan(0)
  })

  test('应该验证必需参数', async () => {
    const result = await outlineTool.execute({})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少主题参数')
  })

  test('应该计算合理的字数分配', async () => {
    const result = await outlineTool.execute({
      topic: '云计算技术',
      targetLength: 4000
    })
    
    expect(result.success).toBe(true)
    
    const outline = result.metadata?.outline
    const totalSectionWords = outline.sections.reduce(
      (sum, section) => sum + section.wordCount, 
      0
    )
    
    // 总字数应该接近目标字数（允许一定误差）
    expect(totalSectionWords).toBeGreaterThan(1500)
    expect(totalSectionWords).toBeLessThan(5000)
  })

  test('应该提供实用的写作建议', async () => {
    const result = await outlineTool.execute({
      topic: '机器学习算法',
      style: '技术性',
      audience: '初学者'
    })
    
    expect(result.success).toBe(true)
    
    const outline = result.metadata?.outline
    expect(outline.writingTips).toBeDefined()
    expect(outline.writingTips.length).toBeGreaterThan(3)
    
    // 检查建议是否具体和实用
    const hasConcreteTips = outline.writingTips.some(tip => 
      tip.includes('例子') || 
      tip.includes('数据') || 
      tip.includes('图表') ||
      tip.includes('案例')
    )
    expect(hasConcreteTips).toBe(true)
  })

  test('应该正确验证输入参数', async () => {
    // 有效输入
    const validResult = await outlineTool.validateInput({
      topic: '有效主题'
    })
    expect(validResult).toBe(true)

    // 无效输入 - 缺少主题
    const invalidResult1 = await outlineTool.validateInput({})
    expect(invalidResult1).toBe(false)

    // 无效输入 - 空主题
    const invalidResult2 = await outlineTool.validateInput({
      topic: ''
    })
    expect(invalidResult2).toBe(false)

    // 无效输入 - 只有空格的主题
    const invalidResult3 = await outlineTool.validateInput({
      topic: '   '
    })
    expect(invalidResult3).toBe(false)
  })

  test('应该支持自定义参数', async () => {
    const result = await outlineTool.execute({
      topic: '数据科学实践',
      style: '学术',
      targetLength: 5000,
      audience: '研究人员',
      language: '英文'
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.targetLength).toBe(5000)
    expect(result.metadata?.audience).toBe('研究人员')
  })
})