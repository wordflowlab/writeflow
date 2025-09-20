import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { StyleAdaptationResult, AIWritingConfig } from '../../types/writing.js'

/**
 * StyleAdapter 工具
 * 文章风格调整工具
 */
export class StyleAdapterTool implements WritingTool {
  name = 'style_adapter'
  description = '调整文章写作风格'
  securityLevel = 'ai-powered' as const

  constructor(private config: AIWritingConfig) {}

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        content,
        targetStyle,
        currentStyle,
        preserveLength = false,
        analyzeDifferences = true
      } = input as {
        content: string
        targetStyle: string
        currentStyle?: string
        preserveLength?: boolean
        analyzeDifferences?: boolean
      }

      if (!content || !targetStyle) {
        return {
          success: false,
          error: '缺少内容或目标风格参数'
        }
      }

      // 分析当前风格（如果未指定）
      if (!currentStyle) {
        const detectedStyle = await this.detectCurrentStyle(content)
        input.currentStyle = detectedStyle
      }

      // 执行风格转换
      const adaptationResult = await this.adaptStyle(
        content, 
        targetStyle, 
        currentStyle || input.currentStyle,
        { preserveLength, analyzeDifferences }
      )

      return {
        success: true,
        content: this.formatAdaptationResult(adaptationResult),
        metadata: {
          ...adaptationResult,
          adaptedAt: new Date().toISOString()
        }
      }

    } catch (_error) {
      return {
        success: false,
        error: `风格调整失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 检测当前文本风格
   */
  private async detectCurrentStyle(content: string): Promise<string> {
    // 简化的风格检测逻辑
    const indicators = {
      academic: [
        /因此|然而|此外|综上所述|根据.*研究/g,
        /参考文献|如表.*所示|图.*显示/g,
        /实验结果表明|数据分析显示/g
      ],
      technical: [
        /API|SDK|框架|架构|算法/g,
        /系统|模块|组件|接口/g,
        /实现|部署|配置|优化/g
      ],
      marketing: [
        /卓越的|领先的|创新的|突破性的/g,
        /解决方案|助力|赋能|提升/g,
        /立即|马上|现在就|不要错过/g
      ],
      popular: [
        /大家|我们|你|简单来说/g,
        /其实|当然|比如|举个例子/g,
        /很好|不错|厉害|太棒了/g
      ]
    }

    let bestMatch = 'general'
    let maxScore = 0

    for (const [style, patterns] of Object.entries(indicators)) {
      let score = 0
      for (const pattern of patterns) {
        const matches = content.match(pattern)
        if (matches) score += matches.length
      }
      
      if (score > maxScore) {
        maxScore = score
        bestMatch = style
      }
    }

    return bestMatch
  }

  /**
   * 执行风格转换
   */
  private async adaptStyle(
    content: string, 
    targetStyle: string, 
    currentStyle: string,
    options: { preserveLength: boolean; analyzeDifferences: boolean }
  ): Promise<StyleAdaptationResult> {
    
    // 构建风格转换提示词
    const systemPrompt = this.buildStyleSystemPrompt(currentStyle, targetStyle, options)
    const userPrompt = this.buildStyleUserPrompt(content, currentStyle, targetStyle)

    // 执行风格转换
    const adaptedText = await this.performStyleTransformation(content, targetStyle)

    // 分析变更
    const changes = options.analyzeDifferences 
      ? this.analyzeStyleChanges(content, adaptedText, currentStyle, targetStyle)
      : []

    // 计算风格指标
    const styleMetrics = this.calculateStyleMetrics(adaptedText)

    return {
      originalText: content,
      adaptedText,
      changes,
      styleMetrics
    }
  }

  /**
   * 构建风格转换系统提示词
   */
  private buildStyleSystemPrompt(
    currentStyle: string, 
    targetStyle: string, 
    options: { preserveLength: boolean }
  ): string {
    const styleGuides = {
      academic: {
        description: '学术论文风格：严谨、客观、使用第三人称，引用数据和研究',
        vocabulary: '使用专业术语，避免口语化表达',
        structure: '逻辑清晰，论证严密，结构完整',
        tone: '客观中性，避免情感化表达'
      },
      technical: {
        description: '技术文档风格：准确、详细、注重实用性',
        vocabulary: '使用准确的技术术语，提供具体的实现细节',
        structure: '步骤清晰，条理分明，便于操作',
        tone: '专业权威，简洁明了'
      },
      marketing: {
        description: '营销文案风格：吸引人、有说服力、行动导向',
        vocabulary: '使用有力的形容词，强调价值和益处',
        structure: '突出卖点，层层递进，引导行动',
        tone: '热情积极，充满感染力'
      },
      popular: {
        description: '通俗易懂风格：简单直白、贴近生活、易于理解',
        vocabulary: '使用日常用语，避免专业术语',
        structure: '逻辑简单，举例说明，通俗易懂',
        tone: '亲切自然，平易近人'
      }
    }

    const currentGuide = styleGuides[currentStyle as keyof typeof styleGuides] || {
      description: '一般风格',
      vocabulary: '普通词汇',
      structure: '常规结构',
      tone: '中性语调'
    }
    
    const targetGuide = styleGuides[targetStyle as keyof typeof styleGuides] || currentGuide

    return `你是一个专业的文本风格转换专家。

当前风格特征：
- ${currentGuide.description}
- 词汇：${currentGuide.vocabulary}
- 结构：${currentGuide.structure}
- 语调：${currentGuide.tone}

目标风格特征：
- ${targetGuide.description}
- 词汇：${targetGuide.vocabulary}
- 结构：${targetGuide.structure}
- 语调：${targetGuide.tone}

转换原则：
1. 保持核心信息和观点不变
2. 调整词汇选择和表达方式
3. 重新组织句子结构
4. 调整语调和措辞
5. 确保目标风格的一致性
${options.preserveLength ? '6. 尽量保持与原文相近的长度' : ''}

请确保转换后的文本符合目标风格的特征和要求。`
  }

  /**
   * 构建风格转换用户提示词
   */
  private buildStyleUserPrompt(content: string, currentStyle: string, targetStyle: string): string {
    return `请将以下${currentStyle}风格的文本转换为${targetStyle}风格：

原文：
${content}

请确保：
1. 保持原文的核心信息和观点
2. 完全符合${targetStyle}风格的特征
3. 表达自然流畅，符合目标读者的阅读习惯
4. 保持逻辑清晰和结构合理`
  }

  /**
   * 执行风格转换
   */
  private async performStyleTransformation(content: string, targetStyle: string): Promise<string> {
    // 模拟风格转换
    // 实际实现中会调用 Anthropic API
    
    const transformations = {
      academic: (text: string) => text
        .replace(/我认为/g, '研究表明')
        .replace(/很好/g, '显著有效')
        .replace(/大家都知道/g, '众所周知')
        .replace(/比如/g, '例如')
        .replace(/所以/g, '因此'),
        
      technical: (text: string) => text
        .replace(/方法/g, '解决方案')
        .replace(/做/g, '实现')
        .replace(/用/g, '使用')
        .replace(/好的/g, '最佳的')
        .replace(/问题/g, '技术挑战'),
        
      marketing: (text: string) => text
        .replace(/好的/g, '卓越的')
        .replace(/有用/g, '极具价值')
        .replace(/可以/g, '能够助您')
        .replace(/效果/g, '突破性效果')
        .replace(/解决/g, '完美解决'),
        
      popular: (text: string) => text
        .replace(/因此/g, '所以')
        .replace(/然而/g, '但是')
        .replace(/此外/g, '另外')
        .replace(/综上所述/g, '总的来说')
        .replace(/实现/g, '做到')
    }

    const transformer = transformations[targetStyle as keyof typeof transformations]
    return transformer ? transformer(content) : content
  }

  /**
   * 分析风格变更
   */
  private analyzeStyleChanges(
    original: string, 
    adapted: string, 
    currentStyle: string, 
    targetStyle: string
  ) {
    const changes = []
    
    // 简化的变更检测
    const originalWords = original.split(/\s+/)
    const adaptedWords = adapted.split(/\s+/)
    
    // 这里可以实现更复杂的差异分析
    // 当前提供一个简化版本
    
    if (originalWords.length !== adaptedWords.length) {
      changes.push({
        type: 'structure' as const,
        original: `${originalWords.length} 个词`,
        adapted: `${adaptedWords.length} 个词`,
        reason: '调整了文本长度以适应新风格'
      })
    }

    return changes
  }

  /**
   * 计算风格指标
   */
  private calculateStyleMetrics(text: string) {
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim())
    const words = text.split(/\s+/).filter(w => w.trim())
    const avgSentenceLength = words.length / sentences.length
    
    // 简化的可读性评分（基于句子长度）
    const readabilityScore = Math.max(0, Math.min(100, 100 - (avgSentenceLength - 15) * 2))
    
    // 简化的正式度评分（基于特定词汇）
    const formalWords = (text.match(/因此|然而|此外|综上所述|根据|研究表明/g) || []).length
    const informalWords = (text.match(/大家|我们|你|其实|比如|举个例子/g) || []).length
    const formalityLevel = formalWords > informalWords ? 70 : 30
    
    // 简化的技术密度评分
    const techWords = (text.match(/API|SDK|系统|模块|框架|算法|实现|配置/g) || []).length
    const technicalDensity = Math.min(100, (techWords / words.length) * 1000)

    return {
      readabilityScore,
      formalityLevel,
      technicalDensity
    }
  }

  /**
   * 格式化结果用于显示
   */
  private formatAdaptationResult(result: StyleAdaptationResult): string {
    let output = `# 风格调整结果\n\n`
    
    output += `## 调整后内容\n${result.adaptedText}\n\n`
    
    if (result.changes.length > 0) {
      output += `## 主要变更\n`
      result.changes.forEach((change, index) => {
        output += `${index + 1}. **${change.type}**: ${change.original} → ${change.adapted}\n`
        output += `   ${change.reason}\n\n`
      })
    }
    
    output += `## 风格指标\n`
    output += `- 可读性评分: ${result.styleMetrics.readabilityScore.toFixed(1)}/100\n`
    output += `- 正式度: ${result.styleMetrics.formalityLevel.toFixed(1)}/100\n`
    output += `- 技术密度: ${result.styleMetrics.technicalDensity.toFixed(1)}/100\n`

    return output
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { content, targetStyle } = input as { content?: string; targetStyle?: string }
    return Boolean(content && targetStyle && content.trim().length > 0)
  }
}