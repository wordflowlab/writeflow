import { SlashCommand } from '../../../types/command.js'
import type { ToolUseContext } from '../../../Tool.js'
import { AgentContext } from '../../../types/agent.js'

/**
 * 分析类命令：grammar, check, summarize
 * 负责内容的分析、检查和总结
 */
export const analysisCommands: SlashCommand[] = [
  {
    type: 'prompt',
    name: 'grammar',
    description: '语法检查和纠错',
    aliases: ['语法', 'g'],
    usage: '/grammar [文件路径或直接输入内容]',
    examples: [
      '/grammar ./articles/draft.md',
      '/grammar 检查这段文字的语法错误',
      '/grammar /path/to/document.md'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      let content = _args.trim()
      
      if (!content) {
        throw new Error('请提供要检查的内容或文件路径。用法: /grammar [内容或文件路径]')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请对以下内容进行语法检查和纠错：

检查内容：
${content}

检查要求：
1. 识别所有语法错误（语序、时态、单复数等）
2. 发现拼写错误和错别字
3. 检查标点符号使用是否正确
4. 分析句式结构的合理性
5. 检查专业术语使用是否准确
6. 提供具体的修改建议和解释
7. 保持原文的语义和风格不变
8. 如果是中文，检查语言表达的地道性

请提供详细的检查结果，包括错误位置、错误类型和修改建议。`
    },
    
    allowedTools: ['read_article', 'grammar_checker', 'style_adapter'],
    progressMessage: '正在进行语法检查',
    userFacingName: () => 'grammar'
  },

  {
    type: 'prompt',
    name: 'check',
    description: '内容事实核查',
    aliases: ['核查', '检查', 'verify'],
    usage: '/check <需要检查的内容>',
    examples: [
      '/check ./articles/research-report.md',
      '/check 根据最新数据，全球AI市场规模已达1000亿美元',
      '/check GPT-4的参数量超过1万亿'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      let content = _args.trim()
      
      if (!content) {
        throw new Error('请提供需要核查的内容。用法: /check <内容或文件路径>')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 fact_checker 工具读取: ${content}]`
      }
      
      return `请对以下内容进行事实核查：

核查内容：
${content}

核查要求：
1. 验证所有陈述的数据和统计信息
2. 检查引用的事实是否准确
3. 验证时间、地点、人物等具体信息
4. 确认技术术语和概念的正确性
5. 检查是否有过时或错误的信息
6. 识别需要更新的数据或观点
7. 提供可靠的信息源和参考链接
8. 标注不确定或需要进一步验证的内容

请提供详细的核查报告，包括：
- 已验证的正确信息
- 发现的错误或不准确之处
- 需要更新或补充的内容
- 建议的修正方案`
    },
    
    allowedTools: ['web_search', 'fact_checker', 'citation_manager', 'read_article'],
    progressMessage: '正在进行事实核查',
    userFacingName: () => 'check'
  },

  {
    type: 'prompt',
    name: 'summarize',
    description: '总结和提炼内容要点',
    aliases: ['总结', 'sum'],
    usage: '/summarize <内容或文件路径>',
    examples: [
      '/summarize ./reports/research.md',
      '/summarize 这是一篇关于AI发展的长文...',
      '/summarize /path/to/article.md'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      let content = _args.trim()
      
      if (!content) {
        throw new Error('请提供需要总结的内容或文件路径。用法: /summarize <内容或文件路径>')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请对以下内容进行总结和要点提炼：

原始内容：
${content}

总结要求：
1. 提取核心观点和主要论述
2. 识别关键数据、事实和引用
3. 概括主要结论和发现
4. 保持逻辑结构的清晰性
5. 突出重要信息，去除冗余内容
6. 如果内容较长，提供分层次的总结
7. 保持客观性，不添加个人观点
8. 确保总结内容准确反映原文意图

请提供以下格式的总结：
- 核心要点（3-5个主要观点）
- 关键数据/事实
- 主要结论
- 如有必要，提供详细分段总结`
    },
    
    allowedTools: ['read_article', 'web_search', 'citation_manager'],
    progressMessage: '正在总结提炼内容',
    userFacingName: () => 'summarize'
  }
]