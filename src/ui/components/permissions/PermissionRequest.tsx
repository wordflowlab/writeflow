import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import chalk from 'chalk'

interface PermissionRequestProps {
  toolName: string
  filePath: string
  description: string
  onAllow: (type: 'temporary' | 'session') => void
  onDeny: () => void
}

interface SelectOption {
  label: string
  value: string
}

export function PermissionRequest({
  toolName,
  filePath,
  description,
  onAllow,
  onDeny,
}: PermissionRequestProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  // 判断是否在工作目录内，决定是否显示"don't ask again"选项
  const isInWorkingDir = filePath.startsWith(process.cwd())
  
  const options: SelectOption[] = [
    { label: '是，允许', value: 'yes' },
    ...(isInWorkingDir ? [{
      label: `是，允许并且不再询问当前项目的类似命令`,
      value: 'yes-dont-ask-again',
    }] : []),
    { label: `否，并提供说明 (${chalk.bold.yellow('esc')})`, value: 'no' },
  ]

  useInput((input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    } else if (key.downArrow && selectedIndex < options.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    } else if (key.return) {
      const selectedOption = options[selectedIndex]
      switch (selectedOption.value) {
        case 'yes':
          onAllow('temporary')
          break
        case 'yes-dont-ask-again':
          onAllow('session')
          break
        case 'no':
          onDeny()
          break
      }
    } else if (key.escape) {
      onDeny()
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      marginTop={1}
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={1}
    >
      {/* 标题 */}
      <Box paddingX={1} paddingY={1}>
        <Text color="yellow" bold>⚠ 编辑文件</Text>
      </Box>
      
      {/* 工具描述 */}
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>
          {toolName}({filePath})
        </Text>
        <Text dimColor>{description}</Text>
      </Box>

      {/* 确认选项 */}
      <Box flexDirection="column" paddingX={2}>
        <Text>您是否要继续?</Text>
        <Box flexDirection="column" marginTop={1}>
          {options.map((option, index) => (
            <Box key={option.value} paddingY={0}>
              <Text color={index === selectedIndex ? 'blue' : undefined}>
                {index === selectedIndex ? '› ' : '  '}
                {option.label}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}