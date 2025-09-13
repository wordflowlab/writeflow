import { debugLog, logError, logWarn, infoLog } from '../../utils/log.js'

/**

 * AI 响应解析器
 * 将 AI 服务返回的字符串响应解析成结构化的 ContentBlock 数组
 * 遵循模块化架构，分离工具调用和文本内容
 */

import type { ContentBlock, TextBlock, ToolUseBlock, ThinkingBlock } from '../../types/UIMessage.js'
import { createTextBlock, createToolUseBlock } from '../../types/UIMessage.js'

export interface ParsedResponse {
  content: ContentBlock[]
  hasToolCalls: boolean
  toolCallIds: string[]
}

/**
 * 解析 AI 响应字符串为 ContentBlock 数组
 * 这是实现模块化架构的核心 - 确保工具调用和文本完全分离
 */
export function parseAIResponse(response: string): ParsedResponse {
  const blocks: ContentBlock[] = []
  const toolCallIds: string[] = []
  let hasToolCalls = false
  
  // 检查是否包含工具调用 JSON
  const toolCallMatches = findToolCallJSON(response)
  
  if (toolCallMatches.length > 0) {
    // 有工具调用 - 分离处理
    hasToolCalls = true
    let textContent = response
    
    // 提取每个工具调用并创建 tool_use block
    for (const match of toolCallMatches) {
      try {
        const toolCall = JSON.parse(match.json)
        const toolId = generateToolId()
        toolCallIds.push(toolId)
        
        // 创建工具使用块
        blocks.push(createToolUseBlock(toolId, 'todo_write', toolCall))
        
        // 从文本中移除 JSON 部分
        textContent = textContent.replace(match.json, '').trim()
      } catch (error) {
        // JSON 解析失败，当作文本处理
        logWarn('工具调用 JSON 解析失败:', error)
      }
    }
    
    // 如果还有剩余文本内容，创建文本块
    if (textContent && textContent.trim()) {
      blocks.push(createTextBlock(textContent.trim()))
    }
  } else {
    // 纯文本响应 - 直接创建文本块
    if (response && response.trim()) {
      blocks.push(createTextBlock(response.trim()))
    }
  }
  
  return {
    content: blocks,
    hasToolCalls,
    toolCallIds
  }
}

/**
 * 查找响应中的工具调用 JSON
 * 检测模式：{"todos": [...]} 或其他 JSON 对象
 */
function findToolCallJSON(text: string): Array<{ json: string, startIndex: number, endIndex: number }> {
  const matches: Array<{ json: string, startIndex: number, endIndex: number }> = []
  
  // 匹配完整的 JSON 对象
  const jsonRegex = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g
  let match
  
  while ((match = jsonRegex.exec(text)) !== null) {
    const jsonStr = match[0]
    
    try {
      const parsed = JSON.parse(jsonStr)
      
      // 检查是否是工具调用相关的 JSON
      if (isToolCallJSON(parsed)) {
        matches.push({
          json: jsonStr,
          startIndex: match.index,
          endIndex: match.index + jsonStr.length
        })
      }
    } catch {
      // 不是有效的 JSON，跳过
    }
  }
  
  return matches
}

/**
 * 判断 JSON 对象是否是工具调用
 */
function isToolCallJSON(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    return false
  }
  
  // 检查是否是 TODO 相关的 JSON
  if (obj.todos && Array.isArray(obj.todos)) {
    return true
  }
  
  // 检查是否是其他工具调用格式
  if (obj.tool_use_id || obj.tool_name || obj.function) {
    return true
  }
  
  return false
}

/**
 * 生成工具调用 ID
 */
function generateToolId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 解析流式响应 - 用于处理 SSE 流中的片段
 */
export function parseStreamingChunk(chunk: string, currentBlocks: ContentBlock[]): {
  newBlocks: ContentBlock[]
  shouldUpdateLast: boolean
  toolCallDetected: boolean
} {
  // 检查是否包含工具调用开始标记
  const toolCallDetected = chunk.includes('{"') || chunk.includes('{"todos"')
  
  if (toolCallDetected) {
    // 检测到可能的工具调用，需要特殊处理
    return {
      newBlocks: [...currentBlocks],
      shouldUpdateLast: false,
      toolCallDetected: true
    }
  }
  
  // 普通文本流 - 更新最后一个文本块或创建新的
  const newBlocks = [...currentBlocks]
  const lastBlock = newBlocks[newBlocks.length - 1]
  
  if (lastBlock && lastBlock.type === 'text') {
    // 更新最后一个文本块
    const updatedBlock: TextBlock = {
      type: 'text',
      text: lastBlock.text + chunk
    }
    newBlocks[newBlocks.length - 1] = updatedBlock
    
    return {
      newBlocks,
      shouldUpdateLast: true,
      toolCallDetected: false
    }
  } else {
    // 创建新的文本块
    newBlocks.push(createTextBlock(chunk))
    
    return {
      newBlocks,
      shouldUpdateLast: false,
      toolCallDetected: false
    }
  }
}

/**
 * 处理思考块的解析
 * 如果响应包含思考标记，将其解析为思考块
 */
export function parseThinkingContent(content: string): ContentBlock[] {
  const thinkingMarkers = ['<thinking>', '思考:', '💭']
  
  for (const marker of thinkingMarkers) {
    if (content.includes(marker)) {
      const thinkingBlock: ThinkingBlock = {
        type: 'thinking',
        content: content.replace(marker, '').trim()
      }
      return [thinkingBlock]
    }
  }
  
  // 没有思考标记，按普通内容处理
  return parseAIResponse(content).content
}

/**
 * 合并相邻的文本块
 * 用于优化渲染性能
 */
export function mergeAdjacentTextBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const merged: ContentBlock[] = []
  let currentText = ''
  
  for (const block of blocks) {
    if (block.type === 'text') {
      currentText += block.text
    } else {
      // 非文本块 - 先提交之前积累的文本
      if (currentText) {
        merged.push(createTextBlock(currentText))
        currentText = ''
      }
      merged.push(block)
    }
  }
  
  // 提交最后的文本
  if (currentText) {
    merged.push(createTextBlock(currentText))
  }
  
  return merged
}
