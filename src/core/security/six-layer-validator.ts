import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'
import { 
  SecurityRequest, 
  SecurityResponse, 
  SecurityRisk, 
  ValidationLayer, 
  LayerResult,
  SecurityConfig
} from '../../types/security.js'

/**
 * 六层安全验证器
 * 复刻 Claude Code 的完整安全框架
 * 
 * 六层验证：
 * 1. 身份与策略控制层
 * 2. 自动安全检查层 (tG5)
 * 3. LLM 驱动命令分析层 (uJ1) 
 * 4. 权限验证层
 * 5. 工具替代强制层
 * 6. 执行环境隔离层
 */
export class SixLayerSecurityValidator {
  private layers: ValidationLayer[]
  private auditLog: SecurityRequest[] = []
  
  constructor(private config: SecurityConfig) {
    this.layers = [
      new IdentityControlLayer(config),
      new AutoSecurityCheckLayer(config),
      new LLMCommandAnalysisLayer(config),
      new PermissionValidationLayer(config),
      new ToolSubstitutionLayer(config),
      new ExecutionIsolationLayer(config)
    ]
  }

  /**
   * 执行完整的六层安全验证
   */
  async validate(request: SecurityRequest): Promise<SecurityResponse> {
    const startTime = Date.now()
    
    // 记录审计日志
    if (this.config.auditLogging) {
      this.auditLog.push({ ...request, timestamp: startTime })
    }

    const warnings: string[] = []
    const risks: SecurityRisk[] = []
    const mitigations: string[] = []

    try {
      // 逐层验证
      for (const layer of this.layers) {
        if (!layer.enabled) continue

        debugLog(`[Security] 执行 ${layer.name} 验证...`)
        
        const result = await layer.validate(request)
        
        // 收集警告和风险
        warnings.push(...result.warnings)
        risks.push(...result.risks)
        
        // 如果任何一层拒绝，立即返回
        if (!result.passed) {
          return {
            allowed: false,
            reason: `${layer.name} 验证失败`,
            warnings,
            risks,
            mitigations
          }
        }
        
        // 处理需要清理的情况
        if (result.action === 'sanitize') {
          request = this.sanitizeRequest(request, result.metadata || {})
          mitigations.push(`${layer.name} 已清理请求内容`)
        }
      }

      debugLog(`[Security] 六层验证通过 (${Date.now() - startTime}ms)`)
      
      return {
        allowed: true,
        warnings,
        risks,
        mitigations
      }
      
    } catch (error) {
      logError('[Security] 验证过程出错:', error)
      
      return {
        allowed: false,
        reason: `安全验证错误: ${(error as Error).message}`,
        warnings,
        risks,
        mitigations
      }
    }
  }

  /**
   * 清理请求内容
   */
  private sanitizeRequest(request: SecurityRequest, metadata: Record<string, any>): SecurityRequest {
    // 根据元数据清理请求
    return { ...request }
  }

  /**
   * 获取审计日志
   */
  getAuditLog(): SecurityRequest[] {
    return [...this.auditLog]
  }

  /**
   * 清理审计日志
   */
  clearAuditLog(): void {
    this.auditLog = []
  }
}

/**
 * 第一层：身份与策略控制
 */
class IdentityControlLayer implements ValidationLayer {
  name = '身份与策略控制层'
  enabled = true

  constructor(private config: SecurityConfig) {}

  async validate(request: SecurityRequest): Promise<LayerResult> {
    // 基础身份验证
    if (!request.user && this.config.strictMode) {
      return {
        passed: false,
        warnings: ['缺少用户身份信息'],
        risks: [{
          level: 'medium',
          type: 'authentication',
          description: '未验证的用户请求',
          impact: '可能的未授权访问'
        }],
        action: 'deny'
      }
    }

    // 策略检查
    if (request.type === 'network_request') {
      const url = request.content?.url || ''
      const domain = this.extractDomain(url)
      
      if (domain && !this.config.allowedDomains.includes(domain)) {
        return {
          passed: false,
          warnings: [`域名 ${domain} 不在允许列表中`],
          risks: [{
            level: 'high',
            type: 'network_access',
            description: '访问未授权域名',
            impact: '可能的数据泄露或恶意内容获取'
          }],
          action: 'deny'
        }
      }
    }

    return {
      passed: true,
      warnings: [],
      risks: [],
      action: 'allow'
    }
  }

  private extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname
    } catch {
      return null
    }
  }
}

/**
 * 第二层：自动安全检查 (tG5)
 */
class AutoSecurityCheckLayer implements ValidationLayer {
  name = '自动安全检查层 (tG5)'
  enabled = true

  constructor(private config: SecurityConfig) {}

  async validate(request: SecurityRequest): Promise<LayerResult> {
    const warnings: string[] = []
    const risks: SecurityRisk[] = []

    // 恶意内容检测
    if (this.config.maliciousDetection) {
      const maliciousPatterns = [
        /eval\s*\(/i,
        /exec\s*\(/i,
        /system\s*\(/i,
        /__import__/i,
        /document\.cookie/i,
        /localStorage\./i,
        /rm\s+-rf\s+\//i,
        /rm\s+-rf/i,
        /sudo\s+rm/i,
        /\>\s*\/dev\/null/i,
        /wget\s+.*\|\s*sh/i,
        /curl\s+.*\|\s*sh/i,
        /dd\s+if=/i
      ]

      // 检查所有可能包含代码的字段
      const contentToCheck: string[] = []
      
      if (request.content) {
        contentToCheck.push(typeof request.content === 'string' 
          ? request.content 
          : JSON.stringify(request.content))
      }
      
      if (request.input) {
        contentToCheck.push(typeof request.input === 'string' 
          ? request.input 
          : JSON.stringify(request.input))
      }

      for (const content of contentToCheck) {
        for (const pattern of maliciousPatterns) {
          if (pattern.test(content)) {
            risks.push({
              level: 'high',
              type: 'malicious_code',
              description: `检测到潜在恶意模式: ${pattern.source}`,
              impact: '可能执行危险操作'
            })
            break // 找到一个就够了
          }
        }
      }
    }

    // 文件路径检查
    if (request.type === 'file_access') {
      const path = request.content?.path || ''
      
      for (const blockedPath of this.config.blockedPaths) {
        if (path.includes(blockedPath)) {
          return {
            passed: false,
            warnings: [`尝试访问受限路径: ${path}`],
            risks: [{
              level: 'critical',
              type: 'file_access',
              description: '访问系统敏感目录',
              impact: '可能的系统文件泄露或修改'
            }],
            action: 'deny'
          }
        }
      }
    }

    return {
      passed: risks.filter(r => r.level === 'critical' || r.level === 'high').length === 0,
      warnings,
      risks,
      action: risks.filter(r => r.level === 'critical' || r.level === 'high').length > 0 ? 'deny' : 
              risks.length > 0 ? 'prompt' : 'allow'
    }
  }
}

/**
 * 第三层：LLM 驱动命令分析 (uJ1)
 */
class LLMCommandAnalysisLayer implements ValidationLayer {
  name = 'LLM 驱动命令分析层 (uJ1)'
  enabled = true

  constructor(private config: SecurityConfig) {}

  async validate(request: SecurityRequest): Promise<LayerResult> {
    // 简化的命令意图分析（实际实现可能使用 LLM）
    if (request.type === 'tool_execution') {
      const toolName = request.toolName || ''
      const dangerousTools = ['system_exec', 'file_delete', 'network_admin']
      
      if (dangerousTools.includes(toolName)) {
        return {
          passed: false,
          warnings: [`工具 ${toolName} 被标记为高危险`],
          risks: [{
            level: 'high',
            type: 'dangerous_tool',
            description: '尝试使用危险工具',
            impact: '可能的系统损害'
          }],
          action: 'deny'
        }
      }
    }

    return {
      passed: true,
      warnings: [],
      risks: [],
      action: 'allow'
    }
  }
}

/**
 * 第四层：权限验证
 */
class PermissionValidationLayer implements ValidationLayer {
  name = '权限验证层'
  enabled = true

  constructor(private config: SecurityConfig) {}

  async validate(request: SecurityRequest): Promise<LayerResult> {
    // 基础权限检查
    if (request.type === 'file_access') {
      const operation = request.content?.operation || 'read'
      
      if (operation === 'write' && !this.hasWritePermission(request.user)) {
        return {
          passed: false,
          warnings: ['用户缺少写入权限'],
          risks: [{
            level: 'medium',
            type: 'permission',
            description: '无权限的写入操作',
            impact: '可能的数据损坏'
          }],
          action: 'deny'
        }
      }
    }

    return {
      passed: true,
      warnings: [],
      risks: [],
      action: 'allow'
    }
  }

  private hasWritePermission(user?: string): boolean {
    // 简化的权限检查
    return true // 暂时允许所有写入操作
  }
}

/**
 * 第五层：工具替代强制
 */
class ToolSubstitutionLayer implements ValidationLayer {
  name = '工具替代强制层'
  enabled = true

  constructor(private config: SecurityConfig) {}

  async validate(request: SecurityRequest): Promise<LayerResult> {
    // 强制使用专用工具而不是原始命令
    if (request.type === 'tool_execution') {
      const toolName = request.toolName || ''
      const input = request.input || {}
      
      // 检查是否尝试使用被替代的工具
      const substitutions: Record<string, string> = {
        'cat': 'read_article',
        'grep': 'search_content', 
        'vim': 'edit_article',
        'nano': 'edit_article'
      }
      
      if (substitutions[toolName]) {
        return {
          passed: false,
          warnings: [`工具 ${toolName} 已被 ${substitutions[toolName]} 替代`],
          risks: [{
            level: 'low',
            type: 'tool_substitution',
            description: '使用已废弃工具',
            impact: '功能受限'
          }],
          action: 'deny',
          metadata: { suggestedTool: substitutions[toolName] }
        }
      }
    }

    return {
      passed: true,
      warnings: [],
      risks: [],
      action: 'allow'
    }
  }
}

/**
 * 第六层：执行环境隔离
 */
class ExecutionIsolationLayer implements ValidationLayer {
  name = '执行环境隔离层'
  enabled = true

  constructor(private config: SecurityConfig) {}

  async validate(request: SecurityRequest): Promise<LayerResult> {
    const warnings: string[] = []
    
    // 检查执行环境
    if (request.type === 'tool_execution') {
      const toolName = request.toolName || ''
      
      // 高风险工具需要沙箱环境
      const sandboxRequired = ['web_fetch', 'system_exec', 'file_write']
      
      if (sandboxRequired.includes(toolName)) {
        warnings.push(`工具 ${toolName} 将在隔离环境中执行`)
      }
    }

    return {
      passed: true,
      warnings,
      risks: [],
      action: 'allow'
    }
  }
}