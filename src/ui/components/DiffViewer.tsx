/**
 * WriteFlow DiffViewer 组件
 * 基于 Ink 的文件差异显示组件
 */

import React from 'react'
import { Text, Box } from 'ink'
import { formatDiff, FileDiff, createSimpleDiff } from '../utils/diffFormatter.js'
import { figures } from '../constants/figures.js'

export interface DiffViewerProps {
  fileDiff?: FileDiff
  oldContent?: string
  newContent?: string
  filename?: string
  maxWidth?: number
  theme?: 'light' | 'dark'
  showLineNumbers?: boolean
  compact?: boolean
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  fileDiff,
  oldContent,
  newContent,
  filename,
  maxWidth,
  theme = 'dark',
  showLineNumbers = true,
  compact = false
}) => {
  // 如果没有提供 fileDiff，从 oldContent 和 newContent 创建
  const diff = fileDiff || (oldContent && newContent && filename ? 
    createSimpleDiff(oldContent, newContent, filename) : 
    null
  )

  if (!diff) {
    return (
      <Box marginY={1}>
        <Text color="red">无法显示差异：缺少必要的数据</Text>
      </Box>
    )
  }

  const formatted = formatDiff(diff, {
    maxWidth,
    theme,
    showLineNumbers,
    compact
  })

  const getStatusColor = (type: FileDiff['type']) => {
    switch (type) {
      case 'add': return 'green'
      case 'remove': return 'red'
      case 'rename': return 'yellow'
      case 'modify':
      default: return 'blue'
    }
  }

  const getStatusIcon = (type: FileDiff['type']) => {
    switch (type) {
      case 'add': return figures.plus
      case 'remove': return figures.cross
      case 'rename': return figures.arrowRight
      case 'modify':
      default: return figures.dot
    }
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {/* 文件头 */}
      <Box marginBottom={1}>
        <Text color={getStatusColor(diff.type)}>
          {getStatusIcon(diff.type)} {diff.newPath || diff.oldPath}
        </Text>
        
        {diff.additions > 0 || diff.deletions > 0 ? (
          <Box marginLeft={2}>
            <Text color="gray" dimColor>
              (
              {diff.additions > 0 && <Text color="green">+{diff.additions}</Text>}
              {diff.additions > 0 && diff.deletions > 0 && <Text color="gray">, </Text>}
              {diff.deletions > 0 && <Text color="red">-{diff.deletions}</Text>}
              )
            </Text>
          </Box>
        ) : null}
      </Box>

      {/* 差异内容 */}
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>{formatted}</Text>
      </Box>
    </Box>
  )
}

export interface MultiDiffViewerProps {
  diffs: FileDiff[]
  theme?: 'light' | 'dark'
  maxWidth?: number
  showLineNumbers?: boolean
  compact?: boolean
}

export const MultiDiffViewer: React.FC<MultiDiffViewerProps> = ({
  diffs,
  theme = 'dark',
  maxWidth,
  showLineNumbers = true,
  compact = false
}) => {
  if (!diffs || diffs.length === 0) {
    return (
      <Box marginY={1}>
        <Text color="gray" dimColor>没有文件更改</Text>
      </Box>
    )
  }

  const totalAdditions = diffs.reduce((sum, diff) => sum + diff.additions, 0)
  const totalDeletions = diffs.reduce((sum, diff) => sum + diff.deletions, 0)

  return (
    <Box flexDirection="column">
      {/* 汇总信息 */}
      <Box marginBottom={1}>
        <Text color="cyan">
          {figures.diff} {diffs.length} file{diffs.length !== 1 ? 's' : ''} changed
        </Text>
        
        {totalAdditions > 0 || totalDeletions > 0 ? (
          <Text color="gray" dimColor>
            {' '}(
            {totalAdditions > 0 && <Text color="green">+{totalAdditions}</Text>}
            {totalAdditions > 0 && totalDeletions > 0 && <Text>, </Text>}
            {totalDeletions > 0 && <Text color="red">-{totalDeletions}</Text>}
            )
          </Text>
        ) : null}
      </Box>

      {/* 各个文件的差异 */}
      {diffs.map((diff, index) => (
        <DiffViewer
          key={`${diff.oldPath}-${diff.newPath}-${index}`}
          fileDiff={diff}
          theme={theme}
          maxWidth={maxWidth}
          showLineNumbers={showLineNumbers}
          compact={compact}
        />
      ))}
    </Box>
  )
}

