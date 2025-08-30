import React from 'react'
import { Box, Text } from 'ink'

interface AcceptEditsModeProps {
  autoAcceptEnabled: boolean
  onToggleAutoAccept: () => void
  pendingEdits: number
}

export function AcceptEditsMode({ 
  autoAcceptEnabled, 
  onToggleAutoAccept, 
  pendingEdits 
}: AcceptEditsModeProps) {
  return (
    <Box flexDirection="column">
      {/* AcceptEdits模式标识 */}
      <Box marginBottom={1}>
        <Text color="green" bold>
          ✅ ACCEPT EDITS MODE - 自动接受编辑模式
        </Text>
      </Box>

      {/* 状态显示 */}
      <Box marginBottom={1} paddingX={2} borderStyle="round" borderColor="green">
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Text color="green">自动接受编辑：</Text>
            <Text color={autoAcceptEnabled ? 'green' : 'red'} bold>
              {autoAcceptEnabled ? ' 已启用' : ' 已禁用'}
            </Text>
          </Box>
          
          {pendingEdits > 0 && (
            <Box flexDirection="row">
              <Text color="yellow">待处理编辑：</Text>
              <Text color="yellow" bold> {pendingEdits}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* 模式说明 */}
      <Box marginBottom={1} paddingX={1}>
        <Box flexDirection="column">
          <Text color="green">
            在此模式下：
          </Text>
          <Text color="gray">
            • 自动接受所有代码编辑建议
          </Text>
          <Text color="gray">
            • 跳过手动确认步骤
          </Text>
          <Text color="gray">
            • 加速开发流程
          </Text>
        </Box>
      </Box>

      {/* 切换按钮提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          使用 Shift+Tab 切换到其他模式 | 空格键切换自动接受状态
        </Text>
      </Box>
    </Box>
  )
}