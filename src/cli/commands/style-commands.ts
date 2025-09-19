import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'

/**
 * 写作风格命令实现
 */
export const styleCommands: SlashCommand[] = [
  {
    type: 'prompt',
    name: 'style',
    description: '调整写作风格',
    aliases: ['风格', '样式', 'st'],
    usage: '/style <风格> [内容或文件路径]',
    examples: [
      '/style 通俗 ./articles/technical-doc.md',
      '/style 正式 这是一段需要调整风格的内容...',
      '/style 学术 --tone=专业 --audience=研究人员'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      const parts = _args.trim().split(' ')
      
      if (parts.length === 0) {
        throw new Error('请提供写作风格')
      }
      
      const [style, ...contentParts] = parts
      let content = contentParts.join(' ')
      
      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      if (!content) {
        return `当前可用的写作风格：

📝 **通俗风格** (popular)
- 简单易懂，适合大众读者
- 避免专业术语，多用比喻
- 语言生动活泼

📄 **正式风格** (formal) 
- 严谨规范，商务场合使用
- 语言正式，逻辑清晰
- 适合报告和文档

🔬 **技术风格** (technical)
- 专业准确，面向技术人员
- 保留技术术语和细节
- 强调准确性和精确性

🎓 **学术风格** (academic)
- 学术规范，符合论文标准
- 客观严谨，引用完整
- 适合研究和学术发表

📢 **营销风格** (marketing)
- 有说服力，吸引注意
- 突出价值和优势
- 激发行动和兴趣

📖 **故事风格** (narrative)
- 故事化表达，生动有趣
- 情节性强，引人入胜
- 适合案例和经历分享

使用方法: /style <风格> <内容或文件路径>`
      }
      
      const styleDescriptions = {
        '通俗': 'popular',
        '正式': 'formal', 
        '技术': 'technical',
        '学术': 'academic',
        '营销': 'marketing',
        '故事': 'narrative',
        'popular': 'popular',
        'formal': 'formal',
        'technical': 'technical', 
        'academic': 'academic',
        'marketing': 'marketing',
        'narrative': 'narrative'
      }
      
      const mappedStyle = styleDescriptions[style as keyof typeof styleDescriptions] || style
      
      return `请将以下内容调整为 ${style} 风格：

原始内容：
${content}

风格要求：
- 目标风格：${style} (${mappedStyle})
- 保持核心信息不变
- 调整语言表达方式
- 优化句式结构
- 提高目标读者的理解度

请根据所选风格的特点，重新组织和表达内容，确保：
1. 语言风格与目标一致
2. 逻辑结构清晰
3. 表达自然流畅
4. 适合目标读者群体

请提供调整后的完整内容。`
    },
    
    allowedTools: ['read_article', 'style_adapter', 'content_rewriter'],
    progressMessage: '正在调整写作风格',
    userFacingName: () => 'style'
  }
]