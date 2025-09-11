/**
 * 智能格式化器 - 简化版本
 * 提供基本的内容格式化和折叠功能
 */

import React from 'react'
import { Box, Text } from 'ink'
import { analyzeContent } from './contentAnalyzer.js'
import { CollapsibleContentType } from '../types/CollapsibleContent.js'
import { defaultColorScheme } from './colorScheme.js'

export interface FormattingOptions {
  /**
   * 是否启用智能折叠
   */
  enableCollapsing?: boolean
  
  /**
   * 最大显示行数（超过则自动折叠）
   */
  maxLines?: number
  
  /**
   * 是否显示统计信息
   */
  showStats?: boolean
  
  /**
   * 内容类型（如果已知）
   */
  contentType?: CollapsibleContentType
}

export class SmartFormatter {
  /**
   * 智能格式化内容 - 主入口
   */
  format(content: string, options: FormattingOptions = {}): React.ReactElement {
    const {
      enableCollapsing = true,
      maxLines = 15,
      showStats = true,
      contentType
    } = options
    
    // 分析内容
    const analysis = analyzeContent(content)
    const detectedType = contentType || analysis.contentType
    
    // 根据内容类型选择格式化策略
    switch (detectedType) {
      case 'code-block':
        return this.formatCodeBlock(content)
      
      case 'error-message':
        return this.formatErrorMessage(content)
      
      case 'bash-output':
        return this.formatBashOutput(content)
      
      case 'file-content':
        return this.formatFileContent(content)
      
      default:
        return this.formatPlainText(content)
    }
  }
  
  /**
   * 格式化代码块
   */
  private formatCodeBlock(content: string): React.ReactElement {
    const lines = content.split('\n')
    
    return (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text color={defaultColorScheme.code}>💻 代码块</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2} paddingX={1}>
          {lines.map((line, index) => (
            <Text key={index} color={defaultColorScheme.code}>
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    )
  }
  
  /**
   * 格式化错误信息
   */
  private formatErrorMessage(content: string): React.ReactElement {
    const lines = content.split('\n')
    
    return (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text color={defaultColorScheme.error} bold>❌ 错误信息</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {lines.map((line, index) => (
            <Text key={index} color={defaultColorScheme.error}>
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    )
  }
  
  /**
   * 格式化 Bash 输出
   */
  private formatBashOutput(content: string): React.ReactElement {
    const lines = content.split('\n')
    
    return (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text color={defaultColorScheme.code}>⚡ 命令输出</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {lines.map((line, index) => {
            // 识别命令提示符
            const isCommand = /^[\$#>]/.test(line.trim())
            const color = isCommand ? defaultColorScheme.accent : defaultColorScheme.text
            
            return (
              <Text key={index} color={color}>
                {line}
              </Text>
            )
          })}
        </Box>
      </Box>
    )
  }
  
  /**
   * 格式化文件内容
   */
  private formatFileContent(content: string): React.ReactElement {
    const lines = content.split('\n')
    
    return (
      <Box flexDirection="column" marginY={1}>
        <Box marginBottom={1}>
          <Text color={defaultColorScheme.text}>📄 文件内容</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          {lines.map((line, index) => (
            <Text key={index} color={defaultColorScheme.text}>
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    )
  }
  
  /**
   * 格式化纯文本
   */
  private formatPlainText(content: string): React.ReactElement {
    const lines = content.split('\n')
    
    return (
      <Box flexDirection="column" marginY={1}>
        {lines.map((line, index) => (
          <Text key={index} color={defaultColorScheme.text}>
            {line}
          </Text>
        ))}
      </Box>
    )
  }
}

/**
 * 工具执行结果格式化器
 */
export class ToolResultFormatter {
  private formatter: SmartFormatter
  
  constructor() {
    this.formatter = new SmartFormatter()
  }
  
  /**
   * 格式化工具执行过程
   */
  formatToolExecution(
    toolName: string,
    params: Record<string, any>,
    result: string,
    status: 'executing' | 'success' | 'error' = 'success'
  ): React.ReactElement {
    return (
      <Box flexDirection="column" marginY={1}>
        {/* 工具头部 */}
        <Box flexDirection="row" marginBottom={1}>
          <Text color={defaultColorScheme.toolName} bold>
            {this.getToolEmoji(toolName)} {toolName}
          </Text>
          <Text color={this.getStatusColor(status)} bold>
            {' '}[{this.getStatusText(status)}]
          </Text>
        </Box>
        
        {/* 参数信息 */}
        {Object.keys(params).length > 0 && (
          <Box flexDirection="column" marginLeft={2} marginBottom={1}>
            <Text color={defaultColorScheme.dim}>参数:</Text>
            {Object.entries(params).map(([key, value]) => (
              <Box key={key} marginLeft={2}>
                <Text color={defaultColorScheme.secondary}>
                  {key}: {String(value)}
                </Text>
              </Box>
            ))}
          </Box>
        )}
        
        {/* 结果内容 */}
        <Box marginLeft={2}>
          {this.formatter.format(result, {
            enableCollapsing: true,
            showStats: true,
            maxLines: 10
          })}
        </Box>
      </Box>
    )
  }
  
  private getToolEmoji(toolName: string): string {
    const emojiMap: Record<string, string> = {
      'Read': '📖',
      'Write': '✍️',
      'Edit': '✏️',
      'Bash': '⚡',
      'Grep': '🔍',
      'Glob': '📁',
      'WebFetch': '🌐',
      'Task': '🎯',
      'TodoWrite': '📝'
    }
    return emojiMap[toolName] || '🔧'
  }
  
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'executing': '执行中',
      'success': '成功',
      'error': '错误'
    }
    return statusMap[status] || status
  }
  
  private getStatusColor(status: string): string {
    switch (status) {
      case 'executing': return defaultColorScheme.info
      case 'success': return defaultColorScheme.success
      case 'error': return defaultColorScheme.error
      default: return defaultColorScheme.text
    }
  }
}

/**
 * 全局格式化器实例
 */
export const smartFormatter = new SmartFormatter()
export const toolFormatter = new ToolResultFormatter()

/**
 * 快捷格式化函数
 */
export const formatContent = {
  /**
   * 智能格式化任意内容
   */
  smart: (content: string, options?: FormattingOptions) => 
    smartFormatter.format(content, options),
  
  /**
   * 格式化工具执行结果
   */
  toolResult: (toolName: string, params: Record<string, any>, result: string, status?: 'executing' | 'success' | 'error') =>
    toolFormatter.formatToolExecution(toolName, params, result, status),
  
  /**
   * 格式化代码
   */
  code: (content: string) =>
    smartFormatter.format(content, {
      contentType: 'code-block',
      enableCollapsing: true
    }),
  
  /**
   * 格式化错误
   */
  error: (content: string) =>
    smartFormatter.format(content, {
      contentType: 'error-message',
      enableCollapsing: false
    }),
  
  /**
   * 格式化文件内容
   */
  file: (content: string) =>
    smartFormatter.format(content, {
      contentType: 'file-content',
      enableCollapsing: true,
      showStats: true
    })
}