import { SlashCommand } from '../../../types/command.js'
import { AgentContext } from '../../../types/agent.js'
import { extractOption } from './utils.js'

/**
 * 编辑类命令：rewrite, polish, expand, simplify
 * 负责内容的编辑、优化和改进
 */
export const editingCommands: SlashCommand[] = [
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
    
    allowedTools: ['Write', 'Read', 'Edit', 'MultiEdit'],
    progressMessage: '正在改写内容',
    userFacingName: () => 'rewrite'
  },

  {
    type: 'prompt',
    name: 'polish',
    description: '润色和优化文本',
    aliases: ['润色', 'p'],
    usage: '/polish [文件路径或直接输入内容]',
    examples: [
      '/polish ./articles/draft.md',
      '/polish 这是一段需要润色的文本内容...',
      '/polish /path/to/article.md'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
      if (!content) {
        throw new Error('请提供要润色的内容或文件路径。用法: /polish [内容或文件路径]')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请对以下内容进行润色优化：

原始内容：
${content}

润色要求：
1. 保持原有的核心观点和主要信息不变
2. 优化语言表达，使其更加流畅自然
3. 改善句式结构，提升可读性
4. 纠正语法错误和不当用词
5. 统一术语使用，确保前后一致
6. 增强逻辑连贯性和表达力度
7. 适当调整语调，使内容更有吸引力

请提供润色后的完整内容，确保质量显著提升。`
    },
    
    allowedTools: ['read_article', 'edit_article', 'style_adapter', 'grammar_checker'],
    progressMessage: '正在润色内容',
    userFacingName: () => 'polish'
  },

  {
    type: 'prompt',
    name: 'expand',
    description: '扩展内容深度',
    aliases: ['扩展', 'ex'],
    usage: '/expand <需要扩展的内容>',
    examples: [
      '/expand ./articles/outline.md',
      '/expand AI技术的发展趋势',
      '/expand 云计算的核心优势包括弹性扩展、成本优化'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
      if (!content) {
        throw new Error('请提供需要扩展的内容。用法: /expand <内容或文件路径>')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请对以下内容进行深度扩展：

原始内容：
${content}

扩展要求：
1. 分析原内容的核心要点和论述方向
2. 为每个要点添加更详细的解释和论证
3. 提供相关的实例、数据和案例支撑
4. 增加深层次的分析和见解
5. 补充背景信息和相关知识点
6. 探讨潜在的影响和应用场景
7. 保持逻辑结构清晰，层次分明
8. 确保扩展内容有价值且与原主题高度相关

请提供扩展后的丰富内容，显著增加信息密度和价值。`
    },
    
    allowedTools: ['web_search', 'read_article', 'citation_manager', 'write_article'],
    progressMessage: '正在扩展内容',
    userFacingName: () => 'expand'
  },

  {
    type: 'prompt',
    name: 'simplify',
    description: '简化内容表达',
    aliases: ['简化', 's'],
    usage: '/simplify <需要简化的内容>',
    examples: [
      '/simplify ./articles/complex-article.md',
      '/simplify 量子计算利用量子叠加态和纠缠态实现并行计算...',
      '/simplify /path/to/technical-document.md'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
      if (!content) {
        throw new Error('请提供需要简化的内容。用法: /simplify <内容或文件路径>')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请对以下内容进行简化处理：

原始内容：
${content}

简化要求：
1. 保持核心信息和关键观点完整
2. 用更简单易懂的语言重新表达
3. 减少专业术语，增加通俗解释
4. 简化复杂的句式结构
5. 删除冗余和重复的内容
6. 突出重点，去除次要信息
7. 使用更直接明了的表达方式
8. 确保普通读者也能轻松理解

请提供简化后的内容，保持信息价值的同时显著提升可读性。`
    },
    
    allowedTools: ['read_article', 'style_adapter', 'grammar_checker', 'edit_article'],
    progressMessage: '正在简化内容',
    userFacingName: () => 'simplify'
  }
]