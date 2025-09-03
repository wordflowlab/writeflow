import { Box, Text, useInput } from 'ink'
import React, { useState, useCallback, useEffect, useRef } from 'react'
import figures from 'figures'
import { getGlobalConfig, ModelPointerType, setModelPointer } from '../../utils/config.js'
import { getModelManager } from '../../services/models/ModelManager.js'
import { ModelListManager } from './ModelListManager.js'

type Props = {
  onClose: () => void
}

type ModelPointerSetting = {
  id: ModelPointerType | 'add-new'
  label: string
  description: string
  value: string
  options: Array<{ id: string; name: string }>
  type: 'modelPointer' | 'action'
  onChange(value?: string): void
}

export function ModelConfig({ onClose }: Props): React.ReactNode {
  const config = getGlobalConfig()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showModelListManager, setShowModelListManager] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const selectedIndexRef = useRef(selectedIndex)

  const modelManager = getModelManager()

  // 同步 selectedIndex 到 ref
  useEffect(() => {
    selectedIndexRef.current = selectedIndex
  }, [selectedIndex])

  // 获取可用模型列表
  const availableModels = React.useMemo((): Array<{
    id: string
    name: string
  }> => {
    const profiles = modelManager.getAllProfiles()
    return profiles.filter(p => p.isActive).map(p => ({ 
      id: p.modelName, 
      name: p.name || p.modelName 
    }))
  }, [modelManager, refreshKey])

  // 创建菜单项
  const menuItems = React.useMemo(() => {
    const modelSettings: ModelPointerSetting[] = [
      {
        id: 'main',
        label: '主模型 (Main)',
        description: '用于一般对话和写作任务的主要模型',
        value: config.modelPointers?.main || '',
        options: availableModels,
        type: 'modelPointer' as const,
        onChange: (value: string) => handleModelPointerChange('main', value),
      },
      {
        id: 'task',
        label: '任务模型 (Task)',
        description: '用于子任务处理和工具调用的模型',
        value: config.modelPointers?.task || '',
        options: availableModels,
        type: 'modelPointer' as const,
        onChange: (value: string) => handleModelPointerChange('task', value),
      },
      {
        id: 'reasoning',
        label: '推理模型 (Reasoning)', 
        description: '用于复杂推理和分析任务的模型',
        value: config.modelPointers?.reasoning || '',
        options: availableModels,
        type: 'modelPointer' as const,
        onChange: (value: string) => handleModelPointerChange('reasoning', value),
      },
      {
        id: 'quick',
        label: '快速模型 (Quick)',
        description: '用于简单操作和快速响应的轻量模型',
        value: config.modelPointers?.quick || '',
        options: availableModels,
        type: 'modelPointer' as const,
        onChange: (value: string) => handleModelPointerChange('quick', value),
      },
    ]

    // 添加管理操作
    return [
      ...modelSettings,
      {
        id: 'manage-models',
        label: '管理模型库',
        description: '查看、添加和删除模型配置',
        value: '',
        options: [],
        type: 'action' as const,
        onChange: () => handleManageModels(),
      },
    ]
  }, [config.modelPointers, availableModels, refreshKey])

  const handleModelPointerChange = (
    pointer: ModelPointerType,
    modelId: string,
  ) => {
    setModelPointer(pointer, modelId)
    setRefreshKey(prev => prev + 1)
  }

  const handleManageModels = () => {
    setShowModelListManager(true)
  }

  const handleModelConfigurationComplete = () => {
    setShowModelListManager(false)
    setRefreshKey(prev => prev + 1)
    // 重新聚焦到管理模型库选项
    const manageIndex = menuItems.findIndex(item => item.id === 'manage-models')
    if (manageIndex !== -1) {
      setSelectedIndex(manageIndex)
    }
  }

  // 检查是否需要自动配置
  const shouldShowQuickSetup = React.useMemo(() => {
    return availableModels.length === 0 && 
           (process.env.DEEPSEEK_API_KEY || 
            process.env.ANTHROPIC_API_KEY || 
            process.env.OPENAI_API_KEY ||
            process.env.KIMI_API_KEY)
  }, [availableModels.length])

  // 自动配置基于环境变量的模型
  const handleQuickSetup = useCallback(() => {
    try {
      const profiles = modelManager.getAllProfiles()
      
      // 基于环境变量添加模型配置
      if (process.env.DEEPSEEK_API_KEY && !profiles.find(p => p.provider === 'deepseek')) {
        modelManager.addModelProfile({
          name: 'DeepSeek Chat',
          provider: 'deepseek',
          modelName: 'deepseek-chat',
          apiKey: process.env.DEEPSEEK_API_KEY,
          maxTokens: 4096,
          contextLength: 128000,
          isActive: true,
          createdAt: Date.now()
        })
        setModelPointer('main', 'deepseek-chat')
      }
      
      if (process.env.ANTHROPIC_API_KEY && !profiles.find(p => p.provider === 'anthropic')) {
        modelManager.addModelProfile({
          name: 'Claude Opus 4.1',
          provider: 'anthropic',
          modelName: 'claude-opus-4-1-20250805',
          apiKey: process.env.ANTHROPIC_API_KEY,
          maxTokens: 4096,
          contextLength: 200000,
          isActive: true,
          createdAt: Date.now()
        })
        if (!config.modelPointers?.main) {
          setModelPointer('main', 'claude-opus-4-1-20250805')
        }
      }
      
      if (process.env.OPENAI_API_KEY && !profiles.find(p => p.provider === 'openai')) {
        modelManager.addModelProfile({
          name: 'GPT-4',
          provider: 'openai',
          modelName: 'gpt-4o',
          apiKey: process.env.OPENAI_API_KEY,
          maxTokens: 4096,
          contextLength: 128000,
          isActive: true,
          createdAt: Date.now()
        })
        if (!config.modelPointers?.main) {
          setModelPointer('main', 'gpt-4o')
        }
      }
      
      if (process.env.KIMI_API_KEY && !profiles.find(p => p.provider === 'kimi')) {
        modelManager.addModelProfile({
          name: 'Kimi Chat',
          provider: 'kimi',
          modelName: 'kimi-chat',
          apiKey: process.env.KIMI_API_KEY,
          maxTokens: 4096,
          contextLength: 200000,
          isActive: true,
          createdAt: Date.now()
        })
        if (!config.modelPointers?.main) {
          setModelPointer('main', 'kimi-chat')
        }
      }
      
      setRefreshKey(prev => prev + 1)
      
    } catch (error) {
      console.error('自动配置失败:', error)
    }
  }, [modelManager, config.modelPointers])

  // 处理键盘输入
  const handleInput = useCallback(
    (input: string, key: any) => {
      // 如果在快速设置界面
      if (shouldShowQuickSetup) {
        if (key.return) {
          handleQuickSetup()
          return
        } else if (key.escape) {
          // 跳过快速设置，进入手动配置
          setRefreshKey(prev => prev + 1) // 强制重新渲染
          return
        }
        return
      }

      if (key.escape) {
        if (isDeleteMode) {
          setIsDeleteMode(false)
        } else if (showModelListManager) {
          // 模型列表正在显示：Esc 返回到 ModelConfig 主界面
          setShowModelListManager(false)
        } else {
          // 最外层 Esc 才关闭配置界面
          onClose()
        }
      } else if (input === 'd' && !isDeleteMode) {
        setIsDeleteMode(true)
      } else if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1))
      } else if (key.downArrow) {
        setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1))
      } else if (key.return || input === ' ') {
        const setting = menuItems[selectedIndex]

        if (isDeleteMode && setting.type === 'modelPointer' && setting.value) {
          // 删除模式：清空指针分配
          setModelPointer(setting.id as ModelPointerType, '')
          setRefreshKey(prev => prev + 1)
          setIsDeleteMode(false)
        } else if (setting.type === 'modelPointer') {
          // 普通模式：循环可用模型
          if (setting.options.length === 0) {
            // 没有可用模型，跳转到模型管理
            handleManageModels()
            return
          }
          const currentIndex = setting.options.findIndex(
            opt => opt.id === setting.value,
          )
          const nextIndex = (currentIndex + 1) % setting.options.length
          const nextOption = setting.options[nextIndex]
          if (nextOption) {
            setting.onChange(nextOption.id)
          }
        } else if (setting.type === 'action') {
          // 执行操作
          setting.onChange()
        }
      }
    },
    [selectedIndex, menuItems, onClose, isDeleteMode, shouldShowQuickSetup, handleQuickSetup],
  )

  useInput(handleInput)


  // 如果检测到环境变量但没有配置模型，显示快速设置选项
  if (shouldShowQuickSetup) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="green"
        paddingX={1}
        marginTop={1}
      >
        <Box flexDirection="column" minHeight={2} marginBottom={1}>
          <Text bold color="green">🚀 检测到 API 密钥</Text>
          <Text color="gray">
            我们检测到您已经配置了 AI API 密钥，是否要自动配置模型？
          </Text>
        </Box>

        <Box flexDirection="column" marginY={1}>
          {process.env.DEEPSEEK_API_KEY && (
            <Text>✓ DeepSeek API 密钥已配置</Text>
          )}
          {process.env.ANTHROPIC_API_KEY && (
            <Text>✓ Anthropic Claude API 密钥已配置</Text>
          )}
          {process.env.OPENAI_API_KEY && (
            <Text>✓ OpenAI API 密钥已配置</Text>
          )}
          {process.env.KIMI_API_KEY && (
            <Text>✓ Kimi API 密钥已配置</Text>
          )}
        </Box>

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
          <Text color="green">
            按 Enter 自动配置模型，或按 Esc 手动配置
          </Text>
        </Box>
      </Box>
    )
  }

  // 如果显示模型管理界面
  if (showModelListManager) {
    return <ModelListManager onClose={handleModelConfigurationComplete} />
  }

  // 主配置界面
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="column" minHeight={2} marginBottom={1}>
        <Text bold>
          WriteFlow 模型配置{isDeleteMode ? ' - 清空模式' : ''}
        </Text>
        <Text color="gray">
          {isDeleteMode
            ? '按 Enter/Space 清空选中的指针分配，Esc 取消'
            : availableModels.length === 0
              ? '无可用模型。使用"管理模型库"添加第一个模型配置。'
              : '配置不同任务使用的模型。Space 循环模型，Enter 进入配置。'}
        </Text>
      </Box>

      {menuItems.map((setting, i) => {
        const isSelected = i === selectedIndex
        let displayValue = ''
        let actionText = ''

        if (setting.type === 'modelPointer') {
          const currentModel = setting.options.find(
            opt => opt.id === setting.value,
          )
          displayValue = currentModel?.name || '(未配置)'
          actionText = isSelected ? ' [Space 循环]' : ''
        } else if (setting.type === 'action') {
          displayValue = ''
          actionText = isSelected ? ' [Enter 进入]' : ''
        }

        return (
          <Box key={setting.id} flexDirection="column">
            <Box>
              <Box width={30}>
                <Text color={isSelected ? 'blue' : undefined}>
                  {isSelected ? figures.pointer : ' '} {setting.label}
                </Text>
              </Box>
              <Box>
                {setting.type === 'modelPointer' && (
                  <Text
                    color={
                      displayValue !== '(未配置)' ? 'green' : 'yellow'
                    }
                  >
                    {displayValue}
                  </Text>
                )}
                {actionText && <Text color="blue">{actionText}</Text>}
              </Box>
            </Box>
            {isSelected && (
              <Box paddingLeft={2} marginBottom={1}>
                <Text color="gray">{setting.description}</Text>
              </Box>
            )}
          </Box>
        )
      })}

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
          {isDeleteMode
            ? '清空模式：按 Enter/Space 清空分配，Esc 取消'
            : availableModels.length === 0
              ? '使用 ↑/↓ 导航，Enter 配置新模型，Esc 返回'
              : '使用 ↑/↓ 导航，Space 循环模型，Enter 配置，d 清空，Esc 返回'}
        </Text>
      </Box>
    </Box>
  )
}