/**
 * WriteFlow 流式输出系统演示
 * 展示完整的流式 UI 系统功能
 */

import { getStreamingPipeline } from '../utils/streamingPipeline.js'
import { getPerformanceOptimizer } from '../utils/performanceOptimizer.js'
import { getOutputFormatter } from '../utils/outputFormatter.js'

const demoContent = `# WriteFlow 流式输出系统演示

这是一个完整的流式输出系统演示，展示了 WriteFlow 的新特性。

## 主要功能

### 1. 实时流式文本渲染
支持字符级别的实时渲染，让用户能够看到内容逐字符出现，就像真实的打字效果。

### 2. 智能内容格式化
系统能够实时识别和格式化不同类型的内容：

#### JavaScript 代码示例
\`\`\`javascript
function createStreamingDemo() {
  const pipeline = getStreamingPipeline({
    theme: 'dark',
    enableColors: true,
    enableDoubleBuffer: true,
    renderDelay: 50
  })
  
  pipeline.on('chunk', (streamId, chunk) => {
    console.log(\`接收到流块: \${chunk.content}\`)
  })
  
  return pipeline
}

const demo = createStreamingDemo()
demo.startStream('demo-1', 1000)
\`\`\`

#### TypeScript 接口定义
\`\`\`typescript
interface StreamingOptions {
  theme: 'light' | 'dark'
  delay: number
  chunkSize: number
  enableSyntaxHighlight: boolean
}

type ContentType = 'text' | 'markdown' | 'code'

class StreamingManager<T extends ContentType> {
  private options: StreamingOptions
  
  constructor(options: StreamingOptions) {
    this.options = options
  }
  
  async processContent(content: string): Promise<void> {
    // 处理逻辑
  }
}
\`\`\`

### 3. 性能优化特性

系统包含多项性能优化：

- **智能渲染频率控制**: 根据系统性能自动调节渲染频率
- **双缓冲渲染**: 避免渲染闪烁，提供流畅的用户体验
- **内容完整性保证**: 自动检测和修复内容传输中的错误
- **内存管理**: 智能清理不需要的缓存数据

### 4. 错误处理和降级

当遇到问题时，系统会：

1. 自动检测渲染性能问题
2. 降级到更简单的渲染模式
3. 保证内容的完整传输
4. 提供详细的错误信息和恢复建议

## 使用示例

### 基础流式输出
\`\`\`bash
# 启动流式演示
writeflow demo streaming

# 使用自定义主题
writeflow demo streaming --theme=light

# 启用调试模式
writeflow demo streaming --debug
\`\`\`

### 集成到现有项目
\`\`\`javascript
import { getStreamingPipeline, StreamingOutputManager } from 'writeflow'

// 创建流式管道
const pipeline = getStreamingPipeline({
  theme: 'dark',
  enableColors: true
})

// 在 React 组件中使用
function MyComponent() {
  return (
    <StreamingOutputManager
      streamId="my-stream"
      content="Hello, streaming world!"
      delay={25}
      enableSyntaxHighlight={true}
    />
  )
}
\`\`\`

## 高级特性

### 自定义渲染器
你可以创建自定义的内容渲染器：

\`\`\`typescript
import { StreamingPipeline } from 'writeflow'

class CustomRenderer extends StreamingPipeline {
  protected renderChunk(chunk: StreamChunk): string {
    // 自定义渲染逻辑
    return super.renderChunk(chunk)
  }
}
\`\`\`

### 性能监控
系统提供详细的性能指标：

\`\`\`javascript
const optimizer = getPerformanceOptimizer()
const report = optimizer.getPerformanceReport()

console.log('FPS:', report.rendering.fps)
console.log('内存使用:', report.rendering.memoryUsage, 'MB')
console.log('建议:', report.recommendations)
\`\`\`

---

这个演示展示了 WriteFlow 流式输出系统的强大功能。系统能够：

✅ **实时渲染** - 逐字符显示内容，提供真实的打字体验
✅ **智能格式化** - 自动识别代码、Markdown 等不同内容类型
✅ **性能优化** - 自适应渲染频率，确保流畅体验
✅ **错误恢复** - 自动检测和修复传输错误
✅ **主题支持** - 支持深色和浅色主题
✅ **可扩展性** - 易于集成和定制

现在，WriteFlow 已经具备了与 Claude Code 相媲美的流式输出能力！`

/**
 * 运行流式输出演示
 */
export async function runStreamingDemo(options: {
  theme?: 'light' | 'dark'
  delay?: number
  enableDebug?: boolean
  showPerformance?: boolean
} = {}): Promise<void> {
  const {
    theme = 'dark',
    delay = 25,
    enableDebug = false,
    showPerformance = false
  } = options

  console.log('🚀 WriteFlow 流式输出系统演示开始\n')
  
  // 创建流式管道
  const pipeline = getStreamingPipeline({
    theme,
    enableColors: true,
    enableDoubleBuffer: true,
    renderDelay: 50,
    onChunk: (chunk) => {
      if (enableDebug) {
        console.log(`[DEBUG] 块: ${chunk.content.slice(0, 20)}...`)
      }
    },
    onComplete: (buffer) => {
      console.log(`\n✨ 流式输出完成! 总长度: ${buffer.content.length} 字符`)
    }
  })

  // 创建性能优化器
  const optimizer = getPerformanceOptimizer({
    targetFPS: 30,
    adaptiveRendering: true,
    enableFrameSkipping: true
  })

  // 开始演示
  const streamId = 'streaming-demo'
  pipeline.startStream(streamId, demoContent.length)

  // 模拟逐步添加内容
  const chunkSize = 50
  let position = 0

  const addContentChunk = () => {
    if (position < demoContent.length) {
      const chunk = demoContent.slice(position, position + chunkSize)
      
      // 使用性能优化器处理内容
      const optimized = optimizer.optimizeContent(streamId, chunk)
      pipeline.addChunk(streamId, optimized.content)
      
      position += chunkSize
      
      // 继续下一块
      setTimeout(addContentChunk, delay)
    } else {
      // 完成流处理
      pipeline.completeStream(streamId)
      
      // 显示性能报告
      if (showPerformance) {
        setTimeout(() => {
          showPerformanceReport(optimizer)
        }, 1000)
      }
    }
  }

  // 开始流式传输
  addContentChunk()
}

/**
 * 显示性能报告
 */
function showPerformanceReport(optimizer: any): void {
  console.log('\n' + '='.repeat(60))
  console.log('📊 性能报告')
  console.log('='.repeat(60))
  
  const report = optimizer.getPerformanceReport()
  const formatter = getOutputFormatter()
  
  console.log(`🎯 渲染性能:`)
  console.log(`   FPS: ${report.rendering.fps.toFixed(1)}`)
  console.log(`   平均渲染时间: ${report.rendering.renderTime.toFixed(2)}ms`)
  console.log(`   内存使用: ${report.rendering.memoryUsage.toFixed(2)}MB`)
  console.log(`   掉帧次数: ${report.rendering.frameDrops}`)
  
  console.log(`\n🛡️ 内容完整性:`)
  console.log(`   总错误数: ${report.integrity.totalCorruptions}`)
  console.log(`   已修复: ${report.integrity.repairedCount}`)
  
  if (report.recommendations.length > 0) {
    console.log(`\n💡 建议:`)
    report.recommendations.forEach(rec => {
      console.log(`   • ${rec}`)
    })
  }
  
  console.log('\n' + formatter.formatSuccess('✨ 演示完成！WriteFlow 流式输出系统已就绪。'))
}

/**
 * 交互式演示模式
 */
export async function runInteractiveDemo(): Promise<void> {
  console.log('🎮 WriteFlow 交互式流式演示')
  console.log('输入文本内容，系统将以流式方式实时显示')
  console.log('输入 "exit" 退出，"help" 查看帮助\n')
  
  const pipeline = getStreamingPipeline({
    theme: 'dark',
    enableColors: true
  })

  // 简化的交互式输入处理
  // 实际实现中需要使用适当的输入处理库
  console.log('请输入内容 (按回车确认):')
}

// 如果直接运行此文件，执行演示
if (import.meta.url.endsWith(process.argv[1])) {
  const args = process.argv.slice(2)
  const options = {
    theme: args.includes('--theme=light') ? 'light' as const : 'dark' as const,
    enableDebug: args.includes('--debug'),
    showPerformance: args.includes('--performance'),
    delay: args.includes('--fast') ? 10 : 25
  }
  
  if (args.includes('--interactive')) {
    runInteractiveDemo()
  } else {
    runStreamingDemo(options)
  }
}