#!/usr/bin/env node

/**
 * 简单的流式输出测试
 * 直接测试组件而不使用交互式界面
 */

import React from 'react'
import { render } from 'ink'
import { Text, Box } from 'ink'
import { StreamingText } from '../ui/components/streaming/StreamingText.js'

const TEST_CONTENT = "这是一个测试文本，用来验证字符级别的流式输出效果。如果你看到这些文字是逐个字符出现的，那说明流式输出功能正常工作！"

const SimpleStreamTest = () => {
  const [testComplete, setTestComplete] = React.useState(false)
  const [startTime] = React.useState(Date.now())

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green" bold>
        🧪 WriteFlow 流式输出简单测试
      </Text>
      
      <Box marginY={1}>
        <Text dimColor>
          测试内容: 观察下方文字是否逐字符出现...
        </Text>
      </Box>

      <Box borderStyle="single" borderColor="cyan" padding={1}>
        <StreamingText
          content={TEST_CONTENT}
          delay={50} // 50ms 延迟，比较容易观察
          theme="dark"
          renderMode="character"
          preserveFormatting={true}
          cursor={!testComplete}
          onComplete={() => {
            setTestComplete(true)
            const endTime = Date.now()
            console.log(`\n✅ 测试完成! 耗时: ${endTime - startTime}ms`)
            setTimeout(() => process.exit(0), 1000)
          }}
        />
      </Box>

      {testComplete && (
        <Box marginTop={1}>
          <Text color="green">
            ✅ 流式输出测试完成！
          </Text>
        </Box>
      )}
    </Box>
  )
}

console.log('🚀 启动简单流式输出测试...\n')

// 渲染测试
const { unmount } = render(React.createElement(SimpleStreamTest))

// 10秒后自动退出
setTimeout(() => {
  unmount()
  console.log('\n⏰ 测试超时，自动退出')
  process.exit(0)
}, 10000)

// 处理退出信号
process.on('SIGINT', () => {
  unmount()
  console.log('\n\n测试被中断')
  process.exit(0)
})