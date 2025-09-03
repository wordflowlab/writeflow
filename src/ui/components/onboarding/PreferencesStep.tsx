import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { getTheme } from '../../../utils/theme.js'
import { WritingPreferences } from '../../../utils/config.js'

interface PreferencesStepProps {
  onComplete: (preferences: WritingPreferences) => void
  defaultPreferences: WritingPreferences
}

interface Option {
  label: string
  value: string
  description: string
}

const LANGUAGE_OPTIONS: Option[] = [
  { label: '中文', value: 'zh-CN', description: '主要使用中文进行写作' },
  { label: 'English', value: 'en-US', description: 'Primary writing in English' },
  { label: '自动检测', value: 'auto', description: '根据内容自动选择语言' },
]

const STYLE_OPTIONS: Option[] = [
  { label: '友好风格', value: 'friendly', description: '轻松自然的表达方式' },
  { label: '正式风格', value: 'formal', description: '专业严谨的商务风格' },
  { label: '学术风格', value: 'academic', description: '严谨的学术研究风格' },
  { label: '创意风格', value: 'creative', description: '富有创意和想象力' },
]

const WRITING_MODE_OPTIONS: Option[] = [
  { label: '综合模式', value: 'mixed', description: '支持各种写作场景' },
  { label: '技术文档', value: 'technical', description: '专注技术内容写作' },
  { label: '学术写作', value: 'academic', description: '专注学术论文写作' },
  { label: '创意写作', value: 'creative', description: '专注创意内容写作' },
]

type StepType = 'language' | 'style' | 'mode' | 'tips'

export function PreferencesStep({ 
  onComplete, 
  defaultPreferences 
}: PreferencesStepProps): React.ReactElement {
  const theme = getTheme()
  const [currentStep, setCurrentStep] = useState<StepType>('language')
  const [preferences, setPreferences] = useState<WritingPreferences>(defaultPreferences)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const getCurrentOptions = (): Option[] => {
    switch (currentStep) {
      case 'language':
        return LANGUAGE_OPTIONS
      case 'style':
        return STYLE_OPTIONS
      case 'mode':
        return WRITING_MODE_OPTIONS
      case 'tips':
        return [
          { label: '是', value: 'true', description: '显示写作提示和建议' },
          { label: '否', value: 'false', description: '只显示核心功能' },
        ]
      default:
        return []
    }
  }

  const getCurrentTitle = (): string => {
    switch (currentStep) {
      case 'language':
        return '选择默认写作语言'
      case 'style':
        return '选择写作风格'
      case 'mode':
        return '选择写作模式'
      case 'tips':
        return '是否显示写作提示'
      default:
        return ''
    }
  }

  const goToNextStep = () => {
    const steps: StepType[] = ['language', 'style', 'mode', 'tips']
    const currentIndex = steps.indexOf(currentStep)
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1])
      setSelectedIndex(0)
    } else {
      onComplete(preferences)
    }
  }

  const updatePreference = (value: string) => {
    const newPreferences = { ...preferences }
    
    switch (currentStep) {
      case 'language':
        newPreferences.defaultLanguage = value as WritingPreferences['defaultLanguage']
        break
      case 'style':
        newPreferences.writingStyle = value as WritingPreferences['writingStyle']
        break
      case 'mode':
        newPreferences.preferredWritingMode = value as WritingPreferences['preferredWritingMode']
        break
      case 'tips':
        newPreferences.showWritingTips = value === 'true'
        break
    }
    
    setPreferences(newPreferences)
    goToNextStep()
  }

  useInput((input, key) => {
    const options = getCurrentOptions()
    
    if (key.upArrow) {
      setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : options.length - 1)
    } else if (key.downArrow) {
      setSelectedIndex(selectedIndex < options.length - 1 ? selectedIndex + 1 : 0)
    } else if (key.return) {
      updatePreference(options[selectedIndex].value)
    }
  })

  const options = getCurrentOptions()

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Box flexDirection="column">
        <Text bold>{getCurrentTitle()}：</Text>
        <Text color={theme.secondaryText}>
          使用 ↑↓ 箭头键选择，按 Enter 确认
        </Text>
      </Box>

      {/* 选项列表 */}
      <Box flexDirection="column" marginTop={1} gap={1}>
        {options.map((option, index) => (
          <Box key={option.value} flexDirection="row" alignItems="center">
            <Text color={index === selectedIndex ? theme.claude : theme.secondaryText}>
              {index === selectedIndex ? '●' : '○'} 
            </Text>
            <Box marginLeft={1} flexDirection="column">
              <Text 
                bold={index === selectedIndex}
                color={index === selectedIndex ? theme.text : theme.secondaryText}
              >
                {option.label}
              </Text>
              <Text color={theme.secondaryText}>
                {option.description}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* 当前配置预览 */}
      {currentStep !== 'language' && (
        <Box 
          marginTop={2}
          borderStyle="single"
          borderColor={theme.secondaryBorder}
          paddingX={2}
          paddingY={1}
        >
          <Box flexDirection="column" gap={1}>
            <Text bold color={theme.text}>当前配置：</Text>
            <Text color={theme.secondaryText}>
              语言: {LANGUAGE_OPTIONS.find(o => o.value === preferences.defaultLanguage)?.label}
            </Text>
            {currentStep !== 'style' && (
              <Text color={theme.secondaryText}>
                风格: {STYLE_OPTIONS.find(o => o.value === preferences.writingStyle)?.label}
              </Text>
            )}
            {currentStep === 'tips' && (
              <Text color={theme.secondaryText}>
                模式: {WRITING_MODE_OPTIONS.find(o => o.value === preferences.preferredWritingMode)?.label}
              </Text>
            )}
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text color={theme.secondaryText} italic>
          这些设置可以随时通过 /config 命令修改
        </Text>
      </Box>
    </Box>
  )
}