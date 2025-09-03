import React from 'react'
import { Box, Text } from 'ink'
import { getTheme } from '../../../utils/theme.js'
import { getVersionString } from '../../../utils/version.js'
import { PressEnterToContinue } from './components/PressEnterToContinue.js'

export function WelcomeStep(): React.ReactElement {
  const theme = getTheme()
  
  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      {/* 欢迎消息 */}
      <Box flexDirection="column" gap={1}>
        <Text>
          <Text color={theme.claude}>✍️</Text> 欢迎使用{' '}
          <Text bold color={theme.claude}>WriteFlow</Text>{' '}
          AI 写作助手 <Text color={theme.secondaryText}>{getVersionString()}</Text>
        </Text>
        
        <Text color={theme.secondaryText}>
          让我们花几分钟时间配置 WriteFlow，为您提供最佳的写作体验。
        </Text>
      </Box>

      {/* 特色功能介绍 */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold color={theme.text}>WriteFlow 能为您做什么：</Text>
        
        <Box flexDirection="column" marginLeft={2} marginTop={1} gap={1}>
          <Box flexDirection="row">
            <Text color={theme.claude}>📄 </Text>
            <Text>技术文档撰写 - API 文档、技术博客、说明书</Text>
          </Box>
          
          <Box flexDirection="row">
            <Text color={theme.claude}>🎓 </Text>
            <Text>学术论文协助 - 论文大纲、引用管理、格式规范</Text>
          </Box>
          
          <Box flexDirection="row">
            <Text color={theme.claude}>🎨 </Text>
            <Text>创意写作支持 - 小说、散文、剧本创作</Text>
          </Box>
          
          <Box flexDirection="row">
            <Text color={theme.claude}>🌍 </Text>
            <Text>多语言写作 - 中文、英文无缝切换</Text>
          </Box>
        </Box>
      </Box>

      {/* 使用提示 */}
      <Box 
        marginTop={2}
        borderStyle="single"
        borderColor={theme.secondaryBorder}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column" gap={1}>
          <Text bold color={theme.text}>💡 快速提示：</Text>
          <Text color={theme.secondaryText}>
            • 使用斜杠命令开始写作：/outline、/write、/improve
          </Text>
          <Text color={theme.secondaryText}>
            • 随时按 <Text bold>Ctrl+C</Text> 两次安全退出
          </Text>
          <Text color={theme.secondaryText}>
            • 输入 /help 查看所有可用命令
          </Text>
        </Box>
      </Box>

      <Box marginTop={2}>
        <PressEnterToContinue text="准备好了吗？按" />
      </Box>
    </Box>
  )
}