import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { getTheme } from '../../utils/theme.js'
import { Select, SelectOption } from './Select.js'
import TextInput from './TextInput.js'
import { getModelManager } from '../../services/models/ModelManager.js'
import { ModelProfile, ProviderType } from '../../utils/config.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

type Props = {
  onDone: () => void
  onCancel: () => void
  skipModelType?: boolean
  targetPointer?: string
  isOnboarding?: boolean
  abortController: AbortController
}

// 支持的提供商和对应的模型
const PROVIDERS: Array<{
  value: ProviderType
  label: string
  description: string
  models: Array<{ value: string; label: string }>
}> = [
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    description: '高质量的对话和推理能力',
    models: [
      { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1 (最强)' },
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (快速)' },
    ]
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    description: '高性价比的智能模型',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (推理优化)' },
    ]
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'GPT 系列模型',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (最新)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (快速)' },
    ]
  },
  {
    value: 'kimi',
    label: 'Kimi (月之暗面)',
    description: '长上下文中文优化模型',
    models: [
      { value: 'moonshot-v1-8k', label: 'Moonshot v1 8K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot v1 32K' },
      { value: 'moonshot-v1-128k', label: 'Moonshot v1 128K' },
    ]
  }
]

type Step = 'provider' | 'model' | 'apikey' | 'config' | 'done'

export function ModelSelector({
  onDone,
  onCancel,
  skipModelType = false,
  targetPointer,
  isOnboarding = false,
  abortController
}: Props): React.ReactNode {
  const theme = getTheme()
  const { columns } = useTerminalSize()
  const [currentStep, setCurrentStep] = useState<Step>('provider')
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [maxTokens, setMaxTokens] = useState('4096')
  const [contextLength, setContextLength] = useState('128000')
  
  const [cursorOffset, setCursorOffset] = useState(0)
  const [inputFocus, setInputFocus] = useState(false)
  
  const modelManager = getModelManager()

  // Handle keyboard input for navigation
  const handleInput = useCallback((input: string, key: any) => {
    if (key.escape) {
      onCancel()
    }
  }, [onCancel])

  useInput(handleInput)

  // Provider selection step
  const handleProviderSelect = useCallback((providerValue: string) => {
    const provider = providerValue as ProviderType
    setSelectedProvider(provider)
    setCurrentStep('model')
  }, [])

  // Model selection step
  const handleModelSelect = useCallback((modelValue: string) => {
    setSelectedModel(modelValue)
    setCurrentStep('apikey')
  }, [])

  // API key input step
  const handleApiKeySubmit = useCallback((value: string) => {
    setApiKey(value)
    setCurrentStep('config')
  }, [])

  // Configuration step
  const handleConfigComplete = useCallback(() => {
    if (!selectedProvider || !selectedModel || !apiKey) {
      return
    }

    // Create new model profile
    const newProfile: ModelProfile = {
      name: modelName || `${selectedProvider} ${selectedModel}`,
      provider: selectedProvider,
      modelName: selectedModel,
      apiKey,
      maxTokens: parseInt(maxTokens, 10) || 4096,
      contextLength: parseInt(contextLength, 10) || 128000,
      isActive: true,
      createdAt: Date.now()
    }

    try {
      modelManager.addModelProfile(newProfile)
      onDone()
    } catch (error) {
      console.error('添加模型配置失败:', error)
      onCancel()
    }
  }, [selectedProvider, selectedModel, apiKey, modelName, maxTokens, contextLength, modelManager, onDone, onCancel])

  // Get provider options for select
  const providerOptions: SelectOption[] = PROVIDERS.map(p => ({
    label: p.label,
    value: p.value,
    description: p.description
  }))

  // Get model options for selected provider
  const modelOptions: SelectOption[] = selectedProvider
    ? PROVIDERS.find(p => p.value === selectedProvider)?.models.map(m => ({
        label: m.label,
        value: m.value,
        description: `模型: ${m.value}`
      })) || []
    : []

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.secondaryBorder || 'gray'}
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="column" minHeight={2} marginBottom={1}>
        <Text bold>添加新模型配置</Text>
        <Text color="gray">
          {currentStep === 'provider' && '选择 AI 提供商'}
          {currentStep === 'model' && '选择模型'}
          {currentStep === 'apikey' && '输入 API 密钥'}
          {currentStep === 'config' && '配置模型参数'}
        </Text>
      </Box>

      {currentStep === 'provider' && (
        <Box flexDirection="column">
          <Text>请选择 AI 提供商:</Text>
          <Select
            options={providerOptions}
            onSubmit={handleProviderSelect}
            placeholder="选择提供商..."
            focus={!inputFocus}
          />
        </Box>
      )}

      {currentStep === 'model' && selectedProvider && (
        <Box flexDirection="column">
          <Text>请选择模型 ({selectedProvider}):</Text>
          <Select
            options={modelOptions}
            onSubmit={handleModelSelect}
            placeholder="选择模型..."
            focus={!inputFocus}
          />
        </Box>
      )}

      {currentStep === 'apikey' && (
        <Box flexDirection="column">
          <Text>请输入 API 密钥:</Text>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={handleApiKeySubmit}
            placeholder={`输入 ${selectedProvider} API 密钥...`}
            focus={true}
            mask="*"
            columns={columns - 4}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
          />
        </Box>
      )}

      {currentStep === 'config' && (
        <Box flexDirection="column">
          <Text>配置模型参数:</Text>
          <Box flexDirection="column" marginTop={1}>
            <Text>模型名称 (可选): {modelName || `${selectedProvider} ${selectedModel}`}</Text>
            <Text>最大输出 Tokens: {maxTokens}</Text>
            <Text>上下文长度: {contextLength}</Text>
          </Box>
          <Box marginTop={2}>
            <Text color="green">配置完成！按 Enter 确认添加模型</Text>
          </Box>
        </Box>
      )}

      <Box
        marginTop={1}
        paddingTop={1}
        borderColor="gray"
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop={true}
      >
        <Text color="gray">
          {currentStep === 'provider' && '使用 ↑/↓ 选择，Enter 确认，Esc 取消'}
          {currentStep === 'model' && '使用 ↑/↓ 选择，Enter 确认，Esc 取消'}
          {currentStep === 'apikey' && '输入 API 密钥后按 Enter，Esc 取消'}
          {currentStep === 'config' && '按 Enter 完成配置，Esc 取消'}
        </Text>
      </Box>
    </Box>
  )
}