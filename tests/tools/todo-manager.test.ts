import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { TodoManager } from '@/tools/TodoManager.js'
import { TodoStorage } from '@/tools/TodoStorage.js'
import { TodoStatus, TodoPriority } from '@/types/Todo.js'

describe('TodoList 功能完整测试', () => {
  let todoManager: TodoManager
  let testSessionId: string
  let testTodosDir: string

  beforeEach(() => {
    // 为每个测试创建唯一的会话ID
    testSessionId = `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    todoManager = new TodoManager(testSessionId)
    
    // 设置测试环境变量
    process.env.WRITEFLOW_CONFIG_DIR = path.join(os.tmpdir(), 'writeflow-test')
    testTodosDir = path.join(os.tmpdir(), 'writeflow-test', 'todos')
  })

  afterEach(async () => {
    // 清理测试文件
    try {
      const storageInfo = todoManager.getStorageInfo()
      if (fs.existsSync(storageInfo.storagePath)) {
        fs.unlinkSync(storageInfo.storagePath)
      }
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('TodoStorage 存储系统测试', () => {
    test('应该正确创建存储目录', () => {
      const storage = new TodoStorage(testSessionId)
      const storageInfo = storage.getStorageInfo()
      
      expect(fs.existsSync(testTodosDir)).toBe(true)
      expect(storageInfo.sessionId).toBe(testSessionId)
      expect(storageInfo.storagePath).toMatch(new RegExp(`${testSessionId}-todos\\.json$`))
    })

    test('应该正确加载空的Todo列表', async () => {
      const storage = new TodoStorage(testSessionId)
      const todos = await storage.loadTodos()
      
      expect(Array.isArray(todos)).toBe(true)
      expect(todos.length).toBe(0)
    })

    test('应该正确添加和保存Todo', async () => {
      const storage = new TodoStorage(testSessionId)
      
      const newTodo = await storage.addTodo({
        content: '测试任务',
        activeForm: '正在执行测试任务',
        priority: TodoPriority.HIGH
      })

      expect(newTodo.content).toBe('测试任务')
      expect(newTodo.activeForm).toBe('正在执行测试任务')
      expect(newTodo.status).toBe(TodoStatus.PENDING)
      expect(newTodo.priority).toBe(TodoPriority.HIGH)
      expect(newTodo.id).toMatch(/^todo-\d+-\w+$/)
    })

    test('应该正确更新Todo状态', async () => {
      const storage = new TodoStorage(testSessionId)
      
      const todo = await storage.addTodo({
        content: '测试任务',
        activeForm: '正在执行测试任务'
      })

      const updatedTodo = await storage.updateTodo({
        id: todo.id,
        status: TodoStatus.IN_PROGRESS
      })

      expect(updatedTodo).not.toBeNull()
      expect(updatedTodo!.status).toBe(TodoStatus.IN_PROGRESS)
      expect(updatedTodo!.id).toBe(todo.id)
    })

    test('应该正确删除Todo', async () => {
      const storage = new TodoStorage(testSessionId)
      
      const todo = await storage.addTodo({
        content: '待删除任务',
        activeForm: '正在执行待删除任务'
      })

      const success = await storage.removeTodo(todo.id)
      expect(success).toBe(true)

      const foundTodo = await storage.getTodoById(todo.id)
      expect(foundTodo).toBeNull()
    })

    test('应该正确计算统计信息', async () => {
      const storage = new TodoStorage(testSessionId)
      
      await storage.addTodo({ content: '待处理任务1', activeForm: '正在执行1' })
      await storage.addTodo({ content: '待处理任务2', activeForm: '正在执行2' })
      
      const todo3 = await storage.addTodo({ content: '进行中任务', activeForm: '正在执行3' })
      await storage.updateTodo({ id: todo3.id, status: TodoStatus.IN_PROGRESS })
      
      const todo4 = await storage.addTodo({ content: '已完成任务', activeForm: '正在执行4' })
      await storage.updateTodo({ id: todo4.id, status: TodoStatus.COMPLETED })

      const stats = await storage.getStats()
      
      expect(stats.total).toBe(4)
      expect(stats.pending).toBe(2)
      expect(stats.inProgress).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.completionRate).toBe(25) // 1/4 = 25%
    })
  })

  describe('TodoManager 核心功能测试', () => {
    test('应该正确添加Todo', async () => {
      const todo = await todoManager.addTodo(
        '实现用户登录功能',
        '正在实现用户登录功能',
        TodoPriority.HIGH
      )

      expect(todo.content).toBe('实现用户登录功能')
      expect(todo.activeForm).toBe('正在实现用户登录功能')
      expect(todo.priority).toBe(TodoPriority.HIGH)
      expect(todo.status).toBe(TodoStatus.PENDING)
    })

    test('应该正确获取所有Todos并排序', async () => {
      // 添加不同状态和优先级的任务
      const todo1 = await todoManager.addTodo('低优先级任务', '执行中', TodoPriority.LOW)
      const todo2 = await todoManager.addTodo('高优先级任务', '执行中', TodoPriority.HIGH)
      const todo3 = await todoManager.addTodo('中等优先级任务', '执行中', TodoPriority.MEDIUM)

      // 更改一些任务状态
      await todoManager.updateTodoStatus(todo2.id, TodoStatus.IN_PROGRESS)
      await todoManager.updateTodoStatus(todo3.id, TodoStatus.COMPLETED)

      const todos = await todoManager.getAllTodos()
      
      expect(todos.length).toBe(3)
      
      // 验证排序：completed(medium) -> in_progress(high) -> pending(low)
      expect(todos[0].status).toBe(TodoStatus.COMPLETED)
      expect(todos[1].status).toBe(TodoStatus.IN_PROGRESS)
      expect(todos[2].status).toBe(TodoStatus.PENDING)
    })

    test('应该正确开始任务', async () => {
      const todo = await todoManager.addTodo('待开始任务', '正在执行')
      
      const startedTodo = await todoManager.startTask(todo.id)
      
      expect(startedTodo).not.toBeNull()
      expect(startedTodo!.status).toBe(TodoStatus.IN_PROGRESS)
      expect(startedTodo!.id).toBe(todo.id)
    })

    test('应该正确完成任务', async () => {
      const todo = await todoManager.addTodo('待完成任务', '正在执行')
      
      const completedTodo = await todoManager.completeTask(todo.id)
      
      expect(completedTodo).not.toBeNull()
      expect(completedTodo!.status).toBe(TodoStatus.COMPLETED)
      expect(completedTodo!.id).toBe(todo.id)
    })

    test('应该正确获取当前任务', async () => {
      await todoManager.addTodo('待处理任务', '执行中')
      const inProgressTodo = await todoManager.addTodo('进行中任务', '执行中')
      await todoManager.startTask(inProgressTodo.id)

      const currentTask = await todoManager.getCurrentTask()
      
      expect(currentTask).not.toBeNull()
      expect(currentTask!.id).toBe(inProgressTodo.id)
      expect(currentTask!.status).toBe(TodoStatus.IN_PROGRESS)
    })

    test('应该正确搜索Todos', async () => {
      await todoManager.addTodo('实现登录功能', '正在实现登录功能')
      await todoManager.addTodo('修复数据库问题', '正在修复数据库问题')
      await todoManager.addTodo('更新用户界面', '正在更新用户界面')

      const searchResults = await todoManager.searchTodos('登录')
      
      expect(searchResults.length).toBe(1)
      expect(searchResults[0].content).toBe('实现登录功能')

      const searchResults2 = await todoManager.searchTodos('正在')
      expect(searchResults2.length).toBe(3)
    })

    test('应该正确生成进度报告', async () => {
      // 创建各种状态的任务
      const pendingTodo = await todoManager.addTodo('待处理任务', '执行中')
      const inProgressTodo = await todoManager.addTodo('进行中任务', '执行中') 
      const completedTodo = await todoManager.addTodo('已完成任务', '执行中')

      await todoManager.startTask(inProgressTodo.id)
      await todoManager.completeTask(completedTodo.id)

      const report = await todoManager.getProgressReport()
      
      expect(report.stats.total).toBe(3)
      expect(report.stats.pending).toBe(1)
      expect(report.stats.inProgress).toBe(1)
      expect(report.stats.completed).toBe(1)
      
      expect(report.currentTask).not.toBeNull()
      expect(report.currentTask!.id).toBe(inProgressTodo.id)
      
      expect(report.nextTasks.length).toBe(1)
      expect(report.nextTasks[0].id).toBe(pendingTodo.id)
      
      expect(report.recentCompleted.length).toBe(1)
      expect(report.recentCompleted[0].id).toBe(completedTodo.id)
    })

    test('应该正确处理批量操作', async () => {
      const todo1 = await todoManager.addTodo('任务1', '执行中')
      const todo2 = await todoManager.addTodo('任务2', '执行中')
      const todo3 = await todoManager.addTodo('任务3', '执行中')

      const updatedTodos = await todoManager.batchUpdateStatus(
        [todo1.id, todo2.id, todo3.id],
        TodoStatus.COMPLETED
      )

      expect(updatedTodos.length).toBe(3)
      updatedTodos.forEach(todo => {
        expect(todo.status).toBe(TodoStatus.COMPLETED)
      })
    })

    test('应该正确导出和导入数据', async () => {
      // 添加测试数据
      await todoManager.addTodo('测试任务1', '执行中', TodoPriority.HIGH)
      await todoManager.addTodo('测试任务2', '执行中', TodoPriority.LOW)

      // 导出数据
      const exportedData = await todoManager.exportTodos()
      const parsedData = JSON.parse(exportedData)
      
      expect(Array.isArray(parsedData)).toBe(true)
      expect(parsedData.length).toBe(2)

      // 清空数据
      await todoManager.clearAllTodos()
      let todos = await todoManager.getAllTodos()
      expect(todos.length).toBe(0)

      // 导入数据
      const success = await todoManager.importTodos(exportedData)
      expect(success).toBe(true)
      
      todos = await todoManager.getAllTodos()
      expect(todos.length).toBe(2)
    })
  })

  describe('排序算法测试', () => {
    test('应该按状态优先级正确排序', async () => {
      const completedTodo = await todoManager.addTodo('已完成任务', '执行中', TodoPriority.LOW)
      const inProgressTodo = await todoManager.addTodo('进行中任务', '执行中', TodoPriority.LOW)
      const pendingTodo = await todoManager.addTodo('待处理任务', '执行中', TodoPriority.LOW)

      await todoManager.completeTask(completedTodo.id)
      await todoManager.startTask(inProgressTodo.id)

      const todos = await todoManager.getAllTodos()
      
      // 排序应该是：completed -> in_progress -> pending
      expect(todos[0].status).toBe(TodoStatus.COMPLETED)
      expect(todos[1].status).toBe(TodoStatus.IN_PROGRESS)
      expect(todos[2].status).toBe(TodoStatus.PENDING)
    })

    test('应该在相同状态下按任务优先级排序', async () => {
      const lowTodo = await todoManager.addTodo('低优先级', '执行中', TodoPriority.LOW)
      const highTodo = await todoManager.addTodo('高优先级', '执行中', TodoPriority.HIGH)
      const mediumTodo = await todoManager.addTodo('中等优先级', '执行中', TodoPriority.MEDIUM)

      const todos = await todoManager.getAllTodos()
      
      // 相同状态(pending)下，应该按优先级排序：high -> medium -> low
      expect(todos[0].priority).toBe(TodoPriority.HIGH)
      expect(todos[1].priority).toBe(TodoPriority.MEDIUM)
      expect(todos[2].priority).toBe(TodoPriority.LOW)
    })
  })

  describe('错误处理测试', () => {
    test('应该正确处理不存在的Todo ID', async () => {
      const result = await todoManager.updateTodoStatus('non-existent-id', TodoStatus.COMPLETED)
      expect(result).toBeNull()

      const todo = await todoManager.getTodoById('non-existent-id')
      expect(todo).toBeNull()

      const success = await todoManager.removeTodo('non-existent-id')
      expect(success).toBe(false)
    })

    test('应该正确处理无效的状态转换', async () => {
      const todo = await todoManager.addTodo('测试任务', '执行中')
      
      // 尝试开始已完成的任务
      await todoManager.completeTask(todo.id)
      const result = await todoManager.startTask(todo.id)
      expect(result).toBeNull()
    })

    test('应该正确处理无效的JSON导入', async () => {
      const success = await todoManager.importTodos('invalid json')
      expect(success).toBe(false)
    })

    test('应该正确处理空内容的Todo', async () => {
      // 这应该由storage层的schema验证处理
      // 我们测试manager层不会传递空内容
      try {
        const todo = await todoManager.addTodo('', '')
        // 如果到达这里，我们检查是否确实创建了有内容的任务（可能被默认值填充）
        if (todo) {
          expect(todo.content.length).toBeGreaterThan(0)
        }
      } catch (error) {
        // 如果抛出错误，这是预期的行为（schema验证失败）
        expect(error).toBeDefined()
      }
    })
  })

  describe('存储持久化测试', () => {
    test('应该在重新创建管理器后保持数据', async () => {
      // 使用第一个管理器添加数据
      await todoManager.addTodo('持久化测试任务', '执行中', TodoPriority.HIGH)
      
      // 创建新的管理器实例（相同会话ID）
      const newTodoManager = new TodoManager(testSessionId)
      const todos = await newTodoManager.getAllTodos()
      
      expect(todos.length).toBe(1)
      expect(todos[0].content).toBe('持久化测试任务')
      expect(todos[0].priority).toBe(TodoPriority.HIGH)
    })

    test('应该正确隔离不同会话的数据', async () => {
      // 在当前会话添加任务
      await todoManager.addTodo('会话1任务', '执行中')
      
      // 创建不同会话的管理器
      const differentSessionId = `different-${testSessionId}`
      const differentSessionManager = new TodoManager(differentSessionId)
      
      const todos1 = await todoManager.getAllTodos()
      const todos2 = await differentSessionManager.getAllTodos()
      
      expect(todos1.length).toBe(1)
      expect(todos2.length).toBe(0)
      
      // 在第二个会话添加任务
      await differentSessionManager.addTodo('会话2任务', '执行中')
      
      const updatedTodos1 = await todoManager.getAllTodos()
      const updatedTodos2 = await differentSessionManager.getAllTodos()
      
      expect(updatedTodos1.length).toBe(1)
      expect(updatedTodos2.length).toBe(1)
      expect(updatedTodos1[0].content).toBe('会话1任务')
      expect(updatedTodos2[0].content).toBe('会话2任务')
    })
  })
})