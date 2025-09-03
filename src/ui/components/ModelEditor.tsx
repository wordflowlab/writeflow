import { Box, Text, useInput } from 'ink'
import React, { useState, useCallback } from 'react'
import TextInput from './TextInput.js'
import { getTheme } from '../../utils/theme.js'
import { getModelManager } from '../../services/models/ModelManager.js'
import type { ModelProfile } from '../../utils/config.js'

interface Props {
  profile: ModelProfile
  onClose: () => void
}

/**
 * 轻量模型编辑器：支持更新 API Key 与可选 Base URL
 * - Enter 提交当前字段
 * - Esc 关闭
 */
export function ModelEditor({ profile, onClose }: Props): React.ReactNode {
  const theme = getTheme()
  const manager = getModelManager()

  const [apiKey, setApiKey] = useState<string>(profile.apiKey || '')
  const [baseURL, setBaseURL] = useState<string>(profile.baseURL || '')
  const [cursor1, setCursor1] = useState<number>(apiKey.length)
  const [cursor2, setCursor2] = useState<number>(baseURL.length)
  const [step, setStep] = useState<'apikey' | 'baseurl' | 'confirm'>('apikey')
  const [message, setMessage] = useState<string>('')

  const handleSubmitApiKey = useCallback((value: string) => {
    setApiKey(value)
    setStep('baseurl')
  }, [])

  const handleSubmitBaseURL = useCallback((value: string) => {
    // 去掉结尾斜杠
    const clean = value.replace(/\/+$/, '')
    setBaseURL(clean)
    setStep('confirm')
  }, [])

  const handleSave = useCallback(() => {
    try {
      const updated: ModelProfile = {
        ...profile,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim() || undefined,
        lastUsed: Date.now(),
      }
      manager.updateModelProfile(updated)
      setMessage('✅ 已保存模型配置')
      // 略延迟给用户反馈
      setTimeout(() => onClose(), 400)
    } catch (err) {
      setMessage(`❌ 保存失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [apiKey, baseURL, profile, manager, onClose])

  useInput((input, key) => {
    if (key.escape) {
      // Esc 分步回退：confirm -> baseurl -> apikey -> 返回列表
      if (step === 'confirm') {
        setStep('baseurl')
      } else if (step === 'baseurl') {
        setStep('apikey')
      } else {
        onClose()
      }
    } else if (key.return && step === 'confirm') {
      handleSave()
    }
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.secondaryBorder} paddingX={1} marginTop={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>编辑模型配置</Text>
        <Text color="gray">{profile.name} ({profile.provider}) · {profile.modelName}</Text>
      </Box>

      {(step === 'apikey' || step === 'baseurl' || step === 'confirm') && (
        <>
          <Box flexDirection="column" marginBottom={1}>
            <Text>API 密钥:</Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleSubmitApiKey}
              placeholder={`输入 ${profile.provider} 的 API Key...`}
              focus={step === 'apikey'}
              mask="*"
              columns={80}
              cursorOffset={cursor1}
              onChangeCursorOffset={setCursor1}
            />
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <Text>自定义 Base URL (可选):</Text>
            <TextInput
              value={baseURL}
              onChange={setBaseURL}
              onSubmit={handleSubmitBaseURL}
              placeholder={`例如 https://api.${profile.provider}.com/v1`}
              focus={step === 'baseurl'}
              columns={80}
              cursorOffset={cursor2}
              onChangeCursorOffset={setCursor2}
            />
          </Box>

          {step === 'confirm' && (
            <Box marginTop={1}>
              <Text color="green">按 Enter 保存，或按 Esc 取消</Text>
            </Box>
          )}
        </>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color={message.startsWith('✅') ? theme.success : theme.warning}>{message}</Text>
        </Box>
      )}

      <Box marginTop={1} paddingTop={1} borderColor={theme.secondaryBorder} borderStyle="single" borderBottom={false} borderLeft={false} borderRight={false} borderTop={true}>
        <Text dimColor>
          {step === 'apikey' && '输入 API Key 后按 Enter 继续 · Esc 取消'}
          {step === 'baseurl' && '输入 Base URL（可留空）后按 Enter 继续 · Esc 取消'}
          {step === 'confirm' && '按 Enter 保存配置 · Esc 取消'}
        </Text>
      </Box>
    </Box>
  )
}

