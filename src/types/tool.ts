export interface ToolInput {
  [key: string]: any
}

export interface ToolResult {
  success: boolean
  content?: string
  metadata?: Record<string, any>
  error?: string
  warnings?: string[]
}

export interface FileMetadata {
  path: string
  size: number
  wordCount: number
  lineCount: number
  encoding: string
  format: FileFormat
  lastModified: number
  checksum: string
}

export type FileFormat = 'markdown' | 'html' | 'text' | 'docx' | 'pdf' | 'unknown'

export interface WritingTool {
  name: string
  description: string
  securityLevel: 'safe' | 'ai-powered' | 'restricted'
  
  execute(input: ToolInput): Promise<ToolResult>
  validateInput?(input: ToolInput): Promise<boolean>
}

export interface FileState {
  path: string
  lastRead: number
  checksum: string
  isModified: boolean
  backupPath?: string
}

export interface ReadOptions {
  offset?: number
  limit?: number
  encoding?: string
  detectMalicious?: boolean
}

export interface WriteOptions {
  backup?: boolean
  atomic?: boolean
  validateChecksum?: boolean
  encoding?: string
}