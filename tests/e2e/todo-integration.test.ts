import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const execAsync = promisify(exec)

/**
 * WriteFlow TodoList 端到端集成测试
 * 测试完整的用户工作流程
 */
describe('WriteFlow TodoList 端到端测试', () => {
  let testHomeDir: string
  let originalHomeDir: string

  beforeEach(async () => {
    // 创建临时测试环境
    testHomeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'writeflow-e2e-'))
    originalHomeDir = process.env.HOME || ''
    
    // 设置测试环境变量
    process.env.HOME = testHomeDir
    process.env.WRITEFLOW_HOME = path.join(testHomeDir, '.writeflow')
    process.env.WRITEFLOW_CONFIG_DIR = path.join(testHomeDir, '.writeflow')
  })

  afterEach(async () => {
    // 恢复原始环境
    process.env.HOME = originalHomeDir
    delete process.env.WRITEFLOW_HOME
    delete process.env.WRITEFLOW_CONFIG_DIR
    
    // 清理测试目录
    try {
      await fs.rm(testHomeDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('清理测试目录失败:', error)
    }
  })

  describe('TodoList 命令行接口测试', () => {
    test('应该能够添加和列出任务', async () => {
      // 添加任务
      const addResult = await execAsync('writeflow exec "/add-todo 编写单元测试"')
      expect(addResult.stdout).toContain('任务已添加')
      expect(addResult.stdout).toContain('编写单元测试')

      // 列出任务
      const listResult = await execAsync('writeflow exec "/list-todos"')
      expect(listResult.stdout).toContain('"type":"todo-list"')
    }, 10000)

    test('应该支持优先级设置', async () => {
      // 添加高优先级任务
      const result = await execAsync('writeflow exec "/add-todo 修复严重bug high"')
      expect(result.stdout).toContain('优先级: high')
      expect(result.stdout).toContain('修复严重bug')
    }, 10000)

    test('应该能够更新任务状态', async () => {
      // 添加任务
      const addResult = await execAsync('writeflow exec "/add-todo 测试任务更新"')
      expect(addResult.stdout).toContain('任务已添加')
      
      // 提取任务ID (简单的正则匹配)
      const idMatch = addResult.stdout.match(/ID: (todo-[a-z0-9\\-]+)/)
      expect(idMatch).toBeTruthy()
      
      if (idMatch) {
        const taskId = idMatch[1]
        
        // 更新任务状态
        const updateResult = await execAsync(`writeflow exec "/todo-status ${taskId} in_progress"`)
        expect(updateResult.stdout).toContain('任务状态已更新')
      }
    }, 15000)

    test('应该能够删除任务', async () => {
      // 添加任务
      const addResult = await execAsync('writeflow exec "/add-todo 待删除的任务"')
      const idMatch = addResult.stdout.match(/ID: (todo-[a-z0-9\\-]+)/)
      
      if (idMatch) {
        const taskId = idMatch[1]
        
        // 删除任务
        const removeResult = await execAsync(`writeflow exec "/todo-delete ${taskId}"`)
        expect(removeResult.stdout).toContain('任务已删除')
      }
    }, 15000)

    test('应该显示任务统计信息', async () => {
      // 添加多个不同状态的任务
      await execAsync('writeflow exec "/add-todo 待办任务1"')
      await execAsync('writeflow exec "/add-todo 待办任务2"')
      
      // 查看统计
      const statsResult = await execAsync('writeflow exec "/todo-progress"')
      expect(statsResult.stdout).toContain('任务统计报告')
    }, 15000)
  })

  describe('数据持久化测试', () => {
    test('应该在不同命令间保持数据', async () => {
      // 第一个命令：添加任务
      await execAsync('writeflow exec "/add-todo 持久化测试任务"')
      
      // 第二个命令：列出任务（新的进程）
      const listResult = await execAsync('writeflow exec "/list-todos"')
      
      // 应该能看到之前添加的任务
      expect(listResult.stdout).toContain('"todos"')
    }, 15000)

    test('应该创建正确的存储文件', async () => {
      // 添加任务
      await execAsync('writeflow exec "/add-todo 存储测试任务"', { 
        env: { 
          ...process.env, 
          WRITEFLOW_CONFIG_DIR: path.join(testHomeDir, '.writeflow') 
        } 
      })
      
      // 检查存储目录是否创建（使用默认路径，因为环境变量可能不会传递给全局命令）
      const defaultWriteflowDir = path.join(require('os').homedir(), '.writeflow', 'todos')
      const dirExists = await fs.access(defaultWriteflowDir).then(() => true).catch(() => false)
      expect(dirExists).toBe(true)
      
      // 检查是否有 JSON 文件
      if (dirExists) {
        const files = await fs.readdir(defaultWriteflowDir)
        const jsonFiles = files.filter(f => f.endsWith('.json'))
        expect(jsonFiles.length).toBeGreaterThan(0)
      }
    }, 10000)
  })

  describe('错误处理测试', () => {
    test('应该正确处理无效命令', async () => {
      try {
        const result = await execAsync('writeflow exec "/invalid-command"')
        // 如果命令成功执行，检查输出中是否包含错误信息
        expect(result.stdout).toContain('未知命令')
      } catch (error: any) {
        // 如果命令失败，检查错误输出
        expect(error.stdout || error.stderr || error.message).toContain('未知命令')
      }
    }, 10000)

    test('应该正确处理空参数', async () => {
      const result = await execAsync('writeflow exec "/add-todo"')
      expect(result.stdout).toContain('错误') // 应该有错误信息
    }, 10000)

    test('应该正确处理不存在的任务ID', async () => {
      const result = await execAsync('writeflow exec "/remove-todo nonexistent-id"')
      expect(result.stdout).toContain('未找到') // 应该提示未找到
    }, 10000)
  })

  describe('性能测试', () => {
    test('应该能够快速处理批量任务', async () => {
      const startTime = Date.now()
      
      // 添加 10 个任务
      const promises = []
      for (let i = 1; i <= 10; i++) {
        promises.push(execAsync(`writeflow exec "/add-todo 批量任务${i}"`))
      }
      
      await Promise.all(promises)
      
      const duration = Date.now() - startTime
      console.log(`批量添加 10 个任务耗时: ${duration}ms`)
      
      // 每个任务平均处理时间应该在合理范围内（< 2秒）
      expect(duration / 10).toBeLessThan(2000)
    }, 30000)

    test('应该能够快速查询任务列表', async () => {
      // 先添加一些任务
      await execAsync('writeflow exec "/add-todo 性能测试任务1"')
      await execAsync('writeflow exec "/add-todo 性能测试任务2"')
      
      const startTime = Date.now()
      await execAsync('writeflow exec "/list-todos"')
      const duration = Date.now() - startTime
      
      console.log(`查询任务列表耗时: ${duration}ms`)
      
      // 查询应该很快（< 1秒）
      expect(duration).toBeLessThan(1000)
    }, 10000)
  })
})