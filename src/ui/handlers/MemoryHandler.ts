import { promises as fs } from 'fs'
import path from 'path'

import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'

interface MemoryNote {
  id: string
  content: string
  timestamp: Date
  tags: string[]
}

export class MemoryHandler {
  private notes: MemoryNote[] = []
  private memoryFile: string

  constructor(workingDirectory: string = process.cwd()) {
    this.memoryFile = path.join(workingDirectory, '.writeflow-memory.json')
    this.loadMemory()
  }

  async addNote(content: string): Promise<void> {
    const note: MemoryNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: new Date(),
      tags: this.extractTags(content)
    }

    this.notes.push(note)
    await this.saveMemory()
  }

  async getNotes(limit?: number): Promise<MemoryNote[]> {
    const sorted = this.notes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return limit ? sorted.slice(0, limit) : sorted
  }

  async searchNotes(query: string): Promise<MemoryNote[]> {
    const lowerQuery = query.toLowerCase()
    return this.notes.filter(note => 
      note.content.toLowerCase().includes(lowerQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  async deleteNote(id: string): Promise<boolean> {
    const index = this.notes.findIndex(note => note.id === id)
    if (index !== -1) {
      this.notes.splice(index, 1)
      await this.saveMemory()
      return true
    }
    return false
  }

  async clearAllNotes(): Promise<void> {
    this.notes = []
    await this.saveMemory()
  }

  private extractTags(content: string): string[] {
    // 提取 #tag 格式的标签
    const tagMatches = content.match(/#\w+/g)
    return tagMatches ? tagMatches.map(tag => tag.substring(1)) : []
  }

  private async loadMemory(): Promise<void> {
    try {
      const data = await fs.readFile(this.memoryFile, 'utf8')
      this.notes = JSON.parse(data).map((note: any) => ({
        ...note,
        timestamp: new Date(note.timestamp)
      }))
    } catch (error) {
      // 文件不存在或格式错误，使用空数组
      this.notes = []
    }
  }

  private async saveMemory(): Promise<void> {
    try {
      await fs.writeFile(this.memoryFile, JSON.stringify(this.notes, null, 2))
    } catch (error) {
      logError('保存笔记失败:', error)
    }
  }

  getStats(): {
    totalNotes: number
    tagsCount: number
    oldestNote: Date | null
    newestNote: Date | null
  } {
    if (this.notes.length === 0) {
      return {
        totalNotes: 0,
        tagsCount: 0,
        oldestNote: null,
        newestNote: null
      }
    }

    const timestamps = this.notes.map(note => note.timestamp.getTime())
    const allTags = this.notes.flatMap(note => note.tags)
    const uniqueTags = new Set(allTags)

    return {
      totalNotes: this.notes.length,
      tagsCount: uniqueTags.size,
      oldestNote: new Date(Math.min(...timestamps)),
      newestNote: new Date(Math.max(...timestamps))
    }
  }
}