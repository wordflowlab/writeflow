#!/usr/bin/env node

/**
 * TodoList 工具集成测试脚本
 */

import { TodoWriteTool } from './dist/tools/writing/TodoWriteTool.js'
import { TodoReadTool } from './dist/tools/writing/TodoReadTool.js'

async function testTodoTools() {
  console.log('🧪 开始测试 TodoList 工具集成...\n')

  const testSessionId = 'test-session-' + Date.now()
  const testContext = {
    sessionId: testSessionId,
    agentId: 'test-agent'
  }

  // 1. 测试写入任务
  console.log('1. 测试 TodoWriteTool 写入任务:')
  const writeTool = new TodoWriteTool()
  
  const testTodos = [
    {
      content: '测试任务1 - 撰写技术博客',
      status: 'pending',
      activeForm: '正在撰写技术博客'
    },
    {
      content: '测试任务2 - 编写产品文档', 
      status: 'in_progress',
      activeForm: '正在编写产品文档'
    },
    {
      content: '测试任务3 - 代码审查',
      status: 'completed',
      activeForm: '正在进行代码审查'
    }
  ]

  try {
    const writeResult = await writeTool.execute({ todos: testTodos }, testContext)
    console.log('✅ 写入结果:', JSON.stringify(writeResult, null, 2))
  } catch (error) {
    console.error('❌ 写入失败:', error)
    return
  }

  // 2. 测试读取任务
  console.log('\n2. 测试 TodoReadTool 读取任务:')
  const readTool = new TodoReadTool()
  
  try {
    const readResult = await readTool.execute({}, testContext)
    console.log('✅ 读取结果:', JSON.stringify(readResult, null, 2))
    console.log('\n📋 格式化任务列表:')
    console.log(readResult.content)
  } catch (error) {
    console.error('❌ 读取失败:', error)
    return
  }

  // 3. 测试空参数处理
  console.log('\n3. 测试空参数处理:')
  try {
    const emptyResult = await writeTool.execute({ todos: [] }, testContext)
    console.log('✅ 空任务列表处理结果:', emptyResult.success)
  } catch (error) {
    console.error('❌ 空参数测试失败:', error)
  }

  // 4. 测试错误处理
  console.log('\n4. 测试错误处理:')
  try {
    const errorResult = await writeTool.execute({ todos: 'invalid' }, testContext)
    console.log('✅ 错误处理结果:', errorResult.success, errorResult.error)
  } catch (error) {
    console.log('✅ 捕获到预期错误:', error.message)
  }

  console.log('\n🎉 TodoList 工具集成测试完成!')
}

// 运行测试
testTodoTools().catch(console.error)