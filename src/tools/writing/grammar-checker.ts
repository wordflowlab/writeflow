import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { GrammarCheck, GrammarCheckResult, AIWritingConfig } from '../../types/writing.js'

/**
 * GrammarChecker 工具
 * 语法和拼写检查工具
 */
export class GrammarCheckerTool implements WritingTool {
  name = 'grammar_checker'
  description = '检查语法和拼写错误'
  securityLevel = 'ai-powered' as const

  constructor(private config: AIWritingConfig) {}

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const {
        content,
        language = '中文',
        checkGrammar = true,
        checkSpelling = true,
        checkPunctuation = true,
        checkStyle = true,
        autoCorrect = false
      } = input as {
        content: string
        language?: string
        checkGrammar?: boolean
        checkSpelling?: boolean
        checkPunctuation?: boolean
        checkStyle?: boolean
        autoCorrect?: boolean
      }

      if (!content) {
        return {
          success: false,
          error: '缺少内容参数'
        }
      }

      // 执行语法检查
      const checkResult = await this.performGrammarCheck(content, {
        language,
        checkGrammar,
        checkSpelling,
        checkPunctuation,
        checkStyle
      })

      // 生成修正后的文本（如果需要）
      let correctedText = content
      if (autoCorrect && checkResult.issues.length > 0) {
        correctedText = this.applyCorrections(content, checkResult.issues)
      }

      const result: GrammarCheckResult = {
        ...checkResult,
        correctedText
      }

      return {
        success: true,
        content: this.formatCheckResult(result),
        metadata: {
          ...result,
          checkedAt: new Date().toISOString(),
          language,
          options: {
            checkGrammar,
            checkSpelling,
            checkPunctuation,
            checkStyle,
            autoCorrect
          }
        }
      }

    } catch (_error) {
      return {
        success: false,
        error: `语法检查失败: ${(_error as Error).message}`
      }
    }
  }

  /**
   * 执行语法检查
   */
  private async performGrammarCheck(
    content: string, 
    options: {
      language: string
      checkGrammar: boolean
      checkSpelling: boolean
      checkPunctuation: boolean
      checkStyle: boolean
    }
  ): Promise<Omit<GrammarCheckResult, 'correctedText'>> {
    
    const issues: GrammarCheck[] = []

    // 语法检查
    if (options.checkGrammar) {
      const grammarIssues = await this.checkGrammar(content)
      issues.push(...grammarIssues)
    }

    // 拼写检查
    if (options.checkSpelling) {
      const spellingIssues = await this.checkSpelling(content)
      issues.push(...spellingIssues)
    }

    // 标点符号检查
    if (options.checkPunctuation) {
      const punctuationIssues = await this.checkPunctuation(content)
      issues.push(...punctuationIssues)
    }

    // 风格检查
    if (options.checkStyle) {
      const styleIssues = await this.checkStyle(content)
      issues.push(...styleIssues)
    }

    // 统计信息
    const statistics = {
      totalIssues: issues.length,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      suggestionCount: issues.filter(i => i.severity === 'suggestion').length
    }

    return { issues, statistics }
  }

  /**
   * 语法检查
   */
  private async checkGrammar(content: string): Promise<GrammarCheck[]> {
    const issues: GrammarCheck[] = []
    const lines = content.split('\n')

    // 简化的中文语法检查规则
    const grammarRules = [
      {
        pattern: /的的/g,
        message: '重复使用"的"',
        type: 'grammar' as const,
        severity: 'warning' as const,
        suggestion: '删除重复的"的"'
      },
      {
        pattern: /很很/g,
        message: '重复使用副词',
        type: 'grammar' as const,
        severity: 'warning' as const,
        suggestion: '删除重复的副词'
      },
      {
        pattern: /因为.*所以/g,
        message: '"因为"和"所以"不应同时使用',
        type: 'grammar' as const,
        severity: 'error' as const,
        suggestion: '删除"因为"或"所以"其中之一'
      },
      {
        pattern: /虽然.*但是/g,
        message: '"虽然"和"但是"搭配使用是正确的',
        type: 'grammar' as const,
        severity: 'suggestion' as const,
        suggestion: '确保逻辑关系清晰'
      }
    ]

    lines.forEach((line, lineIndex) => {
      grammarRules.forEach(rule => {
        let match
        while ((match = rule.pattern.exec(line)) !== null) {
          issues.push({
            type: rule.type,
            severity: rule.severity,
            message: rule.message,
            position: {
              start: match.index,
              end: match.index + match[0].length,
              line: lineIndex + 1,
              column: match.index + 1
            },
            suggestions: [rule.suggestion],
            rule: rule.pattern.source
          })
        }
        rule.pattern.lastIndex = 0 // 重置正则表达式
      })
    })

    return issues
  }

  /**
   * 拼写检查
   */
  private async checkSpelling(content: string): Promise<GrammarCheck[]> {
    const issues: GrammarCheck[] = []
    
    // 常见拼写错误
    const spellingErrors = [
      { wrong: '即时', correct: '即使', _context: '即时.*也' },
      { wrong: '做为', correct: '作为', _context: '做为.*来说' },
      { wrong: '即然', correct: '既然', _context: '即然.*就' },
      { wrong: '既使', correct: '即使', _context: '既使.*也' }
    ]

    const lines = content.split('\n')
    
    lines.forEach((line, lineIndex) => {
      spellingErrors.forEach(error => {
        const regex = new RegExp(error.wrong, 'g')
        let match
        
        while ((match = regex.exec(line)) !== null) {
          issues.push({
            type: 'spelling',
            severity: 'error',
            message: `可能的拼写错误：${error.wrong}`,
            position: {
              start: match.index,
              end: match.index + error.wrong.length,
              line: lineIndex + 1,
              column: match.index + 1
            },
            suggestions: [error.correct],
            rule: 'spelling-check'
          })
        }
      })
    })

    return issues
  }

  /**
   * 标点符号检查
   */
  private async checkPunctuation(content: string): Promise<GrammarCheck[]> {
    const issues: GrammarCheck[] = []
    const lines = content.split('\n')

    const punctuationRules = [
      {
        pattern: /\s+[，。！？；：]/g,
        message: '标点符号前不应有空格',
        suggestion: '删除标点符号前的空格'
      },
      {
        pattern: /[，。！？；：]\S/g,
        message: '标点符号后应有空格或换行',
        suggestion: '在标点符号后添加空格'
      },
      {
        pattern: /[。！？]{2,}/g,
        message: '重复使用句末标点符号',
        suggestion: '删除多余的标点符号'
      },
      {
        pattern: /[，；：]{2,}/g,
        message: '重复使用句中标点符号',
        suggestion: '删除多余的标点符号'
      }
    ]

    lines.forEach((line, lineIndex) => {
      punctuationRules.forEach(rule => {
        let match
        while ((match = rule.pattern.exec(line)) !== null) {
          issues.push({
            type: 'punctuation',
            severity: 'warning',
            message: rule.message,
            position: {
              start: match.index,
              end: match.index + match[0].length,
              line: lineIndex + 1,
              column: match.index + 1
            },
            suggestions: [rule.suggestion],
            rule: 'punctuation-check'
          })
        }
        rule.pattern.lastIndex = 0
      })
    })

    return issues
  }

  /**
   * 风格检查
   */
  private async checkStyle(content: string): Promise<GrammarCheck[]> {
    const issues: GrammarCheck[] = []
    const lines = content.split('\n')

    const styleRules = [
      {
        pattern: /很.*很/g,
        message: '避免在同一句中重复使用"很"',
        suggestion: '使用更精确的形容词',
        severity: 'suggestion' as const
      },
      {
        pattern: /非常.*非常/g,
        message: '避免频繁使用"非常"',
        suggestion: '使用更具体的描述词',
        severity: 'suggestion' as const
      },
      {
        pattern: /的话/g,
        message: '"的话"通常是冗余的',
        suggestion: '考虑删除"的话"',
        severity: 'suggestion' as const
      },
      {
        pattern: /\.{4,}/g,
        message: '避免使用过多的省略号',
        suggestion: '使用标准的三个点省略号',
        severity: 'warning' as const
      }
    ]

    lines.forEach((line, lineIndex) => {
      styleRules.forEach(rule => {
        let match
        while ((match = rule.pattern.exec(line)) !== null) {
          issues.push({
            type: 'style',
            severity: rule.severity,
            message: rule.message,
            position: {
              start: match.index,
              end: match.index + match[0].length,
              line: lineIndex + 1,
              column: match.index + 1
            },
            suggestions: [rule.suggestion],
            rule: 'style-check'
          })
        }
        rule.pattern.lastIndex = 0
      })
    })

    return issues
  }

  /**
   * 应用修正
   */
  private applyCorrections(content: string, issues: GrammarCheck[]): string {
    let corrected = content
    
    // 按位置倒序排列，从后往前修正，避免位置偏移
    const sortedIssues = issues
      .filter(issue => issue.severity === 'error' && issue.suggestions.length > 0)
      .sort((a, b) => b.position.start - a.position.start)

    sortedIssues.forEach(issue => {
      const before = corrected.substring(0, issue.position.start)
      const after = corrected.substring(issue.position.end)
      corrected = before + issue.suggestions[0] + after
    })

    return corrected
  }

  /**
   * 格式化检查结果
   */
  private formatCheckResult(result: GrammarCheckResult): string {
    let output = `# 语法检查结果\n\n`

    // 统计信息
    output += `## 检查统计\n`
    output += `- 总问题数: ${result.statistics.totalIssues}\n`
    output += `- 错误: ${result.statistics.errorCount}\n`
    output += `- 警告: ${result.statistics.warningCount}\n`
    output += `- 建议: ${result.statistics.suggestionCount}\n\n`

    if (result.issues.length === 0) {
      output += `✅ 未发现语法问题！\n`
      return output
    }

    // 按类型分组显示问题
    const issuesByType = result.issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = []
      acc[issue.type].push(issue)
      return acc
    }, {} as Record<string, GrammarCheck[]>)

    Object.entries(issuesByType).forEach(([type, issues]) => {
      const typeNames = {
        grammar: '语法问题',
        spelling: '拼写问题',
        punctuation: '标点问题',
        style: '风格建议'
      }
      
      output += `## ${typeNames[type as keyof typeof typeNames] || type}\n\n`
      
      issues.forEach((issue, index) => {
        const severityIcons = {
          error: '❌',
          warning: '⚠️',
          suggestion: '💡'
        }
        
        output += `${index + 1}. ${severityIcons[issue.severity]} **第${issue.position.line}行，第${issue.position.column}列**\n`
        output += `   ${issue.message}\n`
        if (issue.suggestions.length > 0) {
          output += `   建议: ${issue.suggestions.join('、')}\n`
        }
        output += `\n`
      })
    })

    return output
  }

  async validateInput(input: ToolInput): Promise<boolean> {
    const { content } = input as { content?: string }
    return Boolean(content && content.trim().length > 0)
  }
}