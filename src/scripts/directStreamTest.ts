#!/usr/bin/env node

/**
 * 直接测试流式输出逻辑
 * 不使用 React，直接测试核心功能
 */

// 模拟 StreamingText 的核心逻辑
class SimpleStreamingRenderer {
  private content: string
  private delay: number
  private currentPosition = 0
  private isRunning = false

  constructor(content: string, delay = 50) {
    this.content = content
    this.delay = delay
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    this.currentPosition = 0
    
    console.log('🚀 开始流式渲染...\n')
    
    return new Promise((resolve) => {
      const render = () => {
        if (this.currentPosition < this.content.length) {
          // 打印当前字符
          process.stdout.write(this.content[this.currentPosition])
          this.currentPosition++
          
          // 继续下一个字符
          setTimeout(render, this.delay)
        } else {
          // 渲染完成
          console.log('\n\n✅ 流式渲染完成!')
          this.isRunning = false
          resolve()
        }
      }
      
      render()
    })
  }
}

// 测试不同类型的内容
const testContents = {
  text: "这是一个测试文本，用来验证字符级别的流式输出效果。",
  
  code: `function greet(name) {
  console.log(\`Hello, \${name}!\`)
  return "Welcome!"
}`,

  markdown: `# 标题
这是 **粗体** 文本和 *斜体* 文本。
- 列表项1
- 列表项2`
}

async function runTests() {
  console.log('🧪 WriteFlow 流式输出直接测试\n')
  
  for (const [type, content] of Object.entries(testContents)) {
    console.log(`\n📝 测试类型: ${type.toUpperCase()}`)
    console.log('─'.repeat(50))
    
    const renderer = new SimpleStreamingRenderer(content, 30) // 30ms 延迟
    const startTime = Date.now()
    
    await renderer.start()
    
    const endTime = Date.now()
    console.log(`⏱️  渲染时间: ${endTime - startTime}ms`)
    console.log(`📊 字符数: ${content.length}`)
    console.log(`⚡ 平均速度: ${(content.length / (endTime - startTime) * 1000).toFixed(1)} 字符/秒`)
    
    // 等待一会儿再继续下一个测试
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n🎉 所有测试完成!')
  console.log('\n如果你看到上面的文字是逐字符出现的，说明流式输出逻辑工作正常。')
}

// 运行测试
runTests().catch(console.error)