# WriteFlow 简洁状态系统

完全复刻 Claude Code 风格的极简状态提示系统。

## 设计理念

遵循 Claude Code 的极简设计哲学：
- **简洁至上**：只显示必要的状态信息
- **视觉统一**：黄色主题，圆角边框
- **动画流畅**：简单的 spinner 动画
- **位置固定**：输入框上方显示

## 核心组件

### SimpleStatusIndicator
主要的状态指示器组件，模仿 Claude Code 的黄色提示框。

```typescript
<SimpleStatusIndicator
  message="故事事件监听连接中..."
  icon="🔶"
  animated={true}
  showInterruptHint={true}
  additionalInfo="验证 AI 响应处理逻辑"
/>
```

### PlanModeIndicator  
Plan 模式专用指示器，显示在输入框上方。

```typescript
<PlanModeIndicator 
  message="plan mode on"
  cycleHint={true}
/>
```

### useSimpleStatus Hook
简洁的状态管理 Hook。

```typescript
const { currentStatus, showStatus, hideStatus } = useSimpleStatus()

// 显示状态
showStatus('AI 思考中...', {
  icon: '🤔',
  animated: true,
  showInterruptHint: true
})

// 隐藏状态
hideStatus()
```

## 预定义状态

### 常用状态消息
```typescript
STATUS_MESSAGES.CONNECTING      // 故事事件监听连接中...
STATUS_MESSAGES.AI_THINKING     // AI 思考中...
STATUS_MESSAGES.AI_RESPONDING   // AI 回应中...
STATUS_MESSAGES.PROCESSING      // 处理中...
STATUS_MESSAGES.SAVING          // 保存中...
```

### 快速状态方法
```typescript
QuickStatus.aiThinking()       // AI思考状态
QuickStatus.processing()       // 处理状态  
QuickStatus.connecting()       // 连接状态
QuickStatus.success(message)   // 成功状态
QuickStatus.error(message)     // 错误状态
```

## 使用示例

### 在处理用户输入时
```typescript
// 开始处理
if (inputText.startsWith('/')) {
  showStatus(`执行命令: ${command}`, {
    icon: '⚡',
    animated: true,
    showInterruptHint: true
  })
} else {
  showStatus('AI 思考中...', QuickStatus.aiThinking())
}

// AI 回应时
showStatus('AI 回应中...', {
  icon: '💭',
  animated: true,
  additionalInfo: '验证 AI 响应处理逻辑'
})

// 处理完成
setTimeout(() => hideStatus(), 1000)
```

### 错误处理
```typescript
catch (error) {
  showStatus(`错误: ${error.message}`, QuickStatus.error(error.message))
}
```

## 视觉效果

### 正常状态
```
╭─────────────────────────────────────────╮
│ 🔶 故事事件监听连接中... ⠋              │
│ (esc to interrupt · ctrl+t to show todos) │
╰─────────────────────────────────────────╯
```

### 带附加信息
```  
╭─────────────────────────────────────────╮
│ 💭 AI 回应中... ⠙                      │
│ └ Next: 验证 AI 响应处理逻辑            │
╰─────────────────────────────────────────╯
```

### Plan 模式指示器
```
▍ plan mode on (shift+tab to cycle)
```

## 技术实现

### 动画效果
使用简单的字符动画创建 spinner 效果：
```typescript
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
```

### 样式特点
- 黄色边框：`borderColor="yellow"`  
- 圆角边框：`borderStyle="round"`
- 适当间距：`paddingX={1} marginBottom={1}`
- 颜色主题：黄色文字 + 灰色提示

### 性能优化
- 轻量组件，最小化渲染开销
- 简单的状态管理，无复杂逻辑
- 自动清理定时器，避免内存泄漏

## 与 Claude Code 的一致性

### 视觉完全一致
- 相同的黄色/橙色主题
- 相同的圆角边框样式  
- 相同的文字排版和间距
- 相同的动画效果

### 功能完全对应
- 实时状态显示
- 中断提示信息
- Plan 模式指示器
- 自动隐藏机制

### 使用体验一致
- 不干扰主要操作流程
- 提供及时的状态反馈
- 简洁明了的信息展示
- 流畅自然的动画效果

这个系统完全摒弃了复杂的智能分析和多层次管理，回归到 Claude Code 的本质：**简单、优雅、实用**。