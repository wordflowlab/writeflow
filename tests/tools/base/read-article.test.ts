import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import path from 'path'
import { ReadArticleTool } from '@/tools/base/read-article.js'

describe('ReadArticleTool', () => {
  let readTool: ReadArticleTool
  let testFile: string
  let testContent: string

  beforeEach(async () => {
    readTool = new ReadArticleTool()
    
    // 创建测试文件
    testFile = path.join('/tmp', `test-${Date.now()}.md`)
    testContent = `# 测试文章

这是一个测试文章内容。

## 第一章
内容1

## 第二章  
内容2`

    await fs.writeFile(testFile, testContent, 'utf8')
  })

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testFile)
    } catch {}
  })

  test('应该成功读取文件', async () => {
    const result = await readTool.execute({ file_path: testFile })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('测试文章')
    expect(result.content).toContain('1→# 测试文章')
    expect(result.metadata).toBeDefined()
    expect(result.metadata?.format).toBe('markdown')
  })

  test('应该支持行号偏移和限制', async () => {
    const result = await readTool.execute({ 
      file_path: testFile,
      offset: 2,
      limit: 3
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('3→')
    expect(result.content).toContain('5→')
    expect(result.content).not.toContain('6→')
  })

  test('应该检测文件格式', async () => {
    const htmlFile = path.join('/tmp', `test-${Date.now()}.html`)
    const htmlContent = '<html><body>Test</body></html>'
    await fs.writeFile(htmlFile, htmlContent, 'utf8')

    const result = await readTool.execute({ file_path: htmlFile })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.format).toBe('html')
    
    await fs.unlink(htmlFile)
  })

  test('应该生成正确的元数据', async () => {
    const result = await readTool.execute({ file_path: testFile })
    
    expect(result.metadata).toMatchObject({
      path: testFile,
      format: 'markdown',
      encoding: 'utf8'
    })
    expect(result.metadata?.wordCount).toBeGreaterThan(0)
    expect(result.metadata?.lineCount).toBeGreaterThan(0)
    expect(result.metadata?.checksum).toBeDefined()
  })

  test('应该检测恶意内容', async () => {
    const maliciousFile = path.join('/tmp', `malicious-${Date.now()}.js`)
    const maliciousContent = 'eval(process.env.SECRET_KEY)'
    await fs.writeFile(maliciousFile, maliciousContent, 'utf8')

    const result = await readTool.execute({ 
      file_path: maliciousFile,
      detectMalicious: true 
    })
    
    expect(result.success).toBe(true)
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.length).toBeGreaterThan(0)
    expect(result.warnings![0]).toContain('恶意内容')
    
    await fs.unlink(maliciousFile)
  })

  test('应该拒绝访问受限路径', async () => {
    const result = await readTool.execute({ file_path: '/etc/passwd' })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('受限目录')
  })

  test('应该处理不存在的文件', async () => {
    const result = await readTool.execute({ 
      file_path: '/tmp/nonexistent-file.txt' 
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('文件不存在')
  })

  test('应该检测路径遍历攻击', async () => {
    const result = await readTool.execute({ 
      file_path: '../../../etc/passwd' 
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('路径遍历')
  })

  test('应该获取文件统计信息', async () => {
    const stats = await readTool.getFileStats(testFile)
    
    expect(stats).toBeDefined()
    expect(stats?.path).toBe(testFile)
    expect(stats?.format).toBe('markdown')
  })
})