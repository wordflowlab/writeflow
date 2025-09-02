import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'

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
    type: 'prompt',
    name: 'write',
    description: '直接写作文章',
    aliases: ['写作', 'w'],
    usage: '/write <主题>',
    examples: [
      '/write AI代理技术发展趋势',
      '/write 如何构建高性能Web应用',
      '/write 区块链技术在金融中的应用'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      if (!args.trim()) {
        throw new Error('请提供写作主题。用法: /write <主题>')
      }

      const topic = args.trim()
      
      return `请根据以下主题写作一篇文章：

主题：${topic}

写作要求：
1. 结构清晰，逻辑连贯
2. 语言流畅，表达准确
3. 适当使用例子和数据支撑观点
4. 保持专业性和可读性平衡
5. 包含引言、主体和结论部分

请创作一篇完整的、有价值的文章内容。`
    },
    
    allowedTools: ['web_search', 'read_article', 'write_article', 'citation_manager'],
    progressMessage: '正在创作内容',
    userFacingName: () => 'write'
  },

  {
    type: 'prompt',
    name: 'draft',
    description: '快速起草内容',
    aliases: ['草稿', 'd'],
    usage: '/draft <主题>',
    examples: [
      '/draft 人工智能的发展历程',
      '/draft 微服务架构的优缺点',
      '/draft 云计算技术趋势'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      if (!args.trim()) {
        throw new Error('请提供起草主题。用法: /draft <主题>')
      }

      const topic = args.trim()
      
      return `请为以下主题快速起草一个内容框架：

主题：${topic}

起草要求：
1. 快速构建核心框架和要点
2. 重点突出，简洁明了
3. 包含主要论点和关键信息
4. 为后续详细写作打好基础
5. 保持逻辑性和可扩展性

请提供一个结构清晰的草稿内容。`
    },
    
    allowedTools: ['web_search', 'read_article', 'write_article'],
    progressMessage: '正在快速起草内容',
    userFacingName: () => 'draft'
  },

  {
    type: 'prompt',
    name: 'compose',
    description: '指定类型创作内容',
    aliases: ['创作', 'c'],
    usage: '/compose <类型> <主题>',
    examples: [
      '/compose 文章 人工智能的未来发展',
      '/compose 报告 市场分析报告',
      '/compose 邮件 项目进展汇报'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      const [type, ...topicParts] = args.split(' ')
      const topic = topicParts.join(' ')
      
      if (!type || !topic) {
        throw new Error('请提供内容类型和主题。用法: /compose <类型> <主题>')
      }

      const typeMap: Record<string, string> = {
        '文章': '文章形式，包含引言、正文、结论，适合发布和分享',
        '报告': '报告形式，结构化呈现，包含摘要、分析、建议',
        '邮件': '邮件形式，简洁专业，适合商务沟通',
        '博客': '博客文章，个人化表达，生动有趣',
        '方案': '解决方案文档，详细的实施步骤和建议',
        '总结': '总结文档，提炼要点，简明扼要'
      }

      const typeDesc = typeMap[type] || `${type}类型的内容`

      return `请创作以下内容：

内容类型：${type}
主题：${topic}
格式要求：${typeDesc}

创作要求：
1. 严格按照${type}的格式和风格要求
2. 内容针对性强，符合类型特点
3. 结构合理，层次清晰
4. 语言得体，符合应用场景
5. 信息完整，实用价值高

请提供符合要求的${type}内容。`
    },
    
    allowedTools: ['web_search', 'read_article', 'write_article', 'citation_manager'],
    progressMessage: '正在指定类型创作内容',
    userFacingName: () => 'compose'
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
  },

  {
    type: 'prompt',
    name: 'continue',
    description: '续写内容',
    aliases: ['续写', '继续', 'cont'],
    usage: '/continue [文件路径]',
    examples: [
      '/continue ./articles/unfinished-article.md',
      '/continue /path/to/draft.md',
      '/continue'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
      // 如果没有提供参数，提示用户提供文件路径或内容
      if (!content) {
        return `请提供需要续写的文件内容或上下文：

续写说明：
我将根据您提供的内容分析其写作风格、主题方向和逻辑结构，然后进行自然的续写。

如果您有文件，请使用: /continue <文件路径>
如果您想直接提供内容进行续写，请在下次对话中提供内容。

续写特点：
1. 保持与原文一致的写作风格和语调
2. 延续原有的逻辑思路和论证方向
3. 确保内容的连贯性和一致性
4. 根据上下文推断合适的续写方向
5. 补充必要的细节和支撑内容`
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请分析以下内容并进行续写：

现有内容：
${content}

续写要求：
1. 仔细分析现有内容的写作风格和语调
2. 理解文章的主题方向和逻辑结构
3. 识别内容的结束点和自然的续写方向
4. 保持与原文高度一致的表达方式
5. 延续原有的论证思路和表达逻辑
6. 确保续写内容与前文自然衔接
7. 补充必要的细节、例子或进一步的阐述
8. 如果是技术文章，保持技术深度一致

请提供自然流畅的续写内容，确保与原文完美融合。`
    },
    
    allowedTools: ['read_article', 'write_article', 'style_adapter', 'citation_manager'],
    progressMessage: '正在分析并续写内容',
    userFacingName: () => 'continue'
  },

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
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
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
    name: 'summarize',
    description: '总结和提炼内容要点',
    aliases: ['总结', 'sum'],
    usage: '/summarize <内容或文件路径>',
    examples: [
      '/summarize ./reports/research.md',
      '/summarize 这是一篇关于AI发展的长文...',
      '/summarize /path/to/article.md'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
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
  },

  {
    type: 'prompt',
    name: 'translate',
    description: '翻译文本到指定语言',
    aliases: ['翻译', 'tr'],
    usage: '/translate <目标语言> <内容>',
    examples: [
      '/translate 英文 这是一段中文内容',
      '/translate English ./articles/chinese-article.md',
      '/translate 日文 AI技术发展趋势分析报告'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      const [targetLang, ...contentParts] = args.split(' ')
      let content = contentParts.join(' ')
      
      if (!targetLang || !content) {
        throw new Error('请提供目标语言和要翻译的内容。用法: /translate <语言> <内容>')
      }

      // 语言标准化映射
      const langMap: Record<string, string> = {
        '英文': 'English',
        '中文': 'Chinese', 
        '日文': 'Japanese',
        '韩文': 'Korean',
        '法文': 'French',
        '德文': 'German',
        '西班牙文': 'Spanish',
        '俄文': 'Russian'
      }
      
      const standardLang = langMap[targetLang] || targetLang

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请将以下内容翻译为${standardLang}：

原始内容：
${content}

翻译要求：
1. 保持原文的核心意思和语义准确性
2. 使用${standardLang}的地道表达方式
3. 保持原文的语调和风格特点
4. 对于专业术语，提供准确的对应翻译
5. 保持段落结构和格式不变
6. 如果有文化特色内容，适当进行本地化处理
7. 确保译文流畅自然，符合目标语言习惯
8. 如遇到难以翻译的概念，提供解释说明

请提供完整的${standardLang}翻译结果。`
    },
    
    allowedTools: ['read_article', 'style_adapter'],
    progressMessage: '正在翻译内容',
    userFacingName: () => 'translate'
  },

  {
    type: 'prompt',
    name: 'check',
    description: '事实核查和信息验证',
    aliases: ['核查', 'verify'],
    usage: '/check [文件路径或直接输入内容]',
    examples: [
      '/check ./articles/news-article.md',
      '/check 根据最新数据，AI市场规模达到500亿美元',
      '/check /path/to/research-report.md'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      let content = args.trim()
      
      if (!content) {
        throw new Error('请提供需要核查的内容或文件路径。用法: /check [内容或文件路径]')
      }

      // 检查是否是文件路径
      if (content.startsWith('./') || content.startsWith('/')) {
        // 文件内容将通过 read_article 工具读取
        content = `[文件内容将通过 read_article 工具读取: ${content}]`
      }
      
      return `请对以下内容进行全面的事实核查和信息验证：

待核查内容：
${content}

核查要求：
1. 验证所有数据、统计数字和百分比的准确性
2. 核实引用的研究报告、论文和权威资料
3. 检查事件发生时间、地点和相关人物信息
4. 验证公司信息、产品数据和市场数据
5. 核实法律法规、政策文件的准确引用
6. 检查技术概念和专业术语的正确性
7. 验证历史事件和背景信息的准确性
8. 识别可能的偏见、误解或过时信息

请提供详细的核查报告，包括：
- 已验证的准确信息
- 发现的错误或不准确信息
- 需要进一步确认的疑点
- 建议的修正方案
- 可靠信息来源的建议

核查时请优先使用权威、官方和最新的信息源。`
    },
    
    allowedTools: ['web_search', 'web_fetch', 'fact_checker', 'read_article'],
    progressMessage: '正在进行事实核查',
    userFacingName: () => 'check'
  },

  {
    type: 'local',
    name: 'model',
    description: '配置和管理 AI 模型设置',
    aliases: ['模型'],
    
    async call(args: string, context: AgentContext): Promise<string> {
      // 启动模型配置界面
      return 'LAUNCH_MODEL_CONFIG'
    },
    
    userFacingName: () => 'model'
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

📝 创作命令:
  /write <主题>             直接写作文章
  /draft <主题>             快速起草内容
  /compose <类型> <主题>    指定类型创作

✨ 内容优化:
  /polish [内容]            润色和优化文本
  /expand <内容>            扩展内容深度
  /simplify <内容>          简化内容表达
  /continue [文件]          续写内容

🔧 工具命令:
  /grammar [内容]           语法检查和纠错
  /summarize <内容>         总结和提炼要点
  /translate <语言> <内容>  翻译文本内容
  /check [内容]             事实核查验证

📚 研究命令:
  /outline <主题>           生成文章大纲
  /research <主题>          深度主题研究
  /rewrite <风格> <内容>    智能改写内容
  /style <风格> [内容]      调整写作风格

💾 文件命令:
  /read <文件路径>          读取文件内容
  /edit <文件路径>          编辑文件
  /search <关键词>          搜索内容

📤 发布命令:
  /publish <平台> <文件>    发布到平台
  /format <格式> <文件>     格式转换

⚙️ 系统命令:
  /model [模型名]           设置AI模型
  /settings                 打开设置界面
  /status                   查看系统状态
  /clear                    清除会话历史

💡 使用技巧:
  - 命令支持中英文别名 (如 /语法 等同于 /grammar)
  - 使用 /help <命令> 查看详细说明
  - 文件命令支持相对路径 (./file) 和绝对路径 (/path/to/file)
  - 大部分命令支持直接文本输入或文件路径输入

🚀 快速开始:
> /help grammar              查看语法检查详细用法
> /write AI技术发展趋势      直接创作文章
> /polish ./draft.md         润色文件内容
> /translate 英文 你好世界   翻译文本内容`
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