# WriteFlow 动态状态提示系统

WriteFlow 的动态状态提示系统是一个参考 Claude Code 黄色提示框机制设计的智能UI组件系统，专为AI写作场景优化。

## 核心特性

### 🎯 智能场景识别
- 自动检测用户输入意图
- 智能切换写作场景状态
- 上下文感知的状态推断

### ⚡ 丰富的视觉效果
- **光影扫描动画**：模仿 Claude Code 的动态扫描线效果
- **多种主题变体**：Claude、Enhanced、Minimal、Glass 四种风格
- **动态色彩系统**：根据场景自动调整颜色主题
- **进度可视化**：实时显示任务完成进度

### 💡 智能建议系统
- **上下文分析**：基于当前状态和历史记录提供相关建议
- **操作建议**：推荐下一步可执行的操作
- **写作提示**：针对当前写作阶段的专业建议
- **快捷操作**：一键执行常用命令

### 📊 丰富的写作场景
支持 16 种专门的写作场景，包括：

- **文章管理**：创建、编辑、阅读文章
- **研究工具**：主题研究、网络搜索
- **AI 写作**：大纲生成、内容改写、语法检查、风格调整
- **发布准备**：格式转换、发布优化
- **系统状态**：AI 思考、回应、记忆管理

## 使用方法

### 基础使用

```typescript
import { 
  useWritingStatus, 
  AdaptiveStatusBanner,
  WRITING_SCENARIOS 
} from '../ui/status'

// 在组件中使用
function MyWritingApp() {
  const { currentStatus, setStatus } = useWritingStatus()
  
  // 设置写作状态
  const handleStartWriting = () => {
    setStatus(WRITING_SCENARIOS.ARTICLE_CREATE, {
      progress: 25,
      subMessage: '正在构思文章结构...'
    })
  }
  
  return (
    <div>
      {currentStatus && (
        <AdaptiveStatusBanner
          status={currentStatus}
          showTips={true}
          showActions={true}
          animated={true}
        />
      )}
    </div>
  )
}
```

### 智能建议系统

```typescript
import { 
  useIntelligentAnalysis, 
  SuggestionsManager 
} from '../ui/status'

function SmartWritingInterface() {
  const { analyzeInput, currentAnalysis } = useIntelligentAnalysis()
  
  const handleUserInput = (input: string) => {
    // 分析用户输入
    const analysis = analyzeInput(input, {
      messageHistory: [], // 传入消息历史
      currentScenario: 'article.create'
    })
    
    console.log('检测到意图:', analysis.detectedIntent)
    console.log('置信度:', analysis.confidence)
  }
  
  return (
    <div>
      {currentAnalysis && (
        <SuggestionsManager
          analyses={[currentAnalysis]}
          onActionSelect={(action) => {
            console.log('用户选择了:', action.label)
          }}
        />
      )}
    </div>
  )
}
```

### 自定义状态场景

```typescript
import { writingStatusManager } from '../ui/status'

// 创建自定义状态
writingStatusManager.setStatus('article.create', {
  progress: 60,
  subMessage: '正在完善第三章节...',
  metadata: {
    chapterCount: 5,
    currentChapter: 3,
    wordCount: 2500
  }
})
```

## 组件详解

### AdaptiveStatusBanner
自适应状态横幅，根据场景自动选择最佳显示样式。

**Props:**
- `status: WritingStatus` - 当前写作状态
- `showTips?: boolean` - 是否显示提示信息
- `showActions?: boolean` - 是否显示快捷操作
- `animated?: boolean` - 是否启用动画效果

### SuggestionsManager
智能建议管理器，显示上下文相关的操作建议。

**Props:**
- `analyses: ContextAnalysis[]` - 分析结果数组
- `maxVisible?: number` - 最大显示数量
- `onActionSelect?: (action) => void` - 动作选择回调

### StatusBannerManager
状态横幅管理器，支持多个状态的同时显示和优先级管理。

## 视觉主题

### Claude 主题
模仿 Claude Code 的经典黄色提示框风格，简洁专业。

### Enhanced 主题
增强版视觉效果，更丰富的颜色和边框样式。

### Minimal 主题
极简风格，适合追求简洁界面的场景。

### Glass 主题
毛玻璃效果，现代化的视觉体验，特别适合AI相关状态。

## 动画效果

### 扫描线动画
```typescript
// 启用扫描效果
setStatus('ai.thinking', {
  // 会自动启用扫描动画
})
```

### 进度动画
```typescript
// 显示进度
setStatus('content.rewrite', {
  progress: 75, // 显示进度条和百分比
  subMessage: '即将完成...'
})
```

### 呼吸效果
适用于等待状态，柔和的呼吸灯效果。

## 最佳实践

### 1. 合理使用动画
```typescript
// 高优先级任务使用动画
setStatus('ai.thinking', { animated: true })

// 长时间状态避免过多动画
setStatus('research.active', { 
  progress: 45,
  animated: false // 避免分散注意力
})
```

### 2. 提供有意义的子消息
```typescript
setStatus('outline.generate', {
  progress: 30,
  subMessage: '已生成3个主要章节，正在细化子主题...'
})
```

### 3. 利用元数据
```typescript
setStatus('article.edit', {
  metadata: {
    wordCount: 1500,
    targetLength: 2000,
    lastSaved: Date.now()
  }
})
```

### 4. 及时清理状态
```typescript
// 任务完成后清理状态
const { clearStatus } = useWritingStatus()

useEffect(() => {
  // 任务完成后2秒清理状态
  const timer = setTimeout(clearStatus, 2000)
  return () => clearTimeout(timer)
}, [taskCompleted])
```

## 性能优化

### 1. 防抖更新
对于频繁的状态更新，使用防抖机制：

```typescript
import { debounce } from 'lodash'

const debouncedStatusUpdate = debounce((status) => {
  setStatus(status.type, status.options)
}, 300)
```

### 2. 条件渲染
只在必要时显示复杂组件：

```typescript
{writingStatus && 
  writingStatus.scenario.priority === 'high' && (
    <AdaptiveStatusBanner status={writingStatus} />
  )
}
```

### 3. 懒加载动画
对于不支持动画的设备，自动禁用动画效果。

## 扩展开发

### 添加新场景
```typescript
// 1. 在 WritingStatusManager 中添加新场景配置
const newScenario = {
  id: 'custom.task',
  icon: '⚡',
  title: '自定义任务',
  color: 'cyan',
  message: '执行自定义任务中...',
  tips: ['提示1', '提示2'],
  showProgress: true,
  scanEffect: true,
  priority: 'high'
}

// 2. 在 ContextAnalyzer 中添加意图识别
intentPatterns.set('custom_task', [/自定义任务/i])
scenarioMapping.set('custom_task', 'custom.task')
```

### 自定义动画
```typescript
// 创建自定义扫描效果
const customScanEffect = () => {
  const patterns = ['◆◇◇◇', '◇◆◇◇', '◇◇◆◇', '◇◇◇◆']
  return patterns[animationFrame % patterns.length]
}
```

## 故障排除

### 常见问题

**Q: 状态横幅不显示？**
A: 检查是否正确设置了状态：`setStatus('article.create')`

**Q: 动画效果不流畅？**
A: 在低性能设备上会自动禁用动画，可以手动设置 `animated={false}`

**Q: 智能建议不准确？**
A: 提供更多上下文信息给 `analyzeInput` 方法，包括消息历史和当前场景

**Q: 自定义主题不生效？**  
A: 确保在组件中正确传递了 `variant` 属性

## 更新日志

### v1.0.0 (当前版本)
- ✅ 完整的状态管理系统
- ✅ 16种写作场景支持
- ✅ 4种视觉主题
- ✅ 智能分析和建议系统
- ✅ 丰富的动画效果
- ✅ TypeScript 完整支持

### 未来计划
- 🔄 更多自定义动画效果
- 🔄 键盘快捷键支持
- 🔄 状态持久化存储
- 🔄 多语言支持
- 🔄 无障碍访问优化