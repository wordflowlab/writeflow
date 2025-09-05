/**
 * WriteFlow 流式输出测试
 * 验证新的流式组件是否正确工作
 */

import React, { useState, useEffect } from 'react'
import { Text, Box, useInput } from 'ink'
import { StreamingOutputManager } from '../components/streaming/StreamingOutputManager.js'
import { StreamingText } from '../components/streaming/StreamingText.js'
import { StreamingMarkdown } from '../components/streaming/StreamingMarkdown.js'
import { StreamingCodeBlock } from '../components/streaming/StreamingCodeBlock.js'

// 测试内容
const TEST_CONTENTS = {
  text: "这是一段普通的文本内容，用来测试字符级别的流式输出效果。我们希望看到文字一个个地出现，就像真正的打字效果一样。",
  
  markdown: `# WriteFlow 流式输出测试

这是一个 **Markdown** 格式的测试内容。

## 功能特性

- 支持 *斜体* 和 **粗体** 文本
- 支持代码块和内联代码 \`console.log()\`
- 支持列表和标题

### 代码示例

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`)
  return \`Welcome to WriteFlow\`
}

greet('开发者')
\`\`\`

### 总结

这个测试应该展示真正的字符级流式渲染效果。`,

  code: `function createStreamingEffect() {
  const content = "这是测试内容"
  let position = 0
  
  const interval = setInterval(() => {
    if (position < content.length) {
      process.stdout.write(content[position])
      position++
    } else {
      clearInterval(interval)
      console.log("\\n流式输出完成!")
    }
  }, 50)
}

// 测试函数
createStreamingEffect()`
}

interface TestState {
  currentTest: keyof typeof TEST_CONTENTS | null
  isRunning: boolean
  results: Array<{ test: string; success: boolean; time: number }>
}

export const StreamingTest: React.FC = () => {
  const [state, setState] = useState<TestState>({
    currentTest: null,
    isRunning: false,
    results: []
  })

  // 键盘输入处理
  useInput((input, key) => {
    if (state.isRunning) return

    if (input === '1') {
      runTest('text')
    } else if (input === '2') {
      runTest('markdown')
    } else if (input === '3') {
      runTest('code')
    } else if (input === '4') {
      runAllTests()
    } else if (input === 'c') {
      clearResults()
    } else if (key.escape || input === 'q') {
      process.exit(0)
    }
  })

  const runTest = (testType: keyof typeof TEST_CONTENTS) => {
    setState(prev => ({
      ...prev,
      currentTest: testType,
      isRunning: true
    }))
  }

  const runAllTests = async () => {
    setState(prev => ({ ...prev, isRunning: true }))
    
    for (const testType of Object.keys(TEST_CONTENTS) as Array<keyof typeof TEST_CONTENTS>) {
      setState(prev => ({ ...prev, currentTest: testType }))
      await new Promise(resolve => setTimeout(resolve, 3000)) // 每个测试3秒
    }
    
    setState(prev => ({ ...prev, isRunning: false, currentTest: null }))
  }

  const clearResults = () => {
    setState(prev => ({
      ...prev,
      results: [],
      currentTest: null,
      isRunning: false
    }))
  }

  const handleTestComplete = (testType: string, success: boolean, time: number) => {
    setState(prev => ({
      ...prev,
      results: [...prev.results, { test: testType, success, time }],
      isRunning: false,
      currentTest: null
    }))
  }

  // 渲染当前测试
  const renderCurrentTest = () => {
    if (!state.currentTest) return null

    const content = TEST_CONTENTS[state.currentTest]
    const startTime = Date.now()

    return (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            正在测试: {state.currentTest.toUpperCase()}
          </Text>
        </Box>

        {/* 使用不同的组件测试 */}
        {state.currentTest === 'text' && (
          <StreamingText
            content={content}
            delay={30}
            theme="dark"
            renderMode="character"
            preserveFormatting={true}
            cursor={true}
            onComplete={() => {
              handleTestComplete('text', true, Date.now() - startTime)
            }}
          />
        )}

        {state.currentTest === 'markdown' && (
          <StreamingMarkdown
            content={content}
            delay={20}
            theme="dark"
            incrementalParsing={true}
            enableSyntaxHighlight={true}
            onComplete={() => {
              handleTestComplete('markdown', true, Date.now() - startTime)
            }}
          />
        )}

        {state.currentTest === 'code' && (
          <StreamingCodeBlock
            code={content}
            language="javascript"
            delay={25}
            theme="dark"
            showLineNumbers={true}
            enableSyntaxHighlight={true}
            showBorder={true}
            onComplete={() => {
              handleTestComplete('code', true, Date.now() - startTime)
            }}
          />
        )}

        <Box marginTop={1}>
          <Text dimColor>
            提示: 观察文字是否逐字符出现...
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* 标题 */}
      <Box marginBottom={2}>
        <Text color="green" bold>
          🚀 WriteFlow 流式输出测试工具
        </Text>
      </Box>

      {/* 说明 */}
      <Box marginBottom={2} flexDirection="column">
        <Text>此工具用于验证新的流式输出组件是否正确实现字符级渲染。</Text>
        <Text dimColor>期望效果: 文字应该逐个字符出现，而不是一次性显示全部内容。</Text>
      </Box>

      {/* 当前测试显示 */}
      {state.currentTest && renderCurrentTest()}

      {/* 测试结果 */}
      {state.results.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text color="yellow" bold>测试结果:</Text>
          {state.results.map((result, index) => (
            <Box key={index} marginLeft={2}>
              <Text color={result.success ? "green" : "red"}>
                {result.success ? "✓" : "✗"} {result.test}: {result.time}ms
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* 控制说明 */}
      {!state.isRunning && (
        <Box flexDirection="column" marginTop={2} borderStyle="single" borderColor="gray" padding={1}>
          <Text color="cyan" bold>控制选项:</Text>
          <Text>[1] 测试纯文本流式输出</Text>
          <Text>[2] 测试 Markdown 流式输出</Text>
          <Text>[3] 测试代码块流式输出</Text>
          <Text>[4] 运行所有测试</Text>
          <Text>[c] 清除结果</Text>
          <Text>[q] 退出</Text>
        </Box>
      )}

      {/* 运行状态 */}
      {state.isRunning && state.currentTest && (
        <Box marginTop={1}>
          <Text color="yellow">
            测试运行中... 请观察字符是否逐一出现
          </Text>
        </Box>
      )}
    </Box>
  )
}

export default StreamingTest