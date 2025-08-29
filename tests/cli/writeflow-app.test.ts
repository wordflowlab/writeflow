import { describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { WriteFlowApp } from '@/cli/writeflow-app.js'

describe('WriteFlowApp', () => {
  let app: WriteFlowApp

  beforeEach(() => {
    app = new WriteFlowApp()
  })

  afterEach(() => {
    // 清理资源
  })

  test('应该正确初始化', async () => {
    await app.initialize()
    const status = await app.getSystemStatus()
    
    expect(status.initialized).toBe(true)
    expect(status.version).toBeDefined()
    expect(status.activeTools).toBeGreaterThan(0)
  })

  test('应该执行基本命令', async () => {
    await app.initialize()
    const result = await app.executeCommand('/help')
    
    expect(result).toContain('WriteFlow')
    expect(result).toContain('命令参考')
  })

  test('应该管理配置', async () => {
    await app.initialize()
    
    await app.setConfig('testKey', 'testValue')
    const value = await app.getConfig('testKey')
    
    expect(value).toBe('testValue')
  })

  test('应该获取系统状态', async () => {
    await app.initialize()
    const status = await app.getSystemStatus()
    
    expect(status).toHaveProperty('version')
    expect(status).toHaveProperty('initialized')
    expect(status).toHaveProperty('activeTools')
  })
})