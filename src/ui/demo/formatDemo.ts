import { debugLog, logError, logWarn, infoLog } from '../../utils/log.js'

/**
 * WriteFlow 输出格式化演示
 * 测试新的格式化系统功能
 */

import { getOutputFormatter } from '../utils/outputFormatter.js'
import { getThemeManager } from '../theme/index.js'

const testContent = `# WriteFlow 代码格式化演示

这是一个测试 WriteFlow 新输出格式化系统的演示。

## JavaScript 代码示例

\`\`\`javascript
function greetUser(name) {
  debugLog(\`Hello, \${name}!\`)
  return true
}

const users = ['Alice', 'Bob', 'Charlie']
users.forEach(user => greetUser(user))
\`\`\`

## TypeScript 接口示例

\`\`\`typescript
interface User {
  id: number
  name: string
  email: string
  isActive: boolean
}

type UserRole = 'admin' | 'user' | 'guest'

class UserService {
  private users: User[] = []
  
  addUser(user: User): void {
    this.users.push(user)
  }
  
  findUserById(id: number): User | undefined {
    return this.users.find(u => u.id === id)
  }
}
\`\`\`

## 内联代码和列表

- 使用 \`npm install\` 安装依赖
- 运行 \`npm run build\` 构建项目  
- 执行 \`npm test\` 运行测试

> **注意**: 这是一个引用块，用于显示重要信息。

## 表格示例

| 功能 | 状态 | 描述 |
|------|------|------|
| 语法高亮 | ✅ | 支持多种编程语言 |
| 行号显示 | ✅ | 自动添加行号 |
| 主题切换 | ✅ | 支持深色/浅色主题 |
| Diff 显示 | ✅ | Git 风格的文件对比 |

---

这个演示展示了 WriteFlow 强大的格式化能力！`

export function runFormatDemo(): void {
  debugLog('🚀 WriteFlow 输出格式化演示开始\n')
  
  // 测试深色主题
  debugLog('='.repeat(60))
  debugLog('📱 深色主题演示')
  debugLog('='.repeat(60))
  
  const darkFormatter = getOutputFormatter({ theme: 'dark' })
  const darkFormatted = darkFormatter.formatStreamOutput(testContent)
  
  debugLog(darkFormatted.content)
  debugLog(darkFormatter.formatSuccess(`✨ 深色主题格式化完成！包含 ${darkFormatted.codeBlockCount} 个代码块，耗时 ${darkFormatted.renderTime}ms`))
  
  debugLog('\n' + '='.repeat(60))
  debugLog('☀️ 浅色主题演示')
  debugLog('='.repeat(60))
  
  // 测试浅色主题
  const lightFormatter = getOutputFormatter({ theme: 'light' })
  const lightFormatted = lightFormatter.formatStreamOutput(testContent)
  
  debugLog(lightFormatted.content)
  debugLog(lightFormatter.formatSuccess(`✨ 浅色主题格式化完成！包含 ${lightFormatted.codeBlockCount} 个代码块，耗时 ${lightFormatted.renderTime}ms`))
  
  debugLog('\n' + '='.repeat(60))
  debugLog('🔧 其他格式化功能演示')
  debugLog('='.repeat(60))
  
  // 测试其他格式化功能
  const formatter = getOutputFormatter()
  
  debugLog(formatter.formatProgress('正在处理文件', { current: 3, total: 10 }))
  debugLog(formatter.formatFileOperation('create', 'src/components/NewComponent.tsx'))
  debugLog(formatter.formatFileOperation('update', 'src/utils/helper.ts'))
  debugLog(formatter.formatFileOperation('delete', 'src/old/LegacyCode.js'))
  debugLog(formatter.formatWarning('发现过时的依赖包'))
  debugLog(formatter.formatError('构建过程中发生错误'))
  
  // 测试文件差异
  const oldCode = `function hello(name) {
  debugLog("Hello " + name);
}`

  const newCode = `function hello(name) {
  debugLog(\`Hello, \${name}!\`);
  return true;
}`
  
  debugLog('\n📊 文件差异演示:')
  const diff = formatter.formatFileDiff(oldCode, newCode, 'hello.js')
  debugLog(diff)
  
  // 主题管理器演示
  debugLog('\n🎨 主题管理器演示:')
  const themeManager = getThemeManager()
  debugLog(`当前主题: ${themeManager.getThemeName()}`)
  debugLog(`是否深色主题: ${themeManager.isDarkTheme()}`)
  debugLog(`可用主题: ${themeManager.listThemes().join(', ')}`)
  
  debugLog('\n🎉 演示完成！WriteFlow 输出格式化系统已就绪。')
}

// 如果直接运行此文件，执行演示
if (import.meta.url.endsWith(process.argv[1])) {
  runFormatDemo()
}