import { isAbsolute, resolve, relative } from 'path'
import { debugLog } from '../log.js'

/**
 * 参考 Kode 实现的简单权限系统
 * 使用内存中的 Set 存储允许的目录，按目录层级授权
 */

// 内存中的权限存储，会话期间有效
const readFileAllowedDirectories: Set<string> = new Set()
const writeFileAllowedDirectories: Set<string> = new Set()

/**
 * 确保路径是绝对路径
 */
export function toAbsolutePath(path: string): string {
  const abs = isAbsolute(path) ? resolve(path) : resolve(process.cwd(), path)
  return normalizeForCompare(abs)
}

function normalizeForCompare(p: string): string {
  // 标准化路径分隔符并解析 .. 和 . 段
  const norm = resolve(p)
  // 在 Windows 上，比较应该不区分大小写
  return process.platform === 'win32' ? norm.toLowerCase() : norm
}

function isSubpath(base: string, target: string): boolean {
  const rel = relative(base, target)
  // 如果为空或相等，则是同一路径
  if (!rel || rel === '') return true
  // 如果开始于 ..，则不是子路径
  if (rel.startsWith('..')) return false
  // 如果是绝对路径，则不是子路径
  if (isAbsolute(rel)) return false
  return true
}

/**
 * 检查路径是否在当前工作目录内
 */
export function pathInWorkingDirectory(path: string): boolean {
  const absolutePath = toAbsolutePath(path)
  const base = toAbsolutePath(process.cwd())
  const result = isSubpath(base, absolutePath)
  
  return result
}

/**
 * 检查读取权限
 */
export function hasReadPermission(path: string): boolean {
  const absolutePath = toAbsolutePath(path)
  for (const allowedPath of readFileAllowedDirectories) {
    if (isSubpath(allowedPath, absolutePath)) return true
  }
  return false
}

/**
 * 检查写入权限 - Kode 风格的简单实现
 */
export function hasWritePermission(path: string): boolean {
  const absolutePath = toAbsolutePath(path)
  
  // 检查是否在允许的目录中
  for (const allowedPath of writeFileAllowedDirectories) {
    if (isSubpath(allowedPath, absolutePath)) {
      debugLog(`文件写入权限检查通过: ${absolutePath} (在允许目录 ${allowedPath} 中)`)
      return true
    }
  }
  
  debugLog(`文件写入权限被拒绝: ${absolutePath}`)
  return false
}

/**
 * 保存读取权限
 */
function saveReadPermission(directory: string): void {
  const absolutePath = toAbsolutePath(directory)
  // 移除被新路径包含的现有子路径
  for (const allowedPath of Array.from(readFileAllowedDirectories)) {
    if (isSubpath(absolutePath, allowedPath)) {
      readFileAllowedDirectories.delete(allowedPath)
    }
  }
  readFileAllowedDirectories.add(absolutePath)
  debugLog(`已保存读取权限: ${absolutePath}`)
}

/**
 * 保存写入权限
 */
function saveWritePermission(directory: string): void {
  const absolutePath = toAbsolutePath(directory)
  // 移除被新路径包含的现有子路径
  for (const allowedPath of Array.from(writeFileAllowedDirectories)) {
    if (isSubpath(absolutePath, allowedPath)) {
      writeFileAllowedDirectories.delete(allowedPath)
    }
  }
  writeFileAllowedDirectories.add(absolutePath)
  debugLog(`已保存写入权限: ${absolutePath}`)
}

/**
 * 授权当前工作目录的写入权限
 */
export function grantWritePermissionForWorkingDir(): void {
  const workingDir = process.cwd()
  saveWritePermission(workingDir)
  debugLog(`已授权当前工作目录写入权限: ${workingDir}`)
}

/**
 * 授权当前工作目录的读取权限
 */
export function grantReadPermissionForWorkingDir(): void {
  const workingDir = process.cwd()
  saveReadPermission(workingDir)
  debugLog(`已授权当前工作目录读取权限: ${workingDir}`)
}

/**
 * 清除所有权限（测试用）
 */
export function clearFilePermissions(): void {
  readFileAllowedDirectories.clear()
  writeFileAllowedDirectories.clear()
  debugLog('已清除所有文件权限')
}