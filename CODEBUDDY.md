# CODEBUDDY.md

This document provides guidance for future CodeBuddy Code instances working with the WriteFlow AI Writing Assistant codebase.

## 项目概述

WriteFlow 是基于 Claude Code 架构的专业 AI 写作助手，实现了规范驱动的写作工作流。核心理念是通过 `specify → plan → task → write` 的完整工作流解决传统"氛围写作"问题。

## 开发命令

### 基础开发
```bash
# 构建项目
npm run build

# 开发模式（热重载）
npm run dev

# 启动已构建的应用
npm run start

# 清理构建文件
npm run clean
```

### 代码质量
```bash
# TypeScript 类型检查
npm run typecheck

# ESLint 代码检查
npm run lint
npm run lint:fix
```

### 测试系统
```bash
# 运行所有测试
npm test

# 监听模式测试
npm run test:watch

# 组件特定测试
npm run test:queue    # h2A 消息队列测试
npm run test:agent    # nO Agent 引擎测试  
npm run test:tools    # 工具系统测试
npm run test:e2e      # 端到端测试

# 性能基准测试
npm run benchmark
```

### 单个测试运行
```bash
# 运行特定测试文件
npm test -- --testPathPattern="queue"
npm test -- --testNamePattern="should process messages"

# 调试模式运行测试
npm test -- --verbose --no-cache
```

## 核心架构

### 三层架构设计

WriteFlow 采用了复刻 Claude Code 的三层架构：

1. **CLI 层** (`src/cli/`)
   - 命令解析和执行 (`commands/`, `executor/`)
   - 交互式 UI (`WriteFlowREPL.tsx`)
   - 主应用类 (`writeflow-app.ts`)

2. **核心引擎层** (`src/core/`)
   - **h2A 消息队列** (`queue/h2A-queue.ts`): 高性能双缓冲异步消息队列，目标 >10,000 msg/sec
   - **nO Agent 引擎** (`agent/nO-engine.ts`): 智能任务调度和状态管理
   - **wU2 上下文压缩** (`context/wU2-compressor.ts`): 智能上下文压缩和管理
   - **六层安全验证** (`security/six-layer-validator.ts`): 多层安全防护机制

3. **工具生态层** (`src/tools/`)
   - 基础工具：文件操作、搜索、系统命令
   - 写作工具：大纲生成、内容改写、语法检查
   - 研究工具：网络搜索、事实核查、引用管理
   - 发布工具：平台格式转换

### 关键设计模式

#### 1. 规范驱动工作流
核心4命令系统实现规范驱动写作：
- `/specify <主题>`: 将模糊需求转化为明确写作规范
- `/plan`: 基于规范生成详细内容计划
- `/task`: 将计划分解为可执行写作任务  
- `/write <任务>`: 基于明确任务进行精确写作

#### 2. Plan 模式系统
完全复刻 Claude Code 的 Plan 模式：
- **PlanModeManager** (`src/modes/PlanModeManager.ts`): 核心状态管理
- **ExitPlanMode 工具**: AI 请求退出计划模式的工具调用
- **UI 集成**: 计划模式警告和确认界面
- **权限控制**: 计划模式下只允许只读操作

#### 3. 事件驱动架构
WriteFlowApp 继承 EventEmitter，关键事件：
- `plan-mode-changed`: Plan 模式状态变化
- `exit-plan-mode`: 请求退出 Plan 模式
- `ai-thinking`: AI 思考过程
- `todo:changed`: TodoList 更新

#### 4. 工具系统架构
双重工具系统设计：
- **WritingTool 接口**: 传统工具接口 (`src/types/tool.ts`)
- **WriteFlowTool 接口**: 增强工具接口 (`src/Tool.ts`)
- **工具编排器**: 统一工具管理和权限控制

## 重要实现细节

### AI 服务集成
- **WriteFlowAIService** (`src/services/ai/WriteFlowAIService.ts`): 统一 AI 服务接口
- 支持多提供商：Anthropic, DeepSeek, Qwen, GLM
- 流式输出和工具调用支持

### 内存和上下文管理
- **MemoryManager**: 三层记忆架构（短期、中期、长期）
- **ContextManager**: 智能上下文压缩和检索
- **TodoManager**: 任务状态持久化

### UI 系统 (React + Ink)
- **WriteFlowREPL**: 主交互界面
- **PlanModeAlert/PlanModeConfirmation**: Plan 模式 UI 组件
- **TodoPanel**: 任务面板
- **Message**: 统一消息渲染

### 性能优化
- 双缓冲消息队列避免阻塞
- 智能上下文压缩减少 token 使用
- 异步工具调用和并发支持
- 流式输出提升用户体验

## 开发约定

### TypeScript 配置
- 严格模式启用
- ESNext 模块系统
- 路径别名：`@/*` 映射到 `src/*`
- 构建和开发使用不同 tsconfig

### 测试策略
- Jest 测试框架
- 按组件分类测试 (queue, agent, tools)
- 端到端测试验证完整工作流
- 性能基准测试确保指标达成

### 代码组织原则
- 功能模块化：每个核心功能独立目录
- 接口优先：定义清晰的类型接口
- 事件驱动：使用事件解耦组件间通信
- 错误处理：统一错误处理和日志记录

## 调试和监控

### 调试模式
```bash
# 启用详细调试日志
DEBUG=writeflow:* npm run dev

# 特定组件调试
DEBUG=writeflow:h2a,writeflow:nO npm run dev

# 性能分析
npm run start -- status
```

### 关键日志点
- h2A 队列：消息吞吐量和延迟
- nO Agent：任务调度和状态转换
- Plan 模式：模式切换和权限检查
- 工具调用：执行状态和错误处理

## 扩展开发

### 添加新工具
1. 实现 `WritingTool` 接口
2. 在 `src/tools/` 对应分类目录创建
3. 在 `ToolManager` 中注册
4. 添加对应测试

### 添加新命令
1. 在 `src/cli/commands/core/` 创建命令定义
2. 实现 `getPromptForCommand` 方法
3. 在命令索引中注册
4. 更新帮助文档

### Plan 模式扩展
Pl模式是核心功能，修改时需要：
1. 更新 `PlanModeManager` 状态管理
2. 同步 UI 组件状态
3. 确保权限控制正确
4. 测试完整工作流

## 重要注意事项

- **不要修改现有测试用例**：如测试确有问题，需要确认
- **保持 Claude Code 架构一致性**：核心设计模式不可随意更改
- **性能优先**：所有修改需考虑对 >10,000 msg/sec 目标的影响
- **规范驱动**：新功能应符合 specify→plan→task→write 工作流
- **中文输出**：按照 CLAUDE.md 要求，输出使用中文

## 当前开发状态

**阶段1已完成**：核心4命令系统实现和 Plan 模式集成
- ✅ 规范驱动写作工作流建立
- ✅ Plan 模式完全集成
- ✅ 工具系统和 UI 组件完善
- ✅ 编译和基础测试通过

**下阶段目标**：工作流优化和用户体验提升