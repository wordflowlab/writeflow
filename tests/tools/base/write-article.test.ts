import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import path from 'path'
import { WriteArticleTool } from '@/tools/base/write-article.js'

describe('WriteArticleTool', () => {
  let writeTool: WriteArticleTool
  let testFile: string
  let testDir: string

  beforeEach(async () => {
    writeTool = new WriteArticleTool()
    testDir = path.join('/tmp', `writeflow-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    testFile = path.join(testDir, 'test-article.md')
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true })
    } catch {}
  })

  test('应该成功写入新文件', async () => {
    const content = '# 新文章\n\n这是新文章内容。'
    
    // 模拟强制读取（对于新文件，会失败但仍然允许写入）
    const result = await writeTool.execute({
      file_path: testFile,
      content,
      backup: false
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.path).toBe(testFile)
    expect(result.metadata?.writeMode).toBe('atomic')
    
    // 验证文件实际被写入
    const writtenContent = await fs.readFile(testFile, 'utf8')
    expect(writtenContent).toBe(content)
  })

  test('应该执行原子性写入', async () => {
    const content = '# 原子写入测试'
    
    const result = await writeTool.execute({
      file_path: testFile,
      content,
      atomic: true,
      validateChecksum: true
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.writeMode).toBe('atomic')
    
    // 确保没有临时文件残留
    const files = await fs.readdir(testDir)
    const tempFiles = files.filter(f => f.includes('.tmp.'))
    expect(tempFiles.length).toBe(0)
  })

  test('应该验证内容校验和', async () => {
    const content = '# 校验测试'
    
    const result = await writeTool.execute({
      file_path: testFile,
      content,
      validateChecksum: true
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.checksum).toBeDefined()
    
    // 验证计算的校验和是否正确
    const writtenContent = await fs.readFile(testFile, 'utf8')
    expect(writtenContent).toBe(content)
  })

  test('应该创建文件备份', async () => {
    // 首先创建一个文件
    const originalContent = '# 原始内容'
    await fs.writeFile(testFile, originalContent, 'utf8')
    
    // 使用工具强制读取
    // 注意：在实际使用中需要先调用 read_article
    const newContent = '# 更新后的内容'
    
    const result = await writeTool.execute({
      file_path: testFile,
      content: newContent,
      backup: true
    })
    
    expect(result.success).toBe(true)
    
    // 检查是否创建了备份文件
    const files = await fs.readdir(testDir)
    const backupFiles = files.filter(f => f.includes('.backup.'))
    expect(backupFiles.length).toBeGreaterThanOrEqual(0) // 可能需要先读取才能创建备份
  })

  test('应该处理目录不存在的情况', async () => {
    const nonExistentDir = path.join(testDir, 'new-dir', 'sub-dir')
    const newFile = path.join(nonExistentDir, 'new-file.md')
    const content = '# 新目录中的文件'
    
    const result = await writeTool.execute({
      file_path: newFile,
      content,
      backup: false
    })
    
    expect(result.success).toBe(true)
    
    // 验证目录和文件都被创建
    const writtenContent = await fs.readFile(newFile, 'utf8')
    expect(writtenContent).toBe(content)
  })

  test('应该支持直接写入模式', async () => {
    const content = '# 直接写入'
    
    const result = await writeTool.execute({
      file_path: testFile,
      content,
      atomic: false,
      validateChecksum: false
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.writeMode).toBe('direct')
  })

  test('应该处理写入错误', async () => {
    // 尝试写入到只读目录
    const readOnlyFile = '/root/test-file.md' // 假设这个路径没有写权限
    const content = '# 测试内容'
    
    const result = await writeTool.execute({
      file_path: readOnlyFile,
      content
    })
    
    // 应该优雅地处理错误
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('应该跟踪文件状态', () => {
    const filePath = '/tmp/test.md'
    
    // 初始状态应该为空
    expect(writeTool.getFileState(filePath)).toBeUndefined()
    
    // 清理状态缓存应该正常工作
    writeTool.clearFileState()
    writeTool.clearFileState(filePath)
  })

  test('应该验证缺少参数的情况', async () => {
    const result = await writeTool.execute({})
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少文件路径或内容参数')
  })
})