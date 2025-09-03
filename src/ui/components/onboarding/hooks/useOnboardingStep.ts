import { useState, useCallback } from 'react'

export type OnboardingStepId = 'welcome' | 'theme' | 'writing-mode' | 'model-config' | 'preferences'

export interface OnboardingStepConfig {
  id: OnboardingStepId
  title: string
  canSkip: boolean
  required: boolean
}

const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'welcome',
    title: '欢迎使用 WriteFlow',
    canSkip: false,
    required: true,
  },
  {
    id: 'theme',
    title: '选择主题',
    canSkip: true,
    required: false,
  },
  {
    id: 'writing-mode', 
    title: '了解写作模式',
    canSkip: true,
    required: false,
  },
  {
    id: 'model-config',
    title: '配置 AI 模型',
    canSkip: false,
    required: true,
  },
  {
    id: 'preferences',
    title: '写作偏好设置',
    canSkip: true,
    required: false,
  },
]

export function useOnboardingStep() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  
  const currentStep = ONBOARDING_STEPS[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1
  
  const goToNextStep = useCallback(() => {
    if (!isLastStep) {
      setCurrentStepIndex(prev => prev + 1)
    }
  }, [isLastStep])
  
  const goToPreviousStep = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1)
    }
  }, [isFirstStep])
  
  const goToStep = useCallback((stepId: OnboardingStepId) => {
    const stepIndex = ONBOARDING_STEPS.findIndex(step => step.id === stepId)
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex)
    }
  }, [])

  const skipToEnd = useCallback(() => {
    setCurrentStepIndex(ONBOARDING_STEPS.length - 1)
  }, [])

  return {
    currentStep,
    currentStepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    isFirstStep,
    isLastStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    skipToEnd,
    allSteps: ONBOARDING_STEPS,
  }
}