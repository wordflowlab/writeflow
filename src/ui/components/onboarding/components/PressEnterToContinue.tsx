import React from 'react'
import { Text } from 'ink'
import { getTheme } from '../../../../utils/theme.js'

interface PressEnterToContinueProps {
  text?: string
}

export function PressEnterToContinue({ 
  text = "按 Enter 继续..." 
}: PressEnterToContinueProps): React.ReactElement {
  const theme = getTheme()
  
  return (
    <Text color={theme.claude}>
      {text} <Text bold>Enter</Text>
    </Text>
  )
}