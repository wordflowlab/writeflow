import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import path from 'path'
import { ContentRewriterTool } from '@/tools/writing/content-rewriter.js'
import { AIWritingConfig } from '@/types/writing.js'

describe('ContentRewriterTool', () => {
  let rewriterTool: ContentRewriterTool
  let config: AIWritingConfig
  let testFile: string
  let testDir: string

  beforeEach(async () => {
    config = {
      anthropicApiKey: 'test-key',
      model: 'claude-3-sonnet-20240229', 
      temperature: 0.7,
      maxTokens: 4000
    }
    
    rewriterTool = new ContentRewriterTool(config)
    testDir = path.join('/tmp', `rewriter-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    testFile = path.join(testDir, 'test-content.md')
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true })
    } catch {}
  })

  test('应该能改写直接提供的内容', async () => {
    const originalContent = '这是一个技术方案的介绍。我们做了很多好的优化。'
    
    const result = await rewriterTool.execute({
      content: originalContent,
      style: 'technical'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).not.toBe(originalContent)
    expect(result.content).toContain('解决方案') // 应该有技术风格的词汇
    expect(result.metadata?.originalLength).toBe(originalContent.length)
  })

  test('应该能改写文件内容', async () => {
    const fileContent = '这是一个很好的产品，可以帮助用户解决问题。'
    await fs.writeFile(testFile, fileContent, 'utf8')
    
    const result = await rewriterTool.execute({
      filePath: testFile,
      style: 'marketing'
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('卓越的') // 营销风格词汇
    expect(result.content).toContain('助您') // 营销风格表达
  })

  test('应该支持不同的改写风格', async () => {
    const content = '这个方法很好，可以解决很多问题。'
    
    // 测试学术风格
    const academicResult = await rewriterTool.execute({
      content,
      style: 'academic'
    })
    expect(academicResult.success).toBe(true)
    expect(academicResult.content).toContain('研究表明')

    // 测试通俗风格
    const popularResult = await rewriterTool.execute({
      content: '因此我们需要实现更好的解决方案。',
      style: 'popular'
    })
    expect(popularResult.success).toBe(true)
    expect(popularResult.content).toContain('所以')
  })

  test('应该保持内容长度（如果要求）', async () => {
    const content = '这是一段测试内容，用来验证长度保持功能。'
    const originalLength = content.length
    
    const result = await rewriterTool.execute({
      content,
      style: 'formal',
      preserveLength: true
    })
    
    expect(result.success).toBe(true)
    
    const newLength = result.content?.length || 0
    const lengthDiff = Math.abs(newLength - originalLength)
    
    // 允许一定的长度差异（10%以内）
    expect(lengthDiff / originalLength).toBeLessThan(0.1)
  })

  test('应该处理空内容', async () => {
    const result = await rewriterTool.execute({
      content: '',
      style: 'technical'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('内容为空')
  })

  test('应该验证必需参数', async () => {
    // 缺少内容和文件路径
    const result1 = await rewriterTool.execute({
      style: 'technical'
    })
    expect(result1.success).toBe(false)
    expect(result1.error).toContain('必须提供内容或文件路径')

    // 缺少风格
    const result2 = await rewriterTool.execute({
      content: '测试内容'
    })
    expect(result2.success).toBe(false)
    expect(result2.error).toContain('缺少改写风格参数')
  })

  test('应该处理文件读取失败', async () => {
    const result = await rewriterTool.execute({
      filePath: '/tmp/nonexistent-file.md',
      style: 'technical'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('读取文件失败')
  })

  test('应该提供改写元数据', async () => {
    const originalContent = '这是原始内容，需要进行改写处理。'
    
    const result = await rewriterTool.execute({
      content: originalContent,
      style: 'formal',
      tone: 'authoritative'
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata).toBeDefined()
    expect(result.metadata?.originalLength).toBe(originalContent.length)
    expect(result.metadata?.style).toBe('formal')
    expect(result.metadata?.rewriteOptions.tone).toBe('authoritative')
    expect(result.metadata?.rewrittenAt).toBeDefined()
  })

  test('应该正确验证输入', async () => {
    // 有效输入 - 直接内容
    const valid1 = await rewriterTool.validateInput({
      content: '有效内容',
      style: 'technical'
    })
    expect(valid1).toBe(true)

    // 有效输入 - 文件路径
    const valid2 = await rewriterTool.validateInput({
      filePath: '/tmp/test.md',
      style: 'popular'
    })
    expect(valid2).toBe(true)

    // 无效输入 - 缺少内容
    const invalid1 = await rewriterTool.validateInput({
      style: 'technical'
    })
    expect(invalid1).toBe(false)

    // 无效输入 - 缺少风格
    const invalid2 = await rewriterTool.validateInput({
      content: '内容'
    })
    expect(invalid2).toBe(false)

    // 无效输入 - 无效风格
    const invalid3 = await rewriterTool.validateInput({
      content: '内容',
      style: 'invalid_style'
    })
    expect(invalid3).toBe(false)
  })
})