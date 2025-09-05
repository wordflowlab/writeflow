import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

export class AskExpertModelTool implements WritingTool {
  name = 'AskExpertModel'
  description = '将问题包装为“专家模型咨询”格式，返回优化后的提问提示'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: ToolInput): Promise<ToolResult> {
    const question = String(input?.question || input?.content || '')
    const expert = String(input?.expert || '资深架构师')
    if (!question) return { success: false, error: '缺少 question' }
    const prompt = `以${expert}的身份回答：\n\n问题：${question}\n\n请先给出要点，再逐步深入，必要时提供示例。`
    return { success: true, content: prompt }
  }
}

