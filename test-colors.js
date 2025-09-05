#!/usr/bin/env node

import { WriteFlowApp } from './dist/cli/writeflow-app.js'

console.log('🎨 测试 WriteFlow 颜色优化效果...\n')

const app = new WriteFlowApp()

try {
  await app.initialize()
  console.log('WriteFlow 初始化完成\n')
  
  // 测试富文本渲染的颜色效果
  const testContent = `# 颜色测试示例

这是一段**粗体文本**和*斜体文本*的测试。

## 代码示例

下面是一些 JavaScript 代码：

\`\`\`javascript
function testColors() {
  const message = "Hello, colorful world!"
  console.log(message)
  return { success: true, colors: "enhanced" }
}
\`\`\`

还有行内代码：\`const theme = getTheme()\`

> 这是一个引用块，用来测试引用的颜色显示

## 列表测试

- 第一个列表项
- 第二个列表项  
- 第三个列表项

1. 数字列表项
2. 另一个数字列表项

[这是一个链接](https://example.com)

---

**测试完成** - 如果你看到不同的颜色，说明优化生效了！`

  const response = await app.handleFreeTextInput(
    '请按照 Markdown 格式完整显示这段测试内容，展示所有颜色效果：' + testContent, 
    {}
  )
  
  console.log('✨ 颜色测试完成！\n')
  console.log('如果上面的内容显示了丰富的颜色（蓝色标题、绿色代码、橙色粗体等），说明颜色优化成功！')
  
} catch (error) {
  console.error('测试失败:', error.message)
}