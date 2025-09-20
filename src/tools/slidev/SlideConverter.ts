/**
 * Slidev 转换器工具
 * 将 Markdown 文章智能转换为 Slidev 演示文稿
 */

import { Tool } from '../../Tool.js'

export interface SlideConverterInput {
  markdown: string
  options?: {
    splitBy?: 'h1' | 'h2' | 'h3' | 'section' | 'auto'
    maxSlides?: number
    theme?: string
    includeNotes?: boolean
    preserveCodeBlocks?: boolean
    addAnimations?: boolean
    aspectRatio?: string
  }
}

export interface SlideConverterOutput {
  success: boolean
  content?: string
  conversionReport?: {
    originalLength: number
    slideCount: number
    droppedContent: string[]
    suggestions: string[]
  }
  error?: string
}

export class SlideConverter implements Tool {
  name = 'SlideConverter'
  
  description = 'Convert Markdown articles to Slidev presentations'

  async execute(input: SlideConverterInput): Promise<SlideConverterOutput> {
    try {
      const options = input.options || {}
      
      // 解析 Markdown 结构
      const structure = this.parseMarkdownStructure(input.markdown)
      
      // 智能分割内容
      const segments = this.intelligentSplit(structure, {
        strategy: options.splitBy || 'auto',
        targetSlides: options.maxSlides || 20,
        preserveCode: options.preserveCodeBlocks !== false
      })
      
      // 优化每个片段
      const optimizedSegments = segments.map(segment => 
        this.optimizeSegment(segment, options)
      )
      
      // 生成 Slidev 内容
      const slidevContent = this.generateSlidevContent(optimizedSegments, {
        theme: options.theme || 'default',
        aspectRatio: options.aspectRatio || '16/9',
        title: structure.title || 'Presentation'
      })
      
      // 生成转换报告
      const report = this.generateConversionReport(
        input.markdown,
        slidevContent,
        segments
      )
      
      return {
        success: true,
        content: slidevContent,
        conversionReport: report
      }
    } catch (_error) {
      return {
        success: false,
        error: `转换失败: ${_error instanceof Error ? _error.message : String(_error)}`
      }
    }
  }

  /**
   * 解析 Markdown 结构
   */
  private parseMarkdownStructure(markdown: string): any {
    const lines = markdown.split('\n')
    const structure = {
      title: '',
      sections: [] as any[],
      metadata: {} as any
    }

    let currentSection: any = null
    let currentSubsection: any = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // H1 标题
      if (line.startsWith('# ')) {
        if (!structure.title) {
          structure.title = line.substring(2).trim()
        } else {
          if (currentSection) {
            structure.sections.push(currentSection)
          }
          currentSection = {
            title: line.substring(2).trim(),
            content: [],
            subsections: []
          }
          currentSubsection = null
        }
      }
      // H2 标题
      else if (line.startsWith('## ')) {
        if (currentSection) {
          if (currentSubsection) {
            currentSection.subsections.push(currentSubsection)
          }
          currentSubsection = {
            title: line.substring(3).trim(),
            content: []
          }
        }
      }
      // 内容行
      else {
        if (currentSubsection) {
          currentSubsection.content.push(line)
        } else if (currentSection) {
          currentSection.content.push(line)
        }
      }
    }

    // 添加最后的部分
    if (currentSubsection && currentSection) {
      currentSection.subsections.push(currentSubsection)
    }
    if (currentSection) {
      structure.sections.push(currentSection)
    }

    return structure
  }

  /**
   * 智能分割内容
   */
  private intelligentSplit(structure: any, config: any): any[] {
    const segments: any[] = []
    
    if (config.strategy === 'auto') {
      // 自动策略：基于内容密度和逻辑关系
      return this.autoSplit(structure, config.targetSlides)
    }
    
    // 基于标题级别分割
    if (config.strategy === 'h1') {
      structure.sections.forEach((section: any) => {
        segments.push({
          title: section.title,
          content: this.formatContent(section),
          type: 'section'
        })
      })
    } else if (config.strategy === 'h2') {
      structure.sections.forEach((section: any) => {
        // 章节标题页
        segments.push({
          title: section.title,
          content: section.content.join('\n'),
          type: 'section-title'
        })
        
        // 子章节页
        section.subsections.forEach((subsection: any) => {
          segments.push({
            title: subsection.title,
            content: subsection.content.join('\n'),
            type: 'subsection'
          })
        })
      })
    }
    
    return segments
  }

  /**
   * 自动分割策略
   */
  private autoSplit(structure: any, targetSlides: number): any[] {
    const segments: any[] = []
    const totalContent = this.calculateTotalContent(structure)
    const contentPerSlide = Math.ceil(totalContent / targetSlides)
    
    structure.sections.forEach((section: any) => {
      const sectionContent = this.calculateSectionContent(section)
      
      if (sectionContent <= contentPerSlide) {
        // 整个章节作为一页
        segments.push({
          title: section.title,
          content: this.formatContent(section),
          type: 'section'
        })
      } else {
        // 分割章节
        segments.push({
          title: section.title,
          content: section.content.slice(0, 5).join('\n'),
          type: 'section-title'
        })
        
        section.subsections.forEach((subsection: any) => {
          segments.push({
            title: subsection.title,
            content: subsection.content.join('\n'),
            type: 'subsection'
          })
        })
      }
    })
    
    return segments
  }

  /**
   * 优化片段内容
   */
  private optimizeSegment(segment: any, options: any): any {
    let content = segment.content
    
    // 精简内容
    content = this.simplifyContent(content)
    
    // 添加动画标记
    if (options.addAnimations) {
      content = this.addAnimationMarkers(content)
    }
    
    // 优化代码块
    if (options.preserveCodeBlocks) {
      content = this.optimizeCodeBlocks(content)
    }
    
    return {
      ...segment,
      content,
      layout: this.selectLayout(segment)
    }
  }

  /**
   * 生成 Slidev 内容
   */
  private generateSlidevContent(segments: any[], config: any): string {
    const parts: string[] = []
    
    // Headmatter
    parts.push(`---
theme: ${config.theme}
title: ${config.title}
aspectRatio: ${config.aspectRatio}
highlighter: shiki
monaco: true
mdc: true
---`)
    
    // 封面
    parts.push(`
# ${config.title}

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始 <carbon:arrow-right class="inline"/>
  </span>
</div>`)
    
    // 内容页
    segments.forEach(segment => {
      const layout = segment.layout || 'default'
      
      parts.push(`---
layout: ${layout}
---

# ${segment.title}

${segment.content}`)
    })
    
    // 结尾页
    parts.push(`---
layout: end
---

# 谢谢

Questions?`)
    
    return parts.join('\n\n')
  }

  /**
   * 格式化内容
   */
  private formatContent(section: any): string {
    const parts: string[] = []
    
    if (section.content.length > 0) {
      parts.push(section.content.join('\n'))
    }
    
    section.subsections.forEach((sub: any) => {
      parts.push(`## ${sub.title}`)
      parts.push(sub.content.join('\n'))
    })
    
    return parts.join('\n\n')
  }

  /**
   * 计算内容量
   */
  private calculateTotalContent(structure: any): number {
    let total = 0
    structure.sections.forEach((section: any) => {
      total += this.calculateSectionContent(section)
    })
    return total
  }

  /**
   * 计算章节内容量
   */
  private calculateSectionContent(section: any): number {
    let count = section.content.length
    section.subsections.forEach((sub: any) => {
      count += sub.content.length
    })
    return count
  }

  /**
   * 精简内容
   */
  private simplifyContent(content: string): string {
    // 移除过长的段落
    const lines = content.split('\n')
    const simplified = lines.map(line => {
      if (line.length > 200 && !line.startsWith('```')) {
        // 截断过长的行
        return line.substring(0, 197) + '...'
      }
      return line
    })
    
    return simplified.join('\n')
  }

  /**
   * 添加动画标记
   */
  private addAnimationMarkers(content: string): string {
    // 为列表添加动画
    return content.replace(
      /^(\s*[-*]\s.+)$/gm,
      '<v-click>\n\n$1\n\n</v-click>'
    )
  }

  /**
   * 优化代码块
   */
  private optimizeCodeBlocks(content: string): string {
    // 为代码块添加高亮
    return content.replace(
      /```(\w+)\n([\s\S]*?)```/g,
      (match, lang, code) => {
        // 限制代码行数
        const lines = code.split('\n')
        if (lines.length > 15) {
          code = lines.slice(0, 15).join('\n') + '\n// ...'
        }
        return `\`\`\`${lang}\n${code}\n\`\`\``
      }
    )
  }

  /**
   * 选择布局
   */
  private selectLayout(segment: any): string {
    if (segment.type === 'section-title') {
      return 'center'
    }
    
    // 检测是否包含代码
    if (segment.content.includes('```')) {
      return 'two-cols'
    }
    
    // 检测是否包含图片
    if (segment.content.includes('![')) {
      return 'image'
    }
    
    return 'default'
  }

  /**
   * 生成转换报告
   */
  private generateConversionReport(original: string, converted: string, segments: any[]): any {
    return {
      originalLength: original.length,
      slideCount: segments.length + 2, // +封面和结尾
      droppedContent: [], // TODO: 实现内容丢失检测
      suggestions: [
        '建议手动调整部分幻灯片的布局',
        '可以添加更多视觉元素增强表现力',
        '考虑为关键内容添加演讲备注'
      ]
    }
  }
}

