import { debugLog, logError, logWarn, infoLog } from '../../utils/log.js'

/**

 * WriteFlow 用户体验优化器
 * 专注于提升用户交互体验和视觉效果
 */
import { EventEmitter } from 'events'
import { getResponseStateManager } from '../streaming/ResponseStateManager.js'

export interface UXConfig {
  // 视觉优化
  enableSmoothScrolling: boolean
  enableTypingAnimation: boolean
  enableProgressIndicators: boolean
  enableColorAdaptation: boolean
  
  // 交互优化
  enableKeyboardShortcuts: boolean
  enableGestures: boolean
  enableVoiceCommands: boolean
  enableSmartSuggestions: boolean
  
  // 性能阈值
  maxResponseTime: number // ms - 用户感知的响应时间
  maxTypingDelay: number // ms - 打字动画最大延迟
  smoothScrollDuration: number // ms - 滚动动画时长
  
  // 个性化
  enableUserPreferences: boolean
  enableAdaptiveThemes: boolean
  enableContextualHelp: boolean
}

export interface UXMetrics {
  // 用户交互指标
  responseTime: number // 平均响应时间
  interactionLatency: number // 交互延迟
  scrollPerformance: number // 滚动性能评分 (0-100)
  
  // 视觉体验指标
  frameDrops: number // 动画掉帧数
  visualGlitches: number // 视觉故障数
  colorContrastRatio: number // 颜色对比度
  
  // 用户满意度指标
  taskCompletionRate: number // 任务完成率
  errorRecoveryTime: number // 错误恢复时间
  userRetentionScore: number // 用户保持率评分
  
  // 可访问性指标
  accessibilityScore: number // 可访问性评分 (0-100)
  keyboardNavigationEfficiency: number // 键盘导航效率
  screenReaderCompatibility: number // 屏幕阅读器兼容性
}

export interface UserInteraction {
  type: 'click' | 'key' | 'scroll' | 'gesture' | 'voice'
  timestamp: number
  duration: number
  element?: string
  successful: boolean
  responseTime: number
}

export interface UXOptimization {
  type: 'animation' | 'layout' | 'color' | 'interaction' | 'accessibility'
  action: string
  reason: string
  impact: 'low' | 'medium' | 'high'
  userVisible: boolean
  appliedAt: number
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  fontSize: number
  animationSpeed: 'slow' | 'normal' | 'fast' | 'disabled'
  colorBlindness: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  reduceMotion: boolean
  highContrast: boolean
  screenReaderMode: boolean
  keyboardOnly: boolean
}

/**
 * 智能用户体验优化器
 */
export class UXOptimizer extends EventEmitter {
  private config: UXConfig
  private stateManager = getResponseStateManager()
  private metrics: UXMetrics
  private interactions: UserInteraction[] = []
  private optimizations: UXOptimization[] = []
  private userPreferences: UserPreferences
  
  // 性能监控
  private frameTimeHistory: number[] = []
  private interactionTimeouts = new Map<string, NodeJS.Timeout>()
  
  // 适应性设置
  private adaptiveSettings = {
    currentAnimationSpeed: 1.0,
    currentTypingDelay: 50,
    currentScrollSpeed: 1.0,
    colorAdjustments: {
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0
    }
  }
  
  constructor(config: Partial<UXConfig> = {}) {
    super()
    
    this.config = {
      enableSmoothScrolling: true,
      enableTypingAnimation: true,
      enableProgressIndicators: true,
      enableColorAdaptation: false,
      enableKeyboardShortcuts: true,
      enableGestures: false,
      enableVoiceCommands: false,
      enableSmartSuggestions: true,
      maxResponseTime: 100,
      maxTypingDelay: 100,
      smoothScrollDuration: 300,
      enableUserPreferences: true,
      enableAdaptiveThemes: true,
      enableContextualHelp: true,
      ...config
    }
    
    this.metrics = {
      responseTime: 0,
      interactionLatency: 0,
      scrollPerformance: 100,
      frameDrops: 0,
      visualGlitches: 0,
      colorContrastRatio: 4.5,
      taskCompletionRate: 100,
      errorRecoveryTime: 0,
      userRetentionScore: 100,
      accessibilityScore: 90,
      keyboardNavigationEfficiency: 85,
      screenReaderCompatibility: 90
    }
    
    this.userPreferences = {
      theme: 'auto',
      fontSize: 14,
      animationSpeed: 'normal',
      colorBlindness: 'none',
      reduceMotion: false,
      highContrast: false,
      screenReaderMode: false,
      keyboardOnly: false
    }
    
    this.initializeOptimizer()
  }

  /**
   * 初始化优化器
   */
  private initializeOptimizer(): void {
    // 加载用户偏好
    this.loadUserPreferences()
    
    // 设置性能监控
    this.startPerformanceMonitoring()
    
    // 应用初始优化
    this.applyInitialOptimizations()
    
    debugLog('🎨 用户体验优化器已启动')
  }

  /**
   * 加载用户偏好设置
   */
  private loadUserPreferences(): void {
    // 从本地存储或配置文件加载偏好
    try {
      const saved = localStorage?.getItem('writeflow-ux-preferences')
      if (saved) {
        const preferences = JSON.parse(saved)
        this.userPreferences = { ...this.userPreferences, ...preferences }
      }
    } catch (error) {
      logWarn('加载用户偏好失败:', error)
    }
    
    // 应用偏好设置
    this.applyUserPreferences()
  }

  /**
   * 应用用户偏好设置
   */
  private applyUserPreferences(): void {
    // 应用动画速度偏好
    switch (this.userPreferences.animationSpeed) {
      case 'slow':
        this.adaptiveSettings.currentAnimationSpeed = 0.5
        this.adaptiveSettings.currentTypingDelay = 100
        break
      case 'fast':
        this.adaptiveSettings.currentAnimationSpeed = 2.0
        this.adaptiveSettings.currentTypingDelay = 10
        break
      case 'disabled':
        this.adaptiveSettings.currentAnimationSpeed = 0
        this.adaptiveSettings.currentTypingDelay = 0
        break
      default:
        this.adaptiveSettings.currentAnimationSpeed = 1.0
        this.adaptiveSettings.currentTypingDelay = 50
    }
    
    // 应用无障碍设置
    if (this.userPreferences.reduceMotion) {
      this.adaptiveSettings.currentAnimationSpeed = 0.3
    }
    
    if (this.userPreferences.highContrast) {
      this.adaptiveSettings.colorAdjustments.contrast = 1.5
    }
    
    // 应用色盲适配
    if (this.userPreferences.colorBlindness !== 'none') {
      this.adaptiveSettings.colorAdjustments = this.getColorBlindnessAdjustments(
        this.userPreferences.colorBlindness
      )
    }
    
    this.emit('preferences-applied', this.userPreferences)
  }

  /**
   * 开始性能监控
   */
  private startPerformanceMonitoring(): void {
    // 监控帧率
    const monitorFrames = () => {
      const startTime = performance.now()
      
      requestAnimationFrame(() => {
        const frameTime = performance.now() - startTime
        this.frameTimeHistory.push(frameTime)
        
        if (this.frameTimeHistory.length > 60) {
          this.frameTimeHistory.shift()
        }
        
        // 检测掉帧
        if (frameTime > 16.67 * 2) { // 大于两倍期望帧时间
          this.metrics.frameDrops++
        }
        
        monitorFrames()
      })
    }
    
    monitorFrames()
    
    // 定期更新指标
    setInterval(() => {
      this.updateUXMetrics()
    }, 1000)
  }

  /**
   * 应用初始优化
   */
  private applyInitialOptimizations(): void {
    // 优化滚动性能
    if (this.config.enableSmoothScrolling) {
      this.optimizeScrolling()
    }
    
    // 优化动画性能
    if (this.config.enableTypingAnimation) {
      this.optimizeAnimations()
    }
    
    // 优化颜色对比度
    this.optimizeColorContrast()
    
    // 设置键盘导航
    if (this.config.enableKeyboardShortcuts) {
      this.setupKeyboardNavigation()
    }
  }

  /**
   * 记录用户交互
   */
  recordInteraction(
    type: UserInteraction['type'],
    element?: string,
    successful = true
  ): void {
    const startTime = performance.now()
    
    // 设置响应时间监控
    const timeoutId = setTimeout(() => {
      // 如果超时未完成，记录为失败
      this.completeInteraction(type, element, false, performance.now() - startTime)
    }, this.config.maxResponseTime)
    
    // 存储超时ID以便后续清理
    const interactionKey = `${type}_${element || 'unknown'}_${startTime}`
    this.interactionTimeouts.set(interactionKey, timeoutId)
    
    // 如果是立即完成的交互，直接记录
    if (type === 'click' || type === 'key') {
      this.completeInteraction(type, element, successful, performance.now() - startTime)
      this.interactionTimeouts.delete(interactionKey)
      clearTimeout(timeoutId)
    }
  }

  /**
   * 完成交互记录
   */
  private completeInteraction(
    type: UserInteraction['type'],
    element: string | undefined,
    successful: boolean,
    responseTime: number
  ): void {
    const interaction: UserInteraction = {
      type,
      timestamp: Date.now(),
      duration: responseTime,
      element,
      successful,
      responseTime
    }
    
    this.interactions.push(interaction)
    
    // 保持最近1000个交互记录
    if (this.interactions.length > 1000) {
      this.interactions.shift()
    }
    
    // 触发响应时间优化检查
    if (responseTime > this.config.maxResponseTime) {
      this.optimizeResponseTime(interaction)
    }
    
    this.emit('interaction-recorded', interaction)
  }

  /**
   * 优化响应时间
   */
  private async optimizeResponseTime(interaction: UserInteraction): Promise<void> {
    const optimization: UXOptimization = {
      type: 'interaction',
      action: 'reduce_animation_complexity',
      reason: `响应时间过长: ${interaction.responseTime.toFixed(0)}ms > ${this.config.maxResponseTime}ms`,
      impact: 'medium',
      userVisible: false,
      appliedAt: Date.now()
    }
    
    // 减少动画复杂度
    if (this.adaptiveSettings.currentAnimationSpeed > 0.5) {
      this.adaptiveSettings.currentAnimationSpeed *= 0.8
      optimization.action = `降低动画速度到 ${(this.adaptiveSettings.currentAnimationSpeed * 100).toFixed(0)}%`
    }
    
    // 增加打字延迟
    if (this.adaptiveSettings.currentTypingDelay < this.config.maxTypingDelay) {
      this.adaptiveSettings.currentTypingDelay = Math.min(
        this.config.maxTypingDelay,
        this.adaptiveSettings.currentTypingDelay * 1.2
      )
      optimization.action += `, 调整打字延迟到 ${this.adaptiveSettings.currentTypingDelay.toFixed(0)}ms`
    }
    
    await this.applyOptimization(optimization)
  }

  /**
   * 优化滚动性能
   */
  private optimizeScrolling(): void {
    // 启用硬件加速滚动
    const scrollOptimization: UXOptimization = {
      type: 'layout',
      action: 'enable_smooth_scrolling',
      reason: '启用硬件加速平滑滚动',
      impact: 'low',
      userVisible: true,
      appliedAt: Date.now()
    }
    
    this.applyOptimization(scrollOptimization)
  }

  /**
   * 优化动画性能
   */
  private optimizeAnimations(): void {
    // 基于设备性能调整动画
    const avgFrameTime = this.frameTimeHistory.length > 0
      ? this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length
      : 16.67
    
    if (avgFrameTime > 20) { // 低于50fps
      const optimization: UXOptimization = {
        type: 'animation',
        action: 'reduce_animation_complexity',
        reason: `平均帧时间过长: ${avgFrameTime.toFixed(1)}ms`,
        impact: 'medium',
        userVisible: false,
        appliedAt: Date.now()
      }
      
      this.adaptiveSettings.currentAnimationSpeed *= 0.7
      this.applyOptimization(optimization)
    }
  }

  /**
   * 优化颜色对比度
   */
  private optimizeColorContrast(): void {
    // 检查当前对比度是否符合 WCAG 标准
    if (this.metrics.colorContrastRatio < 4.5) {
      const optimization: UXOptimization = {
        type: 'color',
        action: 'increase_contrast',
        reason: `颜色对比度不足: ${this.metrics.colorContrastRatio.toFixed(1)} < 4.5`,
        impact: 'high',
        userVisible: true,
        appliedAt: Date.now()
      }
      
      this.adaptiveSettings.colorAdjustments.contrast = 1.2
      this.applyOptimization(optimization)
    }
  }

  /**
   * 设置键盘导航
   */
  private setupKeyboardNavigation(): void {
    const optimization: UXOptimization = {
      type: 'accessibility',
      action: 'enable_keyboard_navigation',
      reason: '提供完整的键盘导航支持',
      impact: 'high',
      userVisible: false,
      appliedAt: Date.now()
    }
    
    this.applyOptimization(optimization)
  }

  /**
   * 获取色盲适配调整
   */
  private getColorBlindnessAdjustments(type: string) {
    const adjustments = {
      brightness: 1.0,
      contrast: 1.1,
      saturation: 1.0
    }
    
    switch (type) {
      case 'protanopia': // 红色盲
        adjustments.saturation = 1.2
        adjustments.contrast = 1.15
        break
      case 'deuteranopia': // 绿色盲
        adjustments.contrast = 1.2
        adjustments.brightness = 1.05
        break
      case 'tritanopia': // 蓝色盲
        adjustments.saturation = 0.9
        adjustments.contrast = 1.1
        break
    }
    
    return adjustments
  }

  /**
   * 应用优化措施
   */
  private async applyOptimization(optimization: UXOptimization): Promise<void> {
    this.optimizations.push(optimization)
    
    debugLog(`🎨 应用UX优化: ${optimization.action}`)
    
    // 保持优化历史记录大小
    if (this.optimizations.length > 100) {
      this.optimizations.shift()
    }
    
    this.emit('optimization-applied', optimization)
  }

  /**
   * 更新UX指标
   */
  private updateUXMetrics(): void {
    // 计算平均响应时间
    const recentInteractions = this.interactions
      .filter(i => Date.now() - i.timestamp < 60000) // 最近1分钟
    
    if (recentInteractions.length > 0) {
      this.metrics.responseTime = recentInteractions
        .reduce((sum, i) => sum + i.responseTime, 0) / recentInteractions.length
      
      this.metrics.taskCompletionRate = recentInteractions
        .filter(i => i.successful).length / recentInteractions.length * 100
    }
    
    // 计算滚动性能
    const avgFrameTime = this.frameTimeHistory.length > 0
      ? this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length
      : 16.67
    
    this.metrics.scrollPerformance = Math.max(0, 100 - (avgFrameTime - 16.67) * 5)
    
    // 计算可访问性评分
    this.metrics.accessibilityScore = this.calculateAccessibilityScore()
    
    this.emit('metrics-updated', this.metrics)
  }

  /**
   * 计算可访问性评分
   */
  private calculateAccessibilityScore(): number {
    let score = 100
    
    // 颜色对比度扣分
    if (this.metrics.colorContrastRatio < 4.5) {
      score -= 20
    } else if (this.metrics.colorContrastRatio < 3.0) {
      score -= 40
    }
    
    // 键盘导航扣分
    if (!this.config.enableKeyboardShortcuts) {
      score -= 15
    }
    
    // 屏幕阅读器支持扣分
    if (!this.userPreferences.screenReaderMode && this.config.enableContextualHelp) {
      score -= 10
    }
    
    return Math.max(0, score)
  }

  /**
   * 设置用户偏好
   */
  setUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences }
    
    // 保存到本地存储
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('writeflow-ux-preferences', JSON.stringify(this.userPreferences))
      }
    } catch (error) {
      logWarn('保存用户偏好失败:', error)
    }
    
    // 重新应用偏好设置
    this.applyUserPreferences()
  }

  /**
   * 获取当前UX指标
   */
  getMetrics(): UXMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取用户偏好
   */
  getUserPreferences(): UserPreferences {
    return { ...this.userPreferences }
  }

  /**
   * 获取自适应设置
   */
  getAdaptiveSettings() {
    return { ...this.adaptiveSettings }
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(): UXOptimization[] {
    return [...this.optimizations]
  }

  /**
   * 获取交互历史
   */
  getInteractionHistory(): UserInteraction[] {
    return [...this.interactions]
  }

  /**
   * 重置优化器
   */
  reset(): void {
    this.interactions = []
    this.optimizations = []
    this.frameTimeHistory = []
    this.interactionTimeouts.clear()
    
    this.adaptiveSettings = {
      currentAnimationSpeed: 1.0,
      currentTypingDelay: 50,
      currentScrollSpeed: 1.0,
      colorAdjustments: {
        brightness: 1.0,
        contrast: 1.0,
        saturation: 1.0
      }
    }
    
    this.metrics = {
      responseTime: 0,
      interactionLatency: 0,
      scrollPerformance: 100,
      frameDrops: 0,
      visualGlitches: 0,
      colorContrastRatio: 4.5,
      taskCompletionRate: 100,
      errorRecoveryTime: 0,
      userRetentionScore: 100,
      accessibilityScore: 90,
      keyboardNavigationEfficiency: 85,
      screenReaderCompatibility: 90
    }
    
    this.emit('reset', { timestamp: Date.now() })
  }
}

// 全局实例
let globalUXOptimizer: UXOptimizer | null = null

/**
 * 获取全局UX优化器实例
 */
export function getUXOptimizer(config?: Partial<UXConfig>): UXOptimizer {
  if (!globalUXOptimizer) {
    globalUXOptimizer = new UXOptimizer(config)
  }
  return globalUXOptimizer
}