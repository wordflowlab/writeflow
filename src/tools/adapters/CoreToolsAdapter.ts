import { WritingTool as LegacyWritingTool, ToolInput, ToolResult } from '../../types/tool.js'
import { WriteFlowTool, ToolUseContext } from '../../Tool.js'

// 直接导入工具类
import { ReadTool } from '../file/ReadTool/ReadTool.js'
import { WriteTool } from '../file/WriteTool/WriteTool.js'
import { EditTool } from '../file/EditTool/EditTool.js'
import { MultiEditTool } from '../file/MultiEditTool/MultiEditTool.js'
import { GlobTool } from '../search/GlobTool/GlobTool.js'
import { GrepTool } from '../search/GrepTool/GrepTool.js'
import { BashTool } from '../system/BashTool/BashTool.js'

/**
 * 核心工具适配器
 * 将新的 WriteFlowTool 接口适配到传统的 WritingTool 接口
 */
class CoreToolAdapter implements LegacyWritingTool {
  name: string
  description: string
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'safe'

  constructor(private modernTool: WriteFlowTool) {
    this.name = modernTool.name
    this.description = '核心文件操作工具'
  }

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      // 创建模拟的上下文
      const context: ToolUseContext = {
        abortController: new AbortController(),
        readFileTimestamps: {},
        options: {
          verbose: false,
          safeMode: true
        }
      }

      // 将旧的输入格式转换为新的格式
      const modernInput = this.convertInput(input)

      // 调用新工具的 call 方法（它返回 AsyncGenerator）
      const generator = this.modernTool.call(modernInput, context)
      
      // 收集所有结果
      const results: any[] = []
      for await (const result of generator) {
        results.push(result)
      }

      // 返回最后一个结果或合并结果
      const finalResult = results[results.length - 1]
      
      // 转换为旧的输出格式
      return this.convertOutput(finalResult, results)

    } catch (error) {
      return {
        success: false,
        error: `工具执行失败: ${(error as Error).message}`
      }
    }
  }

  private convertInput(input: ToolInput): any {
    // 根据不同工具转换输入格式
    if (this.modernTool === readTool) {
      return {
        file_path: input.file_path || input.filePath
      }
    }
    
    if (this.modernTool === writeTool) {
      return {
        file_path: input.file_path || input.filePath,
        content: input.content
      }
    }
    
    if (this.modernTool === editTool) {
      return {
        file_path: input.file_path || input.filePath,
        old_string: input.old_string || input.oldString,
        new_string: input.new_string || input.newString
      }
    }

    return input
  }

  private convertOutput(finalResult: any, allResults: any[]): ToolResult {
    // 根据不同工具转换输出格式
    if (this.modernTool.name === 'Read') {
      if (finalResult?.content) {
        return {
          success: true,
          content: finalResult.content,
          metadata: finalResult.fileInfo ? {
            size: finalResult.fileInfo.size,
            lineCount: finalResult.fileInfo.lines,
            wordCount: finalResult.content.split(/\s+/).length,
            format: finalResult.fileInfo.extension || 'unknown',
            lastModified: Date.now()
          } : undefined
        }
      } else {
        return {
          success: false,
          error: '读取文件失败'
        }
      }
    }

    if (this.modernTool.name === 'Write' || this.modernTool.name === 'Edit') {
      // 检查是否成功完成
      const hasError = allResults.some(result => result?.error)
      if (hasError) {
        const errorResult = allResults.find(result => result?.error)
        return {
          success: false,
          error: errorResult.error
        }
      }

      return {
        success: true,
        content: this.modernTool.name === 'Write' ? '文件写入成功' : '文件编辑成功'
      }
    }

    // 默认输出格式
    return {
      success: true,
      content: JSON.stringify(finalResult)
    }
  }
}

// 创建工具实例
const readTool = new ReadTool()
const writeTool = new WriteTool()
const editTool = new EditTool()
const multiEditTool = new MultiEditTool()
const globTool = new GlobTool()
const grepTool = new GrepTool()
const bashTool = new BashTool()

// 创建适配器实例
export const readToolAdapter = new CoreToolAdapter(readTool)
export const writeToolAdapter = new CoreToolAdapter(writeTool) 
export const editToolAdapter = new CoreToolAdapter(editTool)
export const multiEditToolAdapter = new CoreToolAdapter(multiEditTool)
export const globToolAdapter = new CoreToolAdapter(globTool)
export const grepToolAdapter = new CoreToolAdapter(grepTool)
export const bashToolAdapter = new CoreToolAdapter(bashTool)

// 具体的工厂函数 - AgentLoader 需要这些类
export class ReadToolAdapter extends CoreToolAdapter {
  constructor() { super(new ReadTool()) }
}

export class WriteToolAdapter extends CoreToolAdapter {
  constructor() { super(new WriteTool()) }
}

export class EditToolAdapter extends CoreToolAdapter {
  constructor() { super(new EditTool()) }
}

export class MultiEditToolAdapter extends CoreToolAdapter {
  constructor() { super(new MultiEditTool()) }
}

export class GlobToolAdapter extends CoreToolAdapter {
  constructor() { super(new GlobTool()) }
}

export class GrepToolAdapter extends CoreToolAdapter {
  constructor() { super(new GrepTool()) }
}

export class BashToolAdapter extends CoreToolAdapter {
  constructor() { super(new BashTool()) }
}

// 工厂函数
export function createCoreToolAdapters(): LegacyWritingTool[] {
  return [
    readToolAdapter,
    writeToolAdapter,
    editToolAdapter,
    multiEditToolAdapter,
    globToolAdapter,
    grepToolAdapter,
    bashToolAdapter
  ]
}