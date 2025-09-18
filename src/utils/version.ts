import { readFileSync, existsSync, readdirSync } from 'fs'
import { dirname, join } from 'path'

// 硬编码版本号作为最终后备
const FALLBACK_VERSION = '2.21.5'

// 获取WriteFlow包的根目录
function getWriteFlowRoot(): string {
  // 优先方法1: 从当前工作目录向上查找（开发环境优先）
  let currentPath = process.cwd()
  while (currentPath !== '/' && currentPath !== '.') {
    try {
      const packagePath = join(currentPath, 'package.json')
      if (existsSync(packagePath)) {
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
        if (packageJson.name === 'writeflow') {
          return currentPath
        }
      }
    } catch (error) {
      // 继续向上查找
    }
    currentPath = dirname(currentPath)
  }
  
  // 方法2: 尝试从全局安装路径定位
  try {
    const possiblePaths = []
    
    // NVM 全局安装路径（动态获取）
    if (process.env.NVM_BIN) {
      possiblePaths.push(join(dirname(process.env.NVM_BIN), 'lib', 'node_modules', 'writeflow'))
    }
    
    // 尝试查找 NVM 路径下的所有 Node.js 版本
    if (process.env.HOME) {
      try {
        const nvmPath = join(process.env.HOME, '.nvm/versions/node')
        if (existsSync(nvmPath)) {
          const nodeVersions = readdirSync(nvmPath)
          for (const version of nodeVersions) {
            possiblePaths.push(join(nvmPath, version, 'lib', 'node_modules', 'writeflow'))
          }
        }
      } catch (error) {
        // 忽略错误，继续其他路径
      }
    }
    
    // 标准全局安装路径
    possiblePaths.push(
      '/opt/homebrew/lib/node_modules/writeflow',
      '/usr/local/lib/node_modules/writeflow',
      '/usr/lib/node_modules/writeflow',
      // 本地安装路径 
      join(process.cwd(), 'node_modules', 'writeflow'),
    )
    
    for (const path of possiblePaths) {
      const packagePath = join(path, 'package.json')
      if (existsSync(packagePath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
          if (packageJson.name === 'writeflow') {
            return path
          }
        } catch (error) {
          // 继续尝试下一个路径
        }
      }
    }
  } catch (error) {
    // 忽略错误，继续使用其他方法
  }
  
  // 如果都找不到，返回null表示需要使用后备版本
  return ''
}

/**
 * 从package.json读取当前版本号
 */
export function getVersion(): string {
  try {
    const writeflowRoot = getWriteFlowRoot()
    
    if (writeflowRoot) {
      const packageJsonPath = join(writeflowRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      return packageJson.version || FALLBACK_VERSION
    }
    
    // 如果找不到package.json，使用后备版本
    return FALLBACK_VERSION
  } catch (error) {
    // 发生任何错误都使用后备版本，不再打印错误信息
    return FALLBACK_VERSION
  }
}

/**
 * 获取格式化的版本字符串
 */
export function getVersionString(prefix = 'v'): string {
  return `${prefix}${getVersion()}`
}