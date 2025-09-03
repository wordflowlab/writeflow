import React from 'react'
import { Box, Text } from 'ink'
import { getTheme } from '../../../../utils/theme.js'
import { useTerminalSize } from '../../../../hooks/useTerminalSize.js'

interface StepContainerProps {
  title: string
  stepNumber: number
  totalSteps: number
  exitState?: { pending: boolean; keyName: string | null }
  children: React.ReactNode
  showProgress?: boolean
}

export function StepContainer({
  title,
  stepNumber,
  totalSteps,
  exitState,
  children,
  showProgress = true,
}: StepContainerProps): React.ReactElement {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  const width = Math.max(60, Math.min(columns - 4, 100))

  return (
    <Box flexDirection="column" gap={1}>
      <Box
        borderColor={theme.claude}
        borderStyle="round"
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingY={1}
        width={width}
      >
        {/* 标题栏 */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text bold color={theme.claude}>
            {title}
            {exitState?.pending && (
              <Text color={theme.secondaryText}>
                {' '}(再次按 {exitState.keyName} 退出)
              </Text>
            )}
          </Text>
          {showProgress && (
            <Text color={theme.secondaryText}>
              {stepNumber}/{totalSteps}
            </Text>
          )}
        </Box>

        {/* 进度条 */}
        {showProgress && (
          <Box marginTop={1} marginBottom={1}>
            <Text color={theme.secondaryText}>
              {'█'.repeat(Math.floor((stepNumber / totalSteps) * 20))}
              {'░'.repeat(20 - Math.floor((stepNumber / totalSteps) * 20))}
              {' '}
              {Math.round((stepNumber / totalSteps) * 100)}%
            </Text>
          </Box>
        )}

        {/* 内容区域 */}
        <Box flexDirection="column" gap={1}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}