import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'
import { ThemeNames, getTheme, detectSystemTheme, getRecommendedTheme } from '../../utils/theme.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

/**
 * 系统管理命令实现
 */
export const systemCommands: SlashCommand[] = [
  {
    type: 'local',
    name: 'model',
    description: '设置AI模型',
    aliases: ['模型', 'ai'],
    usage: '/model [模型名]',
    examples: [
      '/model claude-3-opus-20240229',
      '/model claude-3-sonnet-20240229',
      '/model'
    ],
    
    async call(args: string, context: AgentContext): Promise<string> {
      const input = args.trim()
      
      // 获取默认模型的辅助函数
      const getDefaultModel = (provider: string): string => {
        switch (provider) {
          case 'deepseek': return 'deepseek-chat'
          case 'qwen3': return 'qwen-max'  
          case 'glm4.5': return 'glm-4.5'
          default: return 'claude-opus-4-1-20250805'
        }
      }
      
      // 获取当前配置
      const currentProvider = process.env.API_PROVIDER || 'anthropic'
      const currentModel = process.env.AI_MODEL || getDefaultModel(currentProvider)
      
      // 定义所有支持的模型
      const supportedModels = {
        anthropic: [
          { name: 'claude-opus-4-1-20250805', desc: 'Opus 4.1 - 最强推理', default: true },
          { name: 'claude-opus-4-1-20250805-thinking', desc: 'Opus 4.1 思维链' },
          { name: 'claude-opus-4-20250514', desc: 'Opus 4 - 强大推理' },
          { name: 'claude-sonnet-4-20250514', desc: 'Sonnet 4 - 平衡性能' },
          { name: 'claude-3-5-sonnet-20241022', desc: 'Sonnet 3.5 - 快速响应' },
          { name: 'claude-3-5-haiku-20241022', desc: 'Haiku 3.5 - 极速' }
        ],
        deepseek: [
          { name: 'deepseek-chat', desc: '通用对话模型', default: true },
          { name: 'deepseek-reasoner', desc: '深度推理模型' },
          { name: 'deepseek-v3-chat', desc: 'v3 对话模型' },
          { name: 'deepseek-v3-reasoner', desc: 'v3 推理模型' }
        ],
        qwen3: [
          { name: 'qwen-max', desc: '最强版本', default: true },
          { name: 'qwen-plus', desc: '高性价比版本' },
          { name: 'qwen-turbo', desc: '速度优先版本' }
        ],
        'glm4.5': [
          { name: 'glm-4.5', desc: '升级版本', default: true },
          { name: 'glm-4', desc: '标准版本' },
          { name: 'glm-4-air', desc: '轻量快速版本' },
          { name: 'glm-4-flash', desc: '极速响应版本' },
          { name: 'glm-4v', desc: '多模态版本' }
        ]
      }
      
      if (!input) {
        // 显示当前配置和所有可用模型
        let result = `当前配置:\n  提供商: ${currentProvider}\n  模型: ${currentModel}\n\n可用模型:\n\n`
        
        Object.entries(supportedModels).forEach(([provider, models]) => {
          const providerNames = {
            anthropic: 'Anthropic Claude',
            deepseek: 'Deepseek v3.1',
            qwen3: '通义千问 Qwen3',
            'glm4.5': '智谱 GLM-4.5'
          }
          
          result += `【${providerNames[provider as keyof typeof providerNames]}】\n`
          models.forEach(model => {
            const defaultMark = model.default ? ' (默认)' : ''
            result += `  • ${model.name}${defaultMark} - ${model.desc}\n`
          })
          result += '\n'
        })
        
        result += '使用方法:\n  /model <提供商>        - 切换提供商\n  /model <模型名>       - 切换具体模型'
        return result
      }
      
      // 检查是否是提供商切换
      if (Object.keys(supportedModels).includes(input)) {
        const defaultModel = supportedModels[input as keyof typeof supportedModels]
          .find(model => model.default)?.name || supportedModels[input as keyof typeof supportedModels][0].name
        return `已切换到提供商: ${input}\n默认模型: ${defaultModel}\n\n请设置环境变量:\nexport API_PROVIDER=${input}\nexport AI_MODEL=${defaultModel}`
      }
      
      // 检查具体模型名
      const allModels = Object.values(supportedModels).flat().map(m => m.name)
      if (!allModels.includes(input)) {
        return `无效的模型名: ${input}\n\n使用 /model 查看所有可用模型`
      }
      
      // 找到模型对应的提供商
      let targetProvider = ''
      for (const [provider, models] of Object.entries(supportedModels)) {
        if (models.some(model => model.name === input)) {
          targetProvider = provider
          break
        }
      }
      
      return `已切换到模型: ${input}\n提供商: ${targetProvider}\n\n请设置环境变量:\nexport API_PROVIDER=${targetProvider}\nexport AI_MODEL=${input}`
    },
    
    userFacingName: () => 'model'
  },

  {
    type: 'local',
    name: 'settings',
    description: '打开设置界面',
    aliases: ['设置', 'config'],
    
    async call(_args: string, context: AgentContext): Promise<string> {
      const getDefaultModel = (provider: string): string => {
        switch (provider) {
          case 'deepseek': return 'deepseek-chat'
          case 'qwen3': return 'qwen-max'  
          case 'glm4.5': return 'glm-4.5'
          default: return 'claude-opus-4-1-20250805'
        }
      }
      
      const currentProvider = process.env.API_PROVIDER || 'anthropic'
      const currentModel = process.env.AI_MODEL || getDefaultModel(currentProvider)
      
      return `WriteFlow 设置

📝 写作设置:
  默认风格: 技术性文章
  目标字数: 2000
  自动大纲: 启用
  
🤖 AI 设置:
  提供商: ${currentProvider}
  模型: ${currentModel}
  温度: 0.7
  
📤 发布设置:
  微信自动格式化: 启用
  知乎添加引用: 启用

⚡ 性能设置:
  最大并发工具: ${context.configuration?.maxConcurrentTools || 5}
  工具超时: ${context.configuration?.toolTimeout || 120000}ms
  上下文压缩阈值: ${context.configuration?.contextCompressionThreshold || 0.92}
  
使用 /model, /style 等命令修改具体设置`
    },
    
    userFacingName: () => 'settings'
  },

  {
    type: 'local',
    name: 'status',
    description: '查看系统状态',
    aliases: ['状态', 'stat'],
    
    async call(_args: string, context: AgentContext): Promise<string> {
      const now = new Date().toLocaleString('zh-CN')

      // 读取应用状态（如果 UI 或 CLI 在 global 注入了 app 实例）
      let agentSummary = ''
      try {
        const app: any = (global as any).WRITEFLOW_APP_INSTANCE
        if (app?.getSystemStatus) {
          const st = await app.getSystemStatus()
          const aq = st.h2aQueue
          const ah = st.agent
          const bs = st.bridgeStats
          agentSummary = `\n- h2A: size=${aq?.queueSize||0}, throughput=${aq?.throughput||0}/s, processed=${aq?.messagesProcessed||0}` +
                         `\n- Agent: state=${ah?.state||'idle'}, healthy=${ah?.healthy}, errors=${ah?.statistics?.errorCount||0}` +
                         `\n- Bridge: prompts=${bs?.promptsHandled||0}, toolCalls=${bs?.toolCallsExecuted||0}`
        }
      } catch {}

      return `WriteFlow 系统状态 (${now})

🧠 Agent 状态:
  会话 ID: ${context.sessionId}
  当前状态: ${context.currentState || 'idle'}
  计划模式: ${context.planMode || 'default'}
  工作目录: ${context.workingDirectory || 'unknown'}${agentSummary}

📊 统计信息:
  消息已处理: ${context.statistics?.messagesProcessed || 0}
  工具调用次数: ${context.statistics?.toolInvocations || 0}
  平均响应时间: ${context.statistics?.averageResponseTime || 0}ms
  错误计数: ${context.statistics?.errorCount || 0}

⚙️ 配置信息:
  最大并发工具: ${context.configuration?.maxConcurrentTools || 5}
  工具超时: ${context.configuration?.toolTimeout || 120000}ms
  安全级别: ${context.configuration?.securityLevel || 'normal'}

💾 资源使用:
  内存使用: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB
  Node.js 版本: ${process.version}

🚀 版本信息:
  WriteFlow: 1.0.4
  状态: 运行正常`
    },
    
    userFacingName: () => 'status'
  },

  {
    type: 'local',
    name: 'clear',
    description: '清除会话历史',
    aliases: ['清除', '重置', 'reset'],
    
    async call(_args: string, context: AgentContext): Promise<string> {
      // 清理上下文
      if (context.conversationHistory) {
        context.conversationHistory.length = 0
      }
      
      // 重置统计信息
      if (context.statistics) {
        context.statistics.messagesProcessed = 0
        context.statistics.toolInvocations = 0
        context.statistics.averageResponseTime = 0
        context.statistics.errorCount = 0
        context.statistics.lastActivity = Date.now()
      }
      
      return `✅ 会话历史已清除
      
系统状态:
- 对话历史: 已重置
- 统计信息: 已重置
- 上下文压缩: 已释放

可以开始新的写作会话了！`
    },
    
    userFacingName: () => 'clear'
  },

  {
    type: 'local',
    name: 'theme',
    description: '管理和切换 WriteFlow 主题',
    aliases: ['主题', '配色', 'color'],
    usage: '/theme [子命令] [参数]',
    examples: [
      '/theme list',
      '/theme set light',
      '/theme detect',
      '/theme preview dark-accessible'
    ],
    
    async call(args: string, context: AgentContext): Promise<string> {
      const parts = args.trim().split(/\s+/)
      const subCommand = parts[0]?.toLowerCase()
      const parameter = parts[1] as ThemeNames
      
      switch (subCommand) {
        case 'list':
          return listThemes()
        case 'set':
          return setTheme(parameter)
        case 'current':
          return showCurrentTheme()
        case 'detect':
          return detectSystemThemeInfo()
        case 'preview':
          return previewTheme(parameter)
        case 'reset':
          return resetTheme()
        default:
          // 检查是否为直接主题名（如 /theme dark）
          const validThemes: ThemeNames[] = ['dark', 'light', 'dark-accessible', 'light-accessible', 'auto']
          if (validThemes.includes(subCommand as ThemeNames)) {
            return setTheme(subCommand as ThemeNames)
          }
          return showHelp()
      }

      function listThemes(): string {
        const config = getGlobalConfig()
        const currentTheme = config.theme || 'dark'
        
        const themes = [
          { name: 'dark', description: '浅色文字（深色背景）- 经典绿色品牌风格' },
          { name: 'light', description: '深色文字（浅色背景）- 优化的蓝色配色' },
          { name: 'dark-accessible', description: '浅色文字（高对比度）- 增强可访问性' },
          { name: 'light-accessible', description: '深色文字（高对比度）- 视觉辅助友好' },
          { name: 'auto', description: '智能检测 - 根据系统主题自动选择' }
        ]

        let result = '📋 可用主题:\n\n'
        
        themes.forEach(theme => {
          const marker = theme.name === currentTheme ? '●' : '○'
          const status = theme.name === currentTheme ? ' (当前)' : ''
          result += `${marker} ${theme.name}${status}\n`
          result += `   ${theme.description}\n\n`
        })

        result += '💡 使用方法:\n'
        result += '  /theme set <主题名>  - 设置主题\n'
        result += '  /theme preview <主题名> - 预览主题\n'
        result += '  /theme detect - 检测系统主题'
        
        return result
      }

      function setTheme(themeName: ThemeNames): string {
        if (!themeName) {
          return '❌ 请指定主题名称\n使用 /theme list 查看可用主题'
        }

        const validThemes: ThemeNames[] = ['dark', 'light', 'dark-accessible', 'light-accessible', 'auto']
        if (!validThemes.includes(themeName)) {
          return `❌ 无效的主题: ${themeName}\n使用 /theme list 查看可用主题`
        }

        try {
          const config = getGlobalConfig()
          saveGlobalConfig({
            ...config,
            theme: themeName
          })

          return `✅ 主题已切换到: ${themeName}\n\n${previewTheme(themeName, false)}`
        } catch (error) {
          return `❌ 设置主题时出错: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }

      function showCurrentTheme(): string {
        const config = getGlobalConfig()
        const currentTheme = config.theme || 'dark'
        
        let result = `🎨 当前主题: ${currentTheme}\n`
        
        // 如果是 auto 主题，显示实际检测到的主题
        if (currentTheme === 'auto') {
          const detected = detectSystemTheme()
          const actual = detected !== 'unknown' ? detected : 'dark'
          result += `   实际使用: ${actual} (${detected !== 'unknown' ? '自动检测' : '默认fallback'})\n`
        }

        result += `\n${previewTheme(currentTheme, false)}`
        return result
      }

      function detectSystemThemeInfo(): string {
        const detected = detectSystemTheme()
        const recommended = getRecommendedTheme()

        let result = '🔍 系统主题检测结果:\n\n'
        
        if (detected !== 'unknown') {
          result += `✅ 检测到系统主题: ${detected === 'dark' ? '深色模式' : '浅色模式'}\n`
          result += `💡 推荐主题: ${recommended}\n`
        } else {
          result += '❓ 无法自动检测系统主题\n'
          result += `💡 默认推荐: ${recommended}\n\n`
          result += '可能的原因:\n'
          result += '  - 不支持的操作系统或终端\n'
          result += '  - 系统主题设置未标准化\n'
          result += '  - 权限限制\n'
        }
        
        result += `\n使用 /theme set ${recommended} 应用推荐主题`
        return result
      }

      function previewTheme(themeName: ThemeNames, showHeader: boolean = true): string {
        if (!themeName) {
          return '❌ 请指定要预览的主题名称'
        }

        try {
          const theme = getTheme(themeName)

          let result = showHeader ? `🎨 ${themeName} 主题预览:\n\n` : ''

          // 使用 ANSI 颜色代码显示实际颜色效果
          const colorize = (text: string, hexColor: string) => {
            // 简化的 hex 到 ANSI 转换映射
            const colorMap: Record<string, string> = {
              '#00ff87': '\x1b[92m',  // 亮绿色
              '#007acc': '\x1b[94m',  // 蓝色
              '#2c7a39': '\x1b[32m',  // 绿色
              '#cc0000': '\x1b[31m',  // 红色
              '#ff6b6b': '\x1b[91m',  // 亮红色
              '#e65100': '\x1b[33m',  // 橙色/黄色
              '#ff9500': '\x1b[93m',  // 亮黄色
              '#ffaa00': '\x1b[93m',  // 亮黄色
              '#ff4444': '\x1b[91m',  // 亮红色
              '#0066cc': '\x1b[34m',  // 深蓝色
              '#006600': '\x1b[32m',  // 深绿色
              '#ffffff': '\x1b[97m',  // 白色
              '#000000': '\x1b[30m',  // 黑色
              '#1a1a1a': '\x1b[90m',  // 深灰色
            }
            
            const ansiColor = colorMap[hexColor] || '\x1b[0m'
            return `${ansiColor}${text}\x1b[0m (${hexColor})`
          }

          result += `● ${colorize('WriteFlow AI 写作助手', theme.claude)}\n`
          result += `✅ ${colorize('成功消息示例', theme.success)}\n`
          result += `⚠ ${colorize('警告消息示例', theme.warning)}\n`
          result += `❌ ${colorize('错误消息示例', theme.error)}\n`
          result += `💭 ${colorize('AI 思考状态', theme.thinking)}\n`
          result += `📝 ${colorize('写作模式', theme.writing)}`
          
          return result
        } catch (error) {
          return `❌ 预览主题时出错: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }

      function resetTheme(): string {
        try {
          const config = getGlobalConfig()
          const defaultTheme = getRecommendedTheme()
          
          saveGlobalConfig({
            ...config,
            theme: defaultTheme
          })

          return `✅ 主题已重置为: ${defaultTheme}\n\n${previewTheme(defaultTheme, false)}`
        } catch (error) {
          return `❌ 重置主题时出错: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }

      function showHelp(): string {
        return `🎨 WriteFlow 主题管理

用法: /theme <子命令> [参数]

子命令:
  list                    显示所有可用主题
  current                 显示当前主题
  set <主题名>             设置主题
  preview <主题名>         预览主题效果
  detect                  检测系统主题
  reset                   重置为推荐主题
  help                    显示此帮助

可用主题:
  dark                    浅色文字（深色背景）
  light                   深色文字（浅色背景）
  dark-accessible         高对比度深色主题
  light-accessible        高对比度浅色主题
  auto                    智能检测系统主题

示例:
  /theme list             # 列出所有主题
  /theme set light        # 切换到浅色主题
  /theme detect           # 检测系统主题`
      }
    },
    
    userFacingName: () => 'theme'
  }
]