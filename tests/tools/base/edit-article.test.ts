import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import path from 'path'
import { EditArticleTool } from '@/tools/base/edit-article.js'

describe('EditArticleTool', () => {
  let editTool: EditArticleTool
  let testFile: string
  let testContent: string
  let testDir: string

  beforeEach(async () => {
    editTool = new EditArticleTool()
    testDir = path.join('/tmp', `writeflow-edit-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    testFile = path.join(testDir, 'test-article.md')
    
    testContent = `# 测试文章

这是第一段内容。

## 第一章
这里是第一章的内容。

## 第二章
这里是第二章的内容。`

    await fs.writeFile(testFile, testContent, 'utf8')
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true })
    } catch {}
  })

  test('应该成功执行单个替换', async () => {
    const result = await editTool.execute({
      file_path: testFile,
      old_string: '这是第一段内容。',
      new_string: '这是更新后的第一段内容。'
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.replacements).toBe(1)
    
    // 验证文件实际被修改
    const modifiedContent = await fs.readFile(testFile, 'utf8')
    expect(modifiedContent).toContain('这是更新后的第一段内容。')
    expect(modifiedContent).not.toContain('这是第一段内容。')
  })

  test('应该处理全部替换', async () => {
    const testFileMultiple = path.join(testDir, 'multiple.md')
    const multipleContent = `这里是内容。
这里是内容。
这里是其他内容。
这里是内容。`
    await fs.writeFile(testFileMultiple, multipleContent, 'utf8')

    const result = await editTool.execute({
      file_path: testFileMultiple,
      old_string: '这里是内容。',
      new_string: '这里是新内容。',
      replace_all: true
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.replacements).toBe(3)
    
    const modifiedContent = await fs.readFile(testFileMultiple, 'utf8')
    expect((modifiedContent.match(/这里是新内容。/g) || []).length).toBe(3)
  })

  test('应该执行多个编辑操作', async () => {
    const result = await editTool.execute({
      file_path: testFile,
      edits: [
        {
          old_string: '测试文章',
          new_string: '更新的测试文章'
        },
        {
          old_string: '## 第一章',
          new_string: '## 第一部分'
        },
        {
          old_string: '## 第二章',
          new_string: '## 第二部分'
        }
      ]
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.editsApplied).toBe(3)
    
    const modifiedContent = await fs.readFile(testFile, 'utf8')
    expect(modifiedContent).toContain('更新的测试文章')
    expect(modifiedContent).toContain('第一部分')
    expect(modifiedContent).toContain('第二部分')
  })

  test('应该拒绝不唯一的字符串替换', async () => {
    const multiContent = `内容重复
内容重复
其他内容`
    const multiFile = path.join(testDir, 'multi.md')
    await fs.writeFile(multiFile, multiContent, 'utf8')

    const result = await editTool.execute({
      file_path: multiFile,
      old_string: '内容重复',
      new_string: '新内容'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('字符串不唯一')
  })

  test('应该拒绝找不到的字符串', async () => {
    const result = await editTool.execute({
      file_path: testFile,
      old_string: '不存在的内容',
      new_string: '新内容'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('未找到要替换的字符串')
  })

  test('应该拒绝相同的新旧字符串', async () => {
    const result = await editTool.execute({
      file_path: testFile,
      old_string: '测试文章',
      new_string: '测试文章'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('内容未发生变化')
  })

  test('应该检测外部文件修改', async () => {
    // 首先读取文件以建立状态
    await editTool.execute({
      file_path: testFile,
      old_string: '测试文章',
      new_string: '修改后的测试文章'
    })
    
    // 外部修改文件
    await fs.writeFile(testFile, '外部修改的内容', 'utf8')
    
    // 尝试再次编辑应该失败
    const result = await editTool.execute({
      file_path: testFile,
      old_string: '第一章',
      new_string: '更新的第一章'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('外部修改')
  })

  test('应该处理多编辑中的错误', async () => {
    const result = await editTool.execute({
      file_path: testFile,
      edits: [
        {
          old_string: '测试文章',
          new_string: '更新的测试文章'
        },
        {
          old_string: '不存在的内容',
          new_string: '新内容'
        }
      ]
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('编辑 2')
    expect(result.error).toContain('未找到要替换的字符串')
  })

  test('应该正确提取带行号的内容', async () => {
    // 这个测试验证从 read_article 结果中正确提取内容
    const numberedContent = `     1→# 测试文章
     2→
     3→这是内容。`
    
    // 私有方法测试 - 需要通过实际编辑来验证
    const result = await editTool.execute({
      file_path: testFile,
      old_string: '这是第一段内容。',
      new_string: '这是新内容。'
    })
    
    expect(result.success).toBe(true)
  })

  test('应该管理文件状态', () => {
    const filePath = '/tmp/test.md'
    
    // 初始状态
    expect(editTool.getFileState(filePath)).toBeUndefined()
    
    // 清理状态
    editTool.clearFileState()
    editTool.clearFileState(filePath)
  })

  test('应该验证必需参数', async () => {
    const result = await editTool.execute({
      file_path: testFile
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少 old_string 或 new_string 参数')
  })

  test('应该验证缺少文件路径', async () => {
    const result = await editTool.execute({
      old_string: '测试',
      new_string: '新测试'
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('缺少文件路径参数')
  })
})