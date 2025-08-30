import { readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'

// 获取项目根目录
function getProjectRoot(): string {  
  // 从当前工作目录向上查找package.json
  let currentPath = process.cwd()
  while (currentPath !== '/' && currentPath !== '.') {
    try {
      const packagePath = join(currentPath, 'package.json')
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
      if (packageJson.name === 'writeflow') {
        return currentPath
      }
    } catch (error) {
      // 继续向上查找
    }
    currentPath = dirname(currentPath)
  }
  
  // 如果都找不到，使用当前工作目录
  return process.cwd()
}

/**
 * 从package.json读取当前版本号
 */
export function getVersion(): string {
  try {
    const projectRoot = getProjectRoot()
    const packageJsonPath = resolve(projectRoot, 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.version || '0.0.0'
  } catch (error) {
    console.warn('Failed to read version from package.json:', error)
    return '0.0.0'
  }
}

/**
 * 获取格式化的版本字符串
 */
export function getVersionString(prefix = 'v'): string {
  return `${prefix}${getVersion()}`
}