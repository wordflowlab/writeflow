import React from 'react'
import { Box, Text } from 'ink'
import { UIMode } from '../types/index.js'

interface HintConfig {
  text: string
  color: string
}

interface PromptHintAreaProps {
  mode: UIMode
  currentHint: HintConfig | null
  hasHint: boolean
  isLoading: boolean
}

export function PromptHintArea({ 
  mode, 
  currentHint, 
  hasHint, 
  isLoading 
}: PromptHintAreaProps) {
  if (!hasHint || !currentHint) {
    return null
  }

  return (
    <Box marginBottom={1}>
      <Text color={currentHint.color} dimColor>
        {currentHint.text}
      </Text>
    </Box>
  )
}