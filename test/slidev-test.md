# WriteFlow Slidev 功能测试

这是一个测试文档，用于验证 Slidev PPT 转换功能。

## 功能特性

### AI 驱动的内容生成

WriteFlow 集成了多种 AI 模型：
- Claude Opus
- DeepSeek
- Qwen
- GLM

### 智能转换能力

支持将 Markdown 文档智能转换为演示文稿：
1. 自动分页
2. 内容优化
3. 动画建议

## 技术架构

```typescript
// Agent 系统
export class AgentLoader {
  async loadAgent(): Promise<AgentConfig> {
    // 动态加载配置
  }
}
```

## 使用示例

```bash
# 创建新演示文稿
writeflow /slide create "主题名称"

# 转换现有文档
writeflow /slide convert ./article.md
```

## 总结

WriteFlow Slidev 功能为技术写作者提供了强大的演示文稿创作能力。