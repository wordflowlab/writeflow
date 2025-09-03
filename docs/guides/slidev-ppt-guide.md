# 📚 WriteFlow Slidev PPT 使用手册

## 目录

- [快速开始](#快速开始)
- [功能概述](#功能概述)
- [命令详解](#命令详解)
- [使用示例](#使用示例)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [高级功能](#高级功能)

## 快速开始

### 5分钟上手指南

WriteFlow Slidev 功能让您能够快速创建专业的技术演示文稿。以下是快速开始的步骤：

#### 1. 确认环境准备

```bash
# 确保 WriteFlow 已安装并配置好
writeflow --version

# 检查 Agent 配置文件是否存在
ls .writeflow/agents/slidev-ppt.md
```

#### 2. 创建第一个演示文稿

```bash
# 最简单的方式：创建一个新的演示文稿
writeflow /slide create "我的第一个PPT"

# 或者转换现有的 Markdown 文章
writeflow /slide convert ./my-article.md
```

#### 3. 查看生成结果

生成的文件是标准的 Slidev Markdown 格式，可以：
- 使用 Slidev CLI 启动演示
- 导出为 PDF、PPTX 等格式
- 在任何 Markdown 编辑器中编辑

```bash
# 安装 Slidev（如果尚未安装）
npm install -g @slidev/cli

# 启动演示
slidev slides.md

# 导出为 PDF
slidev export slides.md --format pdf
```

## 功能概述

### 核心能力

WriteFlow Slidev 功能提供以下核心能力：

| 功能 | 描述 | 适用场景 |
|-----|-----|---------|
| **智能创建** | 根据主题自动生成完整演示文稿 | 快速准备技术分享 |
| **文章转换** | 将 Markdown 文章智能转换为 PPT | 将博客转为演讲稿 |
| **大纲生成** | 生成结构化的演讲大纲 | 规划演讲内容 |
| **内容优化** | 优化现有演示文稿的内容和结构 | 改进演示效果 |
| **多格式导出** | 支持 PDF、PPTX、PNG 等格式 | 不同场景分享 |

### 技术特性

- **AI 驱动**：利用 AI 能力自动生成高质量内容
- **模块化设计**：通过 Agent 系统按需加载，不影响主系统
- **智能分页**：自动分析内容密度，合理分配页面
- **主题支持**：支持多种 Slidev 主题
- **代码高亮**：完美支持代码展示和语法高亮

## 命令详解

### `/slide` - 主命令

主命令支持多个子命令，用于不同的 PPT 操作。

```bash
/slide <子命令> [选项]
```

#### 子命令列表

- `create` / `创建` - 创建新的演示文稿
- `convert` / `转换` - 转换 Markdown 文章
- `outline` / `大纲` - 生成演讲大纲
- `optimize` / `优化` - 优化现有演示文稿
- `export` / `导出` - 导出演示文稿（开发中）

### `/slide create` - 创建演示文稿

根据主题和要求创建全新的演示文稿。

#### 语法

```bash
/slide create "<主题>" [选项]
```

#### 选项

- `--duration=<分钟>` - 演讲时长（默认：20）
- `--theme=<主题名>` - Slidev 主题（默认：default）
- `--style=<风格>` - 演讲风格（technical/business/educational）
- `--audience=<听众>` - 目标听众（developers/managers/mixed）
- `--slides=<数量>` - 预期页数（默认：根据时长计算）

#### 示例

```bash
# 创建 30 分钟的技术演讲
/slide create "Vue 3 组合式 API 详解" --duration=30 --style=technical

# 为管理层创建产品介绍
/slide create "AI 产品路线图" --audience=managers --theme=apple-basic

# 创建教育培训材料
/slide create "Git 基础教程" --style=educational --slides=25
```

### `/slide convert` - 转换文章

将现有的 Markdown 文章智能转换为演示文稿。

#### 语法

```bash
/slide convert <文件路径> [选项]
```

#### 选项

- `--theme=<主题名>` - Slidev 主题（默认：default）
- `--slides=<数量>` - 最大页数限制（默认：20）
- `--split=<策略>` - 分割策略：
  - `h1` - 按一级标题分页
  - `h2` - 按二级标题分页
  - `h3` - 按三级标题分页
  - `section` - 按章节分页
  - `auto` - 智能分页（默认）
- `--add-animations` - 添加动画效果
- `--include-notes` - 生成演讲备注

#### 示例

```bash
# 基础转换
/slide convert ./blog/my-article.md

# 指定主题和页数
/slide convert ./docs/guide.md --theme=seriph --slides=15

# 按二级标题分页，添加动画
/slide convert ./tutorial.md --split=h2 --add-animations

# 智能转换，包含演讲备注
/slide convert ./tech-report.md --split=auto --include-notes
```

### `/slide outline` - 生成大纲

为演讲主题生成详细的结构化大纲。

#### 语法

```bash
/slide outline "<主题>" [选项]
```

#### 选项

- `--slides=<数量>` - 预计页数（默认：15）
- `--duration=<分钟>` - 演讲时长（默认：20）
- `--audience=<听众>` - 目标听众类型：
  - `junior` - 初级开发者
  - `senior` - 高级开发者
  - `mixed` - 混合听众（默认）
  - `non-tech` - 非技术人员
- `--depth=<深度>` - 内容深度（basic/intermediate/advanced）

#### 示例

```bash
# 为初级开发者准备的基础教程
/slide outline "React Hooks 入门" --audience=junior --depth=basic

# 高级技术分享
/slide outline "微服务架构设计模式" --audience=senior --depth=advanced

# 45分钟的完整演讲
/slide outline "AI 在前端开发中的应用" --duration=45 --slides=30
```

### `/slide optimize` - 优化演示文稿

优化现有的 Slidev 演示文稿，改进内容和结构。

#### 语法

```bash
/slide optimize <文件路径> [选项]
```

#### 选项

- `--add-animations` - 添加动画和过渡效果
- `--improve-flow` - 优化内容流程
- `--add-visuals` - 建议视觉元素
- `--simplify` - 精简内容
- `--add-notes` - 添加演讲备注

#### 示例

```bash
# 基础优化
/slide optimize ./my-slides.md

# 全面优化
/slide optimize ./presentation.md --add-animations --improve-flow --add-visuals
```

## 使用示例

### 示例 1：准备技术分享会

假设您需要在团队技术分享会上介绍 Docker 容器技术：

```bash
# 1. 生成演讲大纲
writeflow /slide outline "Docker 容器技术实战" --duration=30 --audience=mixed

# 2. 基于大纲创建演示文稿
writeflow /slide create "Docker 容器技术实战" --duration=30 --theme=developer

# 3. 优化生成的内容
writeflow /slide optimize docker-slides.md --add-animations --add-notes

# 4. 启动演示
slidev docker-slides.md
```

### 示例 2：将博客文章转为演讲稿

您写了一篇关于性能优化的博客，想在会议上分享：

```bash
# 1. 转换文章
writeflow /slide convert ./blog/performance-optimization.md --slides=20

# 2. 查看转换结果并手动调整
vim slides.md

# 3. 添加视觉效果
writeflow /slide optimize slides.md --add-visuals

# 4. 导出为 PDF 分享
slidev export slides.md --format pdf
```

### 示例 3：快速创建产品演示

需要向客户展示产品特性：

```bash
# 1. 创建演示文稿
writeflow /slide create "产品新特性介绍" \
  --style=business \
  --audience=non-tech \
  --theme=apple-basic \
  --duration=15

# 2. 导出为 PPTX 供销售团队使用
slidev export product-demo.md --format pptx
```

## 最佳实践

### 1. 内容规划

#### 时间分配建议

| 演讲时长 | 建议页数 | 每页时间 | 内容深度 |
|---------|---------|---------|---------|
| 5 分钟 | 5-8 页 | 30-60 秒 | 概览 |
| 10 分钟 | 8-12 页 | 50-75 秒 | 基础 |
| 20 分钟 | 15-20 页 | 60-80 秒 | 标准 |
| 30 分钟 | 20-30 页 | 60-90 秒 | 详细 |
| 45 分钟 | 30-40 页 | 70-90 秒 | 深入 |
| 60 分钟 | 40-50 页 | 70-90 秒 | 完整 |

#### 内容结构建议

```
1. 开场 (10%)
   - 自我介绍
   - 议程预览
   - 背景说明

2. 主体 (75%)
   - 核心概念
   - 详细说明
   - 案例演示
   - 代码示例

3. 总结 (10%)
   - 要点回顾
   - 关键结论
   - 行动建议

4. Q&A (5%)
   - 问题解答
   - 讨论交流
```

### 2. 视觉设计

#### 选择合适的主题

```yaml
# 技术演讲
theme: developer    # 代码为主
theme: seriph      # 简洁专业
theme: slidev      # 默认风格

# 商务演示  
theme: apple-basic # 苹果风格
theme: bricks      # 商务简约

# 教育培训
theme: academic    # 学术风格
theme: default     # 通用风格
```

#### 动画使用原则

- **适度原则**：不要过度使用动画
- **逻辑原则**：动画要符合内容逻辑
- **一致原则**：保持动画风格一致

```markdown
<!-- 渐进式展示列表 -->
<v-clicks>

- 第一点
- 第二点
- 第三点

</v-clicks>

<!-- 点击后显示 -->
<v-click>
重要内容
</v-click>

<!-- 同时显示多个 -->
<v-clicks at="2">
同时出现的内容
</v-clicks>
```

### 3. 代码展示

#### 代码高亮技巧

```markdown
```javascript {2-4|6|all}
function example() {
  const a = 1  // 第一次高亮
  const b = 2  // 第一次高亮
  const c = 3  // 第一次高亮
  
  return a + b + c  // 第二次高亮
}
```
````

#### 代码分步展示

```markdown
```ts {monaco-run}
// 可交互代码编辑器
const message = 'Hello, Slidev!'
console.log(message)
```


### 4. 演讲技巧

#### 演讲备注使用

```markdown
# 幻灯片标题

主要内容

<!-- 
演讲者备注：
- 强调这一点
- 举例说明
- 预计用时 2 分钟
-->
```

#### 时间控制

- 使用 Slidev 的演讲者视图查看时间
- 在备注中标记关键时间点
- 准备可选内容应对时间变化

## 常见问题

### Q1: 如何安装 Slidev 依赖？

首次使用 Slidev 功能时，系统会提示安装可选依赖：

```bash
# 全局安装 Slidev CLI
npm install -g @slidev/cli

# 或在项目中安装
npm install --save-dev @slidev/cli
```

### Q2: 生成的 PPT 如何编辑？

生成的文件是标准 Markdown 格式，可以：

1. **文本编辑器**：使用任何文本编辑器（VS Code、Vim 等）
2. **Slidev 编辑器**：使用 Slidev 的实时预览功能
3. **在线编辑**：使用 sli.dev 在线编辑器

### Q3: 如何自定义主题？

1. **使用现有主题**：
```bash
/slide create "主题" --theme=seriph
```

2. **自定义样式**：
```markdown
<style>
.slidev-layout {
  background: linear-gradient(to right, #667eea, #764ba2);
}
</style>
```

3. **创建自定义主题**：
参考 Slidev 官方文档创建自定义主题包。

### Q4: Agent 加载失败怎么办？

检查以下几点：

1. **配置文件存在**：
```bash
ls .writeflow/agents/slidev-ppt.md
```

2. **配置格式正确**：
确保 YAML frontmatter 格式正确

3. **查看错误日志**：
```bash
writeflow --debug /slide create "测试"
```

### Q5: 如何处理大文件转换？

对于超长文章，建议：

1. **设置页数限制**：
```bash
/slide convert long-article.md --slides=30
```

2. **分章节转换**：
```bash
/slide convert chapter1.md --output=part1.md
/slide convert chapter2.md --output=part2.md
```

3. **手动精简内容**：
先精简文章，再进行转换

### Q6: 导出格式支持哪些？

通过 Slidev CLI 支持：

- **PDF**: `slidev export slides.md --format pdf`
- **PPTX**: `slidev export slides.md --format pptx`
- **PNG**: `slidev export slides.md --format png`
- **HTML**: `slidev build slides.md`

### Q7: 如何添加自定义组件？

在演示文稿中使用 Vue 组件：

```markdown
<!-- 使用内置组件 -->
<Tweet id="1234567890" />

<!-- 自定义组件 -->
<CustomChart :data="chartData" />

<script setup>
const chartData = [...]
</script>
```

## 高级功能

### 1. Agent 配置定制

#### 修改 Agent 配置

编辑 `.writeflow/agents/slidev-ppt.md` 文件：

```yaml
---
name: slidev-ppt
description: "自定义描述"
tools:
  - SlidevGenerator
  - SlideConverter
  - CustomTool  # 添加自定义工具
model_name: gpt-4  # 使用不同的模型
---

# 自定义系统提示词
你是专业的 PPT 设计专家...
```

#### 创建专用 Agent

为特定场景创建专用 Agent：

```bash
# 创建学术演讲 Agent
cp .writeflow/agents/slidev-ppt.md .writeflow/agents/academic-ppt.md

# 编辑配置
vim .writeflow/agents/academic-ppt.md
```

### 2. 模板系统

#### 使用自定义模板

在 `src/templates/slidev/` 创建自定义模板：

```markdown
<!-- custom/cover.md -->
# {{title}}

{{#if subtitle}}
### {{subtitle}}
{{/if}}

<div class="custom-style">
  {{author}} | {{date}}
</div>
```

#### 模板变量

可用的模板变量：

- `{{title}}` - 演示标题
- `{{subtitle}}` - 副标题
- `{{author}}` - 作者
- `{{date}}` - 日期
- `{{company}}` - 公司/组织
- `{{email}}` - 联系邮箱

### 3. 批处理模式

#### 批量转换文档

创建批处理脚本：

```bash
#!/bin/bash
# batch-convert.sh

for file in ./articles/*.md; do
  writeflow /slide convert "$file" --theme=seriph
done
```

#### 自动化工作流

结合 CI/CD 自动生成演示文稿：

```yaml
# .github/workflows/slides.yml
name: Generate Slides

on:
  push:
    paths:
      - 'docs/**/*.md'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
      - name: Install WriteFlow
        run: npm install -g writeflow
      - name: Generate Slides
        run: |
          for doc in docs/**/*.md; do
            writeflow /slide convert "$doc"
          done
```

### 4. API 集成

#### 编程方式调用

```javascript
import { SlidevGenerator } from 'writeflow/tools/slidev'

const generator = new SlidevGenerator()
const result = await generator.execute({
  title: 'API 生成的 PPT',
  content: ['页面1', '页面2'],
  theme: 'default'
})

console.log(result.content)
```

#### 与其他工具集成

```javascript
// 集成到 Express 应用
app.post('/api/generate-slides', async (req, res) => {
  const { title, content } = req.body
  
  const result = await generateSlides({
    title,
    content,
    theme: 'seriph'
  })
  
  res.json(result)
})
```

### 5. 性能优化

#### 缓存策略

Agent 系统支持工具缓存：

```yaml
# .writeflow/slidev.config.yaml
slidev:
  agent:
    cacheTools: true
    unloadAfter: 3600000  # 1小时后卸载
```

#### 并发处理

批量处理时使用并发：

```javascript
import { Worker } from 'worker_threads'

// 创建工作线程池
const workers = []
for (let i = 0; i < 4; i++) {
  workers.push(new Worker('./slide-worker.js'))
}

// 并发处理多个文件
const tasks = files.map((file, i) => {
  return workers[i % 4].postMessage({ file })
})
```

## 故障排除

### 常见错误和解决方案

| 错误 | 原因 | 解决方案 |
|-----|-----|---------|
| `Agent 配置文件未找到` | 缺少配置文件 | 确认 `.writeflow/agents/slidev-ppt.md` 存在 |
| `工具加载失败` | 依赖未安装 | 运行 `npm install` |
| `生成内容为空` | AI 服务异常 | 检查 API 配置和网络连接 |
| `转换失败` | 文件格式问题 | 确保输入是有效的 Markdown |
| `主题未找到` | 主题未安装 | 安装对应的 Slidev 主题包 |

### 调试模式

启用调试模式获取详细信息：

```bash
# 设置环境变量
export WRITEFLOW_DEBUG=true

# 运行命令
writeflow --debug /slide create "测试"
```

### 日志查看

查看详细日志：

```bash
# 查看最近的日志
tail -f ~/.writeflow/logs/slidev.log

# 搜索错误
grep ERROR ~/.writeflow/logs/slidev.log
```

## 更多资源

### 相关文档

- [WriteFlow 主文档](../README.md)
- [Slidev 官方文档](https://sli.dev)
- [Agent 系统说明](../architecture/agent-system.md)
- [斜杠命令指南](./slash-commands.md)

### 社区资源

- [Slidev 主题库](https://github.com/slidevjs/themes)
- [Slidev 示例](https://github.com/slidevjs/slidev/tree/main/examples)
- [WriteFlow 讨论区](https://github.com/writeflow/discussions)

### 视频教程

- [5分钟快速入门](https://example.com/quick-start)
- [高级技巧讲解](https://example.com/advanced)
- [实战案例分享](https://example.com/cases)

---

*最后更新：2025-09-03*  
*版本：v1.0.0*  
*作者：WriteFlow Team*