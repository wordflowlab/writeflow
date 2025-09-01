import React, { useState, useEffect } from 'react'
import { Box, Text, Newline } from 'ink'
import { UIState } from '../types/index.js'
import { PlanModeState } from '../../modes/PlanModeManager.js'
import { SystemReminder } from '../../tools/SystemReminderInjector.js'

interface PlanModeProps {
  state: UIState
  onExitPlan: (plan: string) => void
  currentPlan?: string
  planModeState?: PlanModeState
  systemReminders?: SystemReminder[]
  allowedTools?: string[]
  forbiddenTools?: string[]
}

export function PlanMode({ 
  state, 
  onExitPlan, 
  currentPlan,
  planModeState,
  systemReminders = [],
  allowedTools = [],
  forbiddenTools = []
}: PlanModeProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  // 更新运行时间
  useEffect(() => {
    if (!planModeState?.isActive) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - planModeState.entryTime
      setElapsedTime(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [planModeState?.entryTime, planModeState?.isActive])

  // 格式化运行时间
  const formatElapsedTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // 解析计划内容获取步骤数
  const getPlanSteps = (plan?: string): { total: number, completed: number } => {
    if (!plan) return { total: 0, completed: 0 }
    
    const stepMatches = plan.match(/^\s*(\d+\.|\*|-)\s+/gm) || []
    const completedMatches = plan.match(/^\s*(\d+\.|\*|-)\s+.*[✓✅]/gm) || []
    
    return {
      total: stepMatches.length,
      completed: completedMatches.length
    }
  }

  const planSteps = getPlanSteps(currentPlan)

  return (
    <Box flexDirection="column">
      {/* Plan模式标题栏 */}
      <Box marginBottom={1} paddingX={2} borderStyle="double" borderColor="yellow">
        <Box flexDirection="column" width="100%">
          <Box justifyContent="space-between">
            <Text color="yellow" bold>
              📋 PLAN MODE - 只读分析模式
            </Text>
            {planModeState?.isActive && (
              <Text color="yellow" dimColor>
                运行时间: {formatElapsedTime(elapsedTime)}
              </Text>
            )}
          </Box>
          
          {/* 计划进度条 */}
          {currentPlan && planSteps.total > 0 && (
            <Box marginTop={1}>
              <Text color="yellow">
                进度: {planSteps.completed}/{planSteps.total} 步骤完成
              </Text>
              <Box marginLeft={2}>
                <Text color="green">
                  {'█'.repeat(Math.floor((planSteps.completed / planSteps.total) * 20))}
                </Text>
                <Text color="gray">
                  {'░'.repeat(20 - Math.floor((planSteps.completed / planSteps.total) * 20))}
                </Text>
                <Text color="yellow"> {Math.round((planSteps.completed / planSteps.total) * 100)}%</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* 系统提醒显示 */}
      {systemReminders.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {systemReminders.map((reminder, index) => (
            <Box key={index} marginBottom={1} paddingX={2} borderStyle="round" 
                 borderColor={reminder.priority === 'high' ? 'red' : reminder.priority === 'medium' ? 'yellow' : 'gray'}>
              <Box flexDirection="column">
                <Text color={reminder.priority === 'high' ? 'red' : reminder.priority === 'medium' ? 'yellow' : 'gray'} bold>
                  {reminder.type === 'tool_restriction' ? '🚫 工具限制' : 
                   reminder.type === 'mode_notification' ? '📢 模式通知' : 
                   '⚠️ 权限警告'}
                </Text>
                <Text color="white">
                  {reminder.content.split('\n').slice(0, 3).join('\n')}
                  {reminder.content.split('\n').length > 3 && '...'}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* 模式说明和工具列表 */}
      <Box marginBottom={1}>
        <Box flexDirection="column" width="60%">
          <Box paddingX={2} borderStyle="round" borderColor="yellow">
            <Box flexDirection="column">
              <Text color="yellow" bold>
                🔍 当前模式说明：
              </Text>
              <Text color="gray">
                • 只读分析：分析代码、搜索文件、查看状态
              </Text>
              <Text color="gray">
                • 安全规划：制定详细实施计划
              </Text>
              <Text color="red">
                • 禁止操作：修改文件、执行命令、安装依赖
              </Text>
            </Box>
          </Box>
        </Box>

        {/* 工具权限面板 */}
        <Box flexDirection="column" width="40%" marginLeft={2}>
          <Box paddingX={2} borderStyle="round" borderColor="green">
            <Box flexDirection="column">
              <Text color="green" bold>
                ✅ 允许的工具 ({allowedTools.length})：
              </Text>
              {allowedTools.slice(0, 4).map((tool, index) => (
                <Text key={index} color="gray">
                  • {tool}
                </Text>
              ))}
              {allowedTools.length > 4 && (
                <Text color="gray" dimColor>
                  ... 还有 {allowedTools.length - 4} 个
                </Text>
              )}
            </Box>
          </Box>
          
          <Box paddingX={2} borderStyle="round" borderColor="red" marginTop={1}>
            <Box flexDirection="column">
              <Text color="red" bold>
                ❌ 禁止的工具 ({forbiddenTools.length})：
              </Text>
              {forbiddenTools.slice(0, 3).map((tool, index) => (
                <Text key={index} color="gray">
                  • {tool}
                </Text>
              ))}
              {forbiddenTools.length > 3 && (
                <Text color="gray" dimColor>
                  ... 还有 {forbiddenTools.length - 3} 个
                </Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 当前计划显示 */}
      {currentPlan && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="yellow" bold>📝 当前计划：</Text>
          <Box paddingX={2} borderStyle="round" borderColor="blue">
            <Box flexDirection="column">
              {/* 显示计划的前几行，支持折叠 */}
              {currentPlan.split('\n').slice(0, 10).map((line, index) => (
                <Text key={index} color="white">
                  {line}
                </Text>
              ))}
              {currentPlan.split('\n').length > 10 && (
                <Text color="gray" dimColor>
                  ... 还有 {currentPlan.split('\n').length - 10} 行 (使用详细视图查看完整计划)
                </Text>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* 计划历史 */}
      {planModeState?.planHistory && planModeState.planHistory.length > 0 && (
        <Box marginBottom={1} paddingX={2} borderStyle="round" borderColor="cyan">
          <Box flexDirection="column">
            <Text color="cyan" bold>
              📚 计划历史 ({planModeState.planHistory.length} 个)：
            </Text>
            {planModeState.planHistory.slice(-3).map((historicalPlan, index) => (
              <Text key={index} color="gray">
                {index + 1}. {historicalPlan.split('\n')[0].substring(0, 50)}...
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* 操作指南 */}
      <Box marginTop={1} paddingX={2} borderStyle="round" borderColor="blue">
        <Box flexDirection="column">
          <Text color="blue" bold>
            💡 操作指南：
          </Text>
          <Text color="gray">
            1. 使用只读工具分析现有代码和需求
          </Text>
          <Text color="gray">
            2. 制定详细的实施计划（包含具体步骤）
          </Text>
          <Text color="gray">
            3. 使用 exit_plan_mode 工具提交计划等待确认
          </Text>
          <Text color="gray">
            4. 获得批准后将切换到执行模式开始实施
          </Text>
        </Box>
      </Box>

      {/* 快捷键提示 */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          💻 快捷键：Shift+Tab 切换模式 | Ctrl+C 退出 | 输入命令开始分析
        </Text>
      </Box>
    </Box>
  )
}