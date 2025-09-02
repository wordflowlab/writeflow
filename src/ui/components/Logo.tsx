import React from 'react'
import { Box, Text } from 'ink'

interface LogoProps {
  variant?: 'full' | 'compact' | 'mini'
}

export const Logo = React.memo(function Logo({ variant = 'full' }: LogoProps) {
  if (variant === 'mini') {
    // 迷你版本 - 单行显示
    return (
      <Box flexDirection="row">
        <Text color="cyan">W</Text>
        <Text color="#40E0D0">r</Text>
        <Text color="#4169E1">i</Text>
        <Text color="#6A5ACD">t</Text>
        <Text color="#8A2BE2">e</Text>
        <Text color="#BA55D3">F</Text>
        <Text color="#DA70D6">l</Text>
        <Text color="#FF69B4">o</Text>
        <Text color="#FFB6C1">w</Text>
      </Box>
    )
  }

  if (variant === 'compact') {
    // 紧凑版本 - 3行高度
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">█   █ </Text>
          <Text color="#40E0D0">████  </Text>
          <Text color="#4169E1">███ </Text>
          <Text color="#6A5ACD">█████ </Text>
          <Text color="#8A2BE2">█████ </Text>
          <Text color="#BA55D3">█████ </Text>
          <Text color="#DA70D6">█     </Text>
          <Text color="#FF69B4">████  </Text>
          <Text color="#FFB6C1">█   █</Text>
        </Box>
        <Box>
          <Text color="cyan">█ █ █ </Text>
          <Text color="#40E0D0">█   █ </Text>
          <Text color="#4169E1"> █  </Text>
          <Text color="#6A5ACD">  █   </Text>
          <Text color="#8A2BE2">█     </Text>
          <Text color="#BA55D3">█     </Text>
          <Text color="#DA70D6">█     </Text>
          <Text color="#FF69B4">█   █ </Text>
          <Text color="#FFB6C1">█ █ █</Text>
        </Box>
        <Box>
          <Text color="cyan">█████ </Text>
          <Text color="#40E0D0">█  █  </Text>
          <Text color="#4169E1">███ </Text>
          <Text color="#6A5ACD">  █   </Text>
          <Text color="#8A2BE2">█████ </Text>
          <Text color="#BA55D3">█     </Text>
          <Text color="#DA70D6">█████ </Text>
          <Text color="#FF69B4">████  </Text>
          <Text color="#FFB6C1">█████</Text>
        </Box>
      </Box>
    )
  }

  // 完整版本 - 5行高度
  return (
    <Box flexDirection="column" alignItems="center">
      {/* WriteFlow ASCII 艺术 */}
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">██   ██ </Text>
          <Text color="#40E0D0">████  </Text>
          <Text color="#4169E1">███ </Text>
          <Text color="#6A5ACD">█████ </Text>
          <Text color="#8A2BE2">█████   </Text>
          <Text color="#BA55D3">█████ </Text>
          <Text color="#DA70D6">█     </Text>
          <Text color="#FF69B4">████  </Text>
          <Text color="#FFB6C1">██   ██</Text>
        </Box>
        <Box>
          <Text color="cyan">██   ██ </Text>
          <Text color="#40E0D0">█   █ </Text>
          <Text color="#4169E1"> █  </Text>
          <Text color="#6A5ACD">  █   </Text>
          <Text color="#8A2BE2">█       </Text>
          <Text color="#BA55D3">█     </Text>
          <Text color="#DA70D6">█     </Text>
          <Text color="#FF69B4">█   █ </Text>
          <Text color="#FFB6C1">██   ██</Text>
        </Box>
        <Box>
          <Text color="cyan">██ █ ██ </Text>
          <Text color="#40E0D0">████  </Text>
          <Text color="#4169E1"> █  </Text>
          <Text color="#6A5ACD">  █   </Text>
          <Text color="#8A2BE2">████    </Text>
          <Text color="#BA55D3">████  </Text>
          <Text color="#DA70D6">█     </Text>
          <Text color="#FF69B4">█   █ </Text>
          <Text color="#FFB6C1">██ █ ██</Text>
        </Box>
        <Box>
          <Text color="cyan">██ █ ██ </Text>
          <Text color="#40E0D0">█ █   </Text>
          <Text color="#4169E1"> █  </Text>
          <Text color="#6A5ACD">  █   </Text>
          <Text color="#8A2BE2">█       </Text>
          <Text color="#BA55D3">█     </Text>
          <Text color="#DA70D6">█     </Text>
          <Text color="#FF69B4">█   █ </Text>
          <Text color="#FFB6C1">██ █ ██</Text>
        </Box>
        <Box>
          <Text color="cyan">███████ </Text>
          <Text color="#40E0D0">█  █  </Text>
          <Text color="#4169E1">███ </Text>
          <Text color="#6A5ACD">  █   </Text>
          <Text color="#8A2BE2">█████   </Text>
          <Text color="#BA55D3">█     </Text>
          <Text color="#DA70D6">█████ </Text>
          <Text color="#FF69B4">████  </Text>
          <Text color="#FFB6C1">███████</Text>
        </Box>
      </Box>
      
      {/* 副标题 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ✍️ AI Writing Assistant 
        </Text>
      </Box>
    </Box>
  )
})