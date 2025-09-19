import { Box, Text, useInput } from 'ink'
import * as React from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import figures from 'figures'
import { getTheme } from '../../utils/theme.js'
import {
  getGlobalConfig,
  saveGlobalConfig,
  ModelPointerType,
  setModelPointer,
} from '../../utils/config.js'
import { getModelManager } from '../../services/models/ModelManager.js'
import { ModelSelector } from './ModelSelector.js'
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
  const theme = getTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [showModelListManager, setShowModelListManager] = useState(false)
  const [currentPointer, setCurrentPointer] = useState<ModelPointerType | null>(
    null,
  )
  const [refreshKey, setRefreshKey] = useState(0) // 添加刷新键来强制更新
  const [isDeleteMode, setIsDeleteMode] = useState(false) // 保留用于清空指针的删除模式
  const selectedIndexRef = useRef(selectedIndex) // 用ref保持焦点状态

  const modelManager = getModelManager()

  // 同步 selectedIndex 到 ref
  useEffect(() => {
    selectedIndexRef.current = selectedIndex
  }, [selectedIndex])

  // Get available models for cycling (memoized) - without "Add New Model" option
  const availableModels = React.useMemo((): Array<{
    id: string
    name: string
  }> => {
    try {
      const profiles = modelManager.getAllProfiles()
      return profiles.filter(p => p.isActive).map(p => ({ 
        id: p.modelName, 
        name: p.name || p.modelName 
      }))
    } catch (_error) {
      console._error('获取模型列表失败:', _error)
      return []
    }
  }, [modelManager, refreshKey]) // 依赖refreshKey来强制更新

  // 创建菜单项：模型指针 + 管理操作
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
        onChange: (value: string) =>
          handleModelPointerChange('reasoning', value),
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

    // 添加管理操作项
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
    // Direct model assignment
    setModelPointer(pointer, modelId)
    // Force re-render to show updated assignment
    setRefreshKey(prev => prev + 1)
  }

  const handleManageModels = () => {
    // Launch ModelListManager for model library management
    setShowModelListManager(true)
  }

  const handleModelConfigurationComplete = () => {
    // Model configuration is complete, return to model config screen
    setShowModelSelector(false)
    setShowModelListManager(false)
    setCurrentPointer(null)
    // 触发组件刷新，重新加载可用模型列表
    setRefreshKey(prev => prev + 1)
    // 将焦点重置到 "Manage Model Library" 选项
    const manageIndex = menuItems.findIndex(item => item.id === 'manage-models')
    if (manageIndex !== -1) {
      setSelectedIndex(manageIndex)
    }
  }

  // Handle keyboard input - completely following Config component pattern
  const handleInput = useCallback(
    (input: string, key: any) => {
      if (key.escape) {
        if (isDeleteMode) {
          setIsDeleteMode(false) // Exit delete mode
        } else {
          onClose()
        }
      } else if (input === 'd' && !isDeleteMode) {
        setIsDeleteMode(true) // Enter delete mode
      } else if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1))
      } else if (key.downArrow) {
        setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1))
      } else if (key.return || input === ' ') {
        const setting = menuItems[selectedIndex]

        if (isDeleteMode && setting.type === 'modelPointer' && setting.value) {
          // Delete mode: clear the pointer assignment (not delete the model config)
          setModelPointer(setting.id as ModelPointerType, '')
          setRefreshKey(prev => prev + 1)
          setIsDeleteMode(false) // Exit delete mode after clearing assignment
        } else if (setting.type === 'modelPointer') {
          // Normal mode: cycle through available models
          if (setting.options.length === 0) {
            // No models available, redirect to model library management
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
          // Execute action (like "Add New Model")
          setting.onChange()
        }
      }
    },
    [selectedIndex, menuItems, onClose, isDeleteMode, modelManager],
  )

  useInput(handleInput)

  // If showing ModelListManager, render it directly
  if (showModelListManager) {
    return <ModelListManager onClose={handleModelConfigurationComplete} />
  }

  // If showing ModelSelector, render it directly
  if (showModelSelector) {
    return (
      <ModelSelector
        onDone={handleModelConfigurationComplete}
        onCancel={handleModelConfigurationComplete} // Same as onDone - return to ModelConfig
        skipModelType={true}
        targetPointer={currentPointer || undefined}
        isOnboarding={false}
        abortController={new AbortController()}
      />
    )
  }

  // Main configuration screen - completely following Config component layout
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.secondaryBorder}
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="column" minHeight={2} marginBottom={1}>
        <Text bold>
          WriteFlow 模型配置{isDeleteMode ? ' - 清空模式' : ''}
        </Text>
        <Text dimColor>
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
              <Box width={44}>
                <Text color={isSelected ? 'blue' : undefined}>
                  {isSelected ? figures.pointer : ' '} {setting.label}
                </Text>
              </Box>
              <Box>
                {setting.type === 'modelPointer' && (
                  <Text
                    color={
                      displayValue !== '(未配置)'
                        ? theme.success
                        : theme.warning
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
                <Text dimColor>{setting.description}</Text>
              </Box>
            )}
          </Box>
        )
      })}

      <Box
        marginTop={1}
        paddingTop={1}
        borderColor={theme.secondaryBorder}
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop={true}
      >
        <Text dimColor>
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