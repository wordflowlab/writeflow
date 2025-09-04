# 📚 WriteFlow Slidev 智能PPT系统 - 完整使用手册

> 从想法到演示，一条命令搞定！WriteFlow 2.11+ 全新智能PPT生成系统

## 🆕 v2.11+ 新功能亮点

- 🧠 **智能生成**: 基于完整Slidev知识库的AI驱动内容创作
- 🚀 **一步到位**: 主题输入即可生成演示文稿，无需复杂子命令
- 📋 **智能指导**: 详细的操作步骤和文件命名建议
- ⚡ **系统精简**: 从13个命令精简至5个核心命令，提升用户体验

## 🚀 快速开始

### ⚡ 一分钟体验（推荐）

最简单的方式 - 主命令直接生成：

```bash
# 直接输入主题，智能生成演示
/slide "Vue 3 响应式原理"

# 商业汇报主题
/slide "Q4业务增长报告"

# 学术演示主题  
/slide "机器学习最新进展"
```

**就是这么简单！** 🎉 系统会自动：

1. 🧠 识别您输入的是主题而非子命令
2. ⚙️ 智能生成专业PPT内容
3. 📋 提供详细的保存和预览指导
4. 🚀 支持一键预览体验

### 🎯 传统方式（分步操作）

如果你喜欢更多控制，可以分步执行：

#### 步骤1: 智能生成内容

```bash
# 生成智能PPT内容（会显示详细的操作指导）
/slide-intelligent "深度学习在计算机视觉中的应用" --style=academic --duration=40 --audience=researchers
```

#### 步骤2: 保存和预览

按照生成后的指导操作：

1. 复制生成的Markdown内容
2. 保存为推荐的文件名（如：`深度学习在计算机视觉中的应用-slides.md`）
3. 执行预览命令：

   ```bash
   /slide-preview 深度学习在计算机视觉中的应用-slides.md
   ```

## 📖 完整命令列表 - 精简至5个核心命令

### 🎯 主命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `/slide` | 智能主命令，支持直接主题生成 | `/slide "React Hooks"` |

### 🧠 智能生成命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `/slide-intelligent` | 智能生成PPT（显示操作指导） | `/slide-intelligent "React Hooks" --style=technical` |

### 🚀 预览命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `/slide-preview` | 预览演示文稿 | `/slide-preview slides.md` |
| `/slide-preview --list` | 查看可用的演示文稿 | `/slide-preview -l` |
| `/slide-preview --recent` | 查看最近的演示历史 | `/slide-preview -r` |

### 🛠️ 创建和转换命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `/slide-create` | 创建演示文稿（支持依赖检查） | `/slide-create "我的主题" --theme=seriph` |
| `/slide-convert` | 文章转换为演示（支持依赖检查） | `/slide-convert article.md --style=technical` |

## 💡 参数说明

### 核心参数

- `--style`: 演示风格
  - `academic` - 学术研究风格
  - `business` - 商业汇报风格
  - `technical` - 技术分享风格
  - `creative` - 创意展示风格
  - `professional` - 专业演示风格（默认）

- `--duration`: 演示时长（分钟），影响幻灯片数量规划
- `--audience`: 目标受众，影响内容深度
  - `researchers` - 研究人员
  - `developers` - 开发者  
  - `investors` - 投资者
  - `students` - 学生
  - `mixed` - 混合受众（默认）

- `--theme`: Slidev主题
  - `seriph` - 优雅风格（默认）
  - `default` - 标准风格
  - `apple-basic` - 苹果风格
  - `carbon` - 碳纤维风格

### 预览参数

- `--port`: 指定预览端口（默认3030）
- `--no-open`: 不自动打开浏览器
- `--list` / `-l`: 列出可用文件
- `--recent` / `-r`: 显示最近记录
- `--help` / `-h`: 显示帮助

## ✨ 使用示例

### 🏫 学术演示

```bash
# 学术研究演示 - 主命令方式
/slide "机器学习在医疗诊断中的应用研究"

# 或使用智能生成命令获取详细指导
/slide-intelligent "机器学习在医疗诊断中的应用研究" \
  --style=academic \
  --duration=40 \
  --audience=researchers \
  --theme=seriph
```

**特点**: 严谨的学术格式、数据驱动的内容结构、专业的图表和公式支持

### 💼 商业汇报

```bash
# 商业汇报演示 - 主命令方式
/slide "Q4业务增长报告"

# 或使用智能生成命令获取详细指导
/slide-intelligent "Q4业务增长报告" \
  --style=business \
  --duration=25 \
  --audience=executives \
  --theme=apple-basic
```

**特点**: 商业智能的视觉设计、KPI数据突出显示、决策导向的内容组织

### 👨‍💻 技术分享

```bash
# 技术分享演示 - 主命令方式
/slide "React 18 并发特性深度解析"

# 或使用智能生成命令获取详细指导
/slide-intelligent "React 18 并发特性深度解析" \
  --style=technical \
  --duration=50 \
  --audience=developers
```

**特点**: 代码示例丰富、实战导向的内容、技术细节深度讲解

### 🎨 创意展示

```bash
# 创意展示 - 主命令方式
/slide "设计系统构建方法论"

# 或使用智能生成命令获取详细指导
/slide-intelligent "设计系统构建方法论" \
  --style=creative \
  --duration=60 \
  --theme=carbon
```

**特点**: 视觉创新的设计、交互性强的展示、创意思维的引导

## 🎯 操作指导详解

### 智能生成后的操作步骤

使用 `/slide-intelligent` 后，系统会显示：

```
🎉 演示文稿生成完成！

## 📋 下一步操作指南

### 步骤1: 保存文件 📁
请将上述Markdown内容保存为文件：
**推荐文件名**: `你的主题-slides.md`

### 步骤2: 立即预览 🚀
保存文件后，复制并执行以下命令：

```bash
/slide-preview 你的主题-slides.md
```

### 备选方案
如果遇到问题，也可以使用：
- /slide-preview（自动查找文件）
- npx @slidev/cli 你的主题-slides.md --open
```

### 预览成功标志

看到以下信息说明启动成功：

```
●■▲ Slidev v52.x.x 
public slide show > http://localhost:3030/
presenter mode    > http://localhost:3030/presenter/
slides overview   > http://localhost:3030/overview/
```

## ❓ 常见问题

### Q: 如何选择合适的演示风格？

**A**: 根据场合和受众选择：
- **学术会议**: `--style=academic`
- **公司汇报**: `--style=business`  
- **技术分享**: `--style=technical`
- **创意展示**: `--style=creative`
- **通用演示**: `--style=professional`（默认）

### Q: 预览启动失败怎么办？

**A**: 系统会自动检查依赖并提供解决方案：

1. 检查Slidev CLI是否安装：`npm install -g @slidev/cli`
2. 使用备用命令：`npx @slidev/cli your-file.md --open`
3. 查看错误提示获取具体解决方案

### Q: 如何修改生成的PPT？

**A**: 有几种方式：
- 直接编辑生成的`.md`文件（Slidev会实时更新预览）
- 使用 `/slide-intelligent` 重新生成优化内容
- 参考 [Slidev官方文档](https://sli.dev) 了解高级特性

### Q: 文件保存在哪里？

**A**: 
- 使用 `/slide "主题"`：系统会生成内容并提供保存指导
- 使用 `/slide-intelligent`：需要手动保存到当前目录
- 查看最近文件：`/slide-preview --recent`

### Q: 如何查看所有可用的演示文稿？

**A**: 使用 `/slide-preview --list` 或 `/slide-preview -l`

## 🔧 进阶功能

### 批量操作

```bash
# 查看当前目录所有Markdown文件
/slide-preview --list

# 预览最近使用的演示文稿
/slide-preview --recent

# 使用特定端口预览（避免冲突）
/slide-preview slides.md --port=3031
```

### 文件管理

```bash
# 自动查找并预览（优先级：slides.md > presentation.md > deck.md）
/slide-preview

# 不自动打开浏览器
/slide-preview slides.md --no-open
```

### 快捷键

预览时可用的快捷键：

- **方向键/空格**: 翻页
- **f**: 全屏模式  
- **o**: 演示大纲
- **e**: 编辑模式
- **g**: 跳转到指定页面
- **Ctrl+C**: 停止服务

## 🏆 最佳实践

### 1. 主题描述技巧

- **具体明确**: "Vue 3 Composition API" 比 "Vue.js" 更好
- **包含关键词**: 提及重要概念和技术栈
- **说明背景**: "面向初学者的..." 或 "企业级..."

### 2. 参数配置建议

- **duration**: 按 1-2分钟/页 规划
- **style**: 根据场合选择合适风格
- **audience**: 准确描述听众特征
- **theme**: seriph适合正式场合，default适合技术分享

### 3. 内容优化提示

- **结构化描述**: "包含背景、方法、结果、结论"
- **明确重点**: "重点讲解算法原理和性能对比"
- **实用性**: "需要代码示例和实战案例"

### 4. 工作流程建议

推荐的PPT创作流程：

1. **规划阶段**: 确定主题、受众、时长
2. **生成阶段**: 使用 `/slide "主题"` 或 `/slide-intelligent` 生成内容
3. **保存阶段**: 按照系统指导保存为 `.md` 文件
4. **预览阶段**: 使用 `/slide-preview` 查看效果
5. **优化阶段**: 根据需要编辑文件或重新生成
6. **演示阶段**: 使用全屏模式和快捷键

## 📈 版本更新历史

### v2.11.0 (最新) - 系统精简优化
- ✅ **主命令智能化**: `/slide` 支持直接主题输入，自动识别并生成演示
- ✅ **系统大幅精简**: 从13个命令精简至5个核心命令，提升用户体验
- ✅ **依赖检查优化**: `create` 和 `convert` 命令支持自动依赖检查和安装指导
- ✅ **用户交互增强**: 所有核心命令支持三选项用户交互模式
- ✅ **文档全面更新**: 重新梳理用户指南，突出简化的使用方式

### v2.10.1
- ✅ 集成完整 Slidev 知识库
- ✅ 实现智能生成命令 `/slide-intelligent`
- ✅ 支持多种演示风格和主题选择
- ✅ 创建详细文档和使用指南

## 🤝 获取帮助

- **命令帮助**: 使用 `--help` 参数查看具体命令帮助
- **错误排查**: 系统会提供详细的错误信息和解决方案
- **功能建议**: 通过GitHub Issues提出改进建议
- **技术支持**: 参考项目文档或联系开发团队

---

**WriteFlow Slidev智能PPT系统让每个想法都能成为精彩演示！** 🚀