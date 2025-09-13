import { H2AAsyncMessageQueue } from '../queue/h2A-queue.js'
import { AgentContext } from '../../types/agent.js'
import { Message, MessageType } from '../../types/message.js'
import { NOMainAgentEngine } from '../agent/nO-engine.js'

import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'

export type ExecuteCommandFn = (command: string, agentContext?: AgentContext) => Promise<{
  success: boolean
  error?: string
  shouldQuery?: boolean
  allowedTools?: string[]
  messages?: Array<{ role: string; content: string }>
}>

export type ProcessAIQueryFn = (
  messages: Array<{ role: string; content: string }>,
  allowedTools?: string[],
  signal?: AbortSignal
) => Promise<string>

/**
 * 最小 CoreEngineAdapter：
 * - 从 h2A 队列消费 SlashCommand 消息
 * - 通过现有执行器执行命令，必要时走 AI 路径
 * - 仅为最小可用，实现指标推进与稳态验证
 */
export class CoreEngineAdapter {
  constructor(
    private queue: H2AAsyncMessageQueue,
    private executeCommand: ExecuteCommandFn,
    private processAIQuery: ProcessAIQueryFn,
    private agentContext?: AgentContext,
    private options?: { agentEnabled?: boolean; agentEngine?: NOMainAgentEngine; agentStrict?: boolean }
  ) {}

  async start(): Promise<void> {
    for await (const msg of this.queue) {
      try {
        if (msg.type !== MessageType.SlashCommand) continue
        const payload = msg.payload as { command: string; options?: any }

        // 转发给 Agent 引擎（若启用）
        if (this.options?.agentEnabled && this.options?.agentEngine) {
          await this.options.agentEngine.sendMessage(msg)
        }

        // 在非严格模式下，仍由现有执行器处理一次，确保兼容
        if (!this.options?.agentStrict) {
          const result = await this.executeCommand(payload.command, this.agentContext)
          if (result.shouldQuery && result.messages) {
            await this.processAIQuery(result.messages, result.allowedTools)
          }
        }
      } catch (e) {
        // 最小容错：记录即可
        // eslint-disable-next-line no-console
        logWarn('[CoreEngineAdapter] 处理消息失败:', (e as Error)?.message || e)
      }
    }
  }
}

