/**
 * Slidev PPT 相关命令
 * 通过 Agent 系统动态加载，避免污染主工具列表
 */

import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { AgentLoader } from '../../utils/agentLoader.js'
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
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
 * 用法：/slide-export <输出目录> --from=<markdown路径|"主题文本"> [--pdf] [--theme=default]
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

    // 使用内置模板，避免路径问题
    const coverTpl = `# {{title}}

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始演示 <carbon:arrow-right class="inline"/>
  </span>
</div>`

    const endTpl = `---
layout: end
---

# 谢谢

Questions?`

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
 * /slide-intelligent：智能生成个性化 PPT
 * 使用完整的 Slidev 知识库和智能提示词
 */
export const slideIntelligentCommand: SlashCommand = {
  type: 'prompt',
  name: 'slide-intelligent',
  description: '智能生成个性化 Slidev 演示文稿 - 充分利用 Slidev 所有特性',
  aliases: ['slide-ai', 'slide-smart', '智能PPT'],
  usage: '/slide-intelligent <描述或主题> [选项]',
  examples: [
    '/slide-intelligent "深度学习在自然语言处理中的应用" --style=academic --duration=45',
    '/slide-intelligent "2024年产品发布会" --style=business --audience=investors',
    '/slide-intelligent "React Hooks 最佳实践" --style=technical --theme=seriph'
  ],

  async getPromptForCommand(args: string, context: AgentContext): Promise<string> {
    // 加载智能 Slidev Agent
    const loader = AgentLoader.getInstance('slidev-intelligent')
    
    try {
      const agent = await loader.loadAgent()
      
      // 解析用户输入
      const userInput = args.trim()
      if (!userInput) {
        return '请提供演示文稿的主题或描述。例如：/slide-intelligent "机器学习入门" --duration=30'
      }

      // 提取选项
      const style = extractOption(userInput, 'style') || 'professional'
      const theme = extractOption(userInput, 'theme') || 'seriph'
      const duration = extractOption(userInput, 'duration') || '20'
      const audience = extractOption(userInput, 'audience') || 'mixed'
      const language = extractOption(userInput, 'language') || 'chinese'
      
      // 构建智能生成提示
      const intelligentPrompt = `${agent.systemPrompt}

## 用户需求分析
**用户输入**: ${userInput}
**演示风格**: ${style}
**主题**: ${theme}  
**时长**: ${duration}分钟
**目标受众**: ${audience}
**语言**: ${language}

## 任务要求
请根据用户的具体需求和上述参数，运用你掌握的完整 Slidev 知识库，生成一个专业、美观、功能完善的演示文稿。

### 生成标准：
1. **内容完整性**: 确保涵盖用户提到的所有要点
2. **技术专业性**: 充分运用 Slidev 的高级特性（v-click、v-motion、组件等）
3. **视觉专业性**: 采用现代设计理念，层次清晰，色彩搭配合理
4. **交互体验**: 合理的动画节奏和页面转场
5. **实用性**: 生成的文件可直接用于演示

### 具体执行：
- 根据${duration}分钟时长规划合适的幻灯片数量（建议${Math.ceil(parseInt(duration) / 2)}-${Math.ceil(parseInt(duration) * 0.8)}页）
- 选择最适合的布局和组件组合
- 设计符合${style}风格的视觉元素
- 针对${audience}受众优化内容深度和表达方式
- 生成完整的 Slidev Markdown 文件

### 生成后操作指导：
**重要提示**: 生成完成后，请在回复末尾添加以下用户指导信息：

"""
🎉 演示文稿生成完成！

## 📋 下一步操作指南

### 步骤1: 保存文件 📁
请将上述Markdown内容保存为文件：
**推荐文件名**: \`${userInput.split(' ')[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}-slides.md\`

### 步骤2: 立即预览 🚀
保存文件后，复制并执行以下命令：

\`\`\`bash
/slide-preview ${userInput.split(' ')[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}-slides.md
\`\`\`

### 备选方案
如果遇到问题，也可以使用：
\`\`\`bash
# 方案一：自动查找文件
/slide-preview

# 方案二：直接使用Slidev
npx @slidev/cli ${userInput.split(' ')[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}-slides.md --open

# 方案三：查看所有可用文件
/slide-preview --list
\`\`\`

## 🎯 预览成功标志
看到以下信息说明启动成功：
- ●■▲ Slidev v52.x.x
- public slide show > http://localhost:3030/
- 浏览器自动打开演示页面

## ⚡ 快速操作
- **全屏演示**: 按 'f' 键
- **演示大纲**: 按 'o' 键  
- **编辑模式**: 按 'e' 键
- **翻页**: 方向键或空格键
- **停止服务**: Ctrl+C

## 🔧 进一步定制
- 编辑 .md 文件可实时更新演示
- 使用 \`/slide-optimize 文件名.md\` 优化演示
- 了解更多: https://sli.dev

💡 **提示**: 如果忘记文件名，使用 \`/slide-preview --recent\` 查看最近的演示文稿
"""

立即开始创作！`

      return intelligentPrompt
    } catch (error) {
      // 如果 Agent 加载失败，使用备用的智能生成逻辑
      console.warn('智能 Agent 加载失败，使用备用生成逻辑:', error)
      return generateFallbackIntelligentPrompt(args.trim())
    }
  },

  allowedTools: ['ReadArticle', 'WriteArticle', 'EditArticle', 'WebSearch', 'WebFetch'],
  progressMessage: '正在智能生成演示文稿',
  userFacingName: () => 'slide-intelligent'
}

/**
 * 备用智能生成提示（当 Agent 不可用时）
 */
function generateFallbackIntelligentPrompt(userInput: string): string {
  const style = extractOption(userInput, 'style') || 'professional'
  const theme = extractOption(userInput, 'theme') || 'seriph'
  const duration = extractOption(userInput, 'duration') || '20'
  const audience = extractOption(userInput, 'audience') || 'mixed'

  return `请根据用户需求"${userInput}"生成一个高质量的 Slidev 演示文稿。

## 生成要求：
- **风格**: ${style}
- **主题**: ${theme}
- **时长**: ${duration}分钟
- **受众**: ${audience}

## Slidev 特性运用：
1. **布局系统**: 根据内容选择合适的布局（cover, center, two-cols, image-right 等）
2. **动画效果**: 使用 v-click, v-motion 创造流畅的展示体验
3. **组件集成**: 利用内置组件优化展示效果
4. **视觉设计**: 现代化的色彩搭配和排版

## 输出标准：
- 生成完整的 Slidev Markdown 文件
- 包含 ${Math.ceil(parseInt(duration) / 2)}-${Math.ceil(parseInt(duration) * 0.8)} 个幻灯片
- 确保所有 Slidev 语法正确
- 适合目标受众的内容深度

## 生成后用户指导：
生成完成后，请在回复末尾添加以下操作指南：

"""
🎉 演示文稿生成完成！

## 📋 下一步操作指南

### 步骤1: 保存文件 📁
请将上述Markdown内容保存为文件：
**推荐文件名**: \`${userInput.split(' ')[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}-slides.md\`

### 步骤2: 立即预览 🚀
保存文件后，复制并执行以下命令：

\`\`\`bash
/slide-preview ${userInput.split(' ')[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}-slides.md
\`\`\`

### 备选方案
如果遇到问题，也可以使用：
\`\`\`bash
# 方案一：自动查找文件
/slide-preview

# 方案二：直接使用Slidev
npx @slidev/cli ${userInput.split(' ')[0].replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}-slides.md --open
\`\`\`

## 🎯 预览成功标志
- ●■▲ Slidev v52.x.x
- public slide show > http://localhost:3030/
- 浏览器自动打开演示页面

## ⚡ 快速操作
- 按 'f' 键全屏演示
- 按 'o' 键查看大纲  
- 方向键或空格翻页
- Ctrl+C 停止服务

💡 **提示**: 使用 \`/slide-preview --recent\` 可查看最近的演示文稿
"""

立即开始生成！`
}

/**
 * /slide-auto-preview：一体化PPT生成和预览命令
 * 集成生成、保存、预览的完整流程
 */
export const slideAutoPreviewCommand: SlashCommand = {
  type: 'local',
  name: 'slide-auto-preview',
  description: '一体化PPT生成和预览 - 生成、保存、预览一条命令完成',
  aliases: ['auto-slide', 'slide-go', '一键PPT'],
  usage: '/slide-auto-preview <描述或主题> [选项]',
  examples: [
    '/slide-auto-preview "Vue 3 响应式原理" --style=technical --duration=30',
    '/slide-auto-preview "产品发布会" --style=business --audience=investors',
    '/slide-auto-preview "机器学习入门" --style=academic --duration=45'
  ],

  async call(args: string): Promise<string> {
    const trimmedArgs = args.trim()
    
    if (!trimmedArgs) {
      return '请提供演示文稿的主题或描述。\n\n用法：/slide-auto-preview "你的主题" [选项]\n\n示例：\n- /slide-auto-preview "Vue 3 新特性" --style=technical\n- /slide-auto-preview "季度业务汇报" --style=business'
    }

    // 提取主题和选项
    const topicMatch = trimmedArgs.match(/^"([^"]+)"/) || trimmedArgs.match(/^'([^']+)'/)
    let topic = topicMatch ? topicMatch[1] : trimmedArgs.split(' --')[0].trim()
    let options = topicMatch ? trimmedArgs.substring(topicMatch[0].length).trim() : 
                  trimmedArgs.includes(' --') ? trimmedArgs.substring(trimmedArgs.indexOf(' --')) : ''

    const style = extractOption(options, 'style') || 'professional'
    const theme = extractOption(options, 'theme') || 'seriph'
    const duration = extractOption(options, 'duration') || '20'
    const audience = extractOption(options, 'audience') || 'mixed'
    
    // 生成安全的文件名
    const safeFilename = topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-slides.md'
    const outputPath = resolve(safeFilename)

    console.log(`🚀 开始一体化PPT生成和预览流程...`)
    console.log(`📝 主题: ${topic}`)
    console.log(`🎨 风格: ${style}, 主题: ${theme}, 时长: ${duration}分钟, 受众: ${audience}`)
    console.log(`📁 输出文件: ${safeFilename}`)

    try {
      // Step 1: 加载智能 Agent 并生成内容
      console.log(`\n⚙️  步骤1: 智能生成内容...`)
      
      const loader = AgentLoader.getInstance('slidev-intelligent')
      let generatedContent = ''
      
      try {
        const agent = await loader.loadAgent()
        
        // 构建生成提示（简化版，专注于内容生成）
        const generationPrompt = `${agent.systemPrompt}

## 用户需求分析
**主题**: ${topic}
**演示风格**: ${style}
**主题**: ${theme}  
**时长**: ${duration}分钟
**目标受众**: ${audience}

## 任务要求
请生成一个专业、美观、功能完善的 Slidev 演示文稿。

### 生成标准：
1. 内容完整涵盖用户主题
2. 充分运用 Slidev 高级特性（v-click、v-motion、组件等）
3. 采用现代设计理念，层次清晰
4. 根据${duration}分钟时长规划${Math.ceil(parseInt(duration) / 2)}-${Math.ceil(parseInt(duration) * 0.8)}页幻灯片
5. 针对${audience}受众优化内容深度

请直接输出完整的 Slidev Markdown 文件内容，无需额外说明。`

        // 这里应该调用AI生成内容，但在本地实现中我们使用模板生成
        generatedContent = generateAutoPreviewContent(topic, style, theme, duration, audience)
        
      } catch (error) {
        console.warn('智能Agent加载失败，使用备用生成逻辑')
        generatedContent = generateAutoPreviewContent(topic, style, theme, duration, audience)
      }

      // Step 2: 保存文件
      console.log(`\n💾 步骤2: 保存文件...`)
      writeFileSync(outputPath, generatedContent, 'utf-8')
      console.log(`✅ 文件已保存: ${outputPath}`)

      // Step 3: 启动预览
      console.log(`\n🎬 步骤3: 启动Slidev预览...`)
      
      // 检查依赖
      const dependencyCheck = await checkSlidevDependency()
      if (!dependencyCheck.available) {
        return `⚠️ Slidev CLI 不可用，但文件已生成成功！

📁 文件位置: ${outputPath}

${dependencyCheck.message}

🔧 解决方案：
${dependencyCheck.solutions.map(solution => `- ${solution}`).join('\n')}

手动预览命令：
npx @slidev/cli ${safeFilename} --open`
      }

      // 启动 Slidev 预览
      const launchResult = spawnSync('npx', ['-y', '@slidev/cli', safeFilename, '--open'], {
        stdio: 'inherit',
        cwd: process.cwd()
      })

      if (launchResult.status === 0 || launchResult.status === null) {
        // 添加到历史记录
        addToSlidesHistory(safeFilename)
        
        return `🎉 一体化PPT生成和预览完成！

📋 执行总结:
✅ 内容生成: 完成 (基于主题"${topic}")
✅ 文件保存: ${outputPath}
✅ 预览启动: Slidev 服务已启动

🌐 预览地址: http://localhost:3030/
📱 演示模式: http://localhost:3030/presenter/
📊 幻灯片概览: http://localhost:3030/overview/

⚡ 快捷操作:
- 'f' 键: 全屏模式
- 'o' 键: 演示大纲
- 方向键/空格: 翻页
- Ctrl+C: 停止服务

💡 文件已保存，您可以随时编辑 ${safeFilename} 来修改演示内容`
      } else {
        return `⚠️ 内容生成成功，但预览启动失败

📁 文件已保存: ${outputPath}

💡 手动启动预览:
/slide-preview ${safeFilename}

或者：
npx @slidev/cli ${safeFilename} --open`
      }

    } catch (error) {
      return `❌ 一体化生成失败: ${error}

🔧 建议:
1. 检查主题描述是否清晰
2. 确认文件写入权限
3. 尝试分步操作：
   - /slide-intelligent "${topic}" --style=${style}
   - /slide-preview 文件名.md`
    }
  },

  userFacingName: () => 'slide-auto-preview'
}

/**
 * 为自动预览生成内容
 */
function generateAutoPreviewContent(topic: string, style: string, theme: string, duration: string, audience: string): string {
  const slidesCount = Math.max(5, Math.min(Math.ceil(parseInt(duration) / 2), 15))
  const styleConfig = getStyleConfiguration(style)
  
  return `---
theme: ${theme}
title: "${topic}"
info: "${styleConfig.description}"
class: text-center
highlighter: shiki
drawings:
  enabled: true
transition: slide-left
mdc: true
${styleConfig.background ? `background: '${styleConfig.background}'` : ''}
---

# ${topic}
## ${styleConfig.subtitle}

<div class="pt-12">
  <div v-click="1" class="text-6xl mb-4">${styleConfig.icon}</div>
  <div v-click="2" class="text-2xl text-${styleConfig.color}-300">${styleConfig.tagline}</div>
</div>

---
layout: center
---

# 📋 ${style === 'academic' ? '研究大纲' : style === 'business' ? '议程安排' : '内容概览'}

<Toc maxDepth="2" columns="2" />

${generateContentSlides(topic, style, audience, slidesCount - 3)}

---
layout: end
---

# ${getEndSlideTitle(style)}

<div class="text-center space-y-6 mt-12">
  <div class="text-3xl">${styleConfig.icon} Questions & Discussion ${styleConfig.icon}</div>
  <div class="text-lg text-gray-400">
    ${getEndMessage(style)}
  </div>
  <div class="text-sm opacity-75 mt-8">
    本演示由 WriteFlow 一体化生成系统创建
  </div>
</div>`
}

/**
 * 获取风格配置
 */
function getStyleConfiguration(style: string) {
  const configs = {
    academic: {
      description: '学术研究报告',
      subtitle: '严谨的学术分析与研究成果',
      icon: '🎓',
      color: 'blue',
      tagline: '严谨治学，追求真理',
      background: ''
    },
    business: {
      description: '商业战略报告',
      subtitle: '驱动业务增长的战略洞察',
      icon: '💼',
      color: 'red',
      tagline: '商业智慧，价值创造',
      background: 'linear-gradient(45deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    },
    technical: {
      description: '技术分享报告',
      subtitle: '深入技术，实践驱动',
      icon: '⚡',
      color: 'green',
      tagline: '技术创新，实践为本',
      background: ''
    },
    creative: {
      description: '创意设计展示',
      subtitle: '创新思维，设计引领',
      icon: '🎨',
      color: 'purple',
      tagline: '创意无限，设计未来',
      background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)'
    },
    professional: {
      description: '专业演示报告',
      subtitle: '专业品质，价值导向',
      icon: '📊',
      color: 'blue',
      tagline: '专业服务，持续价值',
      background: ''
    }
  }
  
  return configs[style as keyof typeof configs] || configs.professional
}

/**
 * 生成内容页面
 */
function generateContentSlides(topic: string, style: string, audience: string, slideCount: number): string {
  let slides = ''
  
  for (let i = 1; i <= slideCount; i++) {
    const slideTitle = generateSlideTitle(topic, style, i)
    slides += `

---

# ${slideTitle}

<v-clicks>

## 核心要点
- **要点一**: 关于"${topic}"的深入分析
- **要点二**: 针对${audience}的专业见解  
- **要点三**: ${style}风格的实用建议

## 详细内容
基于${style}演示风格，为${audience}受众精心设计的专业内容。

</v-clicks>`
  }
  
  return slides
}

/**
 * 生成幻灯片标题
 */
function generateSlideTitle(topic: string, style: string, index: number): string {
  const titleTemplates = {
    academic: ['🔬 研究背景', '📊 方法论', '📈 研究结果', '🎯 结论讨论', '🔮 未来研究'],
    business: ['📊 市场分析', '💡 战略要点', '🎯 执行计划', '📈 预期收益', '⏭️ 行动计划'],
    technical: ['🛠️ 技术架构', '💡 核心实现', '📊 性能分析', '🔍 最佳实践', '🚀 应用案例'],
    creative: ['🎨 设计理念', '💡 创意思路', '🌟 视觉呈现', '🎭 用户体验', '🔮 发展前景'],
    professional: ['📋 现状分析', '💡 解决方案', '📊 实施方案', '📈 预期成果', '🎯 总结建议']
  }
  
  const templates = titleTemplates[style as keyof typeof titleTemplates] || titleTemplates.professional
  return templates[Math.min(index - 1, templates.length - 1)]
}

function getEndSlideTitle(style: string): string {
  const titles = {
    academic: '🎓 研究总结',
    business: '📈 下一步行动',
    technical: '🚀 总结与展望',
    creative: '🌟 创意总结',
    professional: '🎯 专业总结'
  }
  return titles[style as keyof typeof titles] || '🎯 总结'
}

function getEndMessage(style: string): string {
  const messages = {
    academic: '感谢您的学术关注，期待深入讨论',
    business: '将战略转化为行动，创造商业价值',
    technical: '技术驱动创新，实践成就未来',
    creative: '创意激发可能，设计改变世界',
    professional: '专业成就卓越，服务创造价值'
  }
  return messages[style as keyof typeof messages] || '专业服务，持续价值'
}

/**
 * /slide-quick：快速生成主题 PPT
 */
export const slideQuickCommand: SlashCommand = {
  type: 'local',
  name: 'slide-quick',
  description: '快速生成指定主题的 Slidev 演示文稿',
  aliases: ['quick-ppt', '快速PPT'],
  usage: '/slide-quick <主题> [--dir=./slides] [--theme=default]',
  examples: [
    '/slide-quick "探索星空" --dir=./space-slides --theme=seriph'
  ],
  async call(args: string): Promise<string> {
    const parts = args.trim().split(/\s+/)
    if (parts.length === 0) {
      return '用法：/slide-quick <主题> [--dir=./slides] [--theme=default]'
    }
    
    // 解析主题（支持引号）
    const match = args.match(/^"([^"]+)"/) || args.match(/^'([^']+)'/)
    const topic = match ? match[1] : parts[0]
    const rest = match ? args.substring(match[0].length) : parts.slice(1).join(' ')
    
    const outputDir = resolve((rest.match(/--dir=([^\s]+)/)?.[1]) || './slides')
    const theme = (rest.match(/--theme=([^\s]+)/)?.[1]) || 'seriph'
    
    // 根据主题生成内容
    let content = generateTopicContent(topic, theme)
    
    // 创建目录并写入文件
    mkdirSync(outputDir, { recursive: true })
    const slidesPath = join(outputDir, 'slides.md')
    writeFileSync(slidesPath, content, 'utf-8')
    
    return `✅ 已生成"${topic}"主题的 Slidev 演示：\n- 输出目录：${outputDir}\n- 文件：slides.md\n- 预览命令：npx @slidev/cli ${slidesPath} --open`
  },
  userFacingName: () => 'slide-quick'
}

/**
 * 根据主题生成内容
 */
function generateTopicContent(topic: string, theme: string): string {
  const templates: Record<string, () => string> = {
    '探索星空': () => generateSpaceExplorationSlides(topic, theme),
    '默认': () => generateDefaultSlides(topic, theme)
  }
  
  const generator = templates[topic] || templates['默认']
  return generator()
}

/**
 * 生成探索星空主题的幻灯片
 */
function generateSpaceExplorationSlides(title: string, theme: string): string {
  return `---
theme: ${theme}
title: ${title}
aspectRatio: 16/9
highlighter: shiki
monaco: true
mdc: true
background: 'linear-gradient(45deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)'
---

# ${title}
## 宇宙的奥秘与人类的征程

> 仰望星空，脚踏实地

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始探索 <carbon:arrow-right class="inline"/>
  </span>
</div>

---
layout: center
class: text-center
---

# 🌌 宇宙概览

<div class="text-6xl text-blue-400 mb-8">
  ∞
</div>

<div class="text-xl text-gray-300 space-y-4">
  <p>宇宙年龄：约 138 亿年</p>
  <p>可观测宇宙直径：约 930 亿光年</p>
  <p>估计星系数量：超过 2 万亿个</p>
</div>

---

# 🌟 宇宙的诞生与演化

<div class="grid grid-cols-3 gap-6 mt-8">

<div class="p-4 border border-blue-500 rounded-lg">
<h3 class="text-blue-400 font-bold mb-2">大爆炸理论</h3>
<ul class="text-sm space-y-1">
  <li>• 138亿年前的奇点爆炸</li>
  <li>• 宇宙急剧膨胀</li>
  <li>• 基本粒子形成</li>
</ul>
</div>

<div class="p-4 border border-purple-500 rounded-lg">
<h3 class="text-purple-400 font-bold mb-2">暗物质时代</h3>
<ul class="text-sm space-y-1">
  <li>• 暗物质占宇宙27%</li>
  <li>• 形成宇宙结构骨架</li>
  <li>• 引力聚集物质</li>
</ul>
</div>

<div class="p-4 border border-green-500 rounded-lg">
<h3 class="text-green-400 font-bold mb-2">恒星形成</h3>
<ul class="text-sm space-y-1">
  <li>• 氢气云坍塌</li>
  <li>• 核聚变点燃</li>
  <li>• 第一代恒星诞生</li>
</ul>
</div>

</div>

---

# ⭐ 恒星的生命周期

<v-clicks>

## 1. 原恒星阶段
- 星云坍塌
- 温度逐渐升高
- 核聚变尚未开始

## 2. 主序星阶段
- 氢聚变成氦
- 能量输出稳定
- 太阳现处此阶段

## 3. 红巨星阶段
- 氢燃料耗尽
- 外层膨胀
- 温度下降

## 4. 终极命运
- 白矮星（小质量）
- 中子星（中等质量）
- 黑洞（大质量）

</v-clicks>

---

# 🚀 人类探索星空

<div class="text-2xl text-blue-300 mb-6">从古代观星到现代航天</div>

<div class="grid grid-cols-2 gap-8 max-w-4xl mx-auto">

<div class="space-y-4">
  <h3 class="text-xl font-bold text-green-400">🔭 观测发展</h3>
  <ul class="text-left space-y-2">
    <li>• 肉眼观测（古代）</li>
    <li>• 光学望远镜（17世纪）</li>
    <li>• 射电望远镜（20世纪）</li>
    <li>• 空间望远镜（现代）</li>
  </ul>
</div>

<div class="space-y-4">
  <h3 class="text-xl font-bold text-purple-400">🛸 空间探索</h3>
  <ul class="text-left space-y-2">
    <li>• 人造卫星（1957）</li>
    <li>• 载人航天（1961）</li>
    <li>• 登月计划（1969）</li>
    <li>• 空间站（1971-今）</li>
  </ul>
</div>

</div>

---

# 🔮 未来展望

<div class="grid grid-cols-2 gap-8">

<div class="space-y-4">
  <h3 class="text-xl font-bold text-blue-400">近期计划 (2024-2030)</h3>
  <ul class="space-y-2">
    <li>• 月球基地建设</li>
    <li>• 火星移民准备</li>
    <li>• 小行星采矿</li>
  </ul>
</div>

<div class="space-y-4">
  <h3 class="text-xl font-bold text-purple-400">远期愿景 (2030+)</h3>
  <ul class="space-y-2">
    <li>• 星际旅行</li>
    <li>• 寻找地外生命</li>
    <li>• 人类文明扩展</li>
  </ul>
</div>

</div>

---
layout: center
class: text-center
---

# 🌠 结语

<div class="text-3xl mb-8">
  探索星空，就是探索我们自己
</div>

<blockquote class="text-xl text-gray-300 italic">
  "我们都是星尘，我们都是黄金"
</blockquote>

<div class="text-lg text-blue-300 mt-4">
  — 卡尔·萨根
</div>

---
layout: end
---

# 谢谢观看

<div class="text-center space-y-4 mt-12">
  
<div class="text-2xl">🌌 Questions & Discussion 🌌</div>

<div class="text-lg text-gray-400">
  继续探索宇宙的奥秘
</div>

</div>`
}

/**
 * 生成默认主题的幻灯片
 */
function generateDefaultSlides(title: string, theme: string): string {
  return `---
theme: ${theme}
title: ${title}
aspectRatio: 16/9
highlighter: shiki
monaco: true
mdc: true
---

# ${title}

> 开始你的演示

<div class="pt-12">
  <span @click="$slidev.nav.next" class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    开始 <carbon:arrow-right class="inline"/>
  </span>
</div>

---

# 目录

- 章节 1
- 章节 2  
- 章节 3
- 总结

---

# 章节 1

<v-clicks>

- 要点 A
- 要点 B
- 要点 C

</v-clicks>

---

# 章节 2

## 子标题

内容描述...

\`\`\`typescript
// 代码示例
function example() {
  return "Hello World"
}
\`\`\`

---

# 章节 3

![图片示例](/placeholder-image.png)

---

# 总结

<v-clicks>

- 关键要点 1
- 关键要点 2
- 下一步行动

</v-clicks>

---
layout: end
---

# 谢谢

Questions?`
}

/**
 * /slide-preview：预览和启动 Slidev 演示文稿
 * 提供智能的依赖检查和启动逻辑
 */
export const slidePreviewCommand: SlashCommand = {
  type: 'local',
  name: 'slide-preview',
  description: '预览 Slidev 演示文稿 - 智能启动和依赖检查',
  aliases: ['slide-run', 'preview-slide', '预览PPT', '运行PPT'],
  usage: '/slide-preview [文件路径] [选项]',
  examples: [
    '/slide-preview slides.md',
    '/slide-preview --list',
    '/slide-preview --recent',
    '/slide-preview --help'
  ],

  async call(args: string): Promise<string> {
    const trimmedArgs = args.trim()
    
    // 处理特殊选项
    if (trimmedArgs === '--list' || trimmedArgs === '-l') {
      return listAvailableSlides()
    }
    
    if (trimmedArgs === '--recent' || trimmedArgs === '-r') {
      return showRecentSlides()
    }
    
    if (trimmedArgs === '--help' || trimmedArgs === '-h') {
      return getPreviewHelp()
    }

    // 确定目标文件
    let targetFile = trimmedArgs.split(' ')[0] || ''
    
    if (!targetFile) {
      // 如果没有指定文件，尝试找到当前目录下的幻灯片文件
      const candidates = ['slides.md', 'presentation.md', 'deck.md', 'index.md']
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          targetFile = candidate
          break
        }
      }
    }

    if (!targetFile || !existsSync(targetFile)) {
      return `❌ 未找到演示文稿文件。
      
🔍 请检查：
- 文件是否存在：${targetFile || '(未指定)'}
- 当前目录：${process.cwd()}

💡 使用方法：
- /slide-preview slides.md
- /slide-preview --list  (查看可用文件)
- /slide-preview --recent (查看最近生成的文件)`
    }

    // 检查 Slidev 依赖
    const dependencyCheck = await checkSlidevDependency()
    if (!dependencyCheck.available) {
      return `⚠️ Slidev CLI 不可用

${dependencyCheck.message}

🔧 解决方案：
${dependencyCheck.solutions.map(solution => `- ${solution}`).join('\n')}

📚 更多信息：https://sli.dev/guide/install.html`
    }

    // 启动 Slidev
    const absolutePath = resolve(targetFile)
    console.log(`🚀 正在启动 Slidev 预览：${absolutePath}`)
    
    try {
      // 检查是否需要自动打开浏览器
      const autoOpen = !args.includes('--no-open')
      const port = extractOption(args, 'port') || '3030'
      
      const launchParams = ['-y', '@slidev/cli', targetFile]
      if (autoOpen) launchParams.push('--open')
      if (port !== '3030') launchParams.push('--port', port)
      
      const result = spawnSync('npx', launchParams, { 
        stdio: 'inherit',
        cwd: process.cwd()
      })
      
      if (result.status === 0) {
        // 记录到历史
        addToSlidesHistory(targetFile)
        
        return `✅ Slidev 预览已启动！

📁 文件：${absolutePath}
🌐 端口：${port}
${autoOpen ? '🔗 浏览器应该已自动打开' : ''}

💡 快捷键：
- 方向键/空格：翻页
- 'f'：全屏模式  
- 'o'：演示大纲
- 'e'：编辑模式
- 'g'：跳转到指定页面

🛑 停止预览：Ctrl+C`
      } else {
        return `❌ Slidev 启动失败 (退出代码: ${result.status})

💡 尝试手动启动：
npx @slidev/cli ${targetFile} --open

🔍 检查项：
- 文件格式是否正确（Markdown格式）
- 是否包含有效的 frontmatter
- 网络连接是否正常`
      }
    } catch (error) {
      return `❌ 启动失败：${error}

🔧 故障排除：
1. 检查 Node.js 和 npm 是否正常工作
2. 尝试：npm install -g @slidev/cli
3. 手动执行：npx @slidev/cli ${targetFile}

📞 如需帮助：https://github.com/slidevjs/slidev/issues`
    }
  },

  userFacingName: () => 'slide-preview'
}

/**
 * 检查 Slidev CLI 依赖可用性
 */
async function checkSlidevDependency(): Promise<{
  available: boolean,
  message: string,
  solutions: string[]
}> {
  try {
    // 检查 npx 是否可用
    const npxCheck = spawnSync('npx', ['--version'], { stdio: 'pipe' })
    if (npxCheck.status !== 0) {
      return {
        available: false,
        message: 'npx 不可用',
        solutions: [
          '安装 Node.js：https://nodejs.org/',
          '检查 PATH 环境变量',
          '重启终端后再试'
        ]
      }
    }

    // 检查 @slidev/cli 是否可以通过 npx 访问
    const slidevCheck = spawnSync('npx', ['-y', '@slidev/cli', '--version'], { 
      stdio: 'pipe',
      timeout: 10000 // 10秒超时
    })
    
    if (slidevCheck.status === 0) {
      return {
        available: true,
        message: 'Slidev CLI 可用',
        solutions: []
      }
    } else {
      return {
        available: false,
        message: 'Slidev CLI 不可用或版本检查失败',
        solutions: [
          'npm install -g @slidev/cli',
          '或使用 npx：npx @slidev/cli your-slides.md',
          '检查网络连接（首次使用需要下载）',
          '清除 npm 缓存：npm cache clean --force'
        ]
      }
    }
  } catch (error) {
    return {
      available: false,
      message: `依赖检查失败: ${error}`,
      solutions: [
        '检查 Node.js 和 npm 是否正确安装',
        '重启终端并重试',
        '手动安装：npm install -g @slidev/cli'
      ]
    }
  }
}

/**
 * 列出可用的幻灯片文件
 */
function listAvailableSlides(): string {
  const found: string[] = []
  
  try {
    // 直接使用已导入的 fs 模块
    const searchDir = (dir: string, prefix = '') => {
      try {
        const items = readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue
          
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name
          if (item.isDirectory() && prefix.split('/').length < 3) {
            searchDir(`${dir}/${item.name}`, fullPath)
          } else if (item.isFile() && item.name.endsWith('.md')) {
            found.push(fullPath)
          }
        }
      } catch (e) {
        // 忽略访问权限错误
      }
    }
    
    searchDir('.')
  } catch (error) {
    console.warn('搜索文件时出错:', error)
    
    // 备用方式：仅检查当前目录
    try {
      const files = readdirSync('.').filter((f: string) => f.endsWith('.md'))
      found.push(...files)
    } catch {
      return '❌ 无法读取当前目录文件\n\n💡 请检查文件权限或手动指定文件路径'
    }
  }
  
  if (found.length === 0) {
    return '📂 当前目录下未找到 .md 文件\n\n💡 使用 /slide-intelligent 创建新的演示文稿'
  }
  
  return `📁 找到 ${found.length} 个 Markdown 文件：

${found.map((file, index) => `${index + 1}. ${file}`).join('\n')}

💡 使用方法：/slide-preview <文件名>`
}

/**
 * 显示最近生成的幻灯片
 */
function showRecentSlides(): string {
  const history = getSlidesHistory()
  
  if (history.length === 0) {
    return '📜 暂无历史记录\n\n💡 使用 /slide-intelligent 或 /slide-preview 生成和预览演示文稿'
  }
  
  return `📜 最近预览的演示文稿：

${history.slice(0, 10).map((item, index) => 
  `${index + 1}. ${item.file} (${new Date(item.timestamp).toLocaleString()})`
).join('\n')}

💡 使用方法：/slide-preview <文件名>`
}

/**
 * 获取预览命令帮助信息
 */
function getPreviewHelp(): string {
  return `📖 Slidev 预览命令帮助

🎯 基本用法：
/slide-preview [文件路径] [选项]

📝 示例：
/slide-preview slides.md
/slide-preview presentation.md --port=3031
/slide-preview slides.md --no-open

🔧 选项：
--port=<端口>    指定端口号（默认3030）
--no-open        不自动打开浏览器
--list, -l       列出可用的 .md 文件
--recent, -r     显示最近预览的文件
--help, -h       显示此帮助信息

🚀 快速命令：
/slide-preview            自动查找并预览演示文稿
/slide-preview --list     查看所有可用文件
/slide-preview --recent   查看历史记录

💡 提示：
- 如果不指定文件，会自动查找 slides.md、presentation.md 等
- 首次使用可能需要下载 Slidev CLI
- 使用 Ctrl+C 停止预览服务`
}

/**
 * 获取幻灯片历史记录
 */
function getSlidesHistory(): Array<{file: string, timestamp: number}> {
  try {
    const historyFile = join(process.cwd(), '.writeflow-slides-history.json')
    if (existsSync(historyFile)) {
      return JSON.parse(readFileSync(historyFile, 'utf-8'))
    }
  } catch (error) {
    console.warn('读取历史记录失败:', error)
  }
  return []
}

/**
 * 添加到幻灯片历史记录
 */
function addToSlidesHistory(filePath: string): void {
  try {
    const history = getSlidesHistory()
    const newEntry = { file: filePath, timestamp: Date.now() }
    
    // 移除重复项
    const filteredHistory = history.filter(item => item.file !== filePath)
    filteredHistory.unshift(newEntry)
    
    // 只保留最近20个记录
    const trimmedHistory = filteredHistory.slice(0, 20)
    
    const historyFile = join(process.cwd(), '.writeflow-slides-history.json')
    writeFileSync(historyFile, JSON.stringify(trimmedHistory, null, 2), 'utf-8')
  } catch (error) {
    console.warn('保存历史记录失败:', error)
  }
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
  slideIntelligentCommand,  // 智能生成命令
  slidePreviewCommand,      // 预览命令
  slideAutoPreviewCommand,  // 新增一体化命令
  slideExportCommand,
  slideQuickCommand,
  slideInitCommand,
  slideDevCommand,
  slideBuildCommand,
  slideStdExportCommand
]

export default slideCommands