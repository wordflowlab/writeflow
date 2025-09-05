// WriteFlow 工具系统 - 统一导出
// 兼容原有系统并添加新的核心工具

// 原有系统导出
export { ToolManager } from './tool-manager.js'
export * from '../types/tool.js'

// 新的核心工具系统
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

// 工具实例
export const readTool = new ReadTool()
export const writeTool = new WriteTool()
export const editTool = new EditTool()
export const multiEditTool = new MultiEditTool()
export const globTool = new GlobTool()
export const grepTool = new GrepTool()
export const bashTool = new BashTool()

// 核心工具数组
export const coreTools: WriteFlowTool[] = [
  readTool,
  writeTool,
  editTool,
  multiEditTool,
  globTool,
  grepTool,
  bashTool,
]

// 按类别分组的工具
export const toolsByCategory = {
  file: [readTool, writeTool, editTool, multiEditTool],
  search: [globTool, grepTool],
  system: [bashTool],
} as const

// 工具名称到工具实例的映射
export const toolsByName = new Map<string, WriteFlowTool>([
  ['Read', readTool],
  ['Write', writeTool],
  ['Edit', editTool],
  ['MultiEdit', multiEditTool],
  ['Glob', globTool],
  ['Grep', grepTool],
  ['Bash', bashTool],
])

// 获取工具实例
export function getTool(name: string): WriteFlowTool | undefined {
  return toolsByName.get(name)
}

// 获取所有工具名称
export function getToolNames(): string[] {
  return Array.from(toolsByName.keys())
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
  return names.every(name => toolsByName.has(name))
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