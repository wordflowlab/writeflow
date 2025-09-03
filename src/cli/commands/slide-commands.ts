/**
 * Slidev PPT 相关命令
 * 通过 Agent 系统动态加载，避免污染主工具列表
 */

import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { AgentLoader } from '../../utils/agentLoader.js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * 主 slide 命令
 */
export const slideCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide',
  description: 'Slidev PPT 创作命令',
  aliases: ['ppt', '演示', '幻灯片'],
  usage: '/slide <子命令> [选项]',
  examples: [
    '/slide create "AI Agent 架构设计" --duration=30',
    '/slide convert ./article.md --theme=seriph',
    '/slide outline "Rust 性能优化" --slides=15'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 加载 Slidev Agent
    const loader = AgentLoader.getInstance('slidev-ppt')
    const agent = await loader.loadAgent()
    
    // 解析子命令
    const [subcommand, ...rest] = args.split(' ')
    const params = rest.join(' ')
    
    // 构建带有 Agent 系统提示的 prompt
    let basePrompt = agent.systemPrompt + '\n\n'
    
    switch (subcommand) {
      case 'create':
      case '创建':
        basePrompt += await getCreatePrompt(params)
        break
        
      case 'convert':
      case '转换':
        basePrompt += await getConvertPrompt(params)
        break
        
      case 'outline':
      case '大纲':
        basePrompt += await getOutlinePrompt(params)
        break
        
      case 'optimize':
      case '优化':
        basePrompt += await getOptimizePrompt(params)
        break
        
      default:
        basePrompt += `用户请求: ${args}\n\n请根据用户需求，使用你的 Slidev 专业能力提供帮助。`
    }
    
    return basePrompt
  },

  allowedTools: ['SlidevGenerator', 'SlideConverter'],
  progressMessage: '正在处理 PPT 请求',
  userFacingName: () => 'slide'
}

/**
 * 创建演示文稿的 prompt
 */
async function getCreatePrompt(params: string): Promise<string> {
    // 解析参数
    const match = params.match(/^"([^"]+)"(.*)$/) || params.match(/^'([^']+)'(.*)$/)
    const title = match ? match[1] : params.split(' ')[0]
    const options = match ? match[2].trim() : params.substring(title.length).trim()
    
    // 提取选项
    const duration = extractOption(options, 'duration') || '20'
    const theme = extractOption(options, 'theme') || 'default'
    const style = extractOption(options, 'style') || 'technical'
    const audience = extractOption(options, 'audience') || 'developers'
    
    return `请创建一个关于"${title}"的 Slidev 演示文稿。

要求：
- 演讲时长：${duration} 分钟
- 主题风格：${theme}
- 演讲风格：${style}
- 目标听众：${audience}

请按以下步骤执行：
1. 生成演讲大纲（${Math.ceil(parseInt(duration) / 2)} 页左右）
2. 为每页创建合适的内容
3. 添加适当的动画和过渡效果
4. 生成完整的 Slidev Markdown 文件

确保：
- 每页幻灯片聚焦一个核心观点
- 包含代码示例（如果相关）
- 使用 Slidev 的高级功能（动画、布局、组件等）
- 生成演讲者备注`
}

/**
 * 转换文章的 prompt
 */
async function getConvertPrompt(params: string): Promise<string> {
    // 解析文件路径和选项
    const parts = params.split(' ')
    const filePath = parts[0]
    const options = parts.slice(1).join(' ')
    
    // 读取文件内容（如果存在）
    let content = ''
    if (filePath && existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8')
    }
    
    const theme = extractOption(options, 'theme') || 'default'
    const maxSlides = extractOption(options, 'slides') || '20'
    const splitBy = extractOption(options, 'split') || 'auto'
    
    return `请将以下 Markdown 文章转换为 Slidev 演示文稿。

文件路径：${filePath}
${content ? `\n文章内容：\n${content}\n` : ''}

转换要求：
- 主题：${theme}
- 最大页数：${maxSlides}
- 分割策略：${splitBy}

请：
1. 分析文章结构，识别主要章节
2. 智能分割内容，每页包含适量信息
3. 优化标题和要点，使其更适合演示
4. 添加视觉元素建议（图表、动画等）
5. 生成完整的 Slidev 格式文件

注意保留关键信息，同时确保演示节奏合理。`
}

/**
 * 生成大纲的 prompt
 */
async function getOutlinePrompt(params: string): Promise<string> {
    // 解析主题和选项
    const match = params.match(/^"([^"]+)"(.*)$/) || params.match(/^'([^']+)'(.*)$/)
    const topic = match ? match[1] : params.split(' ')[0]
    const options = match ? match[2].trim() : params.substring(topic.length).trim()
    
    const slides = extractOption(options, 'slides') || '15'
    const duration = extractOption(options, 'duration') || '20'
    const audience = extractOption(options, 'audience') || 'mixed'
    
    return `请为主题"${topic}"生成详细的演讲大纲。

参数：
- 预计页数：${slides} 页
- 演讲时长：${duration} 分钟
- 目标听众：${audience}

请生成：
1. 演讲标题和副标题
2. 详细的大纲结构：
   - 开场（1-2页）
   - 主体内容（分章节，每章节标明页数）
   - 结论（1-2页）
3. 每个章节的：
   - 核心观点
   - 关键内容点
   - 建议的视觉元素
   - 时间分配
4. 演讲者备注要点
5. 可能的Q&A问题

确保大纲逻辑清晰，时间分配合理。`
}

/**
 * 优化演示文稿的 prompt
 */
async function getOptimizePrompt(params: string): Promise<string> {
    const filePath = params.split(' ')[0]
    
    // 读取现有演示文稿
    let content = ''
    if (filePath && existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8')
    }
    
    return `请优化以下 Slidev 演示文稿。

文件路径：${filePath}
${content ? `\n当前内容：\n${content}\n` : ''}

优化目标：
1. 改进内容结构和流程
2. 增强视觉吸引力
3. 优化动画和过渡效果
4. 精简冗余内容
5. 添加缺失的演讲备注

请提供：
- 具体的优化建议
- 修改后的完整 Slidev 文件
- 改进要点总结`
}

/**
 * 提取命令选项
 */
function extractOption(options: string, key: string): string | undefined {
    const regex = new RegExp(`--${key}=([^\\s]+)`)
    const match = options.match(regex)
    return match ? match[1] : undefined
}

/**
 * slide-create 子命令（快捷方式）
 */
export const slideCreateCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide-create',
  description: '创建新的 Slidev 演示文稿',
  aliases: ['ppt-create', '创建PPT'],
  usage: '/slide-create <标题> [选项]',
  examples: [
    '/slide-create "Vue 3 新特性" --duration=30 --theme=seriph'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 委托给主命令
    return slideCommand.getPromptForCommand!(`create ${args}`, context)
  },

  allowedTools: ['SlidevGenerator'],
  progressMessage: '正在创建演示文稿',
  userFacingName: () => 'slide-create'
}

/**
 * slide-convert 子命令（快捷方式）
 */
export const slideConvertCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide-convert',
  description: '将 Markdown 文章转换为演示文稿',
  aliases: ['md2ppt', '转换PPT'],
  usage: '/slide-convert <文件路径> [选项]',
  examples: [
    '/slide-convert ./article.md --theme=default --slides=20'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 委托给主命令
    return slideCommand.getPromptForCommand!(`convert ${args}`, context)
  },

  allowedTools: ['SlideConverter'],
  progressMessage: '正在转换文章',
  userFacingName: () => 'slide-convert'
}

// 导出所有 slide 相关命令
export const slideCommands: SlashCommand[] = [
  slideCommand,
  slideCreateCommand,
  slideConvertCommand
]

export default slideCommands