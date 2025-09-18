/**
 * WriteFlow 统一工具注册系统
 * 参考 Kode 的优雅设计，提供单一工具注册点
 */

import { WriteFlowTool } from '../Tool.js'

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

// 任务管理工具
import { TodoWriteTool } from './writing/TodoWriteTool.js'

/**
 * 获取所有核心工具 - 参考 Kode 的 getAllTools()
 * 这里明确列出所有工具，确保 Write 工具包含在内
 */
export function getAllTools(): WriteFlowTool[] {
  return [
    // 文件操作工具（核心）
    new ReadTool(),
    new WriteTool(),      // 🔥 确保 Write 工具在列表中！
    new EditTool(),
    new MultiEditTool(),
    
    // 搜索工具
    new GlobTool(),
    new GrepTool(),
    
    // 系统工具
    new BashTool(),
    
    // Plan 模式工具
    new ExitPlanModeTool() as any,
    
    // 任务管理
    new TodoWriteTool() as any,
  ] as WriteFlowTool[]
}

/**
 * 获取可用工具（过滤未启用的工具）
 */
export async function getAvailableTools(): Promise<WriteFlowTool[]> {
  const allTools = getAllTools()
  
  // 并行检查所有工具是否启用（如果工具有 isEnabled 方法）
  const enabledResults = await Promise.all(
    allTools.map(async tool => {
      if (typeof tool.isEnabled === 'function') {
        return await tool.isEnabled()
      }
      return true // 默认启用
    }),
  )
  
  const availableTools = allTools.filter((_, index) => enabledResults[index])
  return availableTools
}

/**
 * 获取只读工具
 */
export async function getReadOnlyTools(): Promise<WriteFlowTool[]> {
  const allTools = getAllTools()
  
  // 过滤只读工具
  const readOnlyTools = allTools.filter(tool => tool.isReadOnly())
  
  // 检查启用状态
  const enabledResults = await Promise.all(
    readOnlyTools.map(async tool => {
      if (typeof tool.isEnabled === 'function') {
        return await tool.isEnabled()
      }
      return true
    }),
  )
  
  return readOnlyTools.filter((_, index) => enabledResults[index])
}

/**
 * 根据工具名获取工具实例
 */
export function getToolByName(name: string): WriteFlowTool | undefined {
  const allTools = getAllTools()
  return allTools.find(tool => tool.name === name)
}

/**
 * 获取所有工具名称
 */
export function getToolNames(): string[] {
  return getAllTools().map(tool => tool.name)
}

/**
 * 检查工具是否存在
 */
export function hasTools(names: string[]): boolean {
  const availableNames = getToolNames()
  return names.every(name => availableNames.includes(name))
}