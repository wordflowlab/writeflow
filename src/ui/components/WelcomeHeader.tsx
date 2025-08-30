import React from 'react'
import { Box, Text } from 'ink'
import { getVersionString } from '../../utils/version.js'
import { Logo } from './Logo.js'

export function WelcomeHeader() {
  return (
    <Box flexDirection="column" marginBottom={2}>
      {/* 显示彩色ASCII Logo */}
      <Logo variant="full" />
      
      {/* 版本信息 */}
      <Box justifyContent="center" marginTop={1}>
        <Text color="gray" dimColor>
          {getVersionString()} · React + Ink 终端界面
        </Text>
      </Box>
    </Box>
  )
}