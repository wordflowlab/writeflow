import { SlashCommand } from '../../../types/command.js'
import { AgentContext } from '../../../types/agent.js'
import { getCommandHelp } from './utils.js'
import { generateCostSummary, getDetailedStats } from '../../../services/CostTracker.js'
import { formatDuration } from '../../../utils/format.js'

/**
 * 系统类命令：model, help
 * 负责系统配置和帮助功能
 */
export const systemCommands: SlashCommand[] = [
  {
    type: 'local',
    name: 'model',
    description: '配置和管理 AI 模型设置',
    aliases: ['模型'],
    
    async call(args: string, context: AgentContext): Promise<string> {
      // 启动模型配置界面
      return 'LAUNCH_MODEL_CONFIG'
    },
    
    userFacingName: () => 'model'
  },

  {
    type: 'local', 
    name: 'help',
    description: '显示命令帮助信息',
    aliases: ['帮助', 'h', '?'],
    
    async call(args: string, context: AgentContext): Promise<string> {
      if (args.trim()) {
        // 显示特定命令的详细帮助
        // 注意：这里由于循环依赖问题，暂时返回通用帮助
        // 实际实现中应该通过 CommandExecutor 来处理具体命令帮助
        return `请使用 /help 查看所有命令，或直接执行命令查看其功能。`
      }
      
      return `WriteFlow AI 写作助手 - 命令参考

🎯 规范驱动写作工作流 (推荐):
  /specify <主题>           生成写作规范 → 解决"氛围写作"问题
  /plan [基于规范]          生成详细内容计划 → 明确执行路径
  /task [基于计划]          分解具体写作任务 → 可管理的步骤
  /write <具体任务>         执行任务驱动写作 → 精确的内容创作

📝 传统写作命令:
  /write <主题>             直接写作文章
  /draft <主题>             快速起草内容
  /compose <类型> <主题>    指定类型创作

✨ 内容优化:
  /polish [内容]            润色和优化文本
  /expand <内容>            扩展内容深度
  /simplify <内容>          简化内容表达
  /continue [文件]          续写内容

🔧 工具命令:
  /grammar [内容]           语法检查和纠错
  /summarize <内容>         总结和提炼要点
  /translate <语言> <内容>  翻译文本内容
  /check [内容]             事实核查验证

📚 研究命令:
  /outline <主题>           生成文章大纲
  /research <主题>          深度主题研究
  /deep-research <主题>     智能调研报告生成
  /rewrite <风格> <内容>    智能改写内容

⚙️ 系统命令:
  /model                    配置AI模型
  /help [命令名]            查看帮助信息
  /clear                    清除会话历史

📄 文件引用功能:
  @文件路径                 快速引用文件内容到对话中
  
  示例用法:
  > 分析这个文件 @README.md
  > 帮我优化 @src/utils.js 中的代码
  > 基于 @docs/spec.md 写一份实现方案
  
  支持的文件类型: .js .ts .jsx .tsx .md .json .yaml .py .java .go 等
  安全限制: 只能访问当前项目目录内的文件

🚀 规范驱动写作示例:
> /specify "React性能优化最佳实践"     # 1. 生成写作规范
> /plan                              # 2. 生成内容计划  
> /task                              # 3. 分解写作任务
> /write "Task 1.1: 引言部分写作"     # 4. 执行具体任务

💡 核心优势:
  ✓ 告别"帮我写篇关于AI的文章"的模糊需求
  ✓ 通过规范驱动解决"氛围写作"问题
  ✓ 系统化分解，让复杂写作变得可管理
  ✓ 每个步骤都有明确的目标和验收标准

📖 更多帮助:
> /help specify              查看规范生成详细用法
> /help plan                 查看计划生成使用方法
> /help task                 查看任务分解功能说明
> /help write                查看任务驱动写作用法`
    },
    
    userFacingName: () => 'help'
  },

  {
    type: 'local',
    name: 'cost',
    description: '显示当前会话的 token 使用和成本统计',
    aliases: ['成本', 'tokens', 'usage', '使用量'],
    
    async call(args: string, context: AgentContext): Promise<string> {
      const option = args.trim().toLowerCase()
      
      if (option === 'detailed' || option === 'detail' || option === '详细') {
        // 显示详细统计信息
        const stats = getDetailedStats()
        
        return `📊 WriteFlow 详细使用统计

📈 会话信息:
  会话 ID: ${stats.session.id}
  开始时间: ${new Date(stats.session.startTime).toLocaleString()}
  会话时长: ${formatDuration(stats.session.duration)}
  API 调用时长: ${formatDuration(stats.session.apiDuration)}

💰 成本统计:
  总成本: $${stats.session.cost.toFixed(4)}
  总 tokens: ${stats.session.tokens.toLocaleString()}
  总请求: ${stats.session.requests}
  平均每请求成本: $${(stats.session.cost / Math.max(stats.session.requests, 1)).toFixed(4)}

🤖 模型使用详情:
${Object.entries(stats.models).map(([model, usage]: [string, any]) => 
`  ${model}:
    请求次数: ${usage.requests}
    输入 tokens: ${usage.inputTokens.toLocaleString()}
    输出 tokens: ${usage.outputTokens.toLocaleString()}
    成本: $${usage.cost.toFixed(4)}
    平均时长: ${formatDuration(usage.duration / Math.max(usage.requests, 1))}`
).join('\n')}

📊 成本阈值:
  每日限制: $${stats.thresholds.dailyLimit}
  每月限制: $${stats.thresholds.monthlyLimit}
  警告阈值: ${(stats.thresholds.warningThreshold * 100).toFixed(0)}%
  紧急阈值: ${(stats.thresholds.emergencyThreshold * 100).toFixed(0)}%

📈 最近请求:
${stats.recent.map((entry: any) => 
`  ${new Date(entry.timestamp).toLocaleTimeString()} - ${entry.model}: ${entry.inputTokens + entry.outputTokens} tokens, $${entry.cost.toFixed(4)} (${entry.requestType})`
).join('\n')}

💡 提示: 使用 /cost 查看简洁摘要`
      }
      
      // 默认显示简洁摘要
      return generateCostSummary()
    },
    
    userFacingName: () => 'cost'
  }
]

