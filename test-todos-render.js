#!/usr/bin/env node

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

console.log('🎨 测试 WriteFlow Todos 渲染效果...\n')

const app = new WriteFlowApp()

try {
  await app.initialize()
  console.log('WriteFlow 初始化完成\n')
  
  // 测试 TodoWrite 工具的渲染效果
  console.log('正在测试 TodoWrite 工具...')
  
  const response = await app.handleFreeTextInput(
    '请创建以下测试任务：\n1. 实现用户登录功能\n2. 添加数据验证\n3. 修复样式问题', 
    {}
  )
  
  console.log('\n✨ Todos 渲染测试完成！')
  console.log('如果上面显示了彩色的复选框和任务列表，说明渲染优化成功！')
  
} catch (error) {
  console.error('测试失败:', error.message)
}