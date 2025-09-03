import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

export interface SlideProjectInitInput extends ToolInput {
  dir: string
  title?: string
  theme?: string
}

/**
 * 生成标准 Slidev 项目（slides.md + 基础结构）
 */
export class SlideProjectInitTool implements WritingTool {
  name = 'SlidevProjectInit'
  description = 'Initialize a standard Slidev project with slides.md'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  async execute(input: SlideProjectInitInput): Promise<ToolResult> {
    const dir = resolve(input.dir || './slides')
    const title = input.title || '我的演示'
    const theme = input.theme || 'default'

    mkdirSync(dir, { recursive: true })

    // 读取模板（若存在），否则使用内置默认内容
    let head = `---\n` +
      `theme: ${theme}\n` +
      `title: ${title}\n` +
      `aspectRatio: 16/9\n` +
      `highlighter: shiki\n` +
      `monaco: true\n` +
      `mdc: true\n` +
      `---\n\n`

    let cover = '# ' + title + '\n\n> 开始你的演示吧！\n'
    const coverPath = resolve('src/templates/slidev/default/cover.md')
    if (existsSync(coverPath)) {
      try { cover = readFileSync(coverPath, 'utf-8').replace(/\{\{title\}\}/g, title) } catch {}
    }

    let end = '---\nlayout: end\n---\n\n# 谢谢\n\nQuestions?\n'
    const endPath = resolve('src/templates/slidev/default/end.md')
    if (existsSync(endPath)) {
      try { end = readFileSync(endPath, 'utf-8') } catch {}
    }

    const content = [
      head,
      cover,
      '\n---\n',
      '## 目录\n\n- 章节1\n- 章节2\n- 章节3\n',
      '\n---\n',
      '## 第一章\n\n- 要点 A\n- 要点 B\n',
      '\n---\n',
      end
    ].join('\n')

    writeFileSync(join(dir, 'slides.md'), content, 'utf-8')

    return {
      success: true,
      content: `已在 ${dir} 生成 slides.md`,
      metadata: { dir }
    }
  }
}

export default SlideProjectInitTool

