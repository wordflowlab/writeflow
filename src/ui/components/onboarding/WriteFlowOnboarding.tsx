import React, { useState, useCallback } from 'react'
import { Box, useInput } from 'ink'
import { useOnboardingStep } from './hooks/useOnboardingStep.js'
import { useExitHandler } from './hooks/useExitHandler.js'
import { StepContainer } from './components/StepContainer.js'
import { WelcomeStep } from './WelcomeStep.js'
import { ThemeSelectionStep } from './ThemeSelectionStep.js'
import { WritingModeStep } from './WritingModeStep.js'
import { PreferencesStep } from './PreferencesStep.js'
import { getGlobalConfig, saveGlobalConfig, WritingPreferences } from '../../../utils/config.js'
import { ThemeNames } from '../../../utils/theme.js'

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

  const [selectedTheme, setSelectedTheme] = useState<ThemeNames>('dark')
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
    // 保存写作偏好设置
    const config = getGlobalConfig()
    saveGlobalConfig({
      ...config,
      writingPreferences: preferences,
      hasCompletedOnboarding: true,
    })
    setWritingPreferences(preferences)
    onComplete()
  }, [onComplete])

  // 处理通用的 Enter 键导航
  useInput((input, key) => {
    if (key.return) {
      if (currentStep.id === 'welcome' || currentStep.id === 'writing-mode') {
        if (isLastStep) {
          // 标记引导完成并退出
          const config = getGlobalConfig()
          saveGlobalConfig({
            ...config,
            hasCompletedOnboarding: true,
          })
          onComplete()
        } else {
          goToNextStep()
        }
      }
      // theme 步骤由 ThemeSelectionStep 内部处理
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
        // TODO: 实现模型配置步骤
        return (
          <Box flexDirection="column" gap={1}>
            <Box>TODO: 模型配置步骤</Box>
            <Box>按 Enter 继续...</Box>
          </Box>
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