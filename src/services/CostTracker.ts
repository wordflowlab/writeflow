/**
 * WriteFlow 成本跟踪器
 * 参考 Kode 的 cost-tracker 实现，提供实时成本监控和预算控制
 */

import { formatDuration } from '../utils/format.js'

// 成本跟踪状态
interface CostState {
  totalCost: number
  totalTokens: number
  totalRequests: number
  totalAPIDuration: number
  startTime: number
  sessionId: string
  modelUsage: Map<string, ModelUsage>
}

interface ModelUsage {
  requests: number
  inputTokens: number
  outputTokens: number
  cost: number
  duration: number
}

interface CostEntry {
  timestamp: number
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  duration: number
  requestType: 'chat' | 'tool' | 'reasoning'
}

// 成本阈值配置
interface CostThresholds {
  dailyLimit: number
  monthlyLimit: number
  warningThreshold: number
  emergencyThreshold: number
  enableWarnings: boolean
}

// 全局状态 - 参考 Kode 的简洁设计
const STATE: CostState = {
  totalCost: 0,
  totalTokens: 0,
  totalRequests: 0,
  totalAPIDuration: 0,
  startTime: Date.now(),
  sessionId: `wf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  modelUsage: new Map()
}

// 成本历史记录（内存中保存，重启时清空）
const costHistory: CostEntry[] = []

/**
 * 添加成本记录
 */
export function addCostEntry(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  duration: number,
  requestType: 'chat' | 'tool' | 'reasoning' = 'chat'
): void {
  // 更新全局统计
  STATE.totalCost += cost
  STATE.totalTokens += inputTokens + outputTokens
  STATE.totalRequests += 1
  STATE.totalAPIDuration += duration

  // 更新模型使用统计
  const existing = STATE.modelUsage.get(model) || {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    duration: 0
  }

  existing.requests += 1
  existing.inputTokens += inputTokens
  existing.outputTokens += outputTokens
  existing.cost += cost
  existing.duration += duration

  STATE.modelUsage.set(model, existing)

  // 记录到历史
  costHistory.push({
    timestamp: Date.now(),
    model,
    inputTokens,
    outputTokens,
    cost,
    duration,
    requestType
  })

  // 检查阈值警告
  checkCostThresholds()
}

/**
 * 获取总成本
 */
export function getTotalCost(): number {
  return STATE.totalCost
}

/**
 * 获取总 tokens
 */
export function getTotalTokens(): number {
  return STATE.totalTokens
}

/**
 * 获取会话持续时间
 */
export function getSessionDuration(): number {
  return Date.now() - STATE.startTime
}

/**
 * 获取 API 调用总时间
 */
export function getAPIDuration(): number {
  return STATE.totalAPIDuration
}

/**
 * 获取会话 ID
 */
export function getSessionId(): string {
  return STATE.sessionId
}

/**
 * 格式化成本显示
 */
function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

/**
 * 格式化 tokens 显示
 */
function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1000000).toFixed(1)}M`
}

/**
 * 生成成本摘要报告
 */
export function generateCostSummary(): string {
  const lines = [
    '💰 WriteFlow 成本统计',
    '',
    `📊 会话总计:`,
    `   总成本: ${formatCost(STATE.totalCost)}`,
    `   总 tokens: ${formatTokens(STATE.totalTokens)}`,
    `   总请求: ${STATE.totalRequests.toString()}`,
    '',
    `⏱️  时间统计:`,
    `   会话时长: ${formatDuration(getSessionDuration())}`,
    `   API 时长: ${formatDuration(STATE.totalAPIDuration)}`,
    '',
  ]

  // 模型使用详情
  if (STATE.modelUsage.size > 0) {
    lines.push(`🤖 模型使用详情:`)
    for (const [model, usage] of STATE.modelUsage.entries()) {
      const avgCostPerRequest = usage.requests > 0 ? usage.cost / usage.requests : 0
      lines.push(
        `   ${model}:`,
        `     请求: ${usage.requests}, tokens: ${formatTokens(usage.inputTokens + usage.outputTokens)}`,
        `     成本: ${formatCost(usage.cost)} (平均: ${formatCost(avgCostPerRequest)}/请求)`
      )
    }
    lines.push('')
  }

  // 成本趋势（最近 10 次请求）
  if (costHistory.length > 0) {
    lines.push(`📈 最近请求:`)
    const recent = costHistory.slice(-5)
    for (const entry of recent) {
      const time = new Date(entry.timestamp).toLocaleTimeString()
      lines.push(
        `   ${time} - ${entry.model}: ${formatTokens(entry.inputTokens + entry.outputTokens)} tokens, ${formatCost(entry.cost)}`
      )
    }
  }

  return lines.join('\n')
}

/**
 * 获取成本阈值配置
 */
function getCostThresholds(): CostThresholds {
  // 简化配置，使用硬编码默认值避免循环引用
  return {
    dailyLimit: 10.0,
    monthlyLimit: 100.0,
    warningThreshold: 0.8,
    emergencyThreshold: 0.95,
    enableWarnings: true
  }
}

/**
 * 检查成本阈值
 */
function checkCostThresholds(): void {
  const thresholds = getCostThresholds()
  
  if (!thresholds.enableWarnings) {
    return
  }
  
  const dailyCost = getDailyCost()
  const monthlyCost = getMonthlyCost()

  // 检查每日限制
  if (dailyCost > thresholds.dailyLimit * thresholds.emergencyThreshold) {
    console.log(`🚨 紧急警告: 今日成本 ${formatCost(dailyCost)} 已接近限制 ${formatCost(thresholds.dailyLimit)}`)
  } else if (dailyCost > thresholds.dailyLimit * thresholds.warningThreshold) {
    console.log(`⚠️  警告: 今日成本 ${formatCost(dailyCost)} 接近限制 ${formatCost(thresholds.dailyLimit)}`)
  }

  // 检查月度限制
  if (monthlyCost > thresholds.monthlyLimit * thresholds.emergencyThreshold) {
    console.log(`🚨 紧急警告: 本月成本 ${formatCost(monthlyCost)} 已接近限制 ${formatCost(thresholds.monthlyLimit)}`)
  } else if (monthlyCost > thresholds.monthlyLimit * thresholds.warningThreshold) {
    console.log(`⚠️  警告: 本月成本 ${formatCost(monthlyCost)} 接近限制 ${formatCost(thresholds.monthlyLimit)}`)
  }
}

/**
 * 获取今日成本（简化实现 - 基于会话成本）
 */
function getDailyCost(): number {
  // 简化实现：返回当前会话成本
  // 实际实现应该从持久存储中读取今日所有会话的成本
  return STATE.totalCost
}

/**
 * 获取本月成本（简化实现 - 基于会话成本）
 */
function getMonthlyCost(): number {
  // 简化实现：返回当前会话成本
  // 实际实现应该从持久存储中读取本月所有会话的成本
  return STATE.totalCost
}

/**
 * 获取详细的使用统计
 */
export function getDetailedStats() {
  return {
    session: {
      id: STATE.sessionId,
      startTime: STATE.startTime,
      duration: getSessionDuration(),
      cost: STATE.totalCost,
      tokens: STATE.totalTokens,
      requests: STATE.totalRequests,
      apiDuration: STATE.totalAPIDuration
    },
    models: Object.fromEntries(STATE.modelUsage),
    recent: costHistory.slice(-10),
    thresholds: getCostThresholds()
  }
}

/**
 * 重置状态（仅用于测试）
 */
export function resetCostState(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetCostState can only be called in tests')
  }
  STATE.totalCost = 0
  STATE.totalTokens = 0
  STATE.totalRequests = 0
  STATE.totalAPIDuration = 0
  STATE.startTime = Date.now()
  STATE.modelUsage.clear()
  costHistory.length = 0
}

/**
 * 会话结束时保存统计到配置
 */
export function saveCostSummaryOnExit(): void {
  // 简化实现：暂时只记录到内存
  // 避免在服务层直接操作配置文件
  const summary = {
    sessionId: STATE.sessionId,
    cost: STATE.totalCost,
    tokens: STATE.totalTokens,
    requests: STATE.totalRequests,
    duration: getSessionDuration(),
    apiDuration: STATE.totalAPIDuration,
    timestamp: Date.now()
  }
  
  // TODO: 在适当的地方保存到配置文件
  console.log('会话结束统计:', summary)
}

// 进程退出时自动保存
process.on('exit', saveCostSummaryOnExit)
process.on('SIGINT', () => {
  saveCostSummaryOnExit()
  process.exit(0)
})