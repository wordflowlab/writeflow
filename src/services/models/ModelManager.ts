import { ModelProfile, ModelPointerType, getGlobalConfig, GlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { getModelCapabilities } from './modelCapabilities.js'
import { logError } from '../../utils/log.js'

export interface ModelSwitchResult {
  success: boolean
  modelName?: string
  message?: string
  blocked?: boolean
}

export interface ModelDebugInfo {
  totalModels: number
  activeModels: number
  availableModels: Array<{ name: string; isActive: boolean }>
}

/**
 * WriteFlow 模型管理器
 * 为写作场景优化的模型管理器
 */
export class ModelManager {
  private config: GlobalConfig
  private modelProfiles: ModelProfile[]

  constructor(config: GlobalConfig) {
    this.config = config
    this.modelProfiles = config.modelProfiles || []
  }

  /**
   * 获取当前主模型
   */
  getCurrentModel(): string | null {
    // 使用 main pointer 从新的 ModelProfile 系统
    const mainModelName = this.config.modelPointers?.main
    if (mainModelName) {
      const profile = this.findModelProfile(mainModelName)
      if (profile && profile.isActive) {
        return profile.modelName
      }
    }

    // 回退到激活的第一个模型
    const firstActive = this.modelProfiles.find(p => p.isActive)
    return firstActive?.modelName || null
  }

  /**
   * 获取指定类型的模型
   */
  getModel(pointerType: ModelPointerType): ModelProfile | null {
    const pointerName = this.config.modelPointers?.[pointerType]
    if (!pointerName) return null

    return this.findModelProfile(pointerName)
  }

  /**
   * 获取模型名称
   */
  getModelName(pointerType: ModelPointerType): string | null {
    const model = this.getModel(pointerType)
    return model?.modelName || null
  }

  /**
   * 获取主代理模型（写作任务的默认模型）
   */
  getMainAgentModel(): string | null {
    return this.getModelName('main') || this.getCurrentModel()
  }

  /**
   * 切换到下一个可用模型
   */
  switchToNextModel(currentTokens: number = 0): ModelSwitchResult {
    const activeModels = this.modelProfiles.filter(p => p.isActive)
    
    if (activeModels.length === 0) {
      return {
        success: false,
        message: '❌ 没有激活的模型。请使用 /model 命令配置模型。'
      }
    }

    if (activeModels.length === 1) {
      // 单个模型时激活所有配置的模型用于切换
      this.modelProfiles.forEach(p => p.isActive = true)
      const allModels = this.modelProfiles.filter(p => p.isActive)
      
      if (allModels.length <= 1) {
        return {
          success: false,
          message: `⚠️ 只有 1 个配置的模型。请添加更多模型以启用切换功能。`
        }
      }
    }

    // 获取当前模型
    const currentModelName = this.getCurrentModel()
    const currentIndex = activeModels.findIndex(p => p.modelName === currentModelName)
    
    // 切换到下一个模型
    const nextIndex = (currentIndex + 1) % activeModels.length
    const nextModel = activeModels[nextIndex]

    // 检查上下文长度限制
    const capabilities = getModelCapabilities(nextModel.modelName)
    if (currentTokens > capabilities.contextLength * 0.9) {
      return {
        success: false,
        blocked: true,
        message: `❌ 无法切换到 ${nextModel.modelName}：当前上下文 (${currentTokens} tokens) 超出模型限制 (${capabilities.contextLength} tokens)`
      }
    }

    // 更新模型指针
    if (!this.config.modelPointers) {
      this.config.modelPointers = { main: nextModel.name }
    } else {
      this.config.modelPointers.main = nextModel.name
    }

    return {
      success: true,
      modelName: nextModel.modelName,
      message: `✅ 已切换到 ${nextModel.modelName} (${nextModel.provider})`
    }
  }

  /**
   * 获取模型切换调试信息
   */
  getModelSwitchingDebugInfo(): ModelDebugInfo {
    const totalModels = this.modelProfiles.length
    const activeModels = this.modelProfiles.filter(p => p.isActive).length
    const availableModels = this.modelProfiles.map(p => ({
      name: p.modelName,
      isActive: p.isActive
    }))

    return {
      totalModels,
      activeModels,
      availableModels
    }
  }

  /**
   * 添加模型配置
   */
  addModelProfile(profile: ModelProfile): void {
    // 检查是否已存在
    const existingIndex = this.modelProfiles.findIndex(p => p.name === profile.name)
    
    if (existingIndex >= 0) {
      // 更新existing模型
      this.modelProfiles[existingIndex] = profile
    } else {
      // 添加新模型
      this.modelProfiles.push(profile)
    }
    
    // 更新配置并保存到磁盘
    this.config.modelProfiles = this.modelProfiles
    this.saveToConfig()
  }

  /**
   * 移除模型配置
   */
  removeModelProfile(name: string): boolean {
    const index = this.modelProfiles.findIndex(p => p.name === name)
    if (index >= 0) {
      this.modelProfiles.splice(index, 1)
      this.config.modelProfiles = this.modelProfiles
      return true
    }
    return false
  }

  /**
   * 获取所有模型配置
   */
  getAllProfiles(): ModelProfile[] {
    return [...this.modelProfiles]
  }

  /**
   * 获取激活的模型配置
   */
  getActiveProfiles(): ModelProfile[] {
    return this.modelProfiles.filter(p => p.isActive)
  }

  /**
   * 查找模型配置
   */
  private findModelProfile(name: string): ModelProfile | null {
    return this.modelProfiles.find(p => p.name === name) || null
  }

  /**
   * 验证模型配置
   */
  validateProfile(profile: ModelProfile): string[] {
    const errors: string[] = []

    if (!profile.name || profile.name.trim() === '') {
      errors.push('模型名称不能为空')
    }

    if (!profile.modelName || profile.modelName.trim() === '') {
      errors.push('模型标识不能为空')
    }

    if (!profile.provider || profile.provider.trim() === '') {
      errors.push('提供商不能为空')
    }

    // 验证 API 密钥（如果需要）
    if (profile.provider !== 'ollama' && !profile.apiKey && !this.getEnvironmentApiKey(profile.provider)) {
      errors.push(`缺少 ${profile.provider} 的 API 密钥`)
    }

    return errors
  }

  /**
   * 更新模型配置
   */
  updateModelProfile(profile: ModelProfile): void {
    const index = this.modelProfiles.findIndex(p => p.modelName === profile.modelName)
    if (index >= 0) {
      this.modelProfiles[index] = { 
        ...profile, 
        lastUsed: profile.lastUsed || this.modelProfiles[index].lastUsed 
      }
      this.saveToConfig()
    } else {
      throw new Error(`模型配置不存在: ${profile.modelName}`)
    }
  }

  /**
   * 移除模型配置 (设置为非活跃状态)
   */
  removeModel(modelName: string): void {
    const index = this.modelProfiles.findIndex(p => p.modelName === modelName)
    if (index >= 0) {
      this.modelProfiles[index].isActive = false
      this.saveToConfig()
    }
  }

  /**
   * 保存模型配置到全局配置
   */
  private saveToConfig(): void {
    const currentConfig = getGlobalConfig()
    currentConfig.modelProfiles = this.modelProfiles
    saveGlobalConfig(currentConfig)
  }

  /**
   * 获取环境变量中的 API 密钥
   */
  private getEnvironmentApiKey(provider: string): string | undefined {
    const envVars = {
      anthropic: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
      openai: ['OPENAI_API_KEY'],
      deepseek: ['DEEPSEEK_API_KEY'],
      kimi: ['KIMI_API_KEY', 'MOONSHOT_API_KEY']
    }

    const keys = envVars[provider as keyof typeof envVars] || []
    return keys.map(key => process.env[key]).find(Boolean)
  }
}

/**
 * 获取全局模型管理器实例
 */
let globalModelManager: ModelManager | null = null

export function getModelManager(): ModelManager {
  if (!globalModelManager) {
    try {
      const config = getGlobalConfig()
      globalModelManager = new ModelManager(config)
    } catch (error) {
      logError('Failed to initialize ModelManager', error)
      // 返回一个带有默认配置的管理器
      globalModelManager = new ModelManager({ 
        numStartups: 0,
        theme: 'dark',
        preferredNotifChannel: 'iterm2',
        verbose: false,
        modelProfiles: [], 
        modelPointers: { main: '', task: '', reasoning: '', quick: '' } 
      })
    }
  }
  
  return globalModelManager
}

/**
 * 重新加载模型管理器
 */
export function reloadModelManager(): ModelManager {
  globalModelManager = null
  return getModelManager()
}