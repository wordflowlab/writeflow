#!/usr/bin/env node

import { createTodoWriteToolAdapter } from './dist/tools/writing/TodoToolsAdapter.js'

console.log('🧪 直接测试 TodoWrite 适配器...\n')

try {
  const todoTool = createTodoWriteToolAdapter()
  console.log('TodoWrite 工具已创建:', todoTool.name)
  
  // 创建测试任务
  const testTodos = {
    todos: [
      {
        id: "direct-test-001",
        content: "直接测试任务1",
        activeForm: "正在直接测试任务1",
        status: "completed"
      },
      {
        id: "direct-test-002",
        content: "直接测试任务2",
        activeForm: "正在直接测试任务2",
        status: "in_progress"
      },
      {
        id: "direct-test-003",
        content: "直接测试任务3",
        activeForm: "正在直接测试任务3",
        status: "pending"
      }
    ]
  }
  
  console.log('正在执行 TodoWrite...')
  const result = await todoTool.execute(testTodos)
  
  console.log('\n=== 执行结果 ===')
  console.log('成功:', result.success)
  console.log('内容:')
  console.log(result.content)
  
  if (result.error) {
    console.error('错误:', result.error)
  }
  
} catch (error) {
  console.error('测试失败:', error.message)
  console.error(error.stack)
}