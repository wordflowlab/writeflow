/**
 * Slidev PPT 相关命令
 * 通过 Agent 系统动态加载，避免污染主工具列表
 */

import { debugLog, logWarn } from './../../utils/log.js'
import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { AgentLoader } from '../../utils/agentLoader.js'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { SlideConverter } from '../../tools/slidev/SlideConverter.js'
import { spawnSync } from 'child_process'


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

  async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
    // 加载 Slidev Agent
    const loader = AgentLoader.getInstance('slidev-ppt')
    const agent = await loader.loadAgent()

    // 解析子命令
    const [subcommand, ...rest] = _args.split(' ')
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
        // 智能判断：如果输入看起来是主题，使用 intelligent 模式
        if (isTopicLike(_args)) {
          return slideIntelligentCommand.getPromptForCommand!(_args, _context)
        }
        // 否则使用通用 Agent 模式
        basePrompt += `用户请求: ${_args}\n\n请根据用户需求，使用你的 Slidev 专业能力提供帮助。`
    }

    return basePrompt
  },

  allowedTools: ['SlidevProjectInit', 'SlideConverter', 'SlideExporter', 'Read', 'Write', 'Edit', 'Bash', 'WebSearch', 'WebFetch'],
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

    // 生成安全的文件名
    const safeFilename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-slides.md`
    
    // 工具控制：默认保存到当前目录
    const dir = extractOption(options, 'dir') || extractOption(options, 'initDir') || ''
    const exportFmt = extractOption(options, 'export') || ''

    return `你是专业的 Slidev 演示文稿创建专家。请为主题"${title}"创建演示文稿并保存到当前工作目录。

任务要求:
- 主题: ${title}
- 风格: ${style}
- 主题模板: ${theme} 
- 预计时长: ${duration}分钟
- 目标受众: ${audience}
- 保存文件名: ${safeFilename}
- 保存位置: 当前工作目录

请按以下步骤执行:

1. 首先告知用户开始创建演示文稿
2. 生成完整的 Slidev Markdown 内容（包含 frontmatter、封面页、目录页、主要内容页、总结页）
3. 调用 Write 工具保存内容到当前目录的文件 "${safeFilename}"
4. 调用 Bash 工具执行 "ls -la ${safeFilename}" 验证文件创建成功
5. 检查 Slidev CLI 是否可用：
   - 调用 Bash 工具执行 "npx @slidev/cli --version" 检查 Slidev 是否已安装
   - 如果命令执行成功，Slidev 可用，继续第6步
   - 如果命令失败，Slidev 不可用，跳转到第7步
6. Slidev 可用时，询问用户是否要立即打开演示文稿，提供三个选项：
   - 选项1: 立即打开演示文稿（执行 npx @slidev/cli ${safeFilename} --open）
   - 选项2: 稍后手动打开（提供命令: npx @slidev/cli ${safeFilename} --open）
   - 选项3: 不打开演示文稿
7. Slidev 不可用时，提供安装引导选项：
   - 选项A: 立即安装 Slidev（推荐使用: npm init slidev@latest）
   - 选项B: 全局安装 CLI（使用: npm install -g @slidev/cli）
   - 选项C: 跳过安装，稍后手动处理
8. 根据用户选择执行相应操作（安装或打开命令）

注意事项:
- 必须使用工具来保存文件到当前工作目录，不要只返回文本
- 内容要适合 ${duration} 分钟演示，面向 ${audience} 受众
- 使用 ${theme} 主题和 ${style} 风格
- 保存的文件路径应该是相对于当前工作目录的，不要使用绝对路径
- 依赖检查和安装引导：
  * 使用 Bash 工具检查 "npx @slidev/cli --version"，超时时间设为10秒
  * 如果检查失败，优先推荐 "npm init slidev@latest" 创建新项目
  * 如果用户选择安装，使用 Bash 工具执行安装命令并显示进度
  * 安装完成后再次验证 Slidev 可用性
- 如果用户选择立即打开，使用 Bash 工具执行 "npx @slidev/cli ${safeFilename} --open"

现在开始执行任务。`
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
    
    // 生成安全的文件名
    const safeFilename = `${(filePath || '演示').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-slides.md`

    return `你是专业的 Slidev 演示文稿转换专家。请将 Markdown 文章转换为 Slidev 演示文稿并保存到当前工作目录。

任务要求:
- 源文件: ${filePath}
- 主题模板: ${theme}
- 最大页数: ${maxSlides}
- 分割策略: ${splitBy}
- 保存文件名: ${safeFilename}
- 保存位置: 当前工作目录

源文件内容:
${content || '请先使用 Read 工具读取文件内容'}

请按以下步骤执行:

1. 首先告知用户开始转换文章为演示文稿
2. ${content ? '分析已读取的文章内容' : '调用 Read 工具读取源文件内容'}
3. 分析文章结构，识别主要章节和关键要点
4. 智能分割内容，每页包含适量信息（不超过 ${maxSlides} 页）
5. 生成完整的 Slidev Markdown 内容（包含 frontmatter、封面页、主要内容页）
6. 调用 Write 工具保存内容到当前目录的文件 "${safeFilename}"
7. 调用 Bash 工具执行 "ls -la ${safeFilename}" 验证文件创建成功
8. 检查 Slidev CLI 是否可用：
   - 调用 Bash 工具执行 "npx @slidev/cli --version" 检查 Slidev 是否已安装
   - 如果命令执行成功，Slidev 可用，继续第9步
   - 如果命令失败，Slidev 不可用，跳转到第10步
9. Slidev 可用时，询问用户是否要立即打开演示文稿，提供三个选项：
   - 选项1: 立即打开演示文稿（执行 npx @slidev/cli ${safeFilename} --open）
   - 选项2: 稍后手动打开（提供命令: npx @slidev/cli ${safeFilename} --open）
   - 选项3: 不打开演示文稿
10. Slidev 不可用时，提供安装引导选项：
    - 选项A: 立即安装 Slidev（推荐使用: npm init slidev@latest）
    - 选项B: 全局安装 CLI（使用: npm install -g @slidev/cli）
    - 选项C: 跳过安装，稍后手动处理
11. 根据用户选择执行相应操作（安装或打开命令）

注意事项:
- 必须使用工具来保存文件到当前工作目录，不要只返回文本
- 使用 ${theme} 主题和适合转换的风格
- 保持文章的核心信息和逻辑结构
- 优化标题和要点，使其更适合演示
- 添加适当的视觉元素建议（图表、动画等）
- 保存的文件路径应该是相对于当前工作目录的，不要使用绝对路径
- 依赖检查和安装引导：
  * 使用 Bash 工具检查 "npx @slidev/cli --version"，超时时间设为10秒
  * 如果检查失败，优先推荐 "npm init slidev@latest" 创建新项目
  * 如果用户选择安装，使用 Bash 工具执行安装命令并显示进度
  * 安装完成后再次验证 Slidev 可用性
- 如果用户选择立即打开，使用 Bash 工具执行 "npx @slidev/cli ${safeFilename} --open"

现在开始执行任务。`
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
 * 判断输入参数是否为主题内容（应该使用 intelligent 模式）
 */
function isTopicLike(_args: string): boolean {
  const trimmed = args.trim()
  if (!trimmed) return false
  
  // 引号包围的内容，明确是主题
  if (/^["'].*["']/.test(trimmed)) return true
  
  // 包含常见主题关键词的内容
  if (/(?:介绍|教程|分析|设计|架构|原理|实践|应用|入门|进阶|最佳|深入|探索)/.test(trimmed)) return true
  
  // 不包含明确的子命令关键词
  if (!/\b(create|convert|outline|optimize|init|dev|build|export|preview|help)\b/.test(trimmed)) {
    // 且不是以 -- 开头的选项
    if (!trimmed.startsWith('--')) {
      return true
    }
  }
  
  return false
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

  async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
    // 委托给主命令
    return slideCommand.getPromptForCommand!(`create ${_args}`, context)
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

  async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
    // 委托给主命令
    return slideCommand.getPromptForCommand!(`convert ${_args}`, context)
  },

  allowedTools: ['SlideConverter'],
  progressMessage: '正在转换文章',
  userFacingName: () => 'slide-convert'
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
    '/slide-intelligent "React Hooks 最佳实践" --style=technical --theme=seriph',
  ],

  async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
    const trimmedArgs = _args.trim()
    
    if (!trimmedArgs) {
      return '请提供演示文稿的主题或描述。\n\n用法：/slide-intelligent "你的主题" [选项]\n\n示例：\n- /slide-intelligent "深度学习在计算机视觉中的应用" --style=academic --duration=40\n- /slide-intelligent "Vue 3 新特性" --style=technical\n- /slide-intelligent "季度业务汇报" --style=business'
    }

    // 提取主题和选项
    const topicMatch = trimmedArgs.match(/^"([^"]+)"/) || trimmedArgs.match(/^'([^']+)'/)
    const topic = topicMatch ? topicMatch[1] : trimmedArgs.split(' --')[0].trim()
    const options = topicMatch ? trimmedArgs.substring(topicMatch[0].length).trim() : 
                  trimmedArgs.includes(' --') ? trimmedArgs.substring(trimmedArgs.indexOf(' --')) : ''

    const style = extractOption(options, 'style') || 'professional'
    const theme = extractOption(options, 'theme') || 'seriph'
    const duration = extractOption(options, 'duration') || '20'
    const audience = extractOption(options, 'audience') || 'mixed'
    
    // 生成安全的文件名
    const safeFilename = `${topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}-slides.md`

    return `你是专业的 Slidev 演示文稿生成专家。请为主题"${topic}"创建演示文稿并保存到当前工作目录。

任务要求:
- 主题: ${topic}
- 风格: ${style}
- 主题模板: ${theme} 
- 预计时长: ${duration}分钟
- 目标受众: ${audience}
- 保存文件名: ${safeFilename}
- 保存位置: 当前工作目录 (不是 /tmp 目录)

请按以下步骤执行:

1. 首先告知用户开始生成演示文稿
2. 生成完整的 Slidev Markdown 内容（包含 frontmatter、封面页、目录页、主要内容页、总结页）
3. 调用 Write 工具保存内容到当前目录的文件 "${safeFilename}"
4. 调用 Bash 工具执行 "ls -la ${safeFilename}" 验证文件创建成功
5. 检查 Slidev CLI 是否可用：
   - 调用 Bash 工具执行 "npx @slidev/cli --version" 检查 Slidev 是否已安装
   - 如果命令执行成功，Slidev 可用，继续第6步
   - 如果命令失败，Slidev 不可用，跳转到第7步
6. Slidev 可用时，询问用户是否要立即打开演示文稿，提供三个选项：
   - 选项1: 立即打开演示文稿（执行 npx @slidev/cli ${safeFilename} --open）
   - 选项2: 稍后手动打开（提供命令: npx @slidev/cli ${safeFilename} --open）
   - 选项3: 不打开演示文稿
7. Slidev 不可用时，提供安装引导选项：
   - 选项A: 立即安装 Slidev（推荐使用: npm init slidev@latest）
   - 选项B: 全局安装 CLI（使用: npm install -g @slidev/cli）
   - 选项C: 跳过安装，稍后手动处理
8. 根据用户选择执行相应操作（安装或打开命令）

注意事项:
- 必须使用工具来保存文件到当前工作目录，不要只返回文本
- 内容要适合 ${duration} 分钟演示，面向 ${audience} 受众
- 使用 ${theme} 主题和 ${style} 风格
- 保存的文件路径应该是相对于当前工作目录的，不要使用绝对路径
- 依赖检查和安装引导：
  * 使用 Bash 工具检查 "npx @slidev/cli --version"，超时时间设为10秒
  * 如果检查失败，优先推荐 "npm init slidev@latest" 创建新项目
  * 如果用户选择安装，使用 Bash 工具执行安装命令并显示进度
  * 安装完成后再次验证 Slidev 可用性
- 如果用户选择立即打开，使用 Bash 工具执行 "npx @slidev/cli ${safeFilename} --open"

现在开始执行任务。`
  },

  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'WebSearch', 'WebFetch'],
  progressMessage: '系统: 正在智能生成演示文稿...',
  userFacingName: () => 'slide-intelligent',
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

  async call(_args: string): Promise<string> {
    const trimmedArgs = _args.trim()
    
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
    debugLog(`🚀 正在启动 Slidev 预览：${absolutePath}`)
    
    try {
      // 检查是否需要自动打开浏览器
      const autoOpen = !_args.includes('--no-open')
      const port = extractOption(_args, 'port') || '3030'
      
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
    } catch (_error) {
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
          'npm init slidev@latest  # 推荐：创建新 Slidev 项目',
          'npm install -g @slidev/cli  # 全局安装 CLI',
          'npx @slidev/cli your-slides.md  # 临时使用，无需安装',
          '检查网络连接（首次使用需要下载）',
          '清除 npm 缓存：npm cache clean --force',
        ]
      }
    }
  } catch (_error) {
    return {
      available: false,
      message: `依赖检查失败: ${error}`,
      solutions: [
        '检查 Node.js 和 npm 是否正确安装',
        '重启终端并重试',
        '手动安装：npm install -g @slidev/cli',
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
  } catch (_error) {
    logWarn('搜索文件时出错:', _error)
    
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
  } catch (_error) {
    logWarn('读取历史记录失败:', _error)
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
  } catch (_error) {
    logWarn('保存历史记录失败:', _error)
  }
}


// 导出所有 slide 相关命令 - 精简至5个核心命令
export const slideCommands: SlashCommand[] = [
  slideCommand,              // 主命令 - 智能模式，支持直接主题生成
  slideIntelligentCommand,   // 智能生成 - 完整用户体验标杆
  slideCreateCommand,        // 创建演示 - 优化版，支持依赖检查和用户交互
  slideConvertCommand,       // 文章转换 - 优化版，支持依赖检查和用户交互  
  slidePreviewCommand,       // 预览功能 - 核心功能，支持多种预览选项
]

