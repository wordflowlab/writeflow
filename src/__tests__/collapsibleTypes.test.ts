/**
 * 可折叠内容类型和工具函数测试
 */

import {
  DEFAULT_COLLAPSIBLE_OPTIONS,
  AUTO_COLLAPSE_THRESHOLDS,
  CONTENT_TYPE_PATTERNS
} from '../types/CollapsibleContent.js'

import {
  createTextBlock,
  createLongContentBlock,
  isCollapsibleBlock,
  getBlockText
} from '../types/UIMessage.js'

describe('CollapsibleContent 类型和常量', () => {
  it('应该有正确的默认配置', () => {
    expect(DEFAULT_COLLAPSIBLE_OPTIONS.maxLines).toBe(15)
    expect(DEFAULT_COLLAPSIBLE_OPTIONS.autoCollapse).toBe(true)
    expect(DEFAULT_COLLAPSIBLE_OPTIONS.contentType).toBe('long-text')
    expect(DEFAULT_COLLAPSIBLE_OPTIONS.showPreview).toBe(true)
    expect(DEFAULT_COLLAPSIBLE_OPTIONS.previewLines).toBe(3)
  })

  it('应该有正确的自动折叠阈值', () => {
    expect(AUTO_COLLAPSE_THRESHOLDS.lines).toBe(15)
    expect(AUTO_COLLAPSE_THRESHOLDS.characters).toBe(1000)
    expect(AUTO_COLLAPSE_THRESHOLDS.codeBlockLines).toBe(10)
    expect(AUTO_COLLAPSE_THRESHOLDS.toolOutputLines).toBe(8)
    expect(AUTO_COLLAPSE_THRESHOLDS.errorMessageLines).toBe(5)
  })

  it('应该有正确的内容类型模式', () => {
    expect(CONTENT_TYPE_PATTERNS['tool-execution']).toBeDefined()
    expect(CONTENT_TYPE_PATTERNS['code-block']).toBeDefined()
    expect(CONTENT_TYPE_PATTERNS['file-content']).toBeDefined()
    expect(CONTENT_TYPE_PATTERNS['error-message']).toBeDefined()
    expect(CONTENT_TYPE_PATTERNS['analysis-result']).toBeDefined()
  })
})

describe('UIMessage 扩展功能', () => {
  it('应该正确创建带可折叠状态的文本块', () => {
    const collapsibleState = {
      id: 'test-block',
      collapsed: true,
      autoCollapse: true,
      maxLines: 10
    }
    
    const renderMetadata = {
      estimatedLines: 20,
      hasLongContent: true,
      contentType: 'long-text' as const
    }
    
    const textBlock = createTextBlock('Test content', collapsibleState, renderMetadata)
    
    expect(textBlock.type).toBe('text')
    expect(textBlock.text).toBe('Test content')
    expect(textBlock.collapsible).toEqual(collapsibleState)
    expect(textBlock.renderMetadata).toEqual(renderMetadata)
  })

  it('应该正确创建长内容块', () => {
    const longContent = 'This is a very long content that should be collapsible'
    
    const longBlock = createLongContentBlock(
      longContent,
      'tool-execution',
      'Test Tool Output',
      { collapsed: true, maxLines: 5 },
      { toolName: 'TestTool' }
    )
    
    expect(longBlock.type).toBe('long_content')
    expect(longBlock.content).toBe(longContent)
    expect(longBlock.contentType).toBe('tool-execution')
    expect(longBlock.title).toBe('Test Tool Output')
    expect(longBlock.collapsible.collapsed).toBe(true)
    expect(longBlock.collapsible.maxLines).toBe(5)
    expect(longBlock.renderMetadata.toolName).toBe('TestTool')
  })

  it('应该正确检测可折叠块', () => {
    const normalTextBlock = createTextBlock('Normal text')
    const collapsibleTextBlock = createTextBlock('Collapsible text', {
      id: 'test',
      collapsed: false,
      autoCollapse: true,
      maxLines: 10
    })
    const longBlock = createLongContentBlock('Long content', 'long-text')
    
    expect(isCollapsibleBlock(normalTextBlock)).toBe(false)
    expect(isCollapsibleBlock(collapsibleTextBlock)).toBe(true)
    expect(isCollapsibleBlock(longBlock)).toBe(true)
  })

  it('应该正确提取块文本内容', () => {
    const textBlock = createTextBlock('Text content')
    const longBlock = createLongContentBlock('Long content', 'long-text')
    
    expect(getBlockText(textBlock)).toBe('Text content')
    expect(getBlockText(longBlock)).toBe('Long content')
  })
})

describe('内容类型检测', () => {
  it('应该正确检测工具执行内容', () => {
    const toolContent = '🔧 正在执行 Read 工具...'
    const pattern = CONTENT_TYPE_PATTERNS['tool-execution']
    
    expect(pattern.test(toolContent)).toBe(true)
  })

  it('应该正确检测代码块内容', () => {
    const codeContent = '```javascript\nfunction test() {}\n```'
    const pattern = CONTENT_TYPE_PATTERNS['code-block']
    
    expect(pattern.test(codeContent)).toBe(true)
  })

  it('应该正确检测文件内容', () => {
    const fileContent = '📄 文件: package.json'
    const pattern = CONTENT_TYPE_PATTERNS['file-content']
    
    expect(pattern.test(fileContent)).toBe(true)
  })

  it('应该正确检测错误消息', () => {
    const errorContent = '❌ 错误: 文件不存在'
    const pattern = CONTENT_TYPE_PATTERNS['error-message']
    
    expect(pattern.test(errorContent)).toBe(true)
  })

  it('应该正确检测分析结果', () => {
    const analysisContent = '📊 分析结果: 项目结构如下'
    const pattern = CONTENT_TYPE_PATTERNS['analysis-result']
    
    expect(pattern.test(analysisContent)).toBe(true)
  })
})