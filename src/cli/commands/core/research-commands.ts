import { SlashCommand } from '../../../types/command.js'
import { AgentContext } from '../../../types/agent.js'
import { extractOption } from './utils.js'

/**
 * 调研类命令：research, deep-research
 * 负责主题研究和深度调研报告生成
 */
export const researchCommands: SlashCommand[] = [
  {
    type: 'prompt',
    name: 'research', 
    description: '深度主题研究',
    aliases: ['研究', '调研', 'rs'],
    usage: '/research <主题> [选项]',
    examples: [
      '/research AI Agent架构设计',
      '/research 区块链技术发展 --depth=深入 --sources=10',
      '/research 量子计算应用 --lang=中文 --time=最近一年'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      const [topic, ...options] = _args.split(' ')
      const depth = extractOption(options, 'depth') || '标准'
      const maxSources = extractOption(options, 'sources') || '8'
      const timeRange = extractOption(options, 'time') || '无限制'
      const language = extractOption(options, 'lang') || '中英文'
      
      return `请对主题"${topic}"进行深度研究，提供全面的分析报告：

研究参数：
- 研究深度：${depth}
- 最大来源：${maxSources}个
- 时间范围：${timeRange}
- 语言偏好：${language}

请提供以下内容：

## 1. 主题概述
- 基本定义和核心概念
- 发展历程和重要节点
- 当前的重要性和影响

## 2. 现状分析  
- 技术发展现状
- 主要参与者和厂商
- 市场规模和增长趋势
- 存在的问题和挑战

## 3. 最新发展
- 近期重要突破和进展
- 新技术和新方法
- 行业动态和政策变化

## 4. 不同观点对比
- 支持者的主要观点
- 质疑者的主要担忧
- 学术界的研究方向
- 产业界的应用实践

## 5. 权威资料来源
- 学术论文和研究报告
- 权威机构发布的资料
- 知名专家的观点文章
- 可靠的数据统计来源

## 6. 写作建议
- 适合的文章角度和切入点
- 读者关注的核心问题
- 可以深入讨论的技术细节
- 实用的案例和应用场景

请确保信息准确、来源可靠，并提供具体的引用链接。`
    },
    
    allowedTools: [
      'web_search', 'web_fetch', 'fact_checker', 
      'citation_manager', 'read_article', 'write_article'
    ],
    progressMessage: '正在进行深度主题研究',
    userFacingName: () => 'research'
  },

  {
    type: 'prompt',
    name: 'deep-research',
    description: '智能深度调研报告生成',
    aliases: ['调研', 'dr', '研究报告', '深度调研'],
    usage: '/deep-research <研究主题> [选项]',
    examples: [
      '/deep-research "人工智能在教育领域的应用现状"',
      '/deep-research "区块链技术发展趋势" --depth=深入 --format=学术',
      '/deep-research "量子计算商业化前景" --sources=20 --format=商业'
    ],
    
    async getPromptForCommand(_args: string, _context: AgentContext): Promise<string> {
      const parts = _args.split(' ')
      const topic = parts.find(part => !part.startsWith('--')) || parts[0]
      const options = parts.filter(part => part.startsWith('--'))
      
      const depth = extractOption(options, 'depth') || '标准'
      const format = extractOption(options, 'format') || '综合'
      const maxSources = extractOption(options, 'sources') || '15'
      const timeRange = extractOption(options, 'time') || '最近2年'
      const language = extractOption(options, 'lang') || '中英文'
      
      if (!topic || !topic.trim()) {
        throw new Error('请提供研究主题。用法: /deep-research <研究主题> [选项]')
      }

      const formatMap: Record<string, string> = {
        '学术': '学术研究格式，包含详细的方法论和参考文献',
        '商业': '商业分析格式，突出市场价值和商业机会',
        '技术': '技术分析格式，深入技术细节和实现方案',
        '综合': '综合性分析，平衡学术深度和实用价值'
      }

      const depthMap: Record<string, string> = {
        '快速': '快速调研(15-30分钟)，收集基础信息和核心观点',
        '标准': '标准调研(1-2小时)，全面信息分析和趋势判断',
        '深入': '深度调研(2-4小时)，详尽研究和深层次分析'
      }

      const formatDesc = formatMap[format] || '综合性分析格式'
      const depthDesc = depthMap[depth] || '标准深度调研'

      return `请对主题"${topic}"进行智能深度调研，生成专业级调研报告：

## 📋 调研参数设置
- 研究主题: ${topic}
- 调研深度: ${depthDesc}
- 报告格式: ${formatDesc}  
- 信息源数量: ${maxSources}个
- 时间范围: ${timeRange}
- 语言偏好: ${language}

## 🔍 调研任务要求

### 阶段1: 智能信息收集
1. **多源数据采集**
   - 搜索引擎: 收集最新网络信息和新闻报道
   - 学术资源: 查找相关研究论文和学术资料
   - 官方文档: 收集政府报告、行业白皮书
   - 权威媒体: 获取主流媒体的深度分析

2. **关键词智能扩展**
   - 分析主题核心概念，生成相关搜索关键词
   - 识别同义词、相关术语和行业专用词汇
   - 确保信息收集的全面性和准确性

3. **信息源权威性评估**
   - 评估各信息源的可信度和权威性
   - 优先采用高质量、权威的信息源
   - 标注信息来源和可信度等级

### 阶段2: 深度内容分析
1. **核心观点提取**
   - 识别和提取各信息源的核心观点
   - 分析不同立场和观点的差异
   - 整理主流观点和非主流观点

2. **数据验证与交叉比对**
   - 验证关键数据和统计信息的准确性
   - 进行多源信息交叉验证
   - 识别并标注存在争议的信息

3. **趋势分析与预测**
   - 分析历史发展轨迹和变化趋势
   - 识别当前的发展态势和影响因素
   - 基于数据和专家观点进行趋势预测

### 阶段3: 结构化报告生成
请按以下结构生成专业调研报告：

## 📊 [${topic}] 深度调研报告

### 📋 执行摘要
- **核心发现**: 3-5个最重要的发现和洞察
- **关键数据**: 最重要的统计数据和市场数据
- **主要结论**: 基于调研得出的核心结论
- **行动建议**: 针对不同利益相关者的建议

### 🎯 研究背景与意义
- **问题定义**: 明确研究问题和研究范围
- **研究价值**: 说明研究的重要性和意义
- **方法说明**: 简要说明调研方法和信息来源

### 📈 现状全面分析
#### 3.1 发展历程回顾
- 重要发展节点和里程碑事件
- 关键技术突破或政策变化
- 市场演进和竞争格局变化

#### 3.2 当前发展状况
- 技术成熟度和应用现状
- 市场规模和增长趋势
- 主要参与者和竞争态势
- 存在的问题和挑战

#### 3.3 关键影响因素
- 技术驱动因素
- 政策和监管环境
- 市场需求和用户行为
- 经济和社会环境影响

### 🔍 深度分析与洞察
#### 4.1 技术发展分析
- 核心技术原理和特点
- 技术优势和局限性
- 与其他技术的对比分析
- 技术发展路线图

#### 4.2 市场机会与挑战
- 市场机会和增长潜力
- 面临的主要挑战和风险
- 竞争优势和差异化要素
- 商业模式和盈利模式

#### 4.3 典型应用案例
- 成功案例分析和经验总结
- 失败案例反思和教训
- 最佳实践和实施建议

### 🚀 未来发展预测
#### 5.1 短期展望 (1-2年)
- 预期的技术突破和产品发布
- 市场变化和竞争态势
- 政策环境可能的变化

#### 5.2 中期趋势 (3-5年)
- 技术成熟度和应用普及
- 市场规模和结构变化
- 产业链整合和生态发展

#### 5.3 长期愿景 (5-10年)
- 技术发展的终极目标
- 对社会和经济的深远影响
- 可能的颠覆性变化

### 💡 结论与建议
#### 6.1 核心结论
- 基于调研的主要结论
- 对初始研究问题的回答
- 重要发现的总结

#### 6.2 差异化观点
- 与主流观点不同的见解
- 基于数据的独特分析
- 具有前瞻性的判断

#### 6.3 行动建议
- 针对投资者的建议
- 针对从业者的建议  
- 针对政策制定者的建议
- 针对研究人员的建议

### 📚 信息来源与参考资料
- 按权威性和相关性分类整理所有信息源
- 提供具体的引用链接和访问时间
- 标注信息的可信度和使用建议

### 📊 关键数据与图表建议
- 整理调研过程中的重要数据
- 建议制作的图表和可视化内容
- 数据的解读和分析要点

## ⚡ 特别要求

1. **信息准确性**: 所有数据和观点必须有可靠来源支撑
2. **逻辑清晰**: 报告结构清晰，论述逻辑严密
3. **见解独到**: 不只是信息汇总，要有深度分析和独特见解
4. **实用价值**: 为不同读者群体提供可操作的建议
5. **引用规范**: 所有引用信息都要注明出处和时间

请开始执行这个${depthDesc}，确保生成高质量的专业调研报告。`
    },
    
    allowedTools: [
      'web_search', 'web_fetch', 'fact_checker', 'citation_manager',
      'read_article', 'write_article', 'research_analyzer', 'trend_detector'
    ],
    progressMessage: '正在进行智能深度调研，请稍候...',
    userFacingName: () => 'deep-research'
  }
]