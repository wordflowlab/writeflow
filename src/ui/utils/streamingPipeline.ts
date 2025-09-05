/**
 * WriteFlow 流式输出管道系统
 * 实现实时格式化和双缓冲渲染
 */

import { EventEmitter } from 'events'
import { OutputFormatter, OutputFormatOptions, FormattedOutput } from './outputFormatter.js'
import { extractCodeBlocks } from './codeFormatter.js'

export interface StreamChunk {
  content: string
  type: 'text' | 'markdown' | 'code' | 'complete'
  index: number
  totalLength: number
  timestamp: number
}

export interface RenderBuffer {
  id: string
  content: string
  formatted?: string
  isComplete: boolean
  lastUpdate: number
}

export interface StreamingPipelineOptions extends OutputFormatOptions {
  chunkSize?: number
  renderDelay?: number
  bufferTimeout?: number
  enableDoubleBuffer?: boolean
  onChunk?: (chunk: StreamChunk) => void
  onFormatted?: (buffer: RenderBuffer) => void
  onComplete?: (finalBuffer: RenderBuffer) => void
}

/**
 * 流式输出管道管理器
 */
export class StreamingPipeline extends EventEmitter {
  private formatter: OutputFormatter
  private options: Required<StreamingPipelineOptions>
  private buffers: Map<string, RenderBuffer> = new Map()
  private activeStreams: Map<string, NodeJS.Timeout> = new Map()
  
  constructor(options: StreamingPipelineOptions = {}) {
    super()
    
    this.options = {
      theme: options.theme || 'dark',
      maxWidth: options.maxWidth || process.stdout.columns - 4,
      showProgress: options.showProgress ?? true,
      enableColors: options.enableColors ?? true,
      lineNumbers: options.lineNumbers ?? true,
      chunkSize: options.chunkSize || 50,
      renderDelay: options.renderDelay || 100,
      bufferTimeout: options.bufferTimeout || 500,
      enableDoubleBuffer: options.enableDoubleBuffer ?? true,
      onChunk: options.onChunk || (() => {}),
      onFormatted: options.onFormatted || (() => {}),
      onComplete: options.onComplete || (() => {})
    }
    
    this.formatter = new OutputFormatter({
      theme: this.options.theme,
      maxWidth: this.options.maxWidth,
      showProgress: this.options.showProgress,
      enableColors: this.options.enableColors,
      lineNumbers: this.options.lineNumbers
    })
  }

  /**
   * 开始流式处理
   */
  startStream(streamId: string, totalLength?: number): void {
    const buffer: RenderBuffer = {
      id: streamId,
      content: '',
      isComplete: false,
      lastUpdate: Date.now()
    }
    
    this.buffers.set(streamId, buffer)
    this.emit('streamStarted', streamId, totalLength)
  }

  /**
   * 添加内容块到流
   */
  addChunk(streamId: string, chunk: string, totalLength?: number): void {
    const buffer = this.buffers.get(streamId)
    if (!buffer) {
      this.startStream(streamId, totalLength)
      return this.addChunk(streamId, chunk, totalLength)
    }

    // 更新缓冲区内容
    buffer.content += chunk
    buffer.lastUpdate = Date.now()

    // 创建流块事件
    const streamChunk: StreamChunk = {
      content: chunk,
      type: this.detectContentType(chunk),
      index: buffer.content.length - chunk.length,
      totalLength: totalLength || buffer.content.length,
      timestamp: Date.now()
    }

    // 触发块事件
    this.options.onChunk(streamChunk)
    this.emit('chunk', streamId, streamChunk)

    // 如果启用双缓冲，延迟格式化
    if (this.options.enableDoubleBuffer) {
      this.scheduleFormatting(streamId)
    } else {
      // 立即格式化
      this.formatBuffer(streamId)
    }
  }

  /**
   * 完成流处理
   */
  completeStream(streamId: string): void {
    const buffer = this.buffers.get(streamId)
    if (!buffer) return

    buffer.isComplete = true
    
    // 清除延迟格式化
    const timeout = this.activeStreams.get(streamId)
    if (timeout) {
      clearTimeout(timeout)
      this.activeStreams.delete(streamId)
    }

    // 最终格式化
    this.formatBuffer(streamId, true)

    // 触发完成事件
    const completChunk: StreamChunk = {
      content: buffer.content,
      type: 'complete',
      index: 0,
      totalLength: buffer.content.length,
      timestamp: Date.now()
    }

    this.options.onComplete(buffer)
    this.emit('complete', streamId, buffer)
    this.emit('chunk', streamId, completChunk)

    // 清理缓冲区
    setTimeout(() => {
      this.buffers.delete(streamId)
    }, 1000)
  }

  /**
   * 获取流的当前状态
   */
  getStreamStatus(streamId: string): RenderBuffer | null {
    return this.buffers.get(streamId) || null
  }

  /**
   * 获取所有活动流
   */
  getActiveStreams(): string[] {
    return Array.from(this.buffers.keys())
  }

  /**
   * 终止流处理
   */
  terminateStream(streamId: string): void {
    const timeout = this.activeStreams.get(streamId)
    if (timeout) {
      clearTimeout(timeout)
      this.activeStreams.delete(streamId)
    }
    
    this.buffers.delete(streamId)
    this.emit('terminated', streamId)
  }

  /**
   * 清理所有流
   */
  cleanup(): void {
    for (const [streamId] of this.activeStreams) {
      this.terminateStream(streamId)
    }
    this.buffers.clear()
    this.removeAllListeners()
  }

  /**
   * 检测内容类型
   */
  private detectContentType(content: string): 'text' | 'markdown' | 'code' {
    // 检测 Markdown 标记
    if (content.includes('```') || content.includes('# ') || content.includes('## ')) {
      return 'markdown'
    }

    // 检测代码块
    const codeBlocks = extractCodeBlocks(content)
    if (codeBlocks.length > 0) {
      return 'code'
    }

    // 检测代码特征
    const codeIndicators = ['function', 'const', 'let', 'var', 'class', 'interface', '=>', '{}', '[]']
    if (codeIndicators.some(indicator => content.includes(indicator))) {
      return 'code'
    }

    return 'text'
  }

  /**
   * 调度格式化任务
   */
  private scheduleFormatting(streamId: string): void {
    // 清除之前的调度
    const existingTimeout = this.activeStreams.get(streamId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // 设置新的格式化延迟
    const timeout = setTimeout(() => {
      this.formatBuffer(streamId)
      this.activeStreams.delete(streamId)
    }, this.options.renderDelay)

    this.activeStreams.set(streamId, timeout)
  }

  /**
   * 格式化缓冲区内容
   */
  private formatBuffer(streamId: string, isFinal: boolean = false): void {
    const buffer = this.buffers.get(streamId)
    if (!buffer) return

    try {
      // 格式化内容
      const formatted = this.formatter.formatStreamOutput(buffer.content)
      buffer.formatted = formatted.content

      // 触发格式化事件
      this.options.onFormatted(buffer)
      this.emit('formatted', streamId, buffer, formatted)

      // 如果是最终格式化，添加性能信息
      if (isFinal) {
        this.emit('performance', streamId, {
          contentLength: buffer.content.length,
          formatTime: formatted.renderTime,
          hasCodeBlocks: formatted.hasCodeBlocks,
          codeBlockCount: formatted.codeBlockCount
        })
      }

    } catch (error) {
      console.warn(`流式格式化失败 [${streamId}]:`, error)
      buffer.formatted = buffer.content // 降级到原始内容
      this.emit('error', streamId, error)
    }
  }

  /**
   * 更新管道选项
   */
  updateOptions(options: Partial<StreamingPipelineOptions>): void {
    this.options = { ...this.options, ...options }
    
    // 更新格式化器选项
    this.formatter.updateOptions({
      theme: this.options.theme,
      maxWidth: this.options.maxWidth,
      showProgress: this.options.showProgress,
      enableColors: this.options.enableColors,
      lineNumbers: this.options.lineNumbers
    })
  }

  /**
   * 获取管道统计信息
   */
  getStats(): {
    activeStreams: number
    totalBuffers: number
    memoryUsage: number
  } {
    let memoryUsage = 0
    for (const [, buffer] of this.buffers) {
      memoryUsage += buffer.content.length + (buffer.formatted?.length || 0)
    }

    return {
      activeStreams: this.activeStreams.size,
      totalBuffers: this.buffers.size,
      memoryUsage
    }
  }
}

/**
 * 全局流式管道实例
 */
let globalPipeline: StreamingPipeline | null = null

/**
 * 获取全局流式管道
 */
export function getStreamingPipeline(options?: StreamingPipelineOptions): StreamingPipeline {
  if (!globalPipeline) {
    globalPipeline = new StreamingPipeline(options)
  } else if (options) {
    globalPipeline.updateOptions(options)
  }
  return globalPipeline
}

/**
 * 便捷函数：创建新的流式处理器
 */
export function createStreamProcessor(
  streamId: string,
  options?: StreamingPipelineOptions
): {
  pipeline: StreamingPipeline
  addChunk: (chunk: string) => void
  complete: () => void
  terminate: () => void
} {
  const pipeline = getStreamingPipeline(options)
  
  return {
    pipeline,
    addChunk: (chunk: string) => pipeline.addChunk(streamId, chunk),
    complete: () => pipeline.completeStream(streamId),
    terminate: () => pipeline.terminateStream(streamId)
  }
}