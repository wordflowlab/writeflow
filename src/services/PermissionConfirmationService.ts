import { EventEmitter } from 'events'

export interface PermissionRequest {
  id: string
  toolName: string
  filePath: string
  description: string
  args?: any
}

export interface PermissionResponse {
  decision: 'allow' | 'allow-session' | 'deny'
}

/**
 * 权限确认服务
 * 在工具层和 UI 层之间建立桥梁，处理权限确认请求
 */
export class PermissionConfirmationService extends EventEmitter {
  private pendingRequests = new Map<string, {
    resolve: (response: PermissionResponse) => void
    reject: (error: Error) => void
  }>()

  /**
   * 请求权限确认
   * @param request 权限请求信息
   * @returns Promise<PermissionResponse> 用户的权限响应
   */
  async requestPermission(request: PermissionRequest): Promise<PermissionResponse> {
    return new Promise<PermissionResponse>((resolve, reject) => {
      // 存储回调
      this.pendingRequests.set(request.id, { resolve, reject })
      
      // 发射权限请求事件给 UI 层
      this.emit('permission-request', request)
      
      // 设置超时（30秒）
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id)
          reject(new Error('权限确认超时'))
        }
      }, 30000)
    })
  }

  /**
   * 响应权限请求
   * @param requestId 请求ID
   * @param response 用户响应
   */
  respondToPermission(requestId: string, response: PermissionResponse): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      this.pendingRequests.delete(requestId)
      pending.resolve(response)
    }
  }

  /**
   * 取消权限请求
   * @param requestId 请求ID
   * @param reason 取消原因
   */
  cancelPermissionRequest(requestId: string, reason?: string): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      this.pendingRequests.delete(requestId)
      pending.reject(new Error(reason || '权限请求被取消'))
    }
  }

  /**
   * 获取待处理的权限请求数量
   */
  getPendingRequestsCount(): number {
    return this.pendingRequests.size
  }
}

// 全局权限确认服务实例
let globalPermissionService: PermissionConfirmationService | null = null

/**
 * 获取全局权限确认服务实例
 */
export function getPermissionConfirmationService(): PermissionConfirmationService {
  if (!globalPermissionService) {
    globalPermissionService = new PermissionConfirmationService()
  }
  return globalPermissionService
}