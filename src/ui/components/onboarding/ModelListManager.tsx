import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import figures from 'figures'
import { getModelManager } from '../../../services/models/ModelManager.js'
import { getGlobalConfig, setModelPointer, ModelProfile } from '../../../utils/config.js'
import { getProviderDisplayName } from '../../../constants/providers.js'

interface ModelListManagerProps {
  onBack: () => void
  onComplete?: () => void
  showBackOption?: boolean
}

type ViewMode = 'list' | 'details' | 'delete-confirm' | 'set-pointer'
type PointerType = 'main' | 'task' | 'reasoning' | 'quick'

type ListOption = 
  | { type: 'model'; label: string; model: ModelProfile }
  | { type: 'separator'; label: string }
  | { type: 'action'; label: string; action: string }

type PointerOption = 
  | { type: 'pointer'; label: string; pointer: PointerType }
  | { type: 'separator'; label: string }
  | { type: 'action'; label: string; action: string }

type ModelSelectOption = 
  | { type: 'model-select'; label: string; model: ModelProfile }
  | { type: 'separator'; label: string }
  | { type: 'action'; label: string; action: string }

export function ModelListManager({ onBack, onComplete, showBackOption = true }: ModelListManagerProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedModel, setSelectedModel] = useState<ModelProfile | null>(null)
  const [selectedPointerType, setSelectedPointerType] = useState<PointerType>('main')
  const [refreshKey, setRefreshKey] = useState(0)

  const config = getGlobalConfig()
  const modelManager = getModelManager()

  // 获取所有模型配置
  const models = useMemo(() => {
    return modelManager.getActiveProfiles()
  }, [modelManager, refreshKey])

  // 获取当前模型指针
  const modelPointers = useMemo(() => {
    return config.modelPointers || {}
  }, [config.modelPointers])

  // 获取列表选项
  const getListOptions = useCallback((): ListOption[] => {
    const options: ListOption[] = []
    
    // 添加模型列表
    models.forEach(model => {
      const pointers = []
      if (modelPointers.main === model.name) pointers.push('主')
      if (modelPointers.task === model.name) pointers.push('任务')
      if (modelPointers.reasoning === model.name) pointers.push('推理')
      if (modelPointers.quick === model.name) pointers.push('快速')
      
      const pointerText = pointers.length > 0 ? ` [${pointers.join(',')}]` : ''
      options.push({
        type: 'model' as const,
        label: `${model.name}${pointerText}`,
        model: model,
      })
    })
    
    // 添加操作选项
    if (models.length > 0) {
      options.push({ type: 'separator' as const, label: '' })
      options.push({ type: 'action' as const, label: '📋 设置模型指针', action: 'set-pointer' })
    }
    
    if (showBackOption) {
      options.push({ type: 'action' as const, label: '← 返回', action: 'back' })
    }
    
    if (onComplete) {
      options.push({ type: 'action' as const, label: '✅ 完成配置', action: 'complete' })
    }
    
    return options
  }, [models, modelPointers, showBackOption, onComplete])

  // 获取指针设置选项
  const getPointerOptions = useCallback((): PointerOption[] => {
    const options: PointerOption[] = [
      { type: 'pointer' as const, label: `主模型 (当前: ${modelPointers.main || '未设置'})`, pointer: 'main' as PointerType },
      { type: 'pointer' as const, label: `任务模型 (当前: ${modelPointers.task || '未设置'})`, pointer: 'task' as PointerType },
      { type: 'pointer' as const, label: `推理模型 (当前: ${modelPointers.reasoning || '未设置'})`, pointer: 'reasoning' as PointerType },
      { type: 'pointer' as const, label: `快速模型 (当前: ${modelPointers.quick || '未设置'})`, pointer: 'quick' as PointerType },
      { type: 'separator' as const, label: '' },
      { type: 'action' as const, label: '← 返回', action: 'back' },
    ]
    
    return options
  }, [modelPointers])

  // 获取模型选择选项（为指针设置）
  const getModelSelectionOptions = useCallback((): ModelSelectOption[] => {
    const options: ModelSelectOption[] = models.map(model => ({
      type: 'model-select' as const,
      label: model.name,
      model: model,
    }))
    
    options.push({ type: 'separator' as const, label: '' })
    options.push({ type: 'action' as const, label: '🗑️ 清除此指针', action: 'clear-pointer' })
    options.push({ type: 'action' as const, label: '← 返回', action: 'back' })
    
    return options
  }, [models])

  // 获取当前选项列表
  const getCurrentOptions = useCallback(() => {
    if (viewMode === 'set-pointer') {
      if (selectedPointerType) {
        return getModelSelectionOptions()
      }
      return getPointerOptions()
    }
    return getListOptions()
  }, [viewMode, selectedPointerType, getListOptions, getPointerOptions, getModelSelectionOptions])

  // 处理删除模型
  const handleDeleteModel = useCallback((model: ModelProfile) => {
    try {
      modelManager.removeModelProfile(model.name)
      setRefreshKey(prev => prev + 1)
      setViewMode('list')
      setSelectedIndex(0)
    } catch (error) {
      console.error('删除模型失败:', error)
    }
  }, [modelManager])

  // 处理设置模型指针
  const handleSetModelPointer = useCallback((pointerType: PointerType, modelName: string | null) => {
    try {
      if (modelName) {
        setModelPointer(pointerType, modelName)
      } else {
        // 清除指针
        const newPointers = { ...modelPointers }
        delete newPointers[pointerType]
        // 这里需要一个清除指针的功能，暂时使用设置为空字符串
        setModelPointer(pointerType, '')
      }
      setRefreshKey(prev => prev + 1)
      setViewMode('list')
      setSelectedIndex(0)
    } catch (error) {
      console.error('设置模型指针失败:', error)
    }
  }, [modelPointers])

  // 处理键盘输入
  const handleInput = useCallback(
    (input: string, key: any) => {
      const options = getCurrentOptions()
      
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1))
      } else if (key.downArrow) {
        setSelectedIndex(prev => Math.min(options.length - 1, prev + 1))
      } else if (key.return) {
        const selectedOption = options[selectedIndex]
        
        if (!selectedOption || selectedOption.type === 'separator') {
          return
        }
        
        if (selectedOption.type === 'action') {
          switch (selectedOption.action) {
            case 'back':
              if (viewMode === 'set-pointer') {
                setViewMode('list')
                setSelectedIndex(0)
              } else {
                onBack()
              }
              break
            case 'complete':
              onComplete?.()
              break
            case 'set-pointer':
              setViewMode('set-pointer')
              setSelectedIndex(0)
              break
            case 'clear-pointer':
              handleSetModelPointer(selectedPointerType, null)
              break
          }
        } else if (selectedOption.type === 'model') {
          setSelectedModel(selectedOption.model)
          setViewMode('details')
          setSelectedIndex(0)
        } else if (selectedOption.type === 'pointer') {
          setSelectedPointerType(selectedOption.pointer)
          // 直接进入模型选择模式
          setSelectedIndex(0)
        } else if (selectedOption.type === 'model-select') {
          handleSetModelPointer(selectedPointerType, selectedOption.model.name)
        }
      } else if (key.escape) {
        if (viewMode === 'details' || viewMode === 'delete-confirm') {
          setViewMode('list')
          setSelectedIndex(0)
        } else if (viewMode === 'set-pointer') {
          setViewMode('list')
          setSelectedIndex(0)
        } else {
          onBack()
        }
      } else if (key.delete && viewMode === 'list') {
        const selectedOption = options[selectedIndex]
        if (selectedOption && selectedOption.type === 'model') {
          setSelectedModel(selectedOption.model)
          setViewMode('delete-confirm')
          setSelectedIndex(0)
        }
      }
    },
    [
      selectedIndex,
      viewMode,
      selectedPointerType,
      getCurrentOptions,
      onBack,
      onComplete,
      handleSetModelPointer,
    ]
  )

  useInput(handleInput)

  // 渲染模型详情
  if (viewMode === 'details' && selectedModel) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="blue">📋 模型详情</Text>
        </Box>
        
        <Box flexDirection="column" paddingLeft={2} gap={1}>
          <Text>
            <Text color="gray">名称: </Text>
            <Text color="white">{selectedModel.name}</Text>
          </Text>
          <Text>
            <Text color="gray">提供商: </Text>
            <Text color="white">{getProviderDisplayName(selectedModel.provider as any)}</Text>
          </Text>
          <Text>
            <Text color="gray">模型: </Text>
            <Text color="white">{selectedModel.modelName}</Text>
          </Text>
          <Text>
            <Text color="gray">最大输出: </Text>
            <Text color="white">{selectedModel.maxTokens} tokens</Text>
          </Text>
          <Text>
            <Text color="gray">上下文长度: </Text>
            <Text color="white">{selectedModel.contextLength} tokens</Text>
          </Text>
          <Text>
            <Text color="gray">创建时间: </Text>
            <Text color="white">{new Date(selectedModel.createdAt || Date.now()).toLocaleString()}</Text>
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">
            按 Esc 返回列表，Delete 删除模型
          </Text>
        </Box>
      </Box>
    )
  }

  // 渲染删除确认
  if (viewMode === 'delete-confirm' && selectedModel) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="red">⚠️  确认删除</Text>
        </Box>
        
        <Box marginY={1}>
          <Text color="gray">
            确定要删除模型 <Text color="white">{selectedModel.name}</Text> 吗？
          </Text>
        </Box>

        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text color={selectedIndex === 0 ? 'red' : 'white'}>
              {selectedIndex === 0 ? figures.pointer : ' '} 确认删除
            </Text>
          </Box>
          <Box>
            <Text color={selectedIndex === 1 ? 'blue' : 'white'}>
              {selectedIndex === 1 ? figures.pointer : ' '} 取消
            </Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">
            使用 ↑/↓ 选择，Enter 确认，Esc 取消
          </Text>
        </Box>
      </Box>
    )
  }

  // 渲染指针设置模式
  if (viewMode === 'set-pointer') {
    const options = getCurrentOptions()
    const isSelectingModel = selectedPointerType && options.some(opt => opt.type === 'model-select')
    
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="blue">
            {isSelectingModel ? `📌 设置${selectedPointerType}模型` : '📌 设置模型指针'}
          </Text>
        </Box>
        
        <Box marginY={1}>
          <Text color="gray">
            {isSelectingModel 
              ? `选择要设置为${selectedPointerType}模型的配置：`
              : '模型指针允许您为不同用途指定专用模型：'
            }
          </Text>
        </Box>

        <Box flexDirection="column" paddingLeft={2}>
          {options.map((option, index) => {
            if (option.type === 'separator') {
              return <Box key={index} height={1} />
            }
            
            return (
              <Box key={index}>
                <Text color={selectedIndex === index ? 'blue' : 'white'}>
                  {selectedIndex === index ? figures.pointer : ' '} {option.label}
                </Text>
              </Box>
            )
          })}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">
            使用 ↑/↓ 选择，Enter 确认，Esc 返回
          </Text>
        </Box>
      </Box>
    )
  }

  // 主列表界面
  const options = getListOptions()
  
  if (models.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color="yellow">⚠️  没有配置的模型</Text>
        </Box>
        
        <Box marginY={1}>
          <Text color="gray">
            您还没有配置任何 AI 模型。请先添加模型配置。
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">
            {showBackOption ? '按 Esc 或 Enter 返回' : '按 Esc 退出'}
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text color="green">🤖 模型管理</Text>
      </Box>
      
      <Box marginY={1}>
        <Text color="gray">
          当前已配置 {models.length} 个模型：
        </Text>
      </Box>

      <Box flexDirection="column" paddingLeft={2}>
        {options.map((option, index) => {
          if (option.type === 'separator') {
            return <Box key={index} height={1} />
          }
          
          return (
            <Box key={index}>
              <Text color={selectedIndex === index ? 'blue' : 'white'}>
                {selectedIndex === index ? figures.pointer : ' '} {option.label}
              </Text>
            </Box>
          )
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          使用 ↑/↓ 选择，Enter 查看详情，Delete 删除模型，Esc 返回
        </Text>
      </Box>
    </Box>
  )
}