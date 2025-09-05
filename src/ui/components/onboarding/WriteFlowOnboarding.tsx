import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useOnboardingStep } from './hooks/useOnboardingStep.js'
import { useExitHandler } from './hooks/useExitHandler.js'
import { StepContainer } from './components/StepContainer.js'
import { WelcomeStep } from './WelcomeStep.js'
import { ThemeSelectionStep } from './ThemeSelectionStep.js'
import { WritingModeStep } from './WritingModeStep.js'
import { ModelConfigStep } from './ModelConfigStep.js'
import { PreferencesStep } from './PreferencesStep.js'
import { getGlobalConfig, saveGlobalConfig, WritingPreferences } from '../../../utils/config.js'
import { ThemeNames, getRecommendedTheme } from '../../../utils/theme.js'

interface WriteFlowOnboardingProps {
  onComplete: () => void
  onExit?: () => void
}

export function WriteFlowOnboarding({ 
  onComplete, 
  onExit 
}: WriteFlowOnboardingProps): React.ReactElement {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    isLastStep,
    goToNextStep,
  } = useOnboardingStep()

  const [selectedTheme, setSelectedTheme] = useState<ThemeNames>(getRecommendedTheme())
  const [writingPreferences, setWritingPreferences] = useState<WritingPreferences>({
    defaultLanguage: 'zh-CN',
    writingStyle: 'friendly',
    showWritingTips: true,
    preferredWritingMode: 'mixed',
  })
  
  const handleExit = useCallback(() => {
    if (onExit) {
      onExit()
    } else {
      process.exit(0)
    }
  }, [onExit])

  const exitState = useExitHandler(handleExit)

  const handleThemeSelect = useCallback((theme: ThemeNames) => {
    // 保存主题设置
    const config = getGlobalConfig()
    saveGlobalConfig({
      ...config,
      theme,
    })
    setSelectedTheme(theme)
    goToNextStep()
  }, [goToNextStep])

  const handleThemePreview = useCallback((theme: ThemeNames) => {
    // 仅用于预览，不保存
    setSelectedTheme(theme)
  }, [])

  const handlePreferencesComplete = useCallback((preferences: WritingPreferences) => {
    try {
      // 保存写作偏好设置
      const config = getGlobalConfig()
      
      // 检查是否真正完成了所有必要的配置
      const hasModels = config.modelProfiles && config.modelProfiles.length > 0
      const hasMainModel = config.modelPointers && config.modelPointers.main && config.modelPointers.main.trim() !== ''
      const isFullyConfigured = hasModels && hasMainModel
      
      if (!isFullyConfigured) {
        console.error('配置不完整：缺少模型配置或主模型指针')
        return
      }
      
      saveGlobalConfig({
        ...config,
        writingPreferences: preferences,
        hasCompletedOnboarding: true,
      })
      
      setWritingPreferences(preferences)
      onComplete()
    } catch (error) {
      console.error('保存配置时出错:', error)
    }
  }, [onComplete])

  // 处理通用的 Enter 键导航
  useInput((input, key) => {
    if (key.return) {
      if (currentStep.id === 'welcome' || currentStep.id === 'writing-mode') {
        if (isLastStep) {
          // 检查是否真正完成了所有必要的配置才标记引导完成
          try {
            const config = getGlobalConfig()
            const hasModels = config.modelProfiles && config.modelProfiles.length > 0
            const hasMainModel = config.modelPointers && config.modelPointers.main && config.modelPointers.main.trim() !== ''
            const isFullyConfigured = hasModels && hasMainModel
            
            if (!isFullyConfigured) {
              console.error('配置不完整：请先完成模型配置步骤')
              return
            }
            
            saveGlobalConfig({
              ...config,
              hasCompletedOnboarding: true,
            })
            onComplete()
          } catch (error) {
            console.error('保存引导完成状态时出错:', error)
          }
        } else {
          goToNextStep()
        }
      }
      // theme 步骤由 ThemeSelectionStep 内部处理
      // model-config 步骤由 ModelConfigStep 内部处理
      // preferences 步骤由 PreferencesStep 内部处理
    }
  })

  const renderCurrentStep = () => {
    switch (currentStep.id) {
      case 'welcome':
        return <WelcomeStep />
      
      case 'theme':
        return (
          <ThemeSelectionStep
            onThemeSelect={handleThemeSelect}
            onPreviewTheme={handleThemePreview}
            defaultTheme={selectedTheme}
          />
        )
      
      case 'writing-mode':
        return <WritingModeStep />
      
      case 'model-config':
        return (
          <ModelConfigStep 
            onComplete={goToNextStep}
            onSkip={goToNextStep}
          />
        )
      
      case 'preferences':
        return (
          <PreferencesStep
            onComplete={handlePreferencesComplete}
            defaultPreferences={writingPreferences}
          />
        )
      
      default:
        return <WelcomeStep />
    }
  }

  // 防御性检查
  if (!currentStep) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="red">错误：无效的步骤索引 {currentStepIndex}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <StepContainer
        title={currentStep.title}
        stepNumber={currentStepIndex + 1}
        totalSteps={totalSteps}
        exitState={exitState}
      >
        {renderCurrentStep()}
      </StepContainer>
    </Box>
  )
}