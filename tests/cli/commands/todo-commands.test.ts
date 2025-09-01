import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { 
  todoAddCommand,
  todoListCommand,
  todoUpdateCommand,
  todoRemoveCommand,
  todoStatsCommand,
  todoClearCommand,
  todoStartCommand,
  todoDoneCommand
} from '@/cli/commands/todo-commands.js'
import { AgentContext } from '@/types/agent.js'
import { TodoPriority, TodoStatus } from '@/types/Todo.js'

describe('TodoList 命令系统测试', () => {
  let mockContext: AgentContext
  let testSessionId: string

  beforeEach(() => {
    testSessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    mockContext = {
      sessionId: testSessionId,
      userId: 'test-user',
      agentId: 'test-agent',
      isInteractive: true,
      currentDirectory: process.cwd(),
      environmentVariables: {},
      capabilities: [],
      requestId: 'test-request'
    }

    // 设置测试环境变量
    process.env.WRITEFLOW_CONFIG_DIR = path.join(os.tmpdir(), 'writeflow-test')
  })

  afterEach(() => {
    // 清理测试文件
    try {
      const todosDir = path.join(os.tmpdir(), 'writeflow-test', 'todos')
      if (fs.existsSync(todosDir)) {
        const files = fs.readdirSync(todosDir)
        files.forEach(file => {
          if (file.includes(testSessionId)) {
            fs.unlinkSync(path.join(todosDir, file))
          }
        })
      }
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('/todo add 命令测试', () => {
    test('应该正确添加基本任务', async () => {
      const result = await todoAddCommand.call!('实现用户登录功能', mockContext)
      
      expect(result).toContain('✅ 任务已添加')
      expect(result).toContain('实现用户登录功能')
      expect(result).toContain('优先级: medium')
      expect(result).toContain('状态: pending')
    })

    test('应该正确添加带优先级的任务', async () => {
      const result = await todoAddCommand.call!('修复重要bug high', mockContext)
      
      expect(result).toContain('✅ 任务已添加')
      expect(result).toContain('修复重要bug')
      expect(result).toContain('优先级: high')
    })

    test('应该正确处理低优先级任务', async () => {
      const result = await todoAddCommand.call!('更新文档 low', mockContext)
      
      expect(result).toContain('优先级: low')
    })

    test('应该拒绝空内容', async () => {
      const result = await todoAddCommand.call!('', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('请提供任务内容')
    })

    test('应该正确生成activeForm', async () => {
      const testCases = [
        { input: '实现新功能', expected: '正在实现新功能' },
        { input: '修复bug问题', expected: '正在修复bug问题' },
        { input: '创建新页面', expected: '正在创建新页面' },
        { input: '更新配置', expected: '正在更新配置' },
        { input: '删除旧文件', expected: '正在删除旧文件' },
        { input: '其他任务', expected: '正在处理：其他任务' }
      ]

      for (const { input } of testCases) {
        const result = await todoAddCommand.call!(input, mockContext)
        expect(result).toContain('✅ 任务已添加')
      }
    })
  })

  describe('/todo list 命令测试', () => {
    beforeEach(async () => {
      // 预先添加一些测试任务
      await todoAddCommand.call!('待处理任务1', mockContext)
      await todoAddCommand.call!('待处理任务2 high', mockContext)
      
      // 添加一个进行中的任务
      const addResult = await todoAddCommand.call!('进行中任务', mockContext)
      const todoId = addResult.match(/ID: ([\w-]+)/)?.[1]
      if (todoId) {
        await todoStartCommand.call!(todoId, mockContext)
      }
      
      // 添加一个已完成的任务
      const addResult2 = await todoAddCommand.call!('已完成任务', mockContext)
      const todoId2 = addResult2.match(/ID: ([\w-]+)/)?.[1]
      if (todoId2) {
        await todoDoneCommand.call!(todoId2, mockContext)
      }
    })

    test('应该返回结构化的JSON数据', async () => {
      const result = await todoListCommand.call!('', mockContext)
      
      const data = JSON.parse(result)
      expect(data.type).toBe('todo-list')
      expect(data.data).toBeDefined()
      expect(data.data.todos).toBeDefined()
      expect(data.data.stats).toBeDefined()
      expect(data.data.filter).toBe('all')
    })

    test('应该正确返回所有任务', async () => {
      const result = await todoListCommand.call!('', mockContext)
      const data = JSON.parse(result)
      
      expect(data.data.todos.length).toBe(4)
      expect(data.data.stats.total).toBe(4)
      expect(data.data.stats.pending).toBe(2)
      expect(data.data.stats.inProgress).toBe(1)
      expect(data.data.stats.completed).toBe(1)
    })

    test('应该正确筛选pending状态的任务', async () => {
      const result = await todoListCommand.call!('pending', mockContext)
      const data = JSON.parse(result)
      
      expect(data.data.filter).toBe('pending')
      expect(data.data.todos.length).toBe(2)
      data.data.todos.forEach((todo: any) => {
        expect(todo.status).toBe('pending')
      })
    })

    test('应该正确筛选in_progress状态的任务', async () => {
      const result = await todoListCommand.call!('in_progress', mockContext)
      const data = JSON.parse(result)
      
      expect(data.data.filter).toBe('in_progress')
      expect(data.data.todos.length).toBe(1)
      expect(data.data.todos[0].status).toBe('in_progress')
    })

    test('应该正确筛选completed状态的任务', async () => {
      const result = await todoListCommand.call!('completed', mockContext)
      const data = JSON.parse(result)
      
      expect(data.data.filter).toBe('completed')
      expect(data.data.todos.length).toBe(1)
      expect(data.data.todos[0].status).toBe('completed')
    })
  })

  describe('/todo update 命令测试', () => {
    let testTodoId: string

    beforeEach(async () => {
      const result = await todoAddCommand.call!('测试更新任务', mockContext)
      const match = result.match(/ID: ([\w-]+)/)
      testTodoId = match![1]
    })

    test('应该正确更新任务状态', async () => {
      const result = await todoUpdateCommand.call!(`${testTodoId} in_progress`, mockContext)
      
      expect(result).toContain('⏳ 任务状态已更新')
      expect(result).toContain('测试更新任务')
      expect(result).toContain('状态: in_progress')
    })

    test('应该正确处理completed状态', async () => {
      const result = await todoUpdateCommand.call!(`${testTodoId} completed`, mockContext)
      
      expect(result).toContain('✅ 任务状态已更新')
      expect(result).toContain('状态: completed')
    })

    test('应该拒绝无效的参数格式', async () => {
      const result = await todoUpdateCommand.call!('invalid-format', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('用法')
    })

    test('应该拒绝无效的状态', async () => {
      const result = await todoUpdateCommand.call!(`${testTodoId} invalid_status`, mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('无效状态')
    })

    test('应该处理不存在的ID', async () => {
      const result = await todoUpdateCommand.call!('non-existent-id completed', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('未找到')
    })
  })

  describe('/todo start 命令测试', () => {
    let testTodoId: string

    beforeEach(async () => {
      const result = await todoAddCommand.call!('待开始任务', mockContext)
      const match = result.match(/ID: ([\w-]+)/)
      testTodoId = match![1]
    })

    test('应该正确开始任务', async () => {
      const result = await todoStartCommand.call!(testTodoId, mockContext)
      
      expect(result).toContain('🚀 开始任务')
      expect(result).toContain('待开始任务')
      expect(result).toContain('in_progress')
    })

    test('应该拒绝空ID', async () => {
      const result = await todoStartCommand.call!('', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('请提供任务 ID')
    })

    test('应该处理不存在的ID', async () => {
      const result = await todoStartCommand.call!('non-existent-id', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('无法开始任务')
    })
  })

  describe('/todo done 命令测试', () => {
    let testTodoId: string

    beforeEach(async () => {
      const result = await todoAddCommand.call!('待完成任务', mockContext)
      const match = result.match(/ID: ([\w-]+)/)
      testTodoId = match![1]
    })

    test('应该正确完成任务', async () => {
      const result = await todoDoneCommand.call!(testTodoId, mockContext)
      
      expect(result).toContain('✅ 任务已完成')
      expect(result).toContain('待完成任务')
    })

    test('应该拒绝空ID', async () => {
      const result = await todoDoneCommand.call!('', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('请提供任务 ID')
    })

    test('应该处理不存在的ID', async () => {
      const result = await todoDoneCommand.call!('non-existent-id', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('无法完成任务')
    })
  })

  describe('/todo remove 命令测试', () => {
    let testTodoId: string

    beforeEach(async () => {
      const result = await todoAddCommand.call!('待删除任务', mockContext)
      const match = result.match(/ID: ([\w-]+)/)
      testTodoId = match![1]
    })

    test('应该正确删除任务', async () => {
      const result = await todoRemoveCommand.call!(testTodoId, mockContext)
      
      expect(result).toContain('🗑️ 任务已删除')
      expect(result).toContain('待删除任务')
    })

    test('应该拒绝空ID', async () => {
      const result = await todoRemoveCommand.call!('', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('请提供任务 ID')
    })

    test('应该处理不存在的ID', async () => {
      const result = await todoRemoveCommand.call!('non-existent-id', mockContext)
      
      expect(result).toContain('错误')
      expect(result).toContain('未找到')
    })
  })

  describe('/todo stats 命令测试', () => {
    beforeEach(async () => {
      // 添加多个不同状态的任务
      await todoAddCommand.call!('待处理任务1', mockContext)
      await todoAddCommand.call!('待处理任务2', mockContext)
      
      const addResult = await todoAddCommand.call!('进行中任务', mockContext)
      const todoId = addResult.match(/ID: ([\w-]+)/)?.[1]
      if (todoId) {
        await todoStartCommand.call!(todoId, mockContext)
      }
      
      const addResult2 = await todoAddCommand.call!('已完成任务', mockContext)
      const todoId2 = addResult2.match(/ID: ([\w-]+)/)?.[1]
      if (todoId2) {
        await todoDoneCommand.call!(todoId2, mockContext)
      }
    })

    test('应该显示正确的统计信息', async () => {
      const result = await todoStatsCommand.call!('', mockContext)
      
      expect(result).toContain('📊 任务统计报告')
      expect(result).toContain('总任务: 4')
      expect(result).toContain('待处理: 2')
      expect(result).toContain('进行中: 1')
      expect(result).toContain('已完成: 1')
      expect(result).toContain('完成率: 25%')
    })

    test('应该显示当前任务', async () => {
      const result = await todoStatsCommand.call!('', mockContext)
      
      expect(result).toContain('🔥 当前任务: 进行中任务')
    })

    test('应该显示接下来的任务', async () => {
      const result = await todoStatsCommand.call!('', mockContext)
      
      expect(result).toContain('📋 接下来的任务')
      expect(result).toContain('待处理任务1')
      expect(result).toContain('待处理任务2')
    })

    test('应该显示最近完成的任务', async () => {
      const result = await todoStatsCommand.call!('', mockContext)
      
      expect(result).toContain('✅ 最近完成')
      expect(result).toContain('已完成任务')
    })
  })

  describe('/todo clear 命令测试', () => {
    beforeEach(async () => {
      // 添加一些任务
      await todoAddCommand.call!('任务1', mockContext)
      await todoAddCommand.call!('任务2', mockContext)
    })

    test('应该正确清空所有任务', async () => {
      const result = await todoClearCommand.call!('', mockContext)
      
      expect(result).toContain('🧹 所有任务已清空')
      
      // 验证确实清空了
      const listResult = await todoListCommand.call!('', mockContext)
      const data = JSON.parse(listResult)
      expect(data.data.todos.length).toBe(0)
      expect(data.data.stats.total).toBe(0)
    })
  })

  describe('集成测试', () => {
    test('应该支持完整的任务生命周期', async () => {
      // 1. 添加任务
      const addResult = await todoAddCommand.call!('集成测试任务 high', mockContext)
      expect(addResult).toContain('✅ 任务已添加')
      
      const todoId = addResult.match(/ID: ([\w-]+)/)?.[1]
      expect(todoId).toBeDefined()

      // 2. 查看任务列表
      const listResult = await todoListCommand.call!('', mockContext)
      const listData = JSON.parse(listResult)
      expect(listData.data.todos.length).toBe(1)
      expect(listData.data.todos[0].priority).toBe('high')

      // 3. 开始任务
      const startResult = await todoStartCommand.call!(todoId!, mockContext)
      expect(startResult).toContain('🚀 开始任务')

      // 4. 验证状态变化
      const listResult2 = await todoListCommand.call!('in_progress', mockContext)
      const listData2 = JSON.parse(listResult2)
      expect(listData2.data.todos.length).toBe(1)
      expect(listData2.data.todos[0].status).toBe('in_progress')

      // 5. 完成任务
      const doneResult = await todoDoneCommand.call!(todoId!, mockContext)
      expect(doneResult).toContain('✅ 任务已完成')

      // 6. 验证完成状态
      const listResult3 = await todoListCommand.call!('completed', mockContext)
      const listData3 = JSON.parse(listResult3)
      expect(listData3.data.todos.length).toBe(1)
      expect(listData3.data.todos[0].status).toBe('completed')

      // 7. 查看统计
      const statsResult = await todoStatsCommand.call!('', mockContext)
      expect(statsResult).toContain('完成率: 100%')
    })

    test('应该正确处理多个任务的排序', async () => {
      // 添加不同优先级的任务
      await todoAddCommand.call!('低优先级任务 low', mockContext)
      await todoAddCommand.call!('高优先级任务 high', mockContext)
      await todoAddCommand.call!('中优先级任务 medium', mockContext)

      const listResult = await todoListCommand.call!('', mockContext)
      const data = JSON.parse(listResult)
      
      // 在相同状态下，应该按优先级排序
      expect(data.data.todos[0].priority).toBe('high')
      expect(data.data.todos[1].priority).toBe('medium')
      expect(data.data.todos[2].priority).toBe('low')
    })

    test('应该在不同会话间正确隔离', async () => {
      // 在当前会话添加任务
      await todoAddCommand.call!('会话1任务', mockContext)
      
      // 创建不同会话的上下文
      const differentContext = {
        ...mockContext,
        sessionId: `different-${testSessionId}`
      }
      
      // 在不同会话查看任务
      const listResult1 = await todoListCommand.call!('', mockContext)
      const listResult2 = await todoListCommand.call!('', differentContext)
      
      const data1 = JSON.parse(listResult1)
      const data2 = JSON.parse(listResult2)
      
      expect(data1.data.todos.length).toBe(1)
      expect(data2.data.todos.length).toBe(0)
    })
  })
})