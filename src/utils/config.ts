import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomBytes } from 'crypto'
import { getCwd } from './state.js'

// 简单的工具函数替代 lodash
import { logError } from './log.js'

function cloneDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as any
  if (obj instanceof Array) return obj.map(cloneDeep) as any
  if (typeof obj !== 'object') return obj
  
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = cloneDeep(obj[key])
    }
  }
  return cloned
}

function memoize<T extends (...args: any[]) => any>(fn: T): T & { cache: Map<string, any> } {
  const cache = new Map()
  const memoized = ((...args: any[]) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) return cache.get(key)
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T & { cache: Map<string, any> }
  memoized.cache = cache
  return memoized
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) result[key] = obj[key]
  }
  return result
}

/**
 * WriteFlow 配置系统
 * 基于最佳实践的配置系统，保持兼容性
 */

// 配置文件路径
const GLOBAL_CONFIG_FILE = join(homedir(), '.writeflow.json')

export type McpStdioServerConfig = {
  type?: 'stdio'
  command: string
  args: string[]
  env?: Record<string, string>
}

export type McpSSEServerConfig = {
  type: 'sse'
  url: string
}

export type McpServerConfig = McpStdioServerConfig | McpSSEServerConfig

export type ProjectConfig = {
  allowedTools: string[]
  context: Record<string, string>
  contextFiles?: string[]
  history: string[]
  dontCrawlDirectory?: boolean
  enableArchitectTool?: boolean
  mcpContextUris: string[]
  mcpServers?: Record<string, McpServerConfig>
  approvedMcprcServers?: string[]
  rejectedMcprcServers?: string[]
  lastAPIDuration?: number
  lastCost?: number
  lastDuration?: number
  lastSessionId?: string
  exampleFiles?: string[]
  exampleFilesGeneratedAt?: number
  hasTrustDialogAccepted?: boolean
  hasCompletedProjectOnboarding?: boolean
}

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  allowedTools: [], context: {},
  history: [],
  dontCrawlDirectory: false,
  enableArchitectTool: false,
  mcpContextUris: [],
  mcpServers: {},
  approvedMcprcServers: [],
  rejectedMcprcServers: [],
  hasTrustDialogAccepted: false,
}

function defaultConfigForProject(projectPath: string): ProjectConfig {
  const config = { ...DEFAULT_PROJECT_CONFIG }
  if (projectPath === homedir()) {
    config.dontCrawlDirectory = true
  }
  return config
}

export type AutoUpdaterStatus =
  | 'disabled'
  | 'enabled'
  | 'no_permissions'
  | 'not_configured'

export function isAutoUpdaterStatus(value: string): value is AutoUpdaterStatus {
  return ['disabled', 'enabled', 'no_permissions', 'not_configured'].includes(
    value as AutoUpdaterStatus,
  )
}

export type NotificationChannel =
  | 'iterm2'
  | 'terminal_bell'
  | 'iterm2_with_bell'
  | 'notifications_disabled'

export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'mistral'
  | 'deepseek'
  | 'kimi'
  | 'qwen'
  | 'glm'
  | 'minimax'
  | 'baidu-qianfan'
  | 'siliconflow'
  | 'bigdream'
  | 'opendev'
  | 'xai'
  | 'groq'
  | 'gemini'
  | 'ollama'
  | 'azure'
  | 'custom'
  | 'custom-openai'

// 新的模型系统类型
export type ModelProfile = {
  name: string // 用户友好名称
  provider: ProviderType // 提供商类型
  modelName: string // 主键 - 实际模型标识符
  baseURL?: string // 自定义端点
  apiKey: string
  maxTokens: number // 输出token限制
  contextLength: number // 上下文窗口大小
  reasoningEffort?: 'low' | 'medium' | 'high' | 'minimal' | 'medium'
  isActive: boolean // 是否启用配置文件
  createdAt?: number // 创建时间戳
  lastUsed?: number // 最后使用时间戳
  // GPT-5 特定元数据
  isGPT5?: boolean // 自动检测的 GPT-5 模型标志
  validationStatus?: 'valid' | 'needs_repair' | 'auto_repaired' // 配置状态
  lastValidation?: number // 最后验证时间戳
}

export type ModelPointerType = 'main' | 'task' | 'reasoning' | 'quick'

export type ModelPointers = {
  main?: string // 主对话模型 ID
  task?: string // 任务工具模型 ID
  reasoning?: string // 推理模型 ID
  quick?: string // 快速模型 ID
}

export type AccountInfo = {
  accountUuid: string
  emailAddress: string
  organizationUuid?: string
}

// 写作偏好设置
export type WritingPreferences = {
  defaultLanguage: 'zh-CN' | 'en-US' | 'auto'
  writingStyle: 'formal' | 'friendly' | 'academic' | 'creative'
  showWritingTips: boolean
  preferredWritingMode: 'technical' | 'academic' | 'creative' | 'mixed'
}

// 成本跟踪配置
export type CostConfig = {
  dailyLimit?: number
  monthlyLimit?: number
  warningThreshold?: number  // 百分比 (0.8 = 80%)
  emergencyThreshold?: number  // 百分比 (0.95 = 95%)
  enableWarnings?: boolean
  lastSessionSummary?: {
    sessionId: string
    cost: number
    tokens: number
    requests: number
    duration: number
    apiDuration: number
    timestamp: number
  }
}

export type GlobalConfig = {
  projects?: Record<string, ProjectConfig>
  numStartups: number
  autoUpdaterStatus?: AutoUpdaterStatus
  userID?: string
  theme: 'dark' | 'light' | 'dark-accessible' | 'light-accessible' | 'auto'
  hasCompletedOnboarding?: boolean
  // 跟踪重置入职的最后版本，与 MIN_VERSION_REQUIRING_ONBOARDING_RESET 一起使用
  lastOnboardingVersion?: string
  // 跟踪看到发行说明的最后版本，用于管理发行说明
  lastReleaseNotesSeen?: string
  mcpServers?: Record<string, McpServerConfig>
  preferredNotifChannel: NotificationChannel
  verbose: boolean
  customApiKeyResponses?: {
    approved?: string[]
    rejected?: string[]
  }
  primaryProvider?: ProviderType
  maxTokens?: number
  hasAcknowledgedCostThreshold?: boolean
  oauthAccount?: AccountInfo
  iterm2KeyBindingInstalled?: boolean // 保留向后兼容性
  shiftEnterKeyBindingInstalled?: boolean
  proxy?: string
  stream?: boolean

  // 新模型系统
  modelProfiles?: ModelProfile[] // 模型配置列表
  modelPointers?: ModelPointers // 模型指针系统
  defaultModelName?: string // 默认模型
  
  // 写作偏好设置
  writingPreferences?: WritingPreferences
  
  // 成本跟踪配置
  cost?: CostConfig
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  numStartups: 0,
  autoUpdaterStatus: 'not_configured',
  theme: 'dark',
  preferredNotifChannel: 'iterm2',
  verbose: false,
  primaryProvider: 'anthropic' as ProviderType,
  customApiKeyResponses: {
    approved: [],
    rejected: [],
  },
  stream: true,

  // 新模型系统默认值
  modelProfiles: [],
  modelPointers: {
    main: '',
    task: '',
    reasoning: '',
    quick: '',
  },
  
  // 写作偏好默认值
  writingPreferences: {
    defaultLanguage: 'zh-CN',
    writingStyle: 'friendly',
    showWritingTips: true,
    preferredWritingMode: 'mixed',
  },
  
  // 成本跟踪默认值
  cost: {
    dailyLimit: 10.0,
    monthlyLimit: 100.0,
    warningThreshold: 0.8,
    emergencyThreshold: 0.95,
    enableWarnings: true,
  },
}

/**
 * 安全的 JSON 解析
 */
function safeParseJSON<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T
  } catch {
    return fallback
  }
}

/**
 * 获取全局配置文件路径
 */
export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE
}

/**
 * 获取项目配置文件路径
 */
export function getProjectConfigPath(): string {
  return join(getCwd(), '.writeflow.json')
}

/**
 * 获取全局配置
 */
// 非缓存版本的全局配置读取，确保主题等设置实时生效
export const getGlobalConfig: (() => GlobalConfig) & { cache: { clear: () => void } } = (() => {
  const fn = (): GlobalConfig => {
    const configPath = getGlobalConfigPath()

    if (!existsSync(configPath)) {
      return cloneDeep(DEFAULT_GLOBAL_CONFIG)
    }

    try {
      const configData = readFileSync(configPath, 'utf-8')
      const config = safeParseJSON(configData, DEFAULT_GLOBAL_CONFIG)
      
      // 合并默认配置以确保新字段存在
      return {
        ...DEFAULT_GLOBAL_CONFIG,
        ...config,
        customApiKeyResponses: {
          ...DEFAULT_GLOBAL_CONFIG.customApiKeyResponses,
          ...config.customApiKeyResponses,
        },
        modelPointers: {
          ...DEFAULT_GLOBAL_CONFIG.modelPointers,
          ...config.modelPointers,
        },
      }
    } catch (_error) {
      logError('解析全局配置失败:', _error)
      return cloneDeep(DEFAULT_GLOBAL_CONFIG)
    }
  }

  ;(fn as any).cache = { clear: () => {} }
  return fn as typeof fn & { cache: { clear: () => void } }
})()

/**
 * 获取项目配置
 */
export const getProjectConfig = memoize((): ProjectConfig => {
  const configPath = getProjectConfigPath()
  const cwd = getCwd()

  if (!existsSync(configPath)) {
    return defaultConfigForProject(cwd)
  }

  try {
    const configData = readFileSync(configPath, 'utf-8')
    const config = safeParseJSON(configData, DEFAULT_PROJECT_CONFIG)
    
    // 合并默认配置
    return {
      ...defaultConfigForProject(cwd),
      ...config,
    }
  } catch (_error) {
    logError('解析项目配置失败:', _error)
    return defaultConfigForProject(cwd)
  }
})

/**
 * 保存全局配置
 */
export function saveGlobalConfig(config: GlobalConfig): void {
  const configPath = getGlobalConfigPath()
  
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2))
    // 清除memoization缓存
    getGlobalConfig.cache.clear?.()
  } catch (_error) {
    logError('保存全局配置失败:', _error)
    throw _error
  }
}

/**
 * 保存项目配置
 */
export function saveProjectConfig(config: ProjectConfig): void {
  const configPath = getProjectConfigPath()
  
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2))
    // 清除memoization缓存
    getProjectConfig.cache.clear?.()
  } catch (_error) {
    logError('保存项目配置失败:', _error)
    throw _error
  }
}

/**
 * 更新全局配置的部分字段
 */
export function updateGlobalConfig<K extends keyof GlobalConfig>(
  key: K,
  value: GlobalConfig[K],
): void {
  const config = getGlobalConfig()
  config[key] = value
  saveGlobalConfig(config)
}

/**
 * 更新项目配置的部分字段
 */
export function updateProjectConfig<K extends keyof ProjectConfig>(
  key: K,
  value: ProjectConfig[K],
): void {
  const config = getProjectConfig()
  config[key] = value
  saveProjectConfig(config)
}

/**
 * 获取 Anthropic API 密钥
 */
export function getAnthropicApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
}

/**
 * 获取 OpenAI API 密钥
 */
export function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY
}

/**
 * 获取 DeepSeek API 密钥
 */
export function getDeepSeekApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY
}

/**
 * 获取或创建用户 ID
 */
export function getOrCreateUserID(): string {
  const config = getGlobalConfig()
  
  if (config.userID) {
    return config.userID
  }
  
  const userID = randomBytes(16).toString('hex')
  updateGlobalConfig('userID', userID)
  return userID
}

/**
 * 获取配置版本（用于迁移）
 */
export function getConfigVersion(): string {
  const config = getGlobalConfig()
  return config.lastOnboardingVersion || '1.0.0'
}

/**
 * 更新配置版本
 */
export function updateConfigVersion(version: string): void {
  updateGlobalConfig('lastOnboardingVersion', version)
}

/**
 * 检查是否为新用户或需要重新配置
 */
export function isNewUser(): boolean {
  const config = getGlobalConfig()
  const hasModels = config.modelProfiles && config.modelProfiles.length > 0
  const hasMainModel = config.modelPointers && config.modelPointers.main
  return config.numStartups === 0 && !config.hasCompletedOnboarding
}

/**
 * 检查是否需要显示引导流程
 */
export function shouldShowOnboarding(): boolean {
  const config = getGlobalConfig()
  const hasModels = config.modelProfiles && config.modelProfiles.length > 0
  const hasMainModel = config.modelPointers && config.modelPointers.main && config.modelPointers.main.trim() !== ''
  return !config.hasCompletedOnboarding || !hasModels || !hasMainModel
}

/**
 * 标记用户已完成入职
 */
export function markOnboardingComplete(): void {
  updateGlobalConfig('hasCompletedOnboarding', true)
}

/**
 * 增加启动计数
 */
export function incrementStartupCount(): void {
  const config = getGlobalConfig()
  updateGlobalConfig('numStartups', (config.numStartups || 0) + 1)
}

/**
 * 获取模型配置
 */
export function getModelProfiles(): ModelProfile[] {
  const config = getGlobalConfig()
  return config.modelProfiles || []
}

/**
 * 添加或更新模型配置
 */
export function addOrUpdateModelProfile(profile: ModelProfile): void {
  const config = getGlobalConfig()
  const profiles = config.modelProfiles || []
  
  const existingIndex = profiles.findIndex(p => p.name === profile.name)
  
  if (existingIndex >= 0) {
    profiles[existingIndex] = profile
  } else {
    profiles.push(profile)
  }
  
  updateGlobalConfig('modelProfiles', profiles)
}

/**
 * 删除模型配置
 */
export function removeModelProfile(name: string): void {
  const config = getGlobalConfig()
  const profiles = config.modelProfiles || []
  
  const filteredProfiles = profiles.filter(p => p.name !== name)
  updateGlobalConfig('modelProfiles', filteredProfiles)
}

/**
 * 获取模型指针
 */
export function getModelPointers(): ModelPointers {
  const config = getGlobalConfig()
  return config.modelPointers || DEFAULT_GLOBAL_CONFIG.modelPointers!
}

/**
 * 设置模型指针
 */
export function setModelPointer(pointerType: ModelPointerType, profileName: string): void {
  const config = getGlobalConfig()
  const pointers = { ...getModelPointers(), [pointerType]: profileName }
  updateGlobalConfig('modelPointers', pointers)
}

/**
 * 验证模型配置
 */
export function validateModelProfile(profile: ModelProfile): string[] {
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
  
  if (profile.provider !== 'ollama' && (!profile.apiKey || profile.apiKey.trim() === '')) {
    errors.push('API 密钥不能为空（Ollama 除外）')
  }
  
  if (profile.maxTokens <= 0) {
    errors.push('最大输出tokens必须大于0')
  }
  
  if (profile.contextLength <= 0) {
    errors.push('上下文长度必须大于0')
  }
  
  return errors
}

/**
 * 获取活跃的模型配置
 */
export function getActiveModelProfiles(): ModelProfile[] {
  return getModelProfiles().filter(p => p.isActive)
}

/**
 * 根据名称查找模型配置
 */
export function findModelProfile(name: string): ModelProfile | undefined {
  return getModelProfiles().find(p => p.name === name)
}

/**
 * 获取默认模型
 */
export function getDefaultModel(): ModelProfile | undefined {
  const config = getGlobalConfig()
  const pointers = getModelPointers()
  
  // 优先使用主指针
  if (pointers.main) {
    const profile = findModelProfile(pointers.main)
    if (profile && profile.isActive) {
      return profile
    }
  }
  
  // 回退到第一个活跃模型
  const activeProfiles = getActiveModelProfiles()
  return activeProfiles.length > 0 ? activeProfiles[0] : undefined
}

/**
 * 重置全局配置为默认值
 */
export function resetGlobalConfig(): void {
  saveGlobalConfig(cloneDeep(DEFAULT_GLOBAL_CONFIG))
}

/**
 * 重置项目配置为默认值
 */
export function resetProjectConfig(): void {
  const cwd = getCwd()
  saveProjectConfig(defaultConfigForProject(cwd))
}

/**
 * 导出配置数据
 */
export function exportConfig(): { global: GlobalConfig; project: ProjectConfig } {
  return {
    global: getGlobalConfig(),
    project: getProjectConfig(),
  }
}

/**
 * 导入配置数据
 */
export function importConfig(data: { global?: Partial<GlobalConfig>; project?: Partial<ProjectConfig> }): void {
  if (data.global) {
    const currentGlobal = getGlobalConfig()
    const mergedGlobal = { ...currentGlobal, ...data.global }
    saveGlobalConfig(mergedGlobal)
  }
  
  if (data.project) {
    const currentProject = getProjectConfig()
    const mergedProject = { ...currentProject, ...data.project }
    saveProjectConfig(mergedProject)
  }
}
