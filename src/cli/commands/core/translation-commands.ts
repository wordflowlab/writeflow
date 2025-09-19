import { SlashCommand } from '../../../types/command.js'
import { AgentContext } from '../../../types/agent.js'

/**
 * 翻译类命令：translate
 * 负责文本翻译功能
 */
export const translationCommands: SlashCommand[] = [
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
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      const [targetLang, ...contentParts] = _args.split(' ')
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
  }
]