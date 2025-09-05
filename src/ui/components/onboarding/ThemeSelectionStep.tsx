import React from 'react'
import { Box, Text } from 'ink'
import { getTheme, ThemeNames } from '../../../utils/theme.js'
import { ThemeSelector } from './ThemeSelector.js'

interface ThemeSelectionStepProps {
  onThemeSelect: (theme: ThemeNames) => void
  onPreviewTheme: (theme: ThemeNames) => void
  defaultTheme?: ThemeNames
}

export function ThemeSelectionStep({
  onThemeSelect,
  onPreviewTheme,
  defaultTheme
}: ThemeSelectionStepProps): React.ReactElement {
  const theme = getTheme()

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" paddingLeft={1} marginBottom={1}>
        <Text bold color={theme.text}>🎨 选择主题</Text>
        <Text color={theme.secondaryText}>
          让我们为您的终端选择最佳的配色方案
        </Text>
      </Box>

      <ThemeSelector
        onThemeSelect={onThemeSelect}
        onThemePreview={onPreviewTheme}
        defaultTheme={defaultTheme}
      />
    </Box>
  )
}