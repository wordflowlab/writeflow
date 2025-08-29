import { describe, test, expect, beforeEach } from '@jest/globals'
import { SixLayerSecurityValidator } from '@/core/security/six-layer-validator.js'
import { SecurityRequest } from '@/types/security.js'

describe('SixLayerSecurityValidator', () => {
  let validator: SixLayerSecurityValidator
  
  beforeEach(() => {
    const config = {
      enabled: true,
      strictMode: false,
      contentFilter: true,
      maliciousDetection: true,
      auditLogging: true,
      allowedDomains: ['api.anthropic.com', 'www.example.com'],
      blockedPaths: ['/etc', '/var', '/sys'],
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10
      }
    }
    
    validator = new SixLayerSecurityValidator(config)
  })

  test('应该通过安全的请求', async () => {
    const safeRequest: SecurityRequest = {
      type: 'tool_execution',
      toolName: 'read_article',
      input: { file_path: '/home/user/article.md' },
      user: 'testuser',
      source: 'cli',
      timestamp: Date.now()
    }
    
    const response = await validator.validate(safeRequest)
    expect(response.allowed).toBe(true)
  })

  test('应该拒绝恶意内容', async () => {
    const maliciousRequest: SecurityRequest = {
      type: 'tool_execution',
      toolName: 'custom_script',
      input: { 
        code: 'eval(process.env.SECRET_KEY)'
      },
      source: 'user',
      timestamp: Date.now()
    }
    
    const response = await validator.validate(maliciousRequest)
    expect(response.allowed).toBe(false)
    expect(response.risks.some(r => r.type === 'malicious_code')).toBe(true)
  })

  test('应该拒绝访问受限路径', async () => {
    const blockedPathRequest: SecurityRequest = {
      type: 'file_access',
      content: {
        path: '/etc/passwd',
        operation: 'read'
      },
      source: 'cli',
      timestamp: Date.now()
    }
    
    const response = await validator.validate(blockedPathRequest)
    expect(response.allowed).toBe(false)
    expect(response.risks.some(r => r.type === 'file_access')).toBe(true)
  })

  test('应该拒绝未授权域名访问', async () => {
    const unauthorizedDomainRequest: SecurityRequest = {
      type: 'network_request',
      content: {
        url: 'https://malicious-site.com/api'
      },
      source: 'tool',
      timestamp: Date.now()
    }
    
    const response = await validator.validate(unauthorizedDomainRequest)
    expect(response.allowed).toBe(false)
    expect(response.risks.some(r => r.type === 'network_access')).toBe(true)
  })

  test('应该建议工具替代', async () => {
    const deprecatedToolRequest: SecurityRequest = {
      type: 'tool_execution', 
      toolName: 'cat',
      input: { file_path: '/some/file.txt' },
      source: 'user',
      timestamp: Date.now()
    }
    
    const response = await validator.validate(deprecatedToolRequest)
    expect(response.allowed).toBe(false)
    expect(response.warnings.some(w => w.includes('read_article'))).toBe(true)
  })

  test('应该记录审计日志', async () => {
    const request: SecurityRequest = {
      type: 'tool_execution',
      toolName: 'test_tool',
      source: 'test',
      timestamp: Date.now()
    }
    
    await validator.validate(request)
    
    const auditLog = validator.getAuditLog()
    expect(auditLog.length).toBeGreaterThan(0)
    expect(auditLog[auditLog.length - 1].toolName).toBe('test_tool')
  })

  test('应该能清理审计日志', () => {
    const request: SecurityRequest = {
      type: 'tool_execution',
      source: 'test',
      timestamp: Date.now()
    }
    
    validator.validate(request)
    expect(validator.getAuditLog().length).toBeGreaterThan(0)
    
    validator.clearAuditLog()
    expect(validator.getAuditLog().length).toBe(0)
  })

  test('应该处理验证错误', async () => {
    // 创建一个会导致错误的请求
    const errorRequest: SecurityRequest = {
      type: 'file_access',
      content: null, // 无效内容
      source: 'test',
      timestamp: Date.now()
    }
    
    const response = await validator.validate(errorRequest)
    
    // 应该优雅地处理错误
    expect(response.allowed).toBeDefined()
  })
})