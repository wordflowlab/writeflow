# CLAUDE.md

## Claude Code 九荣九耻

- 以瞎猜接口为耻，以认真查询为荣。
- 以模糊执行为耻，以寻求确认为荣。
- 以臆想业务为耻，以复用现有为荣。
- 以创造接口为耻，以主动测试为荣。
- 以跳过验证为耻，以人类确认为荣。
- 以破坏架构为耻，以遵循规范为荣。
- 以假装理解为耻，以诚实无知为荣。
- 以盲目修改为耻，以谨慎重构为荣。
- 以画蛇添足为耻，以按需实现为荣。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

输出中文

# WriteFlow AI Writing Assistant

WriteFlow 是基于 Claude Code 核心架构的 AI 写作助手，专为技术型作家设计的 CLI 工具。

## 🎯 核心理念

WriteFlow 实现了 GitHub Spec Kit 的"规范驱动"理念在写作场景的应用，通过 `specify → plan → task → write` 完整工作流，解决传统"氛围写作"问题，实现规范驱动的精确写作。

测试参考：WRITEFLOW_DEBUG=true echo "请分析这个项目" | npm run dev

# 孤儿代码清理指南

## 孤儿代码检测工具

WriteFlow 已集成以下死代码检测工具：

### 可用命令
- `npm run dead-code:detect` - 使用 ts-prune 检测未使用的导出
- `npm run dead-code:analyze` - 使用 knip 全面分析未使用代码
- `npm run dead-code:clean` - 检测死代码并运行 lint 修复
- `npm run pre-commit-check` - 运行完整的预提交检查（类型检查 + 死代码检测 + lint）

### 预防策略
1. **Git hooks 自动化**：每次提交前自动运行死代码检测
2. **TypeScript 严格模式**：启用 `noUnusedLocals` 和 `noUnusedParameters`
3. **定期清理**：建议每周运行一次 `npm run dead-code:analyze`

### 安全清理流程
1. 运行 `npm run dead-code:detect` 获取详细报告
2. 手动审查输出，确认代码确实未使用
3. 分批删除，每次提交只删除少量文件
4. 运行测试确保没有破坏功能
5. 提交时使用描述性消息如 "clean: remove unused exports"

### 清理时的注意事项
- 谨慎删除 public API 导出
- 保留可能被外部工具使用的代码
- 检查动态导入和字符串引用
- 保留类型定义和接口声明
