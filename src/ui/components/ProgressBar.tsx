/**
 * WriteFlow ProgressBar 组件
 * 基于 Ink 的进度条和状态指示器组件
 */

import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'
import { figures } from '../constants/figures.js'

export interface ProgressBarProps {
  progress?: number // 0-100
  total?: number
  current?: number
  label?: string
  width?: number
  showPercentage?: boolean
  showNumbers?: boolean
  theme?: 'light' | 'dark'
  animated?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  total,
  current,
  label = 'Progress',
  width = 20,
  showPercentage = true,
  showNumbers = false,
  theme = 'dark',
  animated = false
}) => {
  // 计算百分比
  let percentage = progress
  if (percentage === undefined && total && current !== undefined) {
    percentage = Math.round((current / total) * 100)
  }
  percentage = Math.min(Math.max(percentage || 0, 0), 100)

  // 计算填充长度
  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled

  const getColors = () => {
    if (theme === 'light') {
      return {
        filled: 'blue',
        empty: 'gray',
        text: 'black',
        percentage: 'blue'
      } as const
    } else {
      return {
        filled: 'cyan',
        empty: 'gray',
        text: 'white',
        percentage: 'cyan'
      } as const
    }
  }

  const colors = getColors()

  return (
    <Box>
      <Text color={colors.text}>{label}: </Text>
      
      <Text color={colors.filled}>{'█'.repeat(filled)}</Text>
      <Text color={colors.empty} dimColor>{'░'.repeat(empty)}</Text>
      
      {showPercentage && (
        <Text color={colors.percentage}> {percentage}%</Text>
      )}
      
      {showNumbers && total && current !== undefined && (
        <Text color="gray" dimColor> ({current}/{total})</Text>
      )}
    </Box>
  )
}

export interface SpinnerProps {
  label?: string
  type?: 'dots' | 'spinner' | 'pulse'
  theme?: 'light' | 'dark'
}

export const Spinner: React.FC<SpinnerProps> = ({
  label = 'Loading',
  type = 'spinner',
  theme = 'dark'
}) => {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % getFrames().length)
    }, 100)

    return () => clearInterval(interval)
  }, [type])

  const getFrames = () => {
    switch (type) {
      case 'dots':
        return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      case 'pulse':
        return ['●', '○', '●', '○']
      case 'spinner':
      default:
        return figures.spinner
    }
  }

  const frames = getFrames()
  const color = theme === 'dark' ? 'cyan' : 'blue'

  return (
    <Box>
      <Text color={color}>{frames[frame]} </Text>
      <Text>{label}</Text>
    </Box>
  )
}

export interface StatusIndicatorProps {
  status: 'loading' | 'success' | 'error' | 'warning' | 'info'
  message: string
  theme?: 'light' | 'dark'
  animated?: boolean
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  theme = 'dark',
  animated = false
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return {
          icon: animated ? <Spinner label="" type="spinner" theme={theme} /> : figures.spinner[0],
          color: 'cyan' as const
        }
      case 'success':
        return {
          icon: figures.tick,
          color: 'green' as const
        }
      case 'error':
        return {
          icon: figures.cross,
          color: 'red' as const
        }
      case 'warning':
        return {
          icon: figures.warning,
          color: 'yellow' as const
        }
      case 'info':
        return {
          icon: figures.info,
          color: 'blue' as const
        }
    }
  }

  const { icon, color } = getStatusConfig()

  return (
    <Box>
      {React.isValidElement(icon) ? (
        icon
      ) : (
        <Text color={color}>{icon} </Text>
      )}
      <Text>{message}</Text>
    </Box>
  )
}

export interface TaskProgressProps {
  tasks: Array<{
    name: string
    status: 'pending' | 'running' | 'completed' | 'error'
    progress?: number
  }>
  theme?: 'light' | 'dark'
  showProgress?: boolean
}

export const TaskProgress: React.FC<TaskProgressProps> = ({
  tasks,
  theme = 'dark',
  showProgress = true
}) => {
  const completedTasks = tasks.filter(task => task.status === 'completed').length
  const totalTasks = tasks.length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <Box flexDirection="column">
      {/* 总体进度 */}
      <Box marginBottom={1}>
        <ProgressBar
          progress={overallProgress}
          label="Overall"
          theme={theme}
          showPercentage
          showNumbers={false}
        />
        <Text color="gray" dimColor> ({completedTasks}/{totalTasks} tasks)</Text>
      </Box>

      {/* 各个任务状态 */}
      {tasks.map((task, index) => (
        <Box key={index} marginBottom={0}>
          <StatusIndicator
            status={task.status === 'running' ? 'loading' : 
                   task.status === 'completed' ? 'success' :
                   task.status === 'error' ? 'error' : 'info'}
            message={task.name}
            theme={theme}
            animated={task.status === 'running'}
          />
          
          {showProgress && task.progress !== undefined && task.status === 'running' && (
            <Box marginLeft={2}>
              <ProgressBar
                progress={task.progress}
                width={15}
                theme={theme}
                showPercentage
              />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

export default ProgressBar