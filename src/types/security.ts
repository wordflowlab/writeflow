export enum SecurityLevel {
  ReadOnly = 'read-only',
  Write = 'write',
  Network = 'network', 
  AIPowered = 'ai-powered',
  SystemAccess = 'system-access',
  Privileged = 'privileged'
}

export interface SecurityRequest {
  type: 'message' | 'tool_execution' | 'file_access' | 'network_request'
  content?: any
  toolName?: string
  input?: any
  user?: string
  source: string
  timestamp: number
}

export interface SecurityResponse {
  allowed: boolean
  reason?: string
  warnings: string[]
  risks: SecurityRisk[]
  mitigations: string[]
}

export interface SecurityRisk {
  level: 'low' | 'medium' | 'high' | 'critical'
  type: string
  description: string
  impact: string
}

export interface ValidationLayer {
  name: string
  enabled: boolean
  validate(request: SecurityRequest): Promise<LayerResult>
}

export interface LayerResult {
  passed: boolean
  warnings: string[]
  risks: SecurityRisk[]
  action: 'allow' | 'deny' | 'sanitize' | 'prompt'
  metadata?: Record<string, any>
}

export interface SecurityConfig {
  enabled: boolean
  strictMode: boolean
  contentFilter: boolean
  maliciousDetection: boolean
  auditLogging: boolean
  allowedDomains: string[]
  blockedPaths: string[]
  rateLimiting: {
    requestsPerMinute: number
    burstLimit: number
  }
}