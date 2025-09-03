/**
 * Slidev PPT 相关命令
 * 通过 Agent 系统动态加载，避免污染主工具列表
 */

import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { AgentLoader } from '../../utils/agentLoader.js'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { SlideConverter } from '../../tools/slidev/SlideConverter.js'
import { spawnSync } from 'child_process'
import { readFileSync as rfs } from 'fs'


/**
 * 主 slide 命令
 */
export const slideCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide',
  description: 'Slidev PPT 创作命令',
  aliases: ['ppt', '演示', '幻灯片'],
  usage: '/slide <子命令> [选项]',
  examples: [
    '/slide create "AI Agent 架构设计" --duration=30',
    '/slide convert ./article.md --theme=seriph',
    '/slide outline "Rust 性能优化" --slides=15'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 加载 Slidev Agent
    const loader = AgentLoader.getInstance('slidev-ppt')
    const agent = await loader.loadAgent()

    // 解析子命令
    const [subcommand, ...rest] = args.split(' ')
    const params = rest.join(' ')

    // 构建带有 Agent 系统提示的 prompt
    let basePrompt = agent.systemPrompt + '\n\n'

    switch (subcommand) {
      case 'create':
      case '创建':
        basePrompt += await getCreatePrompt(params)
        break

      case 'convert':
      case '转换':
        basePrompt += await getConvertPrompt(params)
        break

      case 'outline':
      case '大纲':
        basePrompt += await getOutlinePrompt(params)
        break

      case 'optimize':
      case '优化':
        basePrompt += await getOptimizePrompt(params)
        break

      default:
        basePrompt += `用户请求: ${args}\n\n请根据用户需求，使用你的 Slidev 专业能力提供帮助。`
    }

    return basePrompt
  },

  allowedTools: ['SlidevProjectInit', 'SlideConverter', 'SlideExporter'],
  progressMessage: '正在处理 PPT 请求',
  userFacingName: () => 'slide'
}

/**
 * 创建演示文稿的 prompt
 */
async function getCreatePrompt(params: string): Promise<string> {
    // 解析参数
    const match = params.match(/^"([^"]+)"(.*)$/) || params.match(/^'([^']+)'(.*)$/)
    const title = match ? match[1] : params.split(' ')[0]
    const options = match ? match[2].trim() : params.substring(title.length).trim()

    // 提取选项
    const duration = extractOption(options, 'duration') || '20'
    const theme = extractOption(options, 'theme') || 'default'
    const style = extractOption(options, 'style') || 'technical'
    const audience = extractOption(options, 'audience') || 'developers'

    // 工具控制：默认不调用任何工具，仅在显式参数时调用
    const dir = extractOption(options, 'dir') || extractOption(options, 'initDir') || ''
    const exportFmt = extractOption(options, 'export') || ''

    const steps = [
      `请创建一个关于"${title}"的 Slidev 演示文稿。`,
      '',
      '要求：',
      `- 演讲时长：${duration} 分钟`,
      `- 主题风格：${theme}`,
      `- 演讲风格：${style}`,
      `- 目标听众：${audience}`,
      '',
      '请按以下步骤执行：',
      `1. 生成演讲大纲（${Math.ceil(parseInt(duration) / 2)} 页左右）`,
      '2. 为每页创建合适的内容',
      '3. 添加适当的动画和过渡效果',
      '4. 生成完整的 Slidev Markdown 文件',
      '',
      '确保：',
      '- 每页幻灯片聚焦一个核心观点',
      '- 包含代码示例（如果相关）',
      '- 使用 Slidev 的高级功能（动画、布局、组件等）',
      '- 生成演讲者备注',
      '',
      '工具使用策略：',
      dir
        ? `- 请调用工具 SlidevProjectInit，参数：{ dir: "${dir}", title: "${title}", theme: "${theme}" }，将生成的 Slidev Markdown 写入该目录的 slides.md`
        : '- 默认不调用任何工具，仅返回生成的 Slidev Markdown 文本',
      exportFmt
        ? `- 生成并写入完成后，请调用 SlideExporter，参数：{ target: "${dir || './slides'}", format: "${exportFmt}" }`
        : '- 仅当显式指定 --export=pdf|png 时才导出，不要自行导出'
    ]

    return steps.join('\n')
}

/**
 * 转换文章的 prompt
 */
async function getConvertPrompt(params: string): Promise<string> {
    // 解析文件路径和选项
    const tokens = params.split(' ')
    const filePath = tokens[0]
    const options = tokens.slice(1).join(' ')

    // 读取文件内容（如果存在）
    let content = ''
    if (filePath && existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8')
    }

    const theme = extractOption(options, 'theme') || 'default'
    const maxSlides = extractOption(options, 'slides') || '20'
    const splitBy = extractOption(options, 'split') || 'auto'

    // 工具控制：默认不调用工具；若带 --dir/--export 再调用
    const dir = extractOption(options, 'dir') || extractOption(options, 'initDir') || ''
    const exportFmt = extractOption(options, 'export') || ''

    const parts = [
      '请将以下 Markdown 文章转换为 Slidev 演示文稿。',
      '',
      `文件路径：${filePath}`,
      content ? `\n文章内容：\n${content}\n` : '',
      '',
      '转换要求：',
      `- 主题：${theme}`,
      `- 最大页数：${maxSlides}`,
      `- 分割策略：${splitBy}`,
      '',
      '请：',
      '1. 分析文章结构，识别主要章节',
      '2. 智能分割内容，每页包含适量信息',
      '3. 优化标题和要点，使其更适合演示',
      '4. 添加视觉元素建议（图表、动画等）',
      '5. 生成完整的 Slidev 格式文件',
      '',
      '工具使用策略：',
      dir
        ? `- 请调用工具 SlidevProjectInit，参数：{ dir: "${dir}", title: "${filePath || '演示'}", theme: "${theme}" }，并将生成的内容写入 slides.md`
        : '- 默认不调用任何工具，仅返回生成的 Slidev Markdown 文本',
      exportFmt
        ? `- 生成并写入完成后，请调用 SlideExporter，参数：{ target: "${dir || './slides'}", format: "${exportFmt}" }`
        : '- 仅当显式指定 --export=pdf|png 时才导出，不要自行导出',
      '',
      '注意保留关键信息，同时确保演示节奏合理。'
    ]

    return parts.join('\n')
}

/**
 * 生成大纲的 prompt
 */
async function getOutlinePrompt(params: string): Promise<string> {
    // 解析主题和选项
    const match = params.match(/^"([^"]+)"(.*)$/) || params.match(/^'([^']+)'(.*)$/)
    const topic = match ? match[1] : params.split(' ')[0]
    const options = match ? match[2].trim() : params.substring(topic.length).trim()

    const slides = extractOption(options, 'slides') || '15'
    const duration = extractOption(options, 'duration') || '20'
    const audience = extractOption(options, 'audience') || 'mixed'

    return `请为主题"${topic}"生成详细的演讲大纲。

参数：
- 预计页数：${slides} 页
- 演讲时长：${duration} 分钟
- 目标听众：${audience}

请生成：
1. 演讲标题和副标题
2. 详细的大纲结构：
   - 开场（1-2页）
   - 主体内容（分章节，每章节标明页数）
   - 结论（1-2页）
3. 每个章节的：
   - 核心观点
   - 关键内容点
   - 建议的视觉元素
   - 时间分配
4. 演讲者备注要点
5. 可能的Q&A问题

确保大纲逻辑清晰，时间分配合理。`
}

/**
 * 优化演示文稿的 prompt
 */
async function getOptimizePrompt(params: string): Promise<string> {
    const filePath = params.split(' ')[0]

    // 读取现有演示文稿
    let content = ''
    if (filePath && existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8')
    }

    return `请优化以下 Slidev 演示文稿。

文件路径：${filePath}
${content ? `\n当前内容：\n${content}\n` : ''}

优化目标：
1. 改进内容结构和流程
2. 增强视觉吸引力
3. 优化动画和过渡效果
4. 精简冗余内容
5. 添加缺失的演讲备注

请提供：
- 具体的优化建议
- 修改后的完整 Slidev 文件
- 改进要点总结`
}

/**
 * 提取命令选项
 */
function extractOption(options: string, key: string): string | undefined {
    const regex = new RegExp(`--${key}=([^\\s]+)`)
    const match = options.match(regex)
    return match ? match[1] : undefined
}

/**
 * slide-create 子命令（快捷方式）
 */
export const slideCreateCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide-create',
  description: '创建新的 Slidev 演示文稿',
  aliases: ['ppt-create', '创建PPT'],
  usage: '/slide-create <标题> [选项]',
  examples: [
    '/slide-create "Vue 3 新特性" --duration=30 --theme=seriph'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 委托给主命令
    return slideCommand.getPromptForCommand!(`create ${args}`, context)
  },

  allowedTools: ['SlidevGenerator'],
  progressMessage: '正在创建演示文稿',
  userFacingName: () => 'slide-create'
}

/**
 * slide-convert 子命令（快捷方式）
 */
export const slideConvertCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide-convert',
  description: '将 Markdown 文章转换为演示文稿',
  aliases: ['md2ppt', '转换PPT'],
  usage: '/slide-convert <文件路径> [选项]',
  examples: [
    '/slide-convert ./article.md --theme=default --slides=20'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 委托给主命令
    return slideCommand.getPromptForCommand!(`convert ${args}`, context)
  },

  allowedTools: ['SlideConverter'],
  progressMessage: '正在转换文章',
  userFacingName: () => 'slide-convert'
}


/**
 * slide-export: 将 Markdown/文本转换为 Slidev 并落盘，可选导出 PDF
 * 用法：/slide-export <输出目录> --from=<markdown路径> [--pdf]
 */
export const slideExportCommand: SlashCommand = {
  type: 'local',
  name: 'slide-export',
  description: '将内容转换为 Slidev 项目并写入磁盘，可选导出 PDF',
  aliases: ['ppt-export', '导出PPT'],
  usage: '/slide-export <outputDir> --from=<path|"raw text"> [--pdf] [--theme=default] [--slides=20]',
  examples: [
    '/slide-export ./slides --from=./article.md --pdf',
  ],
  async call(args: string, _context: AgentContext): Promise<string> {
    const parts = args.trim().split(/\s+/)
    if (parts.length === 0) {
      return '用法：/slide-export <输出目录> --from=<markdown路径或原始文本> [--pdf] [--theme=default] [--slides=20]'
    }
    const outputDir = resolve(parts[0])
    const argStr = parts.slice(1).join(' ')
    const fromMatch = argStr.match(/--from=([^\s].*?)(?=\s--|$)/)
    const pdf = /\s--pdf(\s|$)/.test(argStr)
    const theme = (argStr.match(/--theme=([^\s]+)/)?.[1]) || 'default'
    const maxSlides = parseInt((argStr.match(/--slides=(\d+)/)?.[1]) || '20', 10)

    if (!fromMatch) {
      return '缺少 --from 参数。示例：/slide-export ./slides --from=./article.md --pdf'
    }

    const fromValue = fromMatch[1]
    let markdown = ''
    if (existsSync(fromValue)) {
      markdown = readFileSync(fromValue, 'utf-8')
    } else {
      // 作为原始文本处理
      markdown = fromValue
    }

    // 调用现有 SlideConverter 生成 Slidev 内容
    const converter = new SlideConverter()
    const result = await converter.execute({
      markdown,
      options: { theme, maxSlides }
    } as any)

    if (!result.success || !result.content) {
      return `转换失败：${result.error || '未知错误'}`
    }

    // 写入 slides.md
    mkdirSync(outputDir, { recursive: true })
    const slidesPath = join(outputDir, 'slides.md')
    writeFileSync(slidesPath, result.content, 'utf-8')

    // 可选导出 PDF（如果本机已安装 slidev）
    let exportMsg = ''
    if (pdf) {
      try {
        const r = spawnSync('npx', ['-y', 'slidev', 'export', slidesPath], { stdio: 'inherit' })
        if (r.status === 0) {
          exportMsg = '\n已尝试使用 slidev 导出 PDF（请查看同目录输出）'
        } else {
          exportMsg = '\n提示：未成功调用 slidev 导出 PDF，请确认已安装 slidev 或手动执行：npx -y slidev export slides.md'
        }
      } catch {
        exportMsg = '\n提示：无法调用 npx slidev，请手动执行：npx -y slidev export slides.md'
      }
    }

    return `✅ 已生成 Slidev 内容：\n- 输出目录：${outputDir}\n- 文件：slides.md${exportMsg}`
  },
  userFacingName: () => 'slide-export'
}


/**
 * /slide init：生成标准 Slidev 项目
 */
export const slideInitCommand: SlashCommand = {
  type: 'local',
  name: 'slide-init',
  description: '初始化 Slidev 项目（生成 slides.md 与基础结构）',
  aliases: ['slide init', 'ppt-init'],
  usage: '/slide init <dir> [--title="标题"] [--theme=default]',
  async call(args: string): Promise<string> {
    const parts = args.trim().split(/\s+/)
    const dir = resolve(parts[0] || './slides')
    // 解析 title/theme
    const rest = parts.slice(1).join(' ')
    const title = (rest.match(/--title=([^\s].*?)(?=\s--|$)/)?.[1]) || '我的演示'
    const theme = (rest.match(/--theme=([^\s]+)/)?.[1]) || 'default'

    mkdirSync(dir, { recursive: true })
    const head = `---\n` +
      `theme: ${theme}\n` +
      `title: ${title}\n` +
      `aspectRatio: 16/9\n` +
      `highlighter: shiki\n` +
      `monaco: true\n` +
      `mdc: true\n` +
      `---\n\n`

    const coverTpl = rfs(join(process.cwd(), 'src/templates/slidev/default/cover.md'), 'utf-8')
    const endTpl = rfs(join(process.cwd(), 'src/templates/slidev/default/end.md'), 'utf-8')

    const render = (tpl: string) => tpl
      .replace(/\{\{title\}\}/g, title)

    const content = [
      head,
      render(coverTpl),
      '\n---\n',
      '## 目录\n\n- 章节1\n- 章节2\n- 章节3\n',
      '\n---\n',
      '## 第一章\n\n- 要点 A\n- 要点 B\n',
      '\n---\n',
      render(endTpl)
    ].join('\n')

    writeFileSync(join(dir, 'slides.md'), content, 'utf-8')
    return `✅ 已初始化 Slidev 项目：\n- 目录：${dir}\n- 文件：slides.md`
  },
  userFacingName: () => 'slide-init'
}

/**
 * /slide dev：本地预览（直通 slidev）
 */
export const slideDevCommand: SlashCommand = {
  type: 'local',
  name: 'slide-dev',
  description: '预览 Slidev 演示（调用 npx slidev）',
  aliases: ['slide dev', 'ppt-dev'],
  usage: '/slide dev <slides.md|dir>',
  async call(args: string): Promise<string> {
    const target = args.trim() || 'slides.md'
    try {
      const r = spawnSync('npx', ['-y', 'slidev', target], { stdio: 'inherit' })
      if (r.status === 0) return '✅ 已启动 Slidev 预览（请查看上方输出）'
      return '⚠️ 无法启动 slidev 预览，请确认网络/npm 源或本地已安装 @slidev/cli'
    } catch {
      return '⚠️ 无法调用 npx slidev，请手动执行：npx -y slidev <slides.md|dir>'
    }
  },
  userFacingName: () => 'slide-dev'
}

/**
 * /slide build：构建静态站点
 */
export const slideBuildCommand: SlashCommand = {
  type: 'local',
  name: 'slide-build',
  description: '构建 Slidev 静态站点（调用 npx slidev build）',
  aliases: ['slide build', 'ppt-build'],
  usage: '/slide build <slides.md|dir> [--outDir=dist] ',
  async call(args: string): Promise<string> {
    const parts = args.trim().split(/\s+/)
    const target = parts[0] || 'slides.md'
    const outDir = (args.match(/--outDir=([^\s]+)/)?.[1]) || 'dist'
    try {
      const r = spawnSync('npx', ['-y', 'slidev', 'build', target, '--out', outDir], { stdio: 'inherit' })
      if (r.status === 0) return `✅ 构建完成：${outDir}`
      return '⚠️ 构建失败，请确认 @slidev/cli 可用'
    } catch {
      return '⚠️ 无法调用 npx slidev build，请手动执行：npx -y slidev build <slides.md|dir> --out dist'
    }
  },
  userFacingName: () => 'slide-build'
}

/**
 * /slide export：导出 PDF/PNG
 */
export const slideStdExportCommand: SlashCommand = {
  type: 'local',
  name: 'slide-export-std',
  description: '导出 Slidev（PDF/PNG） - 直通 slidev export',
  aliases: ['slide export', 'ppt-export-std'],
  usage: '/slide export <slides.md|dir> [--pdf | --png]',
  async call(args: string): Promise<string> {
    const target = (args.trim().split(/\s+/)[0]) || 'slides.md'
    const isPNG = /--png/.test(args)
    const params = isPNG ? ['-y', 'slidev', 'export', '--format', 'png', target] : ['-y', 'slidev', 'export', target]
    try {
      const r = spawnSync('npx', params, { stdio: 'inherit' })
      if (r.status === 0) return '✅ 导出完成（请查看上方输出）'
      return '⚠️ 导出失败，请确认 @slidev/cli 可用'
    } catch {
      return '⚠️ 无法调用 npx slidev export，请手动执行：npx -y slidev export <slides.md|dir>'
    }
  },
  userFacingName: () => 'slide-export-std'
}

// 导出所有 slide 相关命令
export const slideCommands: SlashCommand[] = [
  slideCommand,
  slideCreateCommand,
  slideConvertCommand,
  slideExportCommand,
  slideInitCommand,
  slideDevCommand,
  slideBuildCommand,
  slideStdExportCommand
]

export default slideCommands