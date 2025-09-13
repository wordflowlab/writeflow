import { useState, useCallback, useRef } from 'react'
import { WriteFlowApp } from '../../cli/writeflow-app.js'
import { InputMode } from '../types/index.js'

import { debugLog, logError, logWarn, infoLog } from './../../utils/log.js'

interface AgentExecution {
  id: string
  type: 'command' | 'bash' | 'memory'
  input: string
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: string
  error?: string
  startTime: Date
  endTime?: Date
}

export function useAgent(writeFlowApp: WriteFlowApp) {
  const [executions, setExecutions] = useState<AgentExecution[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const executionCounter = useRef(0)

  const createExecution = useCallback((
    type: 'command' | 'bash' | 'memory',
    input: string
  ): AgentExecution => {
    executionCounter.current++
    return {
      id: `exec-${Date.now()}-${executionCounter.current}`,
      type,
      input,
      status: 'pending',
      startTime: new Date()
    }
  }, [])

  const updateExecution = useCallback((id: string, updates: Partial<AgentExecution>) => {
    setExecutions(prev => prev.map(exec => 
      exec.id === id ? { ...exec, ...updates } : exec
    ))
  }, [])

  const executeCommand = useCallback(async (command: string): Promise<string> => {
    const execution = createExecution('command', command)
    
    setExecutions(prev => [...prev, execution])
    setIsProcessing(true)
    
    try {
      updateExecution(execution.id, { status: 'running' })
      
      const result = await writeFlowApp.executeCommand(command)
      
      updateExecution(execution.id, {
        status: 'completed',
        result,
        endTime: new Date()
      })
      
      return result
      
    } catch (error) {
      const errorMessage = (error as Error).message
      
      updateExecution(execution.id, {
        status: 'error',
        error: errorMessage,
        endTime: new Date()
      })
      
      throw error
      
    } finally {
      setIsProcessing(false)
    }
  }, [writeFlowApp, createExecution, updateExecution])

  const executeBash = useCallback(async (command: string): Promise<string> => {
    const execution = createExecution('bash', command)
    
    setExecutions(prev => [...prev, execution])
    setIsProcessing(true)
    
    try {
      updateExecution(execution.id, { status: 'running' })
      
      // 实际bash执行逻辑
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024
      })
      
      const result = stdout || stderr
      
      updateExecution(execution.id, {
        status: 'completed',
        result,
        endTime: new Date()
      })
      
      return result
      
    } catch (error) {
      const errorMessage = (error as Error).message
      
      updateExecution(execution.id, {
        status: 'error',
        error: errorMessage,
        endTime: new Date()
      })
      
      return `❌ 命令执行失败: ${errorMessage}`
      
    } finally {
      setIsProcessing(false)
    }
  }, [createExecution, updateExecution])

  const saveMemoryNote = useCallback(async (note: string): Promise<void> => {
    const execution = createExecution('memory', note)
    
    setExecutions(prev => [...prev, execution])
    
    try {
      updateExecution(execution.id, { status: 'running' })
      
      // 使用集成的记忆系统保存笔记
      const memoryManager = writeFlowApp.getMemoryManager()
      if (memoryManager) {
        await memoryManager.addMessage('system', `📝 用户笔记: ${note}`, { type: 'user_note' })
        debugLog(`📝 笔记已保存到记忆系统: ${note}`)
      } else {
        debugLog(`📝 保存笔记: ${note}`)
      }
      
      updateExecution(execution.id, {
        status: 'completed',
        result: '笔记已保存到记忆系统',
        endTime: new Date()
      })
      
    } catch (error) {
      updateExecution(execution.id, {
        status: 'error',
        error: (error as Error).message,
        endTime: new Date()
      })
    }
  }, [createExecution, updateExecution, writeFlowApp])

  const processInput = useCallback(async (input: string, inputMode: InputMode): Promise<string> => {
    switch (inputMode) {
      case InputMode.Bash:
        return await executeBash(input)
        
      case InputMode.Memory:
        await saveMemoryNote(input)
        return '📝 笔记已保存'
        
      default:
        if (input.startsWith('/')) {
          return await executeCommand(input)
        } else {
          // 自由文本处理
          return await executeCommand(input)
        }
    }
  }, [executeCommand, executeBash, saveMemoryNote])

  const clearExecutions = useCallback(() => {
    setExecutions([])
  }, [])

  return {
    executions,
    isProcessing,
    executeCommand,
    executeBash,
    saveMemoryNote,
    processInput,
    clearExecutions
  }
}