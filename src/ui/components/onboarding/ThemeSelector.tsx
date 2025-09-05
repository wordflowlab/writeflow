import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { getTheme, ThemeNames, detectSystemTheme, getRecommendedTheme } from '../../../utils/theme.js'

interface ThemeOption {
  label: string
  value: ThemeNames
  description: string
  preview?: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    label: '浅色文字（深色背景）',
    value: 'dark',
    description: '适合深色终端环境，使用亮绿色品牌色',
    preview: '✅ WriteFlow AI 写作助手'
  },
  {
    label: '深色文字（浅色背景）', 
    value: 'light',
    description: '适合浅色终端环境，使用深蓝色提升可读性',
    preview: '✅ WriteFlow AI 写作助手'
  },
  {
    label: '浅色文字（高对比度）',
    value: 'dark-accessible', 
    description: '深色背景增强版，提供更好的可访问性',
    preview: '✅ WriteFlow AI 写作助手'
  },
  {
    label: '深色文字（高对比度）',
    value: 'light-accessible',
    description: '浅色背景增强版，适合视觉辅助需求',
    preview: '✅ WriteFlow AI 写作助手'
  },
  {
    label: '智能检测',
    value: 'auto',
    description: '根据系统主题自动选择最佳配色',
    preview: '🤖 自动适配中...'
  }
]

interface ThemeSelectorProps {
  onThemeSelect: (theme: ThemeNames) => void
  onThemePreview?: (theme: ThemeNames) => void
  defaultTheme?: ThemeNames
}

export function ThemeSelector({
  onThemeSelect,
  onThemePreview,
  defaultTheme
}: ThemeSelectorProps): React.ReactElement {
  // Get intelligent default
  const recommendedTheme = defaultTheme || getRecommendedTheme()
  const initialIndex = THEME_OPTIONS.findIndex(option => option.value === recommendedTheme)
  
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialIndex))
  const [previewTheme, setPreviewTheme] = useState<ThemeNames>(recommendedTheme)

  const theme = getTheme(previewTheme)

  useInput((input, key) => {
    if (key.upArrow) {
      const newIndex = selectedIndex > 0 ? selectedIndex - 1 : THEME_OPTIONS.length - 1
      setSelectedIndex(newIndex)
      const newTheme = THEME_OPTIONS[newIndex].value
      setPreviewTheme(newTheme)
      onThemePreview?.(newTheme)
    } else if (key.downArrow) {
      const newIndex = selectedIndex < THEME_OPTIONS.length - 1 ? selectedIndex + 1 : 0
      setSelectedIndex(newIndex) 
      const newTheme = THEME_OPTIONS[newIndex].value
      setPreviewTheme(newTheme)
      onThemePreview?.(newTheme)
    } else if (key.return) {
      onThemeSelect(THEME_OPTIONS[selectedIndex].value)
    }
  })

  // Show system detection info
  const detectedTheme = detectSystemTheme()
  const detectionInfo = detectedTheme !== 'unknown' 
    ? `检测到系统主题: ${detectedTheme === 'dark' ? '深色模式' : '浅色模式'}`
    : '无法自动检测系统主题'

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Box flexDirection="column">
        <Text bold color={theme.text}>选择适合您终端的主题风格：</Text>
        <Text color={theme.secondaryText}>
          使用 ↑↓ 箭头键预览，按 Enter 确认选择
        </Text>
        <Text color={theme.dimText} italic>
          {detectionInfo}
        </Text>
      </Box>

      {/* 主题选项列表 */}
      <Box flexDirection="column" marginTop={1} gap={1}>
        {THEME_OPTIONS.map((option, index) => {
          const isSelected = index === selectedIndex
          const optionTheme = getTheme(option.value)
          
          return (
            <Box key={option.value} flexDirection="column">
              <Box flexDirection="row" alignItems="center">
                <Text color={isSelected ? theme.claude : theme.secondaryText}>
                  {isSelected ? '●' : '○'} 
                </Text>
                <Box marginLeft={1} flexDirection="column">
                  <Text 
                    bold={isSelected}
                    color={isSelected ? theme.text : theme.secondaryText}
                  >
                    {option.label}
                    {option.value === recommendedTheme && ' (推荐)'}
                  </Text>
                  <Text color={theme.dimText} dimColor>
                    {option.description}
                  </Text>
                </Box>
              </Box>
              
              {/* 预览区域 - 只为当前选中的显示 */}
              {isSelected && (
                <Box marginLeft={3} marginTop={1}>
                  <Box 
                    paddingX={2} 
                    paddingY={1} 
                    borderStyle="round" 
                    borderColor={optionTheme.border}
                    flexDirection="column"
                  >
                    <Text color={optionTheme.claude} bold>
                      {option.preview}
                    </Text>
                    <Text color={optionTheme.success}>
                      ✔ 成功消息示例
                    </Text>
                    <Text color={optionTheme.warning}>
                      ⚠ 警告消息示例  
                    </Text>
                    <Text color={optionTheme.error}>
                      ✗ 错误消息示例
                    </Text>
                  </Box>
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      <Box marginTop={2}>
        <Text color={theme.secondaryText} italic>
          提示：您可以随时通过 /config 或 /theme 命令更改主题设置
        </Text>
      </Box>
    </Box>
  )
}