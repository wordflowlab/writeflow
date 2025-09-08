import { SlashCommand } from '../../../types/command.js'
import { planningCommands } from './planning-commands.js'
import { writingCommands } from './writing-commands.js'
import { editingCommands } from './editing-commands.js'
import { analysisCommands } from './analysis-commands.js'
import { researchCommands } from './research-commands.js'
import { translationCommands } from './translation-commands.js'
import { systemCommands } from './system-commands.js'

/**
 * 核心命令模块
 * 按功能分类组织的所有核心写作命令
 */
export const coreCommands: SlashCommand[] = [
  // 规划类命令 (4个): outline, specify, plan, task
  ...planningCommands,
  
  // 写作类命令 (4个): write, draft, compose, continue  
  ...writingCommands,
  
  // 编辑类命令 (4个): rewrite, polish, expand, simplify
  ...editingCommands,
  
  // 分析类命令 (3个): grammar, check, summarize
  ...analysisCommands,
  
  // 调研类命令 (2个): research, deep-research
  ...researchCommands,
  
  // 翻译类命令 (1个): translate
  ...translationCommands,
  
  // 系统类命令 (3个): model, help
  ...systemCommands
]

// 导出各个模块以供单独使用
export {
  planningCommands,
  writingCommands,
  editingCommands,
  analysisCommands,
  researchCommands,
  translationCommands,
  systemCommands
}