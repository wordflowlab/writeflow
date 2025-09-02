import { describe, test, expect, beforeEach } from '@jest/globals'
import { GrammarCheckerTool } from '@/tools/writing/grammar-checker.js'
import { AIWritingConfig, GrammarCheck } from '@/types/writing.js'

describe('GrammarCheckerTool', () => {
  let grammarTool: GrammarCheckerTool
  let config: AIWritingConfig

  beforeEach(() => {
    config = {
      anthropicApiKey: 'test-key',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: 4000
    }
    
    grammarTool = new GrammarCheckerTool(config)
  })

  test('应该检测语法错误', async () => {
    const content = '因为天气很好所以我们出去玩。这个方法的的效果很很好。'
    
    const result = await grammarTool.execute({
      content,
      checkGrammar: true
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.issues).toBeDefined()
    
    const grammarIssues = result.metadata?.issues.filter((issue: GrammarCheck) => issue.type === 'grammar')
    expect(grammarIssues.length).toBeGreaterThan(0)
  })

  test('应该检测拼写错误', async () => {
    const content = '做为一个开发者，即然选择了这条路，即时遇到困难也要坚持。'
    
    const result = await grammarTool.execute({
      content,
      checkSpelling: true
    })
    
    expect(result.success).toBe(true)
    
    const spellingIssues = result.metadata?.issues.filter((issue: GrammarCheck) => issue.type === 'spelling')
    expect(spellingIssues.length).toBeGreaterThan(0)
    
    // 检查是否提供了正确建议
    const suggestions = spellingIssues.flatMap((issue: GrammarCheck) => issue.suggestions)
    expect(suggestions).toContain('作为')
    expect(suggestions).toContain('既然')
  })

  test('应该检测标点符号问题', async () => {
    const content = '这是一个测试 ，标点符号有问题。还有这个问题！！！'
    
    const result = await grammarTool.execute({
      content,
      checkPunctuation: true
    })
    
    expect(result.success).toBe(true)
    
    const punctuationIssues = result.metadata?.issues.filter((issue: GrammarCheck) => issue.type === 'punctuation')
    expect(punctuationIssues.length).toBeGreaterThan(0)
  })

  test('应该提供风格建议', async () => {
    const content = '这个功能非常非常好，很棒很棒的话，用户会很喜欢的话。'
    
    const result = await grammarTool.execute({
      content,
      checkStyle: true
    })
    
    expect(result.success).toBe(true)
    
    const styleIssues = result.metadata?.issues.filter((issue: GrammarCheck) => issue.type === 'style')
    expect(styleIssues.length).toBeGreaterThan(0)
  })

  test('应该支持自动修正', async () => {
    const content = '做为开发者，即然选择了这条路就要坚持。'
    
    const result = await grammarTool.execute({
      content,
      autoCorrect: true,
      checkSpelling: true
    })
    
    expect(result.success).toBe(true)
    expect(result.metadata?.correctedText).toBeDefined()
    expect(result.metadata?.correctedText).toContain('作为')
    expect(result.metadata?.correctedText).toContain('既然')
  })

  test('应该提供准确的统计信息', async () => {
    const content = '因为天气好所以出门。做为程序员，即然写代码就要写好。这很很好！！'
    
    const result = await grammarTool.execute({
      content,
      checkGrammar: true,
      checkSpelling: true,
      checkPunctuation: true
    })
    
    expect(result.success).toBe(true)
    
    const stats = result.metadata?.statistics
    expect(stats?.totalIssues).toBeGreaterThan(0)
    expect(stats?.errorCount + stats?.warningCount + stats?.suggestionCount).toBe(stats?.totalIssues)
  })

  test('应该处理不同严重级别的问题', async () => {
    const content = '因为所以，做为开发者，这很很好。'
    
    const result = await grammarTool.execute({
      content,
      checkGrammar: true,
      checkSpelling: true
    })
    
    expect(result.success).toBe(true)
    
    const issues = result.metadata?.issues
    const hasErrors = issues.some((issue: GrammarCheck) => issue.severity === 'error')
    const hasWarnings = issues.some((issue: GrammarCheck) => issue.severity === 'warning')
    
    expect(hasErrors).toBe(true) // 应该有语法错误
    expect(hasWarnings).toBe(true) // 应该有拼写警告
  })

  test('应该为无问题的内容返回成功结果', async () => {
    const content = '这是一段语法正确、拼写准确的中文内容。'
    
    const result = await grammarTool.execute({
      content,
      checkGrammar: true,
      checkSpelling: true,
      checkPunctuation: true
    })
    
    expect(result.success).toBe(true)
    expect(result.content).toContain('未发现语法问题')
  })

  test('应该提供位置信息', async () => {
    const content = `第一行内容
做为第二行内容
第三行内容`
    
    const result = await grammarTool.execute({
      content,
      checkSpelling: true
    })
    
    expect(result.success).toBe(true)
    
    const spellingIssues = result.metadata?.issues.filter((issue: GrammarCheck) => issue.type === 'spelling')
    expect(spellingIssues.length).toBeGreaterThan(0)
    
    const firstIssue = spellingIssues[0]
    expect(firstIssue.position.line).toBe(2) // "做为" 在第二行
    expect(firstIssue.position.column).toBeGreaterThan(0)
  })

  test('应该正确验证输入', async () => {
    // 有效输入
    const valid = await grammarTool.validateInput({
      content: '有效的测试内容'
    })
    expect(valid).toBe(true)

    // 无效输入 - 缺少内容
    const invalid1 = await grammarTool.validateInput({})
    expect(invalid1).toBe(false)

    // 无效输入 - 空内容
    const invalid2 = await grammarTool.validateInput({
      content: ''
    })
    expect(invalid2).toBe(false)

    // 无效输入 - 只有空格
    const invalid3 = await grammarTool.validateInput({
      content: '   '
    })
    expect(invalid3).toBe(false)
  })

  test('应该支持选择性检查', async () => {
    const content = '做为开发者 ，这很很好！！'
    
    // 只检查拼写
    const spellingOnlyResult = await grammarTool.execute({
      content,
      checkGrammar: false,
      checkSpelling: true,
      checkPunctuation: false,
      checkStyle: false
    })
    
    expect(spellingOnlyResult.success).toBe(true)
    const issues = spellingOnlyResult.metadata?.issues || []
    expect(issues.every((issue: GrammarCheck) => issue.type === 'spelling')).toBe(true)
  })
})