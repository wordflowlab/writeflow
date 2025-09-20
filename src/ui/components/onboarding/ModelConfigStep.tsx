import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import figures from 'figures'
import { getModelManager } from '../../../services/models/ModelManager.js'
import { getGlobalConfig, setModelPointer, ModelProfile } from '../../../utils/config.js'
import { providers, getProviderDisplayName, getProviderEnvVar, providerRequiresApiKey, ProviderType } from '../../../constants/providers.js'
import models from '../../../constants/models.js'
import TextInput from '../common/TextInput.js'

interface ModelConfigStepProps {
  onComplete: () => void
  onSkip?: () => void
}

type ConfigMode = 'detection' | 'provider-selection' | 'api-key-input' | 'model-selection' | 'verification' | 'completed'

interface ConfigState {
  selectedProvider: ProviderType | null
  selectedModel: string | null
  apiKey: string
  modelName: string
  maxTokens: number
  contextLength: number
}

export function ModelConfigStep({ onComplete, onSkip }: ModelConfigStepProps): React.ReactElement {
  const [mode, setMode] = useState<ConfigMode>('detection')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [configState, setConfigState] = useState<ConfigState>({
    selectedProvider: null,
    selectedModel: null,
    apiKey: '',
    modelName: '',
    maxTokens: 4096,
    contextLength: 128000,
  })
  const [inputValue, setInputValue] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [isVerifying, setIsVerifying] = useState(false)
  
  const config = getGlobalConfig()
  const modelManager = getModelManager()

  // 检测环境变量中的 API 密钥
  const detectedApis = useMemo(() => {
    const detected = []
    if (process.env.DEEPSEEK_API_KEY) {
      detected.push({ provider: 'deepseek' as ProviderType, name: 'DeepSeek' })
    }
    if (process.env.ANTHROPIC_API_KEY) {
      detected.push({ provider: 'anthropic' as ProviderType, name: 'Anthropic Claude' })
    }
    if (process.env.OPENAI_API_KEY) {
      detected.push({ provider: 'openai' as ProviderType, name: 'OpenAI' })
    }
    if (process.env.KIMI_API_KEY) {
      detected.push({ provider: 'kimi' as ProviderType, name: 'Kimi' })
    }
    return detected
  }, [])

  // 检查是否已有配置的模型
  const hasConfiguredModels = useMemo(() => {
    const profiles = modelManager.getActiveProfiles()
    return profiles.length > 0
  }, [modelManager])

  // 获取当前模式的选项
  const getCurrentOptions = useCallback(() => {
    switch (mode) {
      case 'detection':
        if (hasConfiguredModels) {
          return ['✅ 使用现有配置', '🚀 自动配置检测到的模型', '⚙️  手动配置模型']
        } else if (detectedApis.length > 0) {
          return ['🚀 自动配置检测到的模型', '⚙️  手动配置模型']
        } else {
          return ['⚙️  手动配置模型']
        }
      
      case 'provider-selection':
        return Object.keys(providers).map(provider => 
          `${getProviderDisplayName(provider as ProviderType)} (${provider})`
        )
      
      case 'model-selection':
        if (configState.selectedProvider) {
          const providerModels = models[configState.selectedProvider] || []
          return providerModels.map(model => model.model)
        }
        return []
      
      default:
        return []
    }
  }, [mode, hasConfiguredModels, detectedApis, configState.selectedProvider])

  // 自动配置检测到的模型
  const handleAutoConfig = useCallback(async () => {
    setIsVerifying(true)
    
    try {
      const profiles = modelManager.getAllProfiles()
      let configuredAny = false
      
      for (const api of detectedApis) {
        const provider = api.provider
        const existingProfile = profiles.find(p => p.provider === provider)
        
        if (!existingProfile) {
          // 获取该提供商的第一个模型作为默认
          const providerModels = models[provider] || []
          if (providerModels.length > 0) {
            const defaultModel = providerModels[0]
            const envVar = getProviderEnvVar(provider)
            const apiKey = envVar ? process.env[envVar] : ''
            
            if (apiKey) {
              const profile: ModelProfile = {
                name: `${api.name} - ${defaultModel.model}`,
                provider: provider,
                modelName: defaultModel.model,
                apiKey: apiKey,
                maxTokens: defaultModel.max_output_tokens || 4096,
                contextLength: defaultModel.max_input_tokens || 128000,
                isActive: true,
                createdAt: Date.now()
              }
              
              modelManager.addModelProfile(profile)
              
              // 如果没有主模型，设为主模型
              if (!config.modelPointers?.main) {
                setModelPointer('main', profile.name)
              }
              
              configuredAny = true
            }
          }
        }
      }
      
      if (configuredAny) {
        setMode('completed')
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        // 没有配置成功，回到手动配置
        setMode('provider-selection')
      }
      
    } catch (_error) {
      console.error('自动配置失败:', _error)
      setMode('provider-selection')
    } finally {
      setIsVerifying(false)
    }
  }, [detectedApis, modelManager, config.modelPointers, onComplete])

  // 处理提供商选择
  const handleProviderSelection = useCallback((providerKey: string) => {
    const provider = providerKey as ProviderType
    setConfigState(prev => ({ ...prev, selectedProvider: provider }))
    
    if (providerRequiresApiKey(provider)) {
      const envVar = getProviderEnvVar(provider)
      const existingKey = envVar ? process.env[envVar] || '' : ''
      setInputValue(existingKey)
      setMode('api-key-input')
    } else {
      setMode('model-selection')
    }
  }, [])

  // 处理 API 密钥输入完成
  const handleApiKeyComplete = useCallback(() => {
    setConfigState(prev => ({ ...prev, apiKey: inputValue }))
    setMode('model-selection')
  }, [inputValue])

  // 处理模型选择
  const handleModelSelection = useCallback((modelName: string) => {
    const provider = configState.selectedProvider!
    const providerModels = models[provider] || []
    const modelInfo = providerModels.find(m => m.model === modelName)
    
    if (modelInfo) {
      setConfigState(prev => ({
        ...prev,
        selectedModel: modelName,
        modelName: `${getProviderDisplayName(provider)} - ${modelName}`,
        maxTokens: modelInfo.max_output_tokens || 4096,
        contextLength: modelInfo.max_input_tokens || 128000,
      }))
      
      // 创建模型配置
      const profile: ModelProfile = {
        name: `${getProviderDisplayName(provider)} - ${modelName}`,
        provider: provider,
        modelName: modelName,
        apiKey: configState.apiKey,
        maxTokens: modelInfo.max_output_tokens || 4096,
        contextLength: modelInfo.max_input_tokens || 128000,
        isActive: true,
        createdAt: Date.now()
      }
      
      try {
        modelManager.addModelProfile(profile)
        
        // 如果没有主模型，设为主模型
        if (!config.modelPointers?.main) {
          setModelPointer('main', profile.name)
        }
        
        setMode('completed')
        setTimeout(() => {
          onComplete()
        }, 1500)
        
      } catch (_error) {
        console.error('保存模型配置失败:', _error)
      }
    }
  }, [configState, modelManager, config.modelPointers, onComplete])

  // 处理键盘输入
  const handleInput = useCallback(
    (input: string, key: any) => {
      if (isVerifying) return // 验证中不处理输入
      
      if (mode === 'api-key-input') {
        // API 密钥输入模式由 TextInput 组件处理
        return
      }
      
      if ((key as any).escape && onSkip) {
        onSkip()
        return
      }
      
      if ((key as any).upArrow) {
        const options = getCurrentOptions()
        setSelectedIndex(prev => Math.max(0, prev - 1))
      } else if ((key as any).downArrow) {
        const options = getCurrentOptions()
        setSelectedIndex(prev => Math.min(options.length - 1, prev + 1))
      } else if ((key as any).return) {
        const options = getCurrentOptions()
        const selectedOption = options[selectedIndex]
        
        switch (mode) {
          case 'detection':
            if (selectedOption.includes('使用现有配置')) {
              onComplete()
            } else if (selectedOption.includes('自动配置')) {
              handleAutoConfig()
            } else if (selectedOption.includes('手动配置')) {
              setMode('provider-selection')
              setSelectedIndex(0)
            }
            break
            
          case 'provider-selection':
            const providerKey = Object.keys(providers)[selectedIndex]
            handleProviderSelection(providerKey)
            setSelectedIndex(0)
            break
            
          case 'model-selection':
            handleModelSelection(selectedOption)
            break
        }
      }
    },
    [mode, selectedIndex, getCurrentOptions, isVerifying, onSkip, onComplete, handleAutoConfig, handleProviderSelection, handleModelSelection]
  )

  useInput(handleInput)

  // 渲染不同模式的界面
  if (mode === 'api-key-input') {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="blue">🔑 输入 {getProviderDisplayName(configState.selectedProvider!)} API 密钥</Text>
        </Box>
        
        <Box marginY={1}>
          <Text color="gray">
            请输入您的 API 密钥（输入将被遮罩保护）：
          </Text>
        </Box>

        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleApiKeyComplete}
            placeholder="sk-..."
            mask="*"
            focus={true}
            showCursor={true}
            columns={80}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
          />
        </Box>

        <Box marginTop={1}>
          <Text color="gray">
            按 Enter 确认，Esc 取消
          </Text>
        </Box>
      </Box>
    )
  }

  if (mode === 'completed') {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="green">✅ 模型配置完成！</Text>
        </Box>
        
        <Box marginY={1}>
          <Text color="gray">
            您的 AI 模型已配置完成，正在进入下一步...
          </Text>
        </Box>
      </Box>
    )
  }

  if (isVerifying) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="blue">⚙️  正在配置模型...</Text>
        </Box>
        
        <Box marginY={1}>
          {detectedApis.map(api => (
            <Text key={api.provider} color="green">
              ✓ 配置 {api.name} 模型
            </Text>
          ))}
        </Box>
        
        <Box>
          <Text color="gray">请稍候...</Text>
        </Box>
      </Box>
    )
  }

  // 主界面
  const options = getCurrentOptions()
  const currentTitle = mode === 'detection' 
    ? '配置 AI 模型'
    : mode === 'provider-selection' 
      ? '选择 AI 提供商'
      : mode === 'model-selection'
        ? `选择 ${getProviderDisplayName(configState.selectedProvider!)} 模型`
        : '模型配置'

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text color="blue">{currentTitle}</Text>
      </Box>
      
      {mode === 'detection' && detectedApis.length > 0 && (
        <Box flexDirection="column" marginY={1}>
          <Text color="gray">检测到以下 AI 服务的 API 密钥：</Text>
          {detectedApis.map(api => (
            <Box key={api.provider} paddingLeft={2}>
              <Text color="white">• {api.name}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray">
          {mode === 'detection' 
            ? '选择配置方式：'
            : mode === 'provider-selection'
              ? '选择您要使用的 AI 服务提供商：'
              : mode === 'model-selection'
                ? '选择要使用的模型：'
                : '请选择：'
          }
        </Text>
        
        {options.map((option, index) => (
          <Box key={index} paddingLeft={2}>
            <Text color={selectedIndex === index ? 'blue' : 'white'}>
              {selectedIndex === index ? figures.pointer : ' '} {option}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          使用 ↑/↓ 选择，Enter 确认{onSkip ? '，Esc 跳过' : ''}
        </Text>
      </Box>
    </Box>
  )
}