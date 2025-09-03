import React from 'react'
import { Box, Text } from 'ink'
import { getTheme, ThemeNames } from '../../../../utils/theme.js'

interface WritingSampleProps {
  overrideTheme?: ThemeNames
  width?: number
}

export function WritingSample({ 
  overrideTheme, 
  width = 60 
}: WritingSampleProps): React.ReactElement {
  const theme = getTheme(overrideTheme)
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={theme.secondaryBorder}
      paddingX={2}
      paddingY={1}
      width={width}
    >
      {/* 文档标题 */}
      <Text bold color={theme.text}>
        # WriteFlow AI 写作助手使用指南
      </Text>
      
      <Box marginY={1}>
        <Text color={theme.secondaryText}>
          WriteFlow 是专为技术型作家设计的智能写作工具，
          支持多种写作场景和创作需求。
        </Text>
      </Box>

      {/* 功能列表 */}
      <Text color={theme.text}>
        ## 核心功能
      </Text>
      
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Text color={theme.claude}>• 技术文档撰写</Text>
        <Text color={theme.claude}>• 学术论文协助</Text>
        <Text color={theme.claude}>• 创意写作支持</Text>
        <Text color={theme.claude}>• 多语言写作能力</Text>
      </Box>

      {/* 示例代码块 */}
      <Box marginTop={1}>
        <Text color={theme.text}>
          ## 快速开始
        </Text>
      </Box>
      
      <Box 
        marginTop={1} 
        borderStyle="single" 
        borderColor={theme.secondaryBorder}
        paddingX={1}
      >
        <Text color={theme.suggestion}>
          $ writeflow start{'\n'}
          $ /outline AI技术发展趋势{'\n'}
          $ /write 详细介绍机器学习的应用场景
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.secondaryText} italic>
          让 AI 成为你的写作伙伴，释放创造力！
        </Text>
      </Box>
    </Box>
  )
}