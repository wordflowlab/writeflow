import { Box, Text, Static } from 'ink'
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { randomUUID } from 'crypto'
import { WriteFlowApp } from '../cli/writeflow-app.js'
import { getTheme } from '../utils/theme.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { ModelConfig } from './components/ModelConfig.js'
import { getSessionState } from '../utils/state.js'
import { PromptInput } from './components/PromptInput.js'

const PRODUCT_NAME = 'WriteFlow'

// 消息渲染类型 - 分层渲染系统
type MessageRenderType = 'static' | 'transient' | 'message'

// 消息JSX结构 - 统一的消息渲染模式
interface MessageJSX {
  type: MessageRenderType
  jsx: React.ReactNode
}

// 消息类型定义 - WriteFlow 消息结构
interface WriteFlowMessage {
  uuid: string
  id: string
  type: 'user' | 'assistant' | 'system'
  message: string
  timestamp: Date
  costUSD?: number
  durationMs?: number
}

// WriteFlow 消息工厂函数
function createUserMessage(content: string): WriteFlowMessage {
  return {
    uuid: randomUUID(),
    id: randomUUID(),
    type: 'user',
    message: content,
    timestamp: new Date(),
  }
}

function createAssistantMessage(content: string, extra?: Partial<WriteFlowMessage>): WriteFlowMessage {
  return {
    uuid: randomUUID(),
    id: randomUUID(),
    type: 'assistant',
    message: content,
    timestamp: new Date(),
    costUSD: 0,
    durationMs: 0,
    ...extra,
  }
}

function createSystemMessage(content: string): WriteFlowMessage {
  return {
    uuid: randomUUID(),
    id: randomUUID(),
    type: 'system',
    message: content,
    timestamp: new Date(),
  }
}

// 消息过滤函数 - 过滤空消息
function isNotEmptyMessage(message: WriteFlowMessage): boolean {
  return Boolean(message.message && message.message.trim().length > 0)
}

// 动态状态消息数组 - 中文状态提示
const DYNAMIC_MESSAGES = [
  '思考中',
  '构思中',
  '分析中',
  '写作中',
  '创作中',
  '计算中',
  '理解中',
  '整理中',
  '编写中',
  '汇总中',
  '推理中',
  '处理中',
  '生成中',
  '考虑中',
  '制作中',
  '精炼中',
  '创建中',
  '运算中',
  '深思中',
  '判断中',
  '工作中',
  '实现中',
  '调整中',
  '铸造中',
  '形成中',
  '产生中',
  '酝酿中',
  '组织中',
  '努力中',
  '忙碌中',
  '构想中',
  '推断中',
  '实现中',
  '酝酿中',
  '漫步中',
  '思索中',
  '集结中',
  '沉思中',
  '琢磨中',
  '渗透中',
  '沉淀中',
  '加工中',
  '修补中',
  '网格化中',
  '反刍中',
  '奔波中',
  '剥离中',
  '炖煮中',
  '捏合中',
  '旋转中',
  '炖制中',
  '合成中',
  '思考中',
  '转换中',
  '感受中',
  '工作中',
  '完成中',
  '执行中',
  '实际化中',
  '烘焙中',
  '酝酿中',
  '计算中',
  '思考中',
  '搅拌中',
  '编码中',
  '融合中',
  '认知中',
  '计算中',
  '变魔术中',
  '考虑中',
  '烹饪中',
  '制作中'
]

// 动画字符 - 跨平台兼容配置
const SPINNER_CHARACTERS =
  process.platform === 'darwin'
    ? ['·', '✢', '✳', '∗', '✻', '✽']
    : ['·', '✢', '*', '∗', '✻', '✽']

// 增强的 Spinner 组件 - 动态状态指示器（支持“滚动安全”模式）
function Spinner() {
  // 若设置 WRITEFLOW_SCROLL_SAFE=1，则禁用高速动画，避免频繁重绘导致滚动条回弹
  const SCROLL_SAFE = process.env.WRITEFLOW_SCROLL_SAFE === '1'

  // 双向动画帧序列 - 创造更流畅的动画效果
  const frames = [...SPINNER_CHARACTERS, ...[...SPINNER_CHARACTERS].reverse()]
  const [frame, setFrame] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  // 随机选择一个动态消息并保持稳定
  const message = useRef(DYNAMIC_MESSAGES[Math.floor(Math.random() * DYNAMIC_MESSAGES.length)])
  const startTime = useRef(Date.now())

  // 动画帧更新（滚动安全模式下关闭，仅每秒更新一次由 elapsedTime 驱动）
  useEffect(() => {
    if (SCROLL_SAFE) return
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length)
    }, 120)
    return () => clearInterval(timer)
  }, [frames.length, SCROLL_SAFE])

  // 时间计数器更新（1s一次，影响小）
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000))
      // 在滚动安全模式下，顺便每秒驱动一帧，提供轻微反馈且不致频闪
      if (SCROLL_SAFE) {
        setFrame(f => (f + 1) % frames.length)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [SCROLL_SAFE])

  const theme = getTheme()
  const currentError = getSessionState('currentError', '')

  return (
    <Box flexDirection="row" marginTop={1}>
      <Box flexWrap="nowrap" height={1} width={2}>
        <Text color={theme.claude}>{frames[frame]}</Text>
      </Box>
      <Text color={theme.claude}>{message.current}… </Text>
      <Text color={theme.secondaryText}>
        ({elapsedTime}s · <Text bold>esc</Text> 中断)
      </Text>
      {currentError && (
        <Text color={theme.secondaryText}>
          · {currentError}
        </Text>
      )}
    </Box>
  )
}

// Professional status indicator for WriteFlow - 无边框版本
function WriteFlowStatusIndicator({
  isThinking,
  status
}: {
  isThinking: boolean
  status?: string
}) {
  const theme = getTheme()

  if (!isThinking && !status) {
    return null
  }

  return (
    <Box marginTop={1} marginBottom={1}>
      {isThinking ? (
        // 使用增强的 Spinner，移除边框
        <Spinner />
      ) : (
        <Text color={theme.claude}>{status}</Text>
      )}
    </Box>
  )
}

// Professional Logo for WriteFlow
function WriteFlowLogo() {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  const width = Math.max(50, Math.min(columns - 4, 80))

  return (
    <Box flexDirection="column" marginBottom={2}>
      <Box
        borderColor={theme.claude}
        borderStyle="round"
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingY={1}
        width={width}
      >
        <Text>
          <Text color={theme.claude}>✎</Text> 欢迎使用{' '}
          <Text bold color={theme.claude}>{PRODUCT_NAME}</Text>
          <Text> AI 写作助手</Text>
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text color={theme.secondaryText} italic>
            专为技术型作家设计的智能写作工具
          </Text>
          <Text color={theme.secondaryText}>
            输入 /help 获取帮助 · 开始您的创作之旅
          </Text>
        </Box>

        <Box
          borderColor={theme.secondaryBorder}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderTop={true}
          marginTop={1}
          paddingTop={1}
        >
          <Text color={theme.secondaryText}>
            💡 支持技术文档、创意写作、学术论文等多种写作模式
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

// Professional message display
function WriterMessage({
  message,
  type
}: {
  message: string
  type: 'user' | 'assistant' | 'system'
}) {
  const theme = getTheme()
  const { columns } = useTerminalSize()

  return (
    <Box flexDirection="row" marginBottom={1} width="100%">
      <Box minWidth={3}>
        <Text color={
          type === 'user' ? theme.secondaryText :
          type === 'system' ? theme.secondaryText : theme.text
        }>
          {type === 'user' ? ' > ' : type === 'system' ? ' ! ' : '   '}
        </Text>
      </Box>
      <Box flexDirection="column" width={columns - 4}>
        <Text
          color={
            type === 'user' ? theme.secondaryText :
            type === 'system' ? theme.secondaryText : theme.text
          }
          wrap="wrap"
        >
          {message}
        </Text>
      </Box>
    </Box>
  )
}

// WriterInput 组件已被 PromptInput 替代，支持智能命令补全

interface WriteFlowREPLProps {
  writeFlowApp: WriteFlowApp
}

export function WriteFlowREPL({ writeFlowApp }: WriteFlowREPLProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<WriteFlowMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [showModelConfig, setShowModelConfig] = useState(false)
  const [cursorOffset, setCursorOffset] = useState(0)
  const [mode, setMode] = useState<'writing' | 'editing' | 'reviewing'>('writing')
  
  // 获取所有可用命令用于补全
  const commands = useMemo(() => {
    return writeFlowApp.getAllCommands()
  }, [writeFlowApp])
  
  // 永久显示Logo的静态消息模式

  // 监听模型配置启动事件
  useEffect(() => {
    const handleLaunchModelConfig = () => {
      setShowModelConfig(true)
      setIsThinking(false)
    }

    writeFlowApp.on('launch-model-config', handleLaunchModelConfig)

    return () => {
      writeFlowApp.off('launch-model-config', handleLaunchModelConfig)
    }
  }, [writeFlowApp])

  // 消息过滤 - 只过滤空消息
  const validMessages = useMemo(() => {
    return messages.filter(isNotEmptyMessage)
  }, [messages])


  const messagesJSX = useMemo((): MessageJSX[] => {
    // 仅保留动态消息项，避免主题切换时 Static 内容无法更新
    return validMessages.map((msg) => ({
      type: 'message',
      jsx: (
        <WriterMessage
          key={msg.uuid}
          message={msg.message}
          type={msg.type}
        />
      ),
    }))
  }, [validMessages])

  const handleSubmit = useCallback(async (message: string) => {
    if (!message.trim()) return

    // Add user message using factory function
    const userMessage = createUserMessage(message.trim())
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsThinking(true)
    // Logo永久显示

    try {
      const trimmedMessage = message.trim()
      let response: string

      // 预创建一个空的助手消息用于流式增量输出
      const streamingAssistant = createAssistantMessage('')
      setMessages(prev => [...prev, streamingAssistant])

      const onToken = (chunk: string) => {
        setMessages(prev => prev.map(m => (
          m.uuid === streamingAssistant.uuid
            ? { ...m, message: (m.message || '') + chunk }
            : m
        )))
      }

      if (trimmedMessage.startsWith('/')) {
        // 处理斜杠命令
        response = await writeFlowApp.executeCommand(trimmedMessage, { onToken })
      } else {
        // 普通对话直接走自由文本路径
        // @ts-ignore - 访问类方法
        response = await writeFlowApp.handleFreeTextInput(trimmedMessage, { onToken })
      }

      // 将最终响应写入同一条消息，避免重复
      setMessages(prev => prev.map(m => (
        m.uuid === streamingAssistant.uuid
          ? { ...m, message: response }
          : m
      )))
    } catch (error) {
      // 如果命令方式失败，尝试直接调用私有方法（临时解决方案）
      try {
        // @ts-ignore - 临时访问私有方法
        const streamingAssistant = createAssistantMessage('')
        setMessages(prev => [...prev, streamingAssistant])
        const onToken = (chunk: string) => {
          setMessages(prev => prev.map(m => (
            m.uuid === streamingAssistant.uuid
              ? { ...m, message: (m.message || '') + chunk }
              : m
          )))
        }
        const result = await writeFlowApp.handleFreeTextInput(message.trim(), { onToken })

        // 智能解析返回结果
        let responseText: string = '处理完成'

        if (typeof result === 'string') {
          responseText = result
        } else if (typeof result === 'object' && result !== null) {
          // 尝试不同的属性名
          if ((result as any).content) {
            responseText = String((result as any).content)
          } else if ((result as any).text) {
            responseText = String((result as any).text)
          } else if ((result as any).message) {
            responseText = String((result as any).message)
          } else if ((result as any).response) {
            responseText = String((result as any).response)
          } else {
            // 如果都没有，转换为字符串或使用默认消息
            responseText = JSON.stringify(result).length > 200
              ? '收到了复杂的回复，请查看日志获取详细信息'
              : JSON.stringify(result)
          }
        } else {
          responseText = String(result)
        }

        setMessages(prev => prev.map(m => (
          m.uuid === streamingAssistant.uuid
            ? { ...m, message: responseText }
            : m
        )))
      } catch (fallbackError) {
        const errorMessage = createAssistantMessage(
          `错误: ${error instanceof Error ? error.message : '处理请求时发生错误'}`
        )
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsThinking(false)
    }
  }, [writeFlowApp])

  // 如果显示模型配置界面，则渲染 ModelConfig 组件
  if (showModelConfig) {
    return (
      <ModelConfig
        onClose={() => {
          setShowModelConfig(false)
          // 添加配置完成消息
          const configCompleteMessage = createAssistantMessage(
            '模型配置已完成，可以开始使用 WriteFlow AI 写作助手了！'
          )
          setMessages(prev => [...prev, configCompleteMessage])
        }}
      />
    )
  }

  return (
    <Box flexDirection="column" width="100%">

      {/* 顶部欢迎与品牌区（非 Static，主题切换可立即反映） */}
      <Box flexDirection="column">
        <WriteFlowLogo />
      </Box>

      {/* 消息内容渲染 - 回退为原先一次性渲染列表，避免重复输入出现 */}
      {messagesJSX.filter(_ => _.type === 'message').map(_ => _.jsx)}

      {/* 动态状态和输入区域 */}
      <WriteFlowStatusIndicator isThinking={isThinking} />

      <PromptInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        commands={commands}
        isLoading={isThinking}
        isDisabled={isThinking}
        placeholder={validMessages.length === 0 ? "描述您想要写作的内容..." : "继续您的写作..."}
        enableCompletion={true}
        mode={mode}
        onModeChange={setMode}
        messages={validMessages
          .filter(msg => msg.type === 'user' || msg.type === 'assistant')
          .map(msg => ({
            id: msg.id,
            type: msg.type as 'user' | 'assistant',
            content: msg.message
          }))}
      />
    </Box>
  )
}
