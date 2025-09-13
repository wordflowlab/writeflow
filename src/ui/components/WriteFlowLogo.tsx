import { Box, Text } from 'ink'
import React from 'react'
import { getTheme } from '../../utils/theme'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

const PRODUCT_NAME = 'WriteFlow'
const VERSION = '1.0.0'

interface WriteFlowLogoProps {
  showWelcome?: boolean
  showVersion?: boolean
  showFeatures?: boolean
}

export function WriteFlowLogo({
  showWelcome = true,
  showVersion = true,
  showFeatures = true
}: WriteFlowLogoProps) {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  
  // Calculate logo width based on terminal size
  const minWidth = 60
  const maxWidth = 100
  const width = Math.max(minWidth, Math.min(columns - 4, maxWidth))
  
  // Get current working directory info
  const cwd = process.cwd()
  const projectName = cwd.split('/').pop() || 'unknown'
  
  // Check for environment overrides (similar to Kode)
  const hasOverrides = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.DEBUG ||
    process.env.WRITEFLOW_MODEL
  )
  
  return (
    <Box flexDirection="column" marginBottom={2}>
      <Box
        borderColor={theme.claude}
        borderStyle="round"
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingY={1}
        width={width}
      >
        {/* Main header */}
        <Box flexDirection="row" alignItems="center">
          <Text color={theme.claude}>✎ </Text>
          {showWelcome && (
            <Text>
              欢迎使用 <Text bold color={theme.claude}>{PRODUCT_NAME}</Text>
              {showVersion && (
                <Text dimColor> v{VERSION}</Text>
              )}
              <Text> AI 写作助手</Text>
            </Text>
          )}
        </Box>
        
        {/* Subtitle */}
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.secondaryText} italic>
            专为技术型作家设计的智能写作工具
          </Text>
          <Text color={theme.secondaryText}>
            /help 获取帮助 · 当前项目: {projectName}
          </Text>
        </Box>
        
        {/* Features section */}
        {showFeatures && (
          <Box
            borderColor={theme.secondaryBorder}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderTop={true}
            flexDirection="column"
            marginTop={1}
            paddingTop={1}
          >
            <Text color={theme.secondaryText} bold>
              支持的写作模式:
            </Text>
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.secondaryText}>
                • <Text color="#00ff87">✎ 写作模式</Text> - 创意写作和内容生成
              </Text>
              <Text color={theme.secondaryText}>
                • <Text color="#ff9500">✏ 编辑模式</Text> - 内容修改和优化
              </Text>
              <Text color={theme.secondaryText}>
                • <Text color="#007acc">👁 审阅模式</Text> - 文档审查和反馈
              </Text>
            </Box>
          </Box>
        )}
        
        {/* Environment overrides section */}
        {hasOverrides && (
          <Box
            borderColor={theme.secondaryBorder}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderTop={true}
            flexDirection="column"
            marginTop={1}
            paddingTop={1}
          >
            <Text color={theme.secondaryText}>
              环境配置覆盖:
            </Text>
            <Box flexDirection="column" marginTop={1}>
              {process.env.OPENAI_API_KEY && (
                <Text color={theme.secondaryText}>
                  • OpenAI API: <Text bold>已配置</Text>
                </Text>
              )}
              {process.env.ANTHROPIC_API_KEY && (
                <Text color={theme.secondaryText}>
                  • Anthropic API: <Text bold>已配置</Text>
                </Text>
              )}
              {process.env.DEEPSEEK_API_KEY && (
                <Text color={theme.secondaryText}>
                  • DeepSeek API: <Text bold>已配置</Text>
                </Text>
              )}
              {process.env.WRITEFLOW_MODEL && (
                <Text color={theme.secondaryText}>
                  • 默认模型: <Text bold>{process.env.WRITEFLOW_MODEL}</Text>
                </Text>
              )}
              {process.env.DEBUG && (
                <Text color={theme.secondaryText}>
                  • 调试模式: <Text bold color={theme.error}>开启</Text>
                </Text>
              )}
            </Box>
          </Box>
        )}
        
        {/* Quick start tips */}
        <Box
          borderColor={theme.secondaryBorder}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderTop={true}
          flexDirection="column"
          marginTop={1}
          paddingTop={1}
        >
          <Text color={theme.secondaryText}>
            💡 快速开始: 描述您想要写作的内容，AI 将协助您完成创作
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

// Compact version for inline display
export function WriteFlowMiniLogo() {
  const theme = getTheme()
  
  return (
    <Box flexDirection="row" alignItems="center">
      <Text color={theme.claude}>✎ </Text>
      <Text bold color={theme.claude}>WriteFlow</Text>
      <Text dimColor> AI写作</Text>
    </Box>
  )
}

// Status logo for header
export function WriteFlowStatusLogo() {
  const theme = getTheme()
  
  return (
    <Box
      borderColor={theme.secondaryBorder}
      borderStyle="round"
      paddingLeft={1}
      paddingRight={1}
    >
      <Text color={theme.claude}>✎ WriteFlow</Text>
    </Box>
  )
}