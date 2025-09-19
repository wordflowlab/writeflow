import { Box, Text, useInput } from 'ink'
import * as React from 'react'
import { useState, useCallback } from 'react'
import figures from 'figures'
import { getTheme } from '../../utils/theme.js'
import { getGlobalConfig, ModelPointerType } from '../../utils/config.js'
import { getModelManager } from '../../services/models/ModelManager.js'
import { ModelSelector } from './ModelSelector.js'
import { ModelEditor } from './ModelEditor.js'

type Props = {
  onClose: () => void
}

export function ModelListManager({ onClose }: Props): React.ReactNode {
  const config = getGlobalConfig()
  const theme = getTheme()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingProfile, setEditingProfile] = useState<any | null>(null)

  const modelManager = getModelManager()
  const availableModels = modelManager.getAllProfiles().filter(p => p.isActive)

  // Create menu items: existing models + "Add New Model"
  const menuItems = React.useMemo(() => {
    const modelItems = availableModels.map(model => ({
      id: model.modelName,
      name: model.name,
      provider: model.provider,
      usedBy: getModelUsage(model.modelName),
      type: 'model' as const,
    }))

    return [
      ...modelItems,
      {
        id: 'add-new',
        name: '+ 添加新模型',
        provider: '',
        usedBy: [],
        type: 'action' as const,
      },
    ]
  }, [availableModels, config.modelPointers, refreshKey])

  // Check which pointers are using this model
  function getModelUsage(modelName: string): ModelPointerType[] {
    const usage: ModelPointerType[] = []
    const pointers: ModelPointerType[] = ['main', 'task', 'reasoning', 'quick']

    pointers.forEach(pointer => {
      if (config.modelPointers?.[pointer] === modelName) {
        usage.push(pointer)
      }
    })

    return usage
  }

  const handleDeleteModel = (modelName: string) => {
    // 通过将模型标记为非活跃来"删除"模型
    const profiles = modelManager.getAllProfiles()
    const modelToDelete = profiles.find(p => p.modelName === modelName)
    if (modelToDelete) {
      modelToDelete.isActive = false
      modelManager.updateModelProfile(modelToDelete)
    }

    // 清理指向该模型的指针
    const pointers: ModelPointerType[] = ['main', 'task', 'reasoning', 'quick']
    pointers.forEach(pointer => {
      if (config.modelPointers?.[pointer] === modelName) {
        // 这里需要使用 setModelPointer 函数
        const { setModelPointer } = require('../../utils/config.js')
        setModelPointer(pointer, '')
      }
    })

    setRefreshKey(prev => prev + 1)
    setIsDeleteMode(false)
  }

  const handleAddNewModel = () => {
    setShowModelSelector(true)
  }

  const handleModelConfigurationComplete = () => {
    setShowModelSelector(false)
    setRefreshKey(prev => prev + 1)
  }

  // Handle keyboard input
  const handleInput = useCallback(
    (input: string, key: any) => {
      if (key.escape) {
        if (isDeleteMode) {
          setIsDeleteMode(false)
        } else if (showModelSelector) {
          // 从添加新模型返回列表
          setShowModelSelector(false)
        } else {
          onClose()
        }
      } else if (input === 'd' && !isDeleteMode && availableModels.length > 1) {
        setIsDeleteMode(true)
      } else if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1))
      } else if (key.downArrow) {
        setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1))
      } else if (key.return || input === ' ') {
        const item = menuItems[selectedIndex]

        if (isDeleteMode && item.type === 'model') {
          // Prevent deleting the last model
          if (availableModels.length <= 1) {
            setIsDeleteMode(false) // Exit delete mode
            return
          }
          handleDeleteModel(item.id)
        } else if (item.type === 'model') {
          // 打开编辑器，允许设置/更新 API string 和 Base URL
          const profile = availableModels.find(p => p.modelName === item.id)
          if (profile) setEditingProfile(profile)
        } else if (item.type === 'action') {
          handleAddNewModel()
        }
      }
    },
    [selectedIndex, menuItems, onClose, isDeleteMode, availableModels.length],
  )

  useInput(handleInput)

  // 编辑器界面（优先于其它界面渲染）
  if (editingProfile) {
    return (
      <ModelEditor
        profile={editingProfile}
        onClose={() => {
          setEditingProfile(null)
          setRefreshKey(prev => prev + 1)
        }}
      />
    )
  }

  // If showing ModelSelector, render it directly
  if (showModelSelector) {
    return (
      <ModelSelector
        onDone={handleModelConfigurationComplete}
        onCancel={handleModelConfigurationComplete}
        skipModelType={true}
        isOnboarding={false}
        abortController={new AbortController()}
      />
    )
  }

  // Main model list screen
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isDeleteMode ? 'red' : 'gray'}
      paddingX={1}
      marginTop={1}
    >
      <Box flexDirection="column" minHeight={2} marginBottom={1}>
        <Text bold color={isDeleteMode ? 'red' : undefined}>
          管理模型库{isDeleteMode ? ' - 删除模式' : ''}
        </Text>
        <Text color="gray">
          {isDeleteMode
            ? availableModels.length <= 1
              ? '无法删除最后一个模型，按 Esc 取消'
              : '按 Enter/Space 删除选中的模型，Esc 取消'
            : '导航: ↑↓ | 选择: Enter | 删除: d | 退出: Esc'}
        </Text>
      </Box>

      {menuItems.map((item, i) => {
        const isSelected = i === selectedIndex

        return (
          <Box key={item.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Box width={50}>
                <Text
                  color={
                    isSelected ? (isDeleteMode ? 'red' : 'blue') : undefined
                  }
                >
                  {isSelected ? figures.pointer : ' '} {item.name}
                </Text>
              </Box>
              <Box>
                {item.type === 'model' && (
                  <>
                    <Text color="gray">({item.provider})</Text>
                    {item.usedBy.length > 0 && (
                      <Box marginLeft={1}>
                        <Text color="green">
                          [正在使用: {item.usedBy.join(', ')}]
                        </Text>
                      </Box>
                    )}
                    {item.usedBy.length === 0 && (
                      <Box marginLeft={1}>
                        <Text color="gray">
                          [可用]
                        </Text>
                      </Box>
                    )}
                  </>
                )}
                {item.type === 'action' && (
                  <Text color="cyan">
                    {isSelected ? '[按 Enter 添加新模型]' : ''}
                  </Text>
                )}
              </Box>
            </Box>
            {isSelected && item.type === 'action' && (
              <Box paddingLeft={2} marginTop={1}>
                <Text color="gray">
                  配置一个新的 AI 模型并添加到您的模型库
                </Text>
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
            ? availableModels.length <= 1
              ? '无法删除最后一个模型 - 按 Esc 取消'
              : '删除模式: 按 Enter/Space 删除模型, Esc 取消'
            : availableModels.length <= 1
              ? '使用 ↑/↓ 导航, Enter 添加新模型, Esc 退出 (无法删除最后一个模型)'
              : '使用 ↑/↓ 导航, d 删除模型, Enter 添加新模型, Esc 退出'}
        </Text>
      </Box>
    </Box>
  )
}