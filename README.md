# WriteFlow AI 写作助手

基于 Claude Code 架构的专业 AI 写作助手，为技术型作家提供完整的写作解决方案。

## ✨ 核心特性

- **完整复刻 Claude Code 架构**：h2A消息队列、nO Agent引擎、六层安全验证
- **AI 驱动写作**：智能大纲生成、内容改写、风格调整、语法检查
- **多平台发布**：支持微信公众号、知乎、Medium等平台格式转换
- **深度研究**：网络搜索、事实核查、引用管理
- **高性能设计**：>10,000 msg/sec消息处理，<100ms响应延迟

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/wordflowlab/writeflow.git
cd writeflow

# 安装依赖
npm install

# 构建项目
npm run build

# 全局安装
npm install -g .
```

### 配置 API 密钥

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 基本使用

```bash
# 启动交互模式（推荐）
writeflow
writeflow> /outline AI技术发展趋势
writeflow> /rewrite 通俗 ./article.md
writeflow> /research 量子计算应用
writeflow> /publish wechat ./article.md

# 直接执行单个斜杠命令
writeflow exec "/outline AI技术发展趋势"
writeflow exec "/rewrite 通俗 ./article.md"
writeflow exec "/research 量子计算应用"
```

## 📋 命令参考

### 斜杠命令系统

WriteFlow 使用斜杠命令系统，完全复刻 Claude Code 的命令体验：

```bash
# 在交互模式中使用斜杠命令
writeflow> /outline <主题> [选项]
writeflow> /rewrite <风格> <内容或文件路径> [选项]  
writeflow> /research <主题> [选项]
writeflow> /publish <平台> <文件> [选项]
writeflow> /help              # 查看所有命令

# 支持中英文别名
writeflow> /大纲 AI技术发展   # 等同于 /outline
writeflow> /改写 通俗 ./article.md
writeflow> /研究 量子计算
writeflow> /帮助              # 等同于 /help
```

### 命令选项

```bash
# 生成文章大纲
/outline <主题> --style=技术性 --length=2000 --audience=技术人员

# 智能改写内容  
/rewrite <风格> <文件路径> --keep-structure --tone=专业

# 深度主题研究
/research <主题> --depth=标准 --sources=8 --time=最近一年

# 发布到平台
/publish <平台> <文件> --tags=AI,技术 --auto-format
```

### CLI 系统命令

```bash
# 启动交互模式（默认）
writeflow

# 直接执行斜杠命令
writeflow exec "/outline AI技术发展"
writeflow exec "/help"

# 配置管理
writeflow config --set model=claude-3-opus-20240229
writeflow config --get model
writeflow config --list

# 系统状态
writeflow status
```

## 🏗️ 架构设计

### 核心组件

```text
┌─────────────────────────────────────────────────┐
│                 WriteFlow CLI                   │
├─────────────────────────────────────────────────┤
│  斜杠命令系统  │  交互界面  │  配置管理           │
├─────────────────────────────────────────────────┤
│           工具系统 (Tool Manager)               │
│  基础工具  │  写作工具  │  研究工具  │  发布工具   │
├─────────────────────────────────────────────────┤
│                 nO Agent 引擎                   │
│  消息处理  │  任务调度  │  状态管理              │
├─────────────────────────────────────────────────┤
│  h2A消息队列 │ wU2上下文管理 │ 六层安全验证       │
└─────────────────────────────────────────────────┘
```

### 性能指标

- **消息队列吞吐量**: >10,000 msg/sec
- **响应延迟**: <100ms
- **内存使用**: <256MB
- **启动时间**: <3秒

## 🛠️ 开发指南

### 项目结构

```text
src/
├── cli/                    # CLI 界面
│   ├── commands/          # 斜杠命令
│   ├── executor/          # 命令执行器
│   ├── parser/           # 命令解析器
│   └── writeflow-cli.ts  # CLI 主入口
├── core/                   # 核心引擎
│   ├── agent/            # nO Agent 系统
│   ├── context/          # wU2 上下文管理
│   ├── queue/            # h2A 消息队列
│   └── security/         # 六层安全框架
├── tools/                  # 工具系统
│   ├── base/             # 基础文章操作
│   ├── writing/          # 高级写作工具
│   ├── research/         # 研究工具
│   └── publish/          # 发布工具
└── types/                  # TypeScript 类型定义
```

### 本地开发

```bash
# 开发模式
npm run dev

# 运行测试
npm test
npm run test:watch

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

### 添加自定义工具

```typescript
import { WritingTool, ToolInput, ToolResult } from '@/types/tool.js'

export class CustomTool implements WritingTool {
  name = 'custom_tool'
  description = '自定义工具描述'
  securityLevel = 'safe'
  
  async execute(input: ToolInput): Promise<ToolResult> {
    // 实现自定义逻辑
    return {
      success: true,
      content: '处理结果'
    }
  }
}
```

### 添加自定义命令

```typescript
{
  type: 'prompt',
  name: 'custom_command',
  description: '自定义命令',
  aliases: ['自定义', 'cc'],
  async getPromptForCommand(args: string): Promise<string> {
    return `自定义提示词: ${args}`
  },
  userFacingName: () => 'custom_command'
}
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 测试特定组件
npm run test:queue    # 消息队列测试
npm run test:agent    # Agent 引擎测试
npm run test:tools    # 工具系统测试

# 端到端测试
npm run test:e2e

# 性能基准测试
npm run benchmark
```

## 📊 监控和调试

```bash
# 启用详细调试
DEBUG=writeflow:* writeflow outline "AI技术"

# 特定组件调试
DEBUG=writeflow:h2a,writeflow:nO writeflow research "机器学习"

# 性能分析
writeflow status
writeflow config --get performance
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 遵循 TypeScript 严格模式
- 所有新功能必须包含测试
- 保持与 Claude Code 架构一致性
- 性能优化优先

## 📄 许可证

本项目基于 MIT 许可证开源。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- [Anthropic](https://www.anthropic.com/) - Claude AI 技术支持
- [Claude Code](https://claude.ai/code) - 架构设计参考

---

**WriteFlow** - 让 AI 写作更专业 🚀
