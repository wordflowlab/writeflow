import { SlashCommand } from '../../../types/command.js'
import { AgentContext } from '../../../types/agent.js'

/**
 * 写作类命令：write, draft, compose, continue
 * 负责各种写作任务的执行
 */
export const writingCommands: SlashCommand[] = [
  {
    type: 'prompt',
    name: 'write',
    description: '任务驱动的精确写作',
    aliases: ['写作', 'w'],
    usage: '/write <具体任务或主题>',
    examples: [
      '/write Task 1.1: 引言部分写作',
      '/write "为React性能优化文章写作引言部分"',
      '/write AI代理技术发展趋势',
      '/write 如何构建高性能Web应用'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      if (!args.trim()) {
        throw new Error('请提供写作任务或主题。用法: /write <具体任务或主题>')
      }

      const input = args.trim()
      
      // 检测是否为任务驱动的写作（包含Task关键词或具体任务描述）
      const isTaskDriven = input.includes('Task ') || 
                          input.includes('任务') ||
                          input.includes('部分写作') ||
                          input.includes('章节写作') ||
                          input.includes('引言') ||
                          input.includes('结论')
      
      if (isTaskDriven) {
        // 任务驱动的精确写作模式
        return `请基于具体任务执行精确的写作：

任务要求：${input}

## 🎯 任务驱动写作要求

### 阶段1: 任务理解和分析
- 仔细分析任务的具体要求和目标
- 理解在整体文章中的位置和作用
- 确认字数要求和质量标准

### 阶段2: 上下文整合
- 查阅前面的写作规范和内容计划
- 理解与其他部分的逻辑关系
- 确保风格和语调的一致性

### 阶段3: 精确内容创作
请严格按照任务要求创作内容，确保：

#### 内容质量要求
1. **目标明确**: 每个段落都有明确的目的
2. **逻辑清晰**: 论点论据关系清楚
3. **材料充分**: 使用恰当的案例、数据、引用
4. **风格统一**: 保持与整体文章风格一致
5. **读者导向**: 始终考虑目标读者的需求

#### 任务执行检查
- [ ] 是否完全满足任务描述的要求？
- [ ] 内容是否达到预期的字数和深度？
- [ ] 是否与前后文逻辑连贯？
- [ ] 是否符合原始写作规范？

#### 输出格式
请提供：
1. **完整的任务内容**: 符合要求的完整文本
2. **任务完成报告**: 说明如何满足任务要求
3. **下一步建议**: 建议后续的写作任务

请开始执行这个具体的写作任务，确保内容精确、有针对性。`
      } else {
        // 传统的主题写作模式（保持兼容）
        return `请根据以下主题写作一篇文章：

主题：${input}

## 📝 写作要求

### 文章结构
1. **引言部分**: 提出问题，阐述价值，预告结构
2. **主体部分**: 3-4个核心章节，逐步展开论述
3. **结论部分**: 总结观点，提供建议，展望未来

### 质量标准
1. **结构清晰**: 逻辑连贯，层次分明
2. **语言流畅**: 表达准确，可读性强
3. **内容充实**: 适当使用例子和数据支撑观点
4. **专业平衡**: 保持专业性和可读性平衡
5. **实用价值**: 为读者提供有价值的见解

### 写作建议
- 开篇要吸引读者注意，明确文章价值
- 主体部分要有清晰的论点和充分的论证
- 结论要呼应开头，并提供实践建议
- 全文保持统一的语调和风格

💡 **提示**: 如需更精确的写作指导，建议先使用规范驱动写作流程：
\`/specify → /plan → /task → /write <具体任务>\`

请创作一篇完整的、有价值的文章内容。`
      }
    },
    
    allowedTools: [
      'web_search', 'read_article', 'write_article', 'citation_manager',
      'task_manager', 'context_analyzer'
    ],
    progressMessage: '正在执行写作任务...',
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
    description: '组合式创意写作',
    aliases: ['创作', '组合写作'],
    usage: '/compose <创作主题>',
    examples: [
      '/compose 技术博客：我的编程之路',
      '/compose 产品介绍：AI写作助手的功能特色',
      '/compose 技术分享：前端性能优化经验'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      if (!args.trim()) {
        throw new Error('请提供创作主题。用法: /compose <创作主题>')
      }

      const topic = args.trim()
      
      return `请进行组合式创意写作，主题如下：

创作主题：${topic}

创作要求：
1. 结合创意思维和实用价值
2. 采用多元化的表达方式
3. 融入个人见解和经验
4. 保持内容的趣味性和可读性
5. 确保信息的准确性和专业性

写作风格：
- 语言生动，富有感染力
- 结构灵活，富有变化
- 内容深入浅出，雅俗共赏
- 观点独特，具有启发性

请创作一篇有创意、有深度的文章。`
    },
    
    allowedTools: ['web_search', 'read_article', 'write_article', 'citation_manager'],
    progressMessage: '正在进行创意写作',
    userFacingName: () => 'compose'
  },

  {
    type: 'prompt',
    name: 'continue',
    description: '续写内容',
    aliases: ['续写', 'cont'],
    usage: '/continue <需要续写的内容>',
    examples: [
      '/continue 这篇关于AI发展的文章需要继续...',
      '/continue 前面的技术分析还不够深入，需要...',
      '/continue 请基于前面的内容继续写下一部分'
    ],
    
    async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
      if (!args.trim()) {
        throw new Error('请提供需要续写的内容或描述。用法: /continue <需要续写的内容>')
      }

      const content = args.trim()
      
      return `请基于以下内容进行续写：

现有内容/续写要求：${content}

续写要求：
1. 保持与前文的连贯性和一致性
2. 延续原有的语言风格和论证逻辑
3. 深化或扩展核心观点
4. 确保内容的自然过渡
5. 维持整体文章的质量水准

续写策略：
- 仔细分析前文的核心思路
- 识别可以进一步展开的要点
- 保持相同的写作风格和语调
- 确保逻辑的自然延续
- 适当补充新的支撑材料

请提供高质量的续写内容。`
    },
    
    allowedTools: ['read_article', 'write_article', 'content_analyzer'],
    progressMessage: '正在续写内容',
    userFacingName: () => 'continue'
  }
]