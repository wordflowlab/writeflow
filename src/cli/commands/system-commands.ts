import { SlashCommand } from '../../types/command.js'
import { AgentContext } from '../../types/agent.js'

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
      
      return `WriteFlow 系统状态 (${now})

🧠 Agent 状态:
  会话 ID: ${context.sessionId}
  当前状态: ${context.currentState || 'idle'}
  计划模式: ${context.planMode || 'default'}
  工作目录: ${context.workingDirectory || 'unknown'}
  
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
  }
]