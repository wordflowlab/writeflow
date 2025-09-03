import React from 'react'
import { Box, Text } from 'ink'
import { getTheme } from '../../../utils/theme.js'
import { PressEnterToContinue } from './components/PressEnterToContinue.js'

export function WritingModeStep(): React.ReactElement {
  const theme = getTheme()
  
  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Box flexDirection="column">
        <Text bold>探索 WriteFlow 的强大写作功能：</Text>
        <Text color={theme.secondaryText}>
          了解如何充分利用 AI 助手提升您的写作效率
        </Text>
      </Box>

      {/* 写作模式介绍 */}
      <Box flexDirection="column" marginTop={2} gap={2}>
        {/* 技术文档 */}
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row">
            <Text color={theme.claude}>📄 技术文档撰写</Text>
          </Box>
          <Box marginLeft={3} flexDirection="column" gap={1}>
            <Text color={theme.secondaryText}>
              • /api - 生成 API 文档和接口说明
            </Text>
            <Text color={theme.secondaryText}>
              • /guide - 创建用户指南和教程
            </Text>
            <Text color={theme.secondaryText}>
              • /readme - 编写项目说明文档
            </Text>
          </Box>
        </Box>

        {/* 学术写作 */}
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row">
            <Text color={theme.claude}>🎓 学术论文协助</Text>
          </Box>
          <Box marginLeft={3} flexDirection="column" gap={1}>
            <Text color={theme.secondaryText}>
              • /outline - 生成论文大纲和结构
            </Text>
            <Text color={theme.secondaryText}>
              • /research - 整理研究思路和观点
            </Text>
            <Text color={theme.secondaryText}>
              • /citation - 规范引用格式和文献
            </Text>
          </Box>
        </Box>

        {/* 创意写作 */}
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row">
            <Text color={theme.claude}>🎨 创意写作支持</Text>
          </Box>
          <Box marginLeft={3} flexDirection="column" gap={1}>
            <Text color={theme.secondaryText}>
              • /story - 创作小说和故事情节
            </Text>
            <Text color={theme.secondaryText}>
              • /character - 开发人物角色设定
            </Text>
            <Text color={theme.secondaryText}>
              • /poem - 写诗歌和韵律文字
            </Text>
          </Box>
        </Box>
      </Box>

      {/* 通用命令 */}
      <Box 
        marginTop={2}
        borderStyle="single"
        borderColor={theme.secondaryBorder}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column" gap={1}>
          <Text bold color={theme.text}>🚀 通用写作命令：</Text>
          <Text color={theme.secondaryText}>
            • <Text bold>/write</Text> - 开始自由写作和内容生成
          </Text>
          <Text color={theme.secondaryText}>
            • <Text bold>/improve</Text> - 优化和润色已有文本
          </Text>
          <Text color={theme.secondaryText}>
            • <Text bold>/translate</Text> - 多语言翻译和本地化
          </Text>
          <Text color={theme.secondaryText}>
            • <Text bold>/format</Text> - 调整文档格式和排版
          </Text>
        </Box>
      </Box>

      {/* 提示信息 */}
      <Box marginTop={2} flexDirection="column" gap={1}>
        <Text color={theme.text} bold>
          💡 写作小贴士：
        </Text>
        <Text color={theme.secondaryText}>
          • 越详细的描述，AI 越能理解您的需求
        </Text>
        <Text color={theme.secondaryText}>
          • 可以随时调整写作风格：正式、友好、学术、创意
        </Text>
        <Text color={theme.secondaryText}>
          • 支持中英文混合写作，自动适应语言环境
        </Text>
      </Box>

      <Box marginTop={2}>
        <PressEnterToContinue text="了解了写作功能？按" />
      </Box>
    </Box>
  )
}