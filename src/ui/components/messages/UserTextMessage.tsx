import React from 'react'
import { Box, Text } from 'ink'
import { getTheme } from '../../../utils/theme.js'
import { useTerminalSize } from '../../../hooks/useTerminalSize.js'
import { RichTextRenderer } from '../RichTextRenderer.js'

interface UserTextMessageProps {
  text: string
  addMargin: boolean
}

export function UserTextMessage({
  text,
  addMargin,
}: UserTextMessageProps): React.ReactNode {
  const { columns } = useTerminalSize()
  const theme = getTheme()

  return (
    <Box 
      flexDirection="row" 
      marginBottom={1} 
      marginTop={addMargin ? 1 : 0}
      width="100%"
    >
      <Box minWidth={3}>
        <Text color={theme.dimText}>
          &gt; 
        </Text>
      </Box>
      <Box flexDirection="column" width={columns - 4}>
        <Box width="100%">
          <RichTextRenderer 
            content={text}
            wrap={true}
            preserveWhitespace={true}
          />
        </Box>
      </Box>
    </Box>
  )
}