/**
 * WriteFlow /model 命令
 * 迁移自 Kode 的模型配置系统
 */

import { CommandResult } from '../../types/command'
import { AgentContext } from '../../types/agent.js'

export const name = 'model'
export const description = '配置和管理 AI 模型设置'
export const help = `
使用方法: /model

打开交互式模型配置界面，用于：
- 配置主模型、任务模型、推理模型和快速模型
- 添加、编辑、删除模型配置
- 设置 API 密钥和模型参数
- 查看模型状态和使用情况

交互操作：
- ↑/↓ 导航选项
- Space 键循环模型
- Enter 进入配置
- d 键清空配置
- Esc 退出
`

export async function execute(
  args: string[],
  context: AgentContext
): Promise<CommandResult> {
  
  // 启动 React UI 进行模型配置
  return {
    success: true,
    shouldQuery: false,
    messages: [{
      role: 'assistant',
      content: 'LAUNCH_MODEL_CONFIG' // 特殊标记，UI 会识别并启动模型配置界面
    }]
  }
}