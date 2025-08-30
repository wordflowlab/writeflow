import React from 'react'
import { Box, Text } from 'ink'

interface FileDiff {
  fileName: string
  oldContent: string
  newContent: string
  changeType: 'created' | 'modified' | 'deleted'
}

interface WriteRendererProps {
  diffs: FileDiff[]
  showDiff?: boolean
  confirmBeforeWrite?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

export function WriteRenderer({ 
  diffs, 
  showDiff = true,
  confirmBeforeWrite = false,
  onConfirm,
  onCancel 
}: WriteRendererProps) {
  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return '📄'
      case 'modified':
        return '✏️'
      case 'deleted':
        return '🗑️'
      default:
        return '📝'
    }
  }

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'created':
        return 'green'
      case 'modified':
        return 'yellow'
      case 'deleted':
        return 'red'
      default:
        return 'blue'
    }
  }

  const generateSimpleDiff = (oldContent: string, newContent: string): React.ReactNode[] => {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    const diffLines: React.ReactNode[] = []
    
    const maxLines = Math.max(oldLines.length, newLines.length)
    
    for (let i = 0; i < Math.min(maxLines, 10); i++) { // 限制显示10行
      const oldLine = oldLines[i] || ''
      const newLine = newLines[i] || ''
      
      if (oldLine !== newLine) {
        if (oldLine) {
          diffLines.push(
            <Box key={`old-${i}`} flexDirection="row">
              <Text color="red">- </Text>
              <Text color="red">{oldLine}</Text>
            </Box>
          )
        }
        if (newLine) {
          diffLines.push(
            <Box key={`new-${i}`} flexDirection="row">
              <Text color="green">+ </Text>
              <Text color="green">{newLine}</Text>
            </Box>
          )
        }
      }
    }
    
    if (maxLines > 10) {
      diffLines.push(
        <Text key="truncated" color="gray" dimColor>
          ... 省略 {maxLines - 10} 行变更
        </Text>
      )
    }
    
    return diffLines
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* 写入操作头部 */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>✍️ 文件写入操作</Text>
        <Text color="gray"> ({diffs.length} 个文件)</Text>
      </Box>

      {/* 文件变更列表 */}
      {diffs.map((diff, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          {/* 文件信息 */}
          <Box flexDirection="row">
            <Text color={getChangeColor(diff.changeType)}>
              {getChangeIcon(diff.changeType)}
            </Text>
            <Text color={getChangeColor(diff.changeType)} bold>
              {' '}{diff.fileName}
            </Text>
            <Text color="gray"> ({diff.changeType})</Text>
          </Box>

          {/* 差异显示 */}
          {showDiff && diff.changeType === 'modified' && (
            <Box marginLeft={2} paddingX={1} borderStyle="round" borderColor="gray">
              <Box flexDirection="column">
                {generateSimpleDiff(diff.oldContent, diff.newContent)}
              </Box>
            </Box>
          )}

          {/* 新文件内容预览 */}
          {showDiff && diff.changeType === 'created' && (
            <Box marginLeft={2} paddingX={1} borderStyle="round" borderColor="green">
              <Box flexDirection="column">
                <Text color="green">新文件内容:</Text>
                {diff.newContent.split('\n').slice(0, 5).map((line, lineIndex) => (
                  <Text key={lineIndex} color="green">+ {line}</Text>
                ))}
                {diff.newContent.split('\n').length > 5 && (
                  <Text color="gray" dimColor>... 还有更多内容</Text>
                )}
              </Box>
            </Box>
          )}
        </Box>
      ))}

      {/* 确认提示 */}
      {confirmBeforeWrite && (
        <Box marginTop={1} paddingX={2} borderStyle="round" borderColor="yellow">
          <Box flexDirection="column">
            <Text color="yellow" bold>⚠️ 确认写入</Text>
            <Text color="gray">
              即将写入 {diffs.length} 个文件。继续吗？
            </Text>
            <Box marginTop={1} flexDirection="row">
              <Text color="green">Enter 确认</Text>
              <Text color="gray"> | </Text>
              <Text color="red">Ctrl+C 取消</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}