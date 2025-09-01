import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'

export type ConfirmationOption = 'auto_approve' | 'manual_approve' | 'keep_planning'

interface PlanModeConfirmationProps {
  plan: string
  onConfirm: (option: ConfirmationOption) => void
  onCancel?: () => void
}

export function PlanModeConfirmation({ plan, onConfirm, onCancel }: PlanModeConfirmationProps) {
  const [selectedOption, setSelectedOption] = useState<number>(0)

  const options = [
    {
      key: 'auto_approve' as ConfirmationOption,
      label: 'Yes, and auto-approve edits',
      description: '退出计划模式并自动批准所有文件修改',
      color: 'green'
    },
    {
      key: 'manual_approve' as ConfirmationOption,
      label: 'Yes, and manually approve edits',
      description: '退出计划模式但需手动确认每个文件修改',
      color: 'yellow'
    },
    {
      key: 'keep_planning' as ConfirmationOption,
      label: 'No, keep planning',
      description: '继续在计划模式下完善计划',
      color: 'blue'
    }
  ]

  useInput((input, key) => {
    if (key.upArrow && selectedOption > 0) {
      setSelectedOption(selectedOption - 1)
    } else if (key.downArrow && selectedOption < options.length - 1) {
      setSelectedOption(selectedOption + 1)
    } else if (key.return) {
      onConfirm(options[selectedOption].key)
    } else if (key.escape && onCancel) {
      onCancel()
    } else if (input >= '1' && input <= '3') {
      const index = parseInt(input) - 1
      if (index >= 0 && index < options.length) {
        setSelectedOption(index)
        onConfirm(options[index].key)
      }
    }
  })

  // 显示计划摘要（前5行）
  const planPreview = plan.split('\n').slice(0, 5).join('\n')
  const hasMoreLines = plan.split('\n').length > 5

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={2}>
      {/* 标题 */}
      <Box marginBottom={1}>
        <Text bold color="blue">
          📋 退出计划模式确认
        </Text>
      </Box>

      {/* 计划预览 */}
      <Box flexDirection="column" marginBottom={2} borderStyle="round" borderColor="gray" padding={1}>
        <Text bold color="gray">计划摘要：</Text>
        <Text color="white">{planPreview}</Text>
        {hasMoreLines && (
          <Text color="gray" dimColor>
            ... 还有 {plan.split('\n').length - 5} 行
          </Text>
        )}
      </Box>

      {/* 选项列表 */}
      <Box flexDirection="column">
        <Text bold>请选择操作：</Text>
        {options.map((option, index) => (
          <Box key={option.key} flexDirection="column" marginTop={1}>
            <Box flexDirection="row">
              <Text color={selectedOption === index ? 'inverse' : 'white'}>
                {selectedOption === index ? '▶ ' : '  '}
                {index + 1}. {option.label}
              </Text>
            </Box>
            <Box marginLeft={4}>
              <Text color="gray" dimColor>
                {option.description}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* 操作提示 */}
      <Box marginTop={2} borderStyle="round" borderColor="gray" padding={1}>
        <Box flexDirection="column">
          <Text color="gray" dimColor>
            💡 操作提示：
          </Text>
          <Text color="gray" dimColor>
            • 数字键 1/2/3：直接选择选项
          </Text>
          <Text color="gray" dimColor>
            • 方向键 ↑/↓：切换选项，Enter 确认
          </Text>
          <Text color="gray" dimColor>
            • ESC：取消操作
          </Text>
        </Box>
      </Box>
    </Box>
  )
}