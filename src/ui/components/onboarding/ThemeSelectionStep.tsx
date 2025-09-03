import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { getTheme, ThemeNames } from '../../../utils/theme.js'
import { WritingSample } from './components/WritingSample.js'

interface ThemeOption {
  label: string
  value: ThemeNames
  description: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    label: '深色主题（推荐）',
    value: 'dark',
    description: '护眼的深色界面，适合长时间写作',
  },
  {
    label: '浅色主题',
    value: 'light', 
    description: '简洁的浅色界面，清晰明亮',
  },
]

interface ThemeSelectionStepProps {
  onThemeSelect: (theme: ThemeNames) => void
  onPreviewTheme: (theme: ThemeNames) => void
  defaultTheme?: ThemeNames
}

export function ThemeSelectionStep({
  onThemeSelect,
  onPreviewTheme,
  defaultTheme = 'dark'
}: ThemeSelectionStepProps): React.ReactElement {
  const theme = getTheme()
  const [selectedIndex, setSelectedIndex] = useState(
    THEME_OPTIONS.findIndex(option => option.value === defaultTheme)
  )
  const [previewTheme, setPreviewTheme] = useState<ThemeNames>(defaultTheme)

  useInput((input, key) => {
    if (key.upArrow) {
      const newIndex = selectedIndex > 0 ? selectedIndex - 1 : THEME_OPTIONS.length - 1
      setSelectedIndex(newIndex)
      const newTheme = THEME_OPTIONS[newIndex].value
      setPreviewTheme(newTheme)
      onPreviewTheme(newTheme)
    } else if (key.downArrow) {
      const newIndex = selectedIndex < THEME_OPTIONS.length - 1 ? selectedIndex + 1 : 0
      setSelectedIndex(newIndex)
      const newTheme = THEME_OPTIONS[newIndex].value
      setPreviewTheme(newTheme)
      onPreviewTheme(newTheme)
    } else if (key.return) {
      onThemeSelect(THEME_OPTIONS[selectedIndex].value)
    }
  })

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Box flexDirection="column">
        <Text bold>选择您喜欢的主题风格：</Text>
        <Text color={theme.secondaryText}>
          使用 ↑↓ 箭头键预览，按 Enter 确认选择
        </Text>
      </Box>

      {/* 主题选项 */}
      <Box flexDirection="column" marginTop={1} gap={1}>
        {THEME_OPTIONS.map((option, index) => (
          <Box key={option.value} flexDirection="row" alignItems="center">
            <Text color={index === selectedIndex ? theme.claude : theme.secondaryText}>
              {index === selectedIndex ? '●' : '○'} 
            </Text>
            <Box marginLeft={1} flexDirection="column">
              <Text 
                bold={index === selectedIndex}
                color={index === selectedIndex ? theme.text : theme.secondaryText}
              >
                {option.label}
              </Text>
              <Text color={theme.secondaryText}>
                {option.description}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* 预览区域 */}
      <Box marginTop={2} flexDirection="column">
        <Text bold color={theme.text}>预览效果：</Text>
        <Box marginTop={1}>
          <WritingSample overrideTheme={previewTheme} width={50} />
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text color={theme.secondaryText} italic>
          提示：您可以随时通过 /config 命令更改主题设置
        </Text>
      </Box>
    </Box>
  )
}