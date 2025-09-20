import { debugLog, logError } from '../utils/log.js'
import { getToolOrchestrator, getTool, getAvailableTools } from './index.js'

/**
 * 简化的工具管理器 - 兼容旧接口
 * 内部使用新的工具编排器系统
 */
export class LegacyToolManager {
  private registeredTools = new Map<string, any>()

  constructor() {
    // 初始化时自动注册核心工具
    this.initializeCoreTools()
  }

  private initializeCoreTools() {
    // 核心工具已经通过 getToolOrchestrator() 自动注册
    debugLog('✅ 兼容工具管理器已初始化')
  }

  /**
   * 注册工具（兼容接口）
   */
  registerTool(tool: any): void {
    if (tool && tool.name) {
      this.registeredTools.set(tool.name, tool)
      debugLog(`📝 已注册工具: ${tool.name}`)
    }
  }

  /**
   * 注册多个工具
   */
  registerTools(tools: any[]): void {
    tools.forEach(tool => this.registerTool(tool))
  }

  /**
   * 获取工具名称列表
   */
  getToolNames(): string[] {
    const coreTools = getAvailableTools().map(tool => tool.name)
    const legacyTools = Array.from(this.registeredTools.keys())
    return [...coreTools, ...legacyTools]
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): any[] {
    const coreTools = getAvailableTools()
    const legacyTools = Array.from(this.registeredTools.values())
    return [...coreTools, ...legacyTools]
  }

  /**
   * 获取工具信息
   */
  getToolInfo(name: string): any {
    // 先从核心工具查找
    const coreTool = getTool(name)
    if (coreTool) {
      return coreTool
    }
    
    // 再从注册的工具查找
    return this.registeredTools.get(name)
  }

  /**
   * 执行工具
   */
  async executeTool(toolName: string, input: any): Promise<any> {
    try {
      // 优先使用核心工具系统
      const coreTool = getTool(toolName)
      if (coreTool) {
        const context = {
          abortController: new AbortController(),
          readFileTimestamps: {},
          options: { verbose: false, safeMode: true },
        }
        
        const callResult = coreTool.call(input, context)
        
        // 处理AsyncGenerator或Promise
        if (Symbol.asyncIterator in callResult) {
          let finalResult = null
          for await (const output of callResult as any) {
            if (output.type === 'result') {
              finalResult = output
              break
            }
          }
          
          return {
            success: true,
            content: finalResult?.resultForAssistant || finalResult?.data?.message || '工具执行成功',
            result: finalResult?.data,
            executionTime: 0,
          }
        } else {
          const output = await callResult
          return {
            success: true,
            content: output?.message || '工具执行成功',
            result: output,
            executionTime: 0,
          }
        }
      }
      
      // 回退到注册的工具
      const legacyTool = this.registeredTools.get(toolName)
      if (legacyTool && legacyTool.execute) {
        return legacyTool.execute(input)
      }
      
      throw new Error(`工具 ${toolName} 不存在`)
      
    } catch (_error) {
      logError(`工具 ${toolName} 执行失败:`, _error)
      return {
        success: false,
        _error: `工具执行失败: ${(_error as Error).message}`,
        content: `❌ 工具 ${toolName} 执行失败`,
      }
    }
  }
}