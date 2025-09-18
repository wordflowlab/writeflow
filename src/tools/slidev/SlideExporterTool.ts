import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { WritingTool, ToolInput, ToolResult } from '../../types/tool.js'

export interface SlideExporterInput extends ToolInput {
  target: string // slides.md 或包含 slides.md 的目录
  format?: 'pdf' | 'png'
}

/**
 * SlideExporter 工具
 * - 通过调用 `npx slidev export` 将 Slidev 文档导出为 PDF 或 PNG
 * - 注意：不直接支持 PPTX，需借助其他链路（Marp/Pandoc 或 PDF->PPTX）
 */
export class SlideExporterTool implements WritingTool {
  name = 'SlideExporter'
  description = 'Export Slidev slides to PDF/PNG using slidev export'
  securityLevel: 'safe' | 'ai-powered' | 'restricted' = 'restricted'

  async execute(input: SlideExporterInput): Promise<ToolResult> {
    const target = resolve(input.target)
    const isDir = !target.endsWith('.md')
    const slidesPath = isDir ? join(target, 'slides.md') : target

    if (!existsSync(slidesPath)) {
      return {
        success: false,
        error: `未找到 slides.md：${slidesPath}`,
        warnings: [
          '请确保目标路径为 slides.md 或包含 slides.md 的目录',
        ]
      }
    }

    const format = input.format === 'png' ? 'png' : 'pdf'
    const params = ['-y', 'slidev', 'export', slidesPath]
    if (format === 'png') {
      params.splice(3, 0, '--format', 'png')
    }

    try {
      const r = spawnSync('npx', params, { stdio: 'inherit' })
      if (r.status === 0) {
        return {
          success: true,
          content: `已导出 ${format.toUpperCase()}，请在同目录查看生成文件`,
          metadata: { target: slidesPath, format }
        }
      }
      return {
        success: false,
        error: 'slidev export 执行失败',
        warnings: [
          '可能原因：当前 npm 源无法获取 @slidev/cli，或网络受限',
          '建议：npm config set registry https://registry.npmjs.org/，或本地安装 @slidev/cli 后重试',
          '手动命令：npx -y slidev export slides.md'
        ]
      }
    } catch (e) {
      return {
        success: false,
        error: `无法调用 npx slidev：${(e as Error).message}`,
        warnings: ['请手动执行：npx -y slidev export slides.md']
      }
    }
  }
}


