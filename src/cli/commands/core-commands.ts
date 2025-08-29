import { SlashCommand } from '@/types/command.js'
import { AgentContext } from '@/types/agent.js'

/**
 * 核心写作命令实现
 * 基于文档规格中的命令设计
 */
export const coreCommands: SlashCommand[] = [
  {
    type: 'prompt',
    name: 'outline',
    description: '生成文章大纲',
    aliases: ['大纲', 'ol'],
    usage: '/outline <主题> [选项]',
    examples: [
      '/outline AI代理技术发展趋势',
      '/outline 微服务架构设计 --style=技术 --length=3000'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      const [topic, ...options] = args.split(' ')
      const style = extractOption(options, 'style') || '技术性'
      const length = extractOption(options, 'length') || '2000'
      
      return `请为主题"${topic}"生成详细的${style}文章大纲：

目标字数：${length}字
写作风格：${style}
目标读者：技术人员

请生成包含以下结构的大纲：
1. 吸引人的标题建议（3个备选）
2. 文章引言（核心问题和价值）
3. 主体章节（3-5个主要部分）
   - 每个章节的核心论点
   - 预估字数分配
   - 关键支撑材料
4. 结论部分（总结和展望）
5. 写作建议和注意事项

请确保大纲逻辑清晰，易于执行。`
    },
    
    allowedTools: ['web_search', 'read_article', 'write_article', 'citation_manager'],
    progressMessage: '正在生成文章大纲',
    userFacingName: () => 'outline'
  },

  {
    type: 'prompt',
    name: 'rewrite',
    description: '智能改写文章内容',
    aliases: ['改写', 'rw', '重写'],
    usage: '/rewrite <风格> <内容或文件路径>',
    examples: [
      '/rewrite 通俗 ./articles/tech-article.md',
      '/rewrite 学术 这是一段需要改写的技术内容...',
      '/rewrite 正式 --tone=专业 --keep-structure'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      const [style, ...contentParts] = args.split(' ')
      let content = contentParts.join(' ')
      
      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      if (!content) {
        throw new Error('请提供要改写的内容或文件路径')
      }

      const styleMap: Record<string, string> = {
        '通俗': '通俗易懂，适合大众读者',
        '正式': '正式严谨，商务场合使用',
        '技术': '技术专业，面向技术人员',
        '学术': '学术规范，符合论文标准',
        '营销': '营销导向，具有说服力',
        '故事': '故事化表达，生动有趣'
      }

      const styleDesc = styleMap[style] || style

      return `请将以下内容改写为${styleDesc}的风格：

原文内容：
${content}

改写要求：
1. 保持核心信息和主要观点不变
2. 调整语言风格为：${styleDesc}
3. 优化句式结构，提高可读性
4. 确保逻辑清晰，表达流畅
5. 适当调整专业术语的使用程度
6. 保持原文的信息密度和价值

请提供改写后的完整内容。`
    },
    
    allowedTools: ['read_article', 'edit_article', 'style_adapter', 'grammar_checker'],
    progressMessage: '正在智能改写内容',
    userFacingName: () => 'rewrite'
  },

  {
    type: 'prompt',
    name: 'research', 
    description: '深度主题研究',
    aliases: ['研究', '调研', 'rs'],
    usage: '/research <主题> [选项]',
    examples: [
      '/research AI Agent架构设计',
      '/research 区块链技术发展 --depth=深入 --sources=10',
      '/research 量子计算应用 --lang=中文 --time=最近一年'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      const [topic, ...options] = args.split(' ')
      const depth = extractOption(options, 'depth') || '标准'
      const maxSources = extractOption(options, 'sources') || '8'
      const timeRange = extractOption(options, 'time') || '无限制'
      const language = extractOption(options, 'lang') || '中英文'
      
      return `请对主题"${topic}"进行深度研究，提供全面的分析报告：

研究参数：
- 研究深度：${depth}
- 最大来源：${maxSources}个
- 时间范围：${timeRange}
- 语言偏好：${language}

请提供以下内容：

## 1. 主题概述
- 基本定义和核心概念
- 发展历程和重要节点
- 当前的重要性和影响

## 2. 现状分析  
- 技术发展现状
- 主要参与者和厂商
- 市场规模和增长趋势
- 存在的问题和挑战

## 3. 最新发展
- 近期重要突破和进展
- 新技术和新方法
- 行业动态和政策变化

## 4. 不同观点对比
- 支持者的主要观点
- 质疑者的主要担忧
- 学术界的研究方向
- 产业界的应用实践

## 5. 权威资料来源
- 学术论文和研究报告
- 权威机构发布的资料
- 知名专家的观点文章
- 可靠的数据统计来源

## 6. 写作建议
- 适合的文章角度和切入点
- 读者关注的核心问题
- 可以深入讨论的技术细节
- 实用的案例和应用场景

请确保信息准确、来源可靠，并提供具体的引用链接。`
    },
    
    allowedTools: [
      'web_search', 'web_fetch', 'fact_checker', 
      'citation_manager', 'read_article', 'write_article'
    ],
    progressMessage: '正在进行深度主题研究',
    userFacingName: () => 'research'
  },

  {
    type: 'local',
    name: 'help',
    description: '显示命令帮助信息',
    aliases: ['帮助', 'h', '?'],
    
    async call(args: string, context: AgentContext): Promise<string> {
      if (args.trim()) {
        // 显示特定命令的详细帮助
        return getCommandHelp(args.trim())
      }
      
      return `WriteFlow AI 写作助手 - 命令参考

📝 写作命令:
  /outline <主题>           生成文章大纲
  /rewrite <风格> <内容>    智能改写内容
  /research <主题>          深度主题研究  
  /style <风格> [内容]      调整写作风格

📤 发布命令:
  /publish <平台> <文件>    发布到平台
  /format <格式> <文件>     格式转换

⚙️ 系统命令:
  /model [模型名]           设置AI模型
  /settings                 打开设置界面
  /status                   查看系统状态
  /clear                    清除会话历史

🔍 工具命令:
  /read <文件路径>          读取文件内容
  /edit <文件路径>          编辑文件
  /search <关键词>          搜索内容

💡 使用技巧:
  - 命令支持中英文别名 (如 /大纲 等同于 /outline)
  - 使用 /help <命令> 查看详细说明
  - 大部分命令支持 --参数=值 的选项格式

示例会话:
> /outline AI代理技术
> /research 自然语言处理
> /rewrite 通俗 ./articles/technical-article.md
> /publish wechat ./articles/final-article.md`
    },
    
    userFacingName: () => 'help'
  }
]

// 辅助函数：提取选项参数
function extractOption(options: string[], optionName: string): string | undefined {
  for (const option of options) {
    if (option.startsWith(`--${optionName}=`)) {
      return option.split('=')[1]
    }
  }
  return undefined
}

// 辅助函数：获取命令帮助信息
function getCommandHelp(commandName: string): string {
  const command = coreCommands.find(cmd => 
    cmd.name === commandName || 
    cmd.aliases?.includes(commandName)
  )

  if (!command) {
    return `命令 '${commandName}' 不存在。使用 /help 查看所有可用命令。`
  }

  let help = `📝 ${command.name} - ${command.description}\n\n`
  
  if (command.usage) {
    help += `📋 用法: ${command.usage}\n\n`
  }
  
  if (command.aliases && command.aliases.length > 0) {
    help += `🔗 别名: ${command.aliases.join(', ')}\n\n`
  }
  
  if (command.examples && command.examples.length > 0) {
    help += `💡 示例:\n`
    command.examples.forEach(example => {
      help += `  ${example}\n`
    })
    help += `\n`
  }
  
  if (command.allowedTools && command.allowedTools.length > 0) {
    help += `🛠️ 可用工具: ${command.allowedTools.join(', ')}\n`
  }

  return help
}