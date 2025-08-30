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
      const modelName = args.trim()
      
      if (!modelName) {
        return `当前模型: ${context.configuration?.maxContextTokens ? 'claude-3-opus-20240229' : 'claude-3-opus-20240229'}
        
可用模型:
- claude-3-opus-20240229 (最强推理能力)
- claude-3-sonnet-20240229 (平衡性能)
- claude-3-haiku-20240307 (最快响应)

使用方法: /model <模型名>`
      }
      
      const validModels = [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229', 
        'claude-3-haiku-20240307'
      ]
      
      if (!validModels.includes(modelName)) {
        return `无效的模型名: ${modelName}
        
可用模型: ${validModels.join(', ')}`
      }
      
      // 模型设置成功提示
      return `已切换到模型: ${modelName}`
    },
    
    userFacingName: () => 'model'
  },

  {
    type: 'local',
    name: 'settings',
    description: '打开设置界面',
    aliases: ['设置', 'config'],
    
    async call(_args: string, context: AgentContext): Promise<string> {
      return `WriteFlow 设置

📝 写作设置:
  默认风格: 技术性文章
  目标字数: 2000
  自动大纲: 启用
  
🤖 AI 设置:
  提供商: anthropic
  模型: claude-3-opus-20240229
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