import React from 'react'
import { Box, Text } from 'ink'
import { SystemReminder as SystemReminderType } from '../../tools/SystemReminderInjector.js'

interface SystemReminderProps {
  reminders: SystemReminderType[]
}

export function SystemReminder({ reminders }: SystemReminderProps) {
  if (!reminders || reminders.length === 0) {
    return null
  }

  // 添加提醒去重逻辑
  const uniqueReminders = reminders.reduce((acc, reminder) => {
    const key = `${reminder.type}-${reminder.priority}-${reminder.content.substring(0, 50)}`
    if (!acc.some(r => `${r.type}-${r.priority}-${r.content.substring(0, 50)}` === key)) {
      acc.push(reminder)
    }
    return acc
  }, [] as SystemReminderType[])

  // 按优先级排序提醒
  const sortedReminders = uniqueReminders.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })

  return (
    <Box flexDirection="column" marginBottom={1}>
      {sortedReminders.map((reminder, index) => (
        <ReminderItem key={`reminder-${reminder.type}-${index}`} reminder={reminder} />
      ))}
    </Box>
  )
}

interface ReminderItemProps {
  reminder: SystemReminderType
}

function ReminderItem({ reminder }: ReminderItemProps) {
  // 根据提醒类型和优先级选择样式
  const getBorderColor = () => {
    if (reminder.priority === 'high') return 'red'
    if (reminder.priority === 'medium') return 'yellow'
    return 'gray'
  }

  const getIcon = () => {
    switch (reminder.type) {
      case 'tool_restriction':
        return '🚫'
      case 'mode_notification':
        return '📢'
      case 'permission_warning':
        return '⚠️'
      default:
        return '💡'
    }
  }

  const getTitle = () => {
    switch (reminder.type) {
      case 'tool_restriction':
        return '工具访问限制'
      case 'mode_notification':
        return '模式通知'
      case 'permission_warning':
        return '权限警告'
      default:
        return '系统提醒'
    }
  }

  // 处理提醒内容 - 支持基本的 markdown 格式
  const formatContent = (content: string) => {
    // 移除 <system-reminder> 标签
    const cleaned = content
      .replace(/<\/?system-reminder>/g, '')
      .trim()

    // 分割为行并处理
    return cleaned.split('\n').map((line, index) => {
      const trimmedLine = line.trim()
      
      if (!trimmedLine) return null
      
      // 处理数字列表
      if (/^\d+\./.test(trimmedLine)) {
        return (
          <Text key={index} color="white">
            {'  '}{trimmedLine}
          </Text>
        )
      }
      
      // 处理其他内容
      return (
        <Text key={index} color="white">
          {trimmedLine}
        </Text>
      )
    }).filter(Boolean)
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={getBorderColor()}
      padding={1}
      marginBottom={1}
    >
      {/* 提醒标题 */}
      <Box flexDirection="row" alignItems="center" marginBottom={1}>
        <Text>
          {getIcon()} 
        </Text>
        <Text bold color={getBorderColor()}>
          {getTitle()}
        </Text>
        {reminder.persistent && (
          <Text color="gray" dimColor>
            {' '}(持续显示)
          </Text>
        )}
      </Box>

      {/* 提醒内容 */}
      <Box flexDirection="column">
        {formatContent(reminder.content)}
      </Box>

      {/* 底部信息 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          优先级: {reminder.priority} | 类型: {reminder.type}
        </Text>
      </Box>
    </Box>
  )
}