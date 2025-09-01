import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { SystemReminder } from '../../tools/SystemReminderInjector.js'

interface SystemReminderDisplayProps {
  reminders: SystemReminder[]
  maxVisible?: number
  autoHideDelay?: number // 自动隐藏延迟（毫秒）
  compact?: boolean // 紧凑模式
}

export function SystemReminderDisplay({ 
  reminders, 
  maxVisible = 3,
  autoHideDelay = 10000,
  compact = false 
}: SystemReminderDisplayProps) {
  const [visibleReminders, setVisibleReminders] = useState<SystemReminder[]>(reminders)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  useEffect(() => {
    // 过滤非持续提醒，设置自动隐藏
    const nonPersistentReminders = reminders.filter(reminder => !reminder.persistent)
    
    if (nonPersistentReminders.length > 0 && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setVisibleReminders(prev => prev.filter(reminder => reminder.persistent))
      }, autoHideDelay)

      return () => clearTimeout(timer)
    }
  }, [reminders, autoHideDelay])

  useEffect(() => {
    setVisibleReminders(reminders.slice(0, maxVisible))
  }, [reminders, maxVisible])

  if (visibleReminders.length === 0) {
    return null
  }

  // 获取优先级图标和颜色
  const getPriorityIcon = (priority: 'high' | 'medium' | 'low'): string => {
    const icons = {
      high: '🚨',
      medium: '📢',
      low: '💭'
    }
    return icons[priority]
  }

  const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
    const colors = {
      high: 'red',
      medium: 'yellow',
      low: 'gray'
    }
    return colors[priority]
  }

  const getTypeLabel = (type: SystemReminder['type']): string => {
    const labels = {
      tool_restriction: '工具限制',
      mode_notification: '模式通知',
      permission_warning: '权限警告'
    }
    return labels[type]
  }

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color="cyan" bold>
        📋 系统提醒 ({visibleReminders.length}/{reminders.length})
      </Text>
      
      {visibleReminders.map((reminder, index) => {
        const isExpanded = expandedIndex === index
        const priorityColor = getPriorityColor(reminder.priority)
        const priorityIcon = getPriorityIcon(reminder.priority)
        const typeLabel = getTypeLabel(reminder.type)
        
        return (
          <Box key={index} marginBottom={compact ? 0 : 1} 
               paddingX={2} borderStyle="round" borderColor={priorityColor}>
            <Box flexDirection="column" width="100%">
              {/* 提醒标题 */}
              <Box justifyContent="space-between" alignItems="center">
                <Text color={priorityColor} bold>
                  {priorityIcon} {typeLabel}
                </Text>
                
                <Box>
                  {reminder.persistent && (
                    <Text color="blue" dimColor>
                      📌 持续
                    </Text>
                  )}
                  
                  {!compact && reminder.content.split('\n').length > 3 && (
                    <Text color="gray" dimColor>
                      {isExpanded ? '▲ 折叠' : '▼ 展开'} (点击展开/折叠)
                    </Text>
                  )}
                </Box>
              </Box>

              {/* 提醒内容 */}
              <Box marginTop={1}>
                {compact ? (
                  // 紧凑模式：只显示第一行
                  <Text color="white">
                    {reminder.content.split('\n')[0]}
                  </Text>
                ) : isExpanded ? (
                  // 展开模式：显示完整内容
                  <Box flexDirection="column">
                    {reminder.content.split('\n').map((line, lineIndex) => (
                      <Text key={lineIndex} color="white">
                        {line}
                      </Text>
                    ))}
                  </Box>
                ) : (
                  // 默认模式：显示前3行
                  <Box flexDirection="column">
                    {reminder.content.split('\n').slice(0, 3).map((line, lineIndex) => (
                      <Text key={lineIndex} color="white">
                        {line}
                      </Text>
                    ))}
                    {reminder.content.split('\n').length > 3 && (
                      <Text color="gray" dimColor>
                        ... 还有 {reminder.content.split('\n').length - 3} 行
                      </Text>
                    )}
                  </Box>
                )}
              </Box>

              {/* 优先级和时间信息 */}
              {!compact && (
                <Box marginTop={1} justifyContent="space-between">
                  <Text color="gray" dimColor>
                    优先级: {reminder.priority.toUpperCase()}
                  </Text>
                  
                  {!reminder.persistent && autoHideDelay > 0 && (
                    <Text color="gray" dimColor>
                      {Math.floor(autoHideDelay / 1000)}s 后自动隐藏
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )
      })}

      {/* 更多提醒指示 */}
      {reminders.length > maxVisible && (
        <Box paddingX={2} borderStyle="round" borderColor="gray">
          <Text color="gray" dimColor>
            ... 还有 {reminders.length - maxVisible} 个提醒 (使用完整视图查看全部)
          </Text>
        </Box>
      )}

      {/* 操作提示 */}
      {visibleReminders.some(r => r.persistent) && !compact && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            💡 提示：持续提醒将保持显示直到相关问题解决
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * 简化的系统提醒横幅显示
 */
export function SystemReminderBanner({ 
  reminders,
  onClick 
}: { 
  reminders: SystemReminder[]
  onClick?: () => void 
}) {
  if (reminders.length === 0) return null

  const highPriorityCount = reminders.filter(r => r.priority === 'high').length
  const mediumPriorityCount = reminders.filter(r => r.priority === 'medium').length
  const persistentCount = reminders.filter(r => r.persistent).length

  return (
    <Box 
      paddingX={2} 
      borderStyle="round" 
      borderColor={highPriorityCount > 0 ? 'red' : mediumPriorityCount > 0 ? 'yellow' : 'gray'}
    >
      <Box justifyContent="space-between" alignItems="center" width="100%">
        <Text color={highPriorityCount > 0 ? 'red' : mediumPriorityCount > 0 ? 'yellow' : 'gray'} bold>
          📋 {reminders.length} 个系统提醒
          {highPriorityCount > 0 && ` (${highPriorityCount} 高优先级)`}
        </Text>
        
        <Box>
          {persistentCount > 0 && (
            <Text color="blue" dimColor>
              📌 {persistentCount} 持续
            </Text>
          )}
          
          {onClick && (
            <Text color="gray" dimColor>
              点击查看详情 →
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 浮动系统提醒通知
 */
export function SystemReminderToast({ 
  reminder,
  duration = 5000,
  onDismiss 
}: { 
  reminder: SystemReminder
  duration?: number
  onDismiss: () => void 
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!reminder.persistent && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(() => onDismiss(), 300) // 等待动画结束
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [reminder.persistent, duration, onDismiss])

  if (!visible) return null

  const priorityColor = getPriorityColor(reminder.priority)
  const priorityIcon = getPriorityIcon(reminder.priority)
  
  return (
    <Box 
      paddingX={2} 
      borderStyle="double" 
      borderColor={priorityColor}
    >
      <Box flexDirection="column">
        <Box justifyContent="space-between" alignItems="center">
          <Text color={priorityColor} bold>
            {priorityIcon} 系统提醒
          </Text>
          
          <Text color="gray">
            ✕ (关闭)
          </Text>
        </Box>
        
        <Box marginTop={1}>
          <Text color="white">
            {reminder.content.split('\n').slice(0, 2).join('\n')}
            {reminder.content.split('\n').length > 2 && '...'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

// 辅助函数，避免重复
function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'red',
    medium: 'yellow', 
    low: 'gray'
  }
  return colors[priority]
}

function getPriorityIcon(priority: 'high' | 'medium' | 'low'): string {
  const icons = {
    high: '🚨',
    medium: '📢',
    low: '💭'
  }
  return icons[priority]
}