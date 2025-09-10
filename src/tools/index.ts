/**
 * WriteFlow 工具系统 - 增强的工具注册和发现系统
 * 参考 Kode 的工具架构，提供统一的工具管理和调用接口
 */

// 原有系统导出（向后兼容）
export { ToolManager } from './tool-manager.js'
export * from '../types/tool.js'

// 核心工具系统
import { WriteFlowTool } from '../Tool.js'
import { ToolOrchestrator, getToolOrchestrator } from './ToolOrchestrator.js'
import { PermissionManager, getPermissionManager } from './PermissionManager.js'

// 文件操作工具
import { ReadTool } from './file/ReadTool/ReadTool.js'
import { WriteTool } from './file/WriteTool/WriteTool.js'
import { EditTool } from './file/EditTool/EditTool.js'
import { MultiEditTool } from './file/MultiEditTool/MultiEditTool.js'

// 搜索工具
import { GlobTool } from './search/GlobTool/GlobTool.js'
import { GrepTool } from './search/GrepTool/GrepTool.js'

// 系统工具
import { BashTool } from './system/BashTool/BashTool.js'

// Plan 模式工具
import { ExitPlanModeTool } from './ExitPlanMode.js'

// 工具实例 - 延迟初始化以避免循环依赖
let toolInstances: Map<string, WriteFlowTool<any, any>> | null = null

/**
 * 获取或创建工具实例
 */
function getOrCreateToolInstances(): Map<string, WriteFlowTool<any, any>> {
  if (!toolInstances) {
    toolInstances = new Map<string, WriteFlowTool<any, any>>([
      ['Read', new ReadTool() as WriteFlowTool<any, any>],
      ['Write', new WriteTool() as WriteFlowTool<any, any>],
      ['Edit', new EditTool() as WriteFlowTool<any, any>],
      ['MultiEdit', new MultiEditTool() as WriteFlowTool<any, any>],
      ['Glob', new GlobTool() as WriteFlowTool<any, any>],
      ['Grep', new GrepTool() as WriteFlowTool<any, any>],
      ['Bash', new BashTool() as WriteFlowTool<any, any>],
      ['ExitPlanMode', new ExitPlanModeTool() as any as WriteFlowTool<any, any>],
    ])
    
    // 自动注册到工具编排器
    const orchestrator = getToolOrchestrator()
    for (const tool of toolInstances.values()) {
      orchestrator.registerTool(tool)
    }
  }
  
  return toolInstances
}

// 导出工具实例（兼容旧接口）
export const readTool = () => getOrCreateToolInstances().get('Read')!
export const writeTool = () => getOrCreateToolInstances().get('Write')!
export const editTool = () => getOrCreateToolInstances().get('Edit')!
export const multiEditTool = () => getOrCreateToolInstances().get('MultiEdit')!
export const globTool = () => getOrCreateToolInstances().get('Glob')!
export const grepTool = () => getOrCreateToolInstances().get('Grep')!
export const bashTool = () => getOrCreateToolInstances().get('Bash')!
export const exitPlanModeTool = () => getOrCreateToolInstances().get('ExitPlanMode')!

// 核心工具数组
export const coreTools: WriteFlowTool[] = Array.from(getOrCreateToolInstances().values())

// 按类别分组的工具 - 动态生成
export const toolsByCategory = {
  get file() { return [readTool(), writeTool(), editTool(), multiEditTool()] },
  get search() { return [globTool(), grepTool()] },
  get system() { return [bashTool()] },
  get plan() { return [exitPlanModeTool()] },
} as const

// 工具名称到工具实例的映射 - 使用编排器作为唯一数据源
export const toolsByName = getOrCreateToolInstances()

// 获取工具实例 - 统一接口
export function getTool(name: string): WriteFlowTool | undefined {
  return getToolOrchestrator().getTool(name)
}

// 获取所有工具名称 - 使用编排器
export function getToolNames(): string[] {
  return getToolOrchestrator().getToolNames()
}

// 获取可用工具（考虑权限）
export function getAvailableTools(): WriteFlowTool[] {
  return getToolOrchestrator().getAvailableTools()
}

// 获取只读工具
export function getReadOnlyTools(): WriteFlowTool[] {
  return coreTools.filter(tool => tool.isReadOnly())
}

// 获取可写工具
export function getWriteTools(): WriteFlowTool[] {
  return coreTools.filter(tool => !tool.isReadOnly())
}

// 获取并发安全的工具
export function getConcurrencySafeTools(): WriteFlowTool[] {
  return coreTools.filter(tool => tool.isConcurrencySafe())
}

// 检查工具是否存在
export function hasTools(names: string[]): boolean {
  return names.every(name => getTool(name) !== undefined)
}

// 获取多个工具
export function getTools(names: string[]): WriteFlowTool[] {
  return names
    .map(name => getTool(name))
    .filter((tool): tool is WriteFlowTool => tool !== undefined)
}

// 工具信息
export interface ToolInfo {
  name: string
  description: string
  category: string
  isReadOnly: boolean
  isConcurrencySafe: boolean
  needsPermissions: boolean
}

// 获取所有工具的信息
export async function getToolsInfo(): Promise<ToolInfo[]> {
  const infos: ToolInfo[] = []
  
  for (const [category, tools] of Object.entries(toolsByCategory)) {
    for (const tool of tools) {
      const description = await tool.description()
      infos.push({
        name: tool.name,
        description,
        category,
        isReadOnly: tool.isReadOnly(),
        isConcurrencySafe: tool.isConcurrencySafe(),
        needsPermissions: tool.needsPermissions(),
      })
    }
  }
  
  return infos
}

// 工具配置常量
export const TOOL_CONFIG = {
  MAX_CONCURRENT_TOOLS: 10,
  DEFAULT_TIMEOUT: 120000,
  MAX_TIMEOUT: 600000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_OUTPUT_LENGTH: 30000,
} as const

// 工具类别枚举
export enum ToolCategory {
  FILE = 'file',
  SEARCH = 'search',
  SYSTEM = 'system',
}

// ==================== 新增的工具系统组件导出 ====================

// 工具系统核心组件
export { ToolOrchestrator, getToolOrchestrator, executeToolQuick } from './ToolOrchestrator.js'
export { PermissionManager, getPermissionManager } from './PermissionManager.js'
export { 
  SystemPromptOptimizer, 
  getSystemPromptOptimizer, 
  generateOptimizedSystemPrompt 
} from './SystemPromptOptimizer.js'
export type { ToolCallEvent } from './ToolBase.js'

// 权限和执行相关类型和枚举
export type { 
  ToolExecutionRequest, 
  ToolExecutionResult, 
  OrchestratorConfig 
} from './ToolOrchestrator.js'

export { ToolExecutionStatus } from './ToolOrchestrator.js'

export type {
  PermissionPolicy,
  ToolUsageStats
} from './PermissionManager.js'

export { ToolPermissionLevel, PermissionGrantType } from './PermissionManager.js'

// ==================== 工具发现和智能推荐 ====================

/**
 * 根据任务描述智能推荐工具
 */
export function recommendToolsForTask(taskDescription: string): WriteFlowTool[] {
  const availableTools = getAvailableTools()
  const recommendations: Array<{tool: WriteFlowTool, score: number}> = []
  
  const keywords = taskDescription.toLowerCase()
  
  // 基于关键字匹配推荐工具
  for (const tool of availableTools) {
    let score = 0
    
    // 文件操作关键字
    if (keywords.includes('read') || keywords.includes('查看') || keywords.includes('读取')) {
      if (tool.name === 'Read') score += 10
      if (tool.name === 'Glob') score += 5
    }
    
    if (keywords.includes('write') || keywords.includes('写入') || keywords.includes('创建文件')) {
      if (tool.name === 'Write') score += 10
    }
    
    if (keywords.includes('edit') || keywords.includes('修改') || keywords.includes('编辑')) {
      if (tool.name === 'Edit') score += 10
      if (tool.name === 'MultiEdit') score += 8
    }
    
    // 搜索关键字
    if (keywords.includes('search') || keywords.includes('find') || keywords.includes('搜索') || keywords.includes('查找')) {
      if (tool.name === 'Grep') score += 10
      if (tool.name === 'Glob') score += 8
    }
    
    // 系统操作关键字
    if (keywords.includes('command') || keywords.includes('execute') || keywords.includes('命令') || keywords.includes('执行')) {
      if (tool.name === 'Bash') score += 10
    }
    
    if (score > 0) {
      recommendations.push({ tool, score })
    }
  }
  
  // 按得分排序并返回前5个
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(rec => rec.tool)
}

/**
 * 获取工具使用统计和推荐
 */
export function getToolRecommendations(): {
  mostUsed: WriteFlowTool[]
  leastUsed: WriteFlowTool[]
  recommended: WriteFlowTool[]
} {
  const orchestrator = getToolOrchestrator()
  const stats = orchestrator.getExecutionStats()
  
  const sortedByUsage = Object.entries(stats.toolUsageStats)
    .sort(([,a], [,b]) => b - a)
    .map(([toolName]) => getTool(toolName))
    .filter((tool): tool is WriteFlowTool => tool !== undefined)
  
  return {
    mostUsed: sortedByUsage.slice(0, 3),
    leastUsed: sortedByUsage.slice(-3).reverse(),
    recommended: getReadOnlyTools().slice(0, 3) // 推荐安全的只读工具
  }
}

/**
 * 生成工具系统状态报告
 */
export function generateSystemReport(): string {
  const orchestrator = getToolOrchestrator()
  const permissionManager = getPermissionManager()
  
  const orchestratorReport = orchestrator.generateUsageReport()
  const permissionReport = permissionManager.generatePermissionReport()
  
  return [
    `# WriteFlow 工具系统状态报告`,
    `生成时间: ${new Date().toISOString()}`,
    ``,
    orchestratorReport,
    ``,
    `---`,
    ``,
    permissionReport
  ].join('\n')
}

// ==================== 向后兼容导出 ====================

// 导出类型和基类
export type { WriteFlowTool } from '../Tool.js'
export { ToolBase } from './ToolBase.js'

// 重新导出工具类（用于扩展）
export { ReadTool } from './file/ReadTool/ReadTool.js'
export { WriteTool } from './file/WriteTool/WriteTool.js'
export { EditTool } from './file/EditTool/EditTool.js'
export { MultiEditTool } from './file/MultiEditTool/MultiEditTool.js'
export { GlobTool } from './search/GlobTool/GlobTool.js'
export { GrepTool } from './search/GrepTool/GrepTool.js'
export { BashTool } from './system/BashTool/BashTool.js'

// 导出适配器类（用于 AgentLoader）
export {
  ReadToolAdapter,
  WriteToolAdapter,
  EditToolAdapter,
  MultiEditToolAdapter,
  GlobToolAdapter,
  GrepToolAdapter,
  BashToolAdapter,
  createCoreToolAdapters,
} from './adapters/CoreToolsAdapter.js'