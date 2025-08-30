# AI 提供商配置指南

WriteFlow 是一个强大的 AI 写作助手，支持四大主流 AI 提供商。本指南将详细说明如何配置和使用这些提供商。

## 🚀 支持的 AI 提供商

| 提供商 | 模型 | 上下文长度 | 特色功能 | 计费货币 |
|--------|------|-----------|----------|---------|
| **Anthropic** | Claude 4.1 | 200K | 超强推理能力 | USD |
| **Deepseek** | v3.1 | 128K | 推理专用模型 | - |
| **通义千问** | Qwen3 | 30K | 中文优化 | CNY |
| **智谱GLM** | 4.5 | 128K | 多模态支持 | CNY |

## 📦 安装 WriteFlow

### 全局安装（推荐）

```bash
npm install -g writeflow
```

### 从源码安装

```bash
git clone https://github.com/wordflowlab/writeflow.git
cd writeflow
npm install
npm run build
npm install -g .
```

**系统要求**: Node.js >= 18.0.0

## ⚙️ 配置各 AI 提供商

### 1. Anthropic Claude

#### 获取 API 密钥

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 前往 **API Keys** 页面
4. 点击 **Create Key** 创建新密钥
5. 复制生成的 API 密钥（以 `sk-` 开头）

#### 环境变量配置

```bash
# 设置 Anthropic 为默认提供商
export API_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-your-anthropic-api-key-here

# 可选：自定义 API 端点（代理/中转）
export API_BASE_URL=https://your-proxy-url.com/v1
```

#### 支持的模型

```bash
# Claude 4.1 系列（最新）
claude-opus-4-1-20250805          # 默认模型
claude-opus-4-1-20250805-thinking

# Claude 4 系列
claude-opus-4-20250514
claude-sonnet-4-20250514

# Claude 3.5 系列
claude-3-5-sonnet-20241022
claude-3-5-haiku-20241022
```

#### 使用示例

```bash
writeflow
writeflow> 你好，请介绍一下人工智能的发展历程
writeflow> /outline 深度学习技术发展趋势
```

---

### 2. Deepseek v3.1

#### 获取 API 密钥

1. 访问 [Deepseek 开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 前往 **API Keys** 管理页面
4. 创建新的 API 密钥
5. 复制生成的密钥

#### 环境变量配置

```bash
# 设置 Deepseek 为提供商
export API_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
export API_BASE_URL=https://api.deepseek.com

# 可选：指定模型
export AI_MODEL=deepseek-chat
```

#### 支持的模型

```bash
# Deepseek v3.1 系列
deepseek-chat      # 通用对话模型（默认）
deepseek-reasoner  # 推理专用模型

# 兼容别名
deepseek-v3-chat
deepseek-v3-reasoner
```

#### 使用示例

```bash
writeflow
writeflow> 请分析一下量子计算的技术原理
writeflow> /research 深度强化学习最新进展
```

---

### 3. 通义千问 Qwen3

#### 获取 API 密钥

1. 访问 [阿里云控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 开通 **模型服务灵积（DashScope）**
4. 前往 **API Key 管理** 页面
5. 创建并复制 API 密钥

#### 环境变量配置

```bash
# 设置 Qwen3 为提供商
export API_PROVIDER=qwen3
export QWEN_API_KEY=sk-your-qwen-api-key-here
export API_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 可选：指定模型
export AI_MODEL=qwen-max
```

#### 支持的模型

```bash
# Qwen3 商业版
qwen-max           # 最强版本（默认）
qwen-plus          # 高性价比版本
qwen-turbo         # 快速响应版本

# Qwen2.5 开源版
qwen2.5-72b-instruct
qwen2.5-32b-instruct
qwen2.5-14b-instruct
qwen2.5-7b-instruct
```

#### 定价信息（CNY）

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| qwen-max | ¥0.02/千token | ¥0.06/千token |
| qwen-plus | ¥0.004/千token | ¥0.012/千token |
| qwen-turbo | ¥0.0015/千token | ¥0.002/千token |

#### 使用示例

```bash
writeflow
writeflow> 帮我写一篇关于中国古代科技发展的文章大纲
writeflow> /rewrite 学术 ./my-article.md
```

---

### 4. 智谱 GLM-4.5

#### 获取 API 密钥

1. 访问 [智谱开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 完成实名认证
4. 前往 **API Keys** 管理页面
5. 创建并复制 API 密钥

#### 环境变量配置

```bash
# 设置 GLM-4.5 为提供商
export API_PROVIDER=glm4.5
export GLM_API_KEY=your-glm-api-key-here
export API_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# 可选：指定模型
export AI_MODEL=glm-4.5
```

#### 支持的模型

```bash
# GLM-4 系列
glm-4              # 标准版本
glm-4.5            # 升级版本（默认）
glm-4-air          # 轻量版本
glm-4-flash        # 极速版本
glm-4v             # 多模态版本
```

#### 模型特性

| 模型 | 上下文 | 特色功能 | 响应速度 |
|------|--------|---------|---------|
| glm-4.5 | 128K | 超强推理 | 标准 |
| glm-4-air | 128K | 快速响应 | 快速 |
| glm-4-flash | 128K | 毫秒响应 | 极速 |
| glm-4v | 2K | 多模态 | 标准 |

#### 定价信息（CNY）

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| glm-4 | ¥0.1/千token | ¥0.1/千token |
| glm-4.5 | ¥0.05/千token | ¥0.05/千token |
| glm-4-air | ¥0.001/千token | ¥0.001/千token |
| glm-4-flash | ¥0.0001/千token | ¥0.0001/千token |

#### 使用示例

```bash
writeflow
writeflow> 请从哲学角度分析人工智能的发展
writeflow> /outline 认知科学与人工智能的交叉研究
```

## 🎯 使用指南

### 启动 WriteFlow

```bash
# 启动交互模式
writeflow

# 检查当前配置
writeflow status
```

### 切换提供商

您可以通过修改环境变量来切换不同的 AI 提供商：

```bash
# 切换到 Deepseek
export API_PROVIDER=deepseek
export DEEPSEEK_API_KEY=your-key

# 切换到 Qwen3
export API_PROVIDER=qwen3
export QWEN_API_KEY=your-key

# 切换到 GLM-4.5
export API_PROVIDER=glm4.5
export GLM_API_KEY=your-key

# 重新启动 WriteFlow 生效
writeflow
```

### 基本命令示例

```bash
# 自由对话
writeflow> 你好，我想了解一下机器学习的基本概念

# 生成文章大纲
writeflow> /outline 人工智能在医疗领域的应用

# 改写内容风格
writeflow> /rewrite 通俗 "深度学习是一种机器学习方法"

# 主题研究
writeflow> /research 量子计算最新突破

# 查看帮助
writeflow> /help
```

### 高级配置选项

#### 模型参数调整

```bash
# 在对话中临时调整参数
writeflow> 请调整温度参数到0.9，然后为我创作一个科幻故事

# 通过环境变量设置
export AI_MODEL=qwen-max
export TEMPERATURE=0.7
export MAX_TOKENS=4000
```

#### 代理/中转配置

```bash
# 使用代理服务
export API_BASE_URL=https://your-proxy.com/v1

# 云雾中转示例（支持多家 API）
export API_BASE_URL=https://yunwu.apifox.cn/api-264600675
export API_PROVIDER=anthropic  # 或其他提供商
```

## 🔧 故障排除

### 常见错误及解决方案

#### 1. API 密钥验证失败

**错误信息**: `401 Authentication Fails` 或 `Invalid API Key`

**解决方案**:
- 检查 API 密钥是否正确复制
- 确认密钥没有过期
- 验证环境变量名称是否正确

```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY
echo $API_PROVIDER
```

#### 2. API 连接超时

**错误信息**: `Connection timeout` 或 `Network error`

**解决方案**:
- 检查网络连接
- 尝试使用代理服务
- 确认 API_BASE_URL 设置是否正确

```bash
# 测试连接
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/messages
```

#### 3. 模型不支持

**错误信息**: `Model not found` 或 `Unsupported model`

**解决方案**:
- 检查模型名称拼写
- 确认提供商支持该模型
- 查看本文档中的模型列表

#### 4. 配额超限

**错误信息**: `Rate limit exceeded` 或 `Quota exceeded`

**解决方案**:
- 等待配额重置
- 升级账户套餐
- 分散请求频率

## 💡 最佳实践

### 提供商选择建议

#### 根据用途选择

- **学术研究**: Anthropic Claude（推理能力强）
- **中文内容**: 通义千问 Qwen3（中文优化）
- **成本敏感**: 智谱 GLM-4-air（价格低廉）
- **复杂推理**: Deepseek v3.1（推理专用）
- **多模态**: 智谱 GLM-4v（支持图像）

#### 成本优化策略

1. **分层使用**: 简单任务用便宜模型，复杂任务用高端模型
2. **批量处理**: 一次请求处理多个问题
3. **缓存结果**: 避免重复相同的请求
4. **参数调优**: 适当降低 max_tokens 控制成本

### 性能对比

| 场景 | 推荐提供商 | 理由 |
|------|-----------|------|
| 英文写作 | Anthropic | 语言质量最高 |
| 中文写作 | 通义千问 | 中文语境理解佳 |
| 代码生成 | Deepseek | 代码推理能力强 |
| 快速响应 | GLM-4-flash | 毫秒级响应 |
| 长文档处理 | Claude 4.1 | 200K 超长上下文 |

### 环境配置模板

创建 `.env` 文件来管理配置：

```bash
# .env 文件示例
API_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-your-key-here
API_BASE_URL=https://api.anthropic.com

# 可选配置
AI_MODEL=claude-opus-4-1-20250805
TEMPERATURE=0.7
MAX_TOKENS=4000
SYSTEM_PROMPT=你是WriteFlow AI写作助手
```

然后在启动前加载：

```bash
source .env
writeflow
```

## 🚀 开始使用

现在您已经了解了如何配置各个 AI 提供商，选择一个适合您需求的提供商：

1. **快速开始**: 使用 Anthropic Claude（功能最全面）
2. **中文用户**: 推荐通义千问 Qwen3
3. **成本控制**: 选择智谱 GLM-4-air
4. **推理任务**: 尝试 Deepseek v3.1

配置完成后，运行 `writeflow` 开始您的 AI 写作之旅！

---

**WriteFlow** - 让 AI 写作更专业 🚀

如有问题，请访问 [GitHub Issues](https://github.com/wordflowlab/writeflow/issues) 获取帮助。