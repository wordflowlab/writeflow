#!/usr/bin/env node

/**
 * ESM 导入路径修复工具 - 借鉴 Kode 的自动修复机制
 * 
 * 解决 Windows 下的 ESM 兼容性问题：
 * 1. 自动为相对导入添加 .js 扩展名
 * 2. 标准化路径分隔符为正斜杠
 * 3. 修复动态 import() 语句
 * 4. 处理 export from 语句
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// 支持从命令行传入目录参数
const TARGET_DIR = process.argv[2] || 'src'
const EXTENSIONS_TO_PROCESS = ['.ts', '.tsx', '.js', '.jsx']

/**
 * 收集所有需要处理的文件
 */
function collectSourceFiles(dir, acc = []) {
  try {
    const items = readdirSync(dir)
    for (const name of items) {
      const fullPath = join(dir, name)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        // 跳过特定目录
        if (name === 'node_modules' || name === 'dist' || name === '.git') {
          continue
        }
        collectSourceFiles(fullPath, acc)
      } else if (stat.isFile()) {
        const ext = extname(fullPath)
        if (EXTENSIONS_TO_PROCESS.includes(ext)) {
          acc.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  读取目录失败 ${dir}:`, error.message)
  }
  return acc
}

/**
 * 修复文件中的 ESM 导入路径
 */
function fixImportsInFile(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch (error) {
    console.warn(`⚠️  读取文件失败 ${filePath}:`, error.message)
    return { modified: false, changes: [] }
  }
  
  let modified = false
  const changes = []
  let newContent = content
  
  // 1. 修复 import ... from '...' 语句
  newContent = newContent.replace(
    /(import\s+(?:[^;]+\s+from\s+)?['"])(\.{1,2}\/[^'"\n]+)(['"])/gm,
    (match, prefix, importPath, suffix) => {
      if (shouldAddExtension(importPath)) {
        const fixedPath = fixPath(importPath)
        changes.push(`${importPath} → ${fixedPath}`)
        modified = true
        return prefix + fixedPath + suffix
      }
      return match
    }
  )
  
  // 2. 修复 export ... from '...' 语句
  newContent = newContent.replace(
    /(export\s+(?:[^;]*?\s+from\s+)?['"])(\.{1,2}\/[^'"\n]+)(['"])/gm,
    (match, prefix, importPath, suffix) => {
      if (shouldAddExtension(importPath)) {
        const fixedPath = fixPath(importPath)
        changes.push(`export from: ${importPath} → ${fixedPath}`)
        modified = true
        return prefix + fixedPath + suffix
      }
      return match
    }
  )
  
  // 3. 修复动态 import('...') 语句
  newContent = newContent.replace(
    /(import\(\s*['"])(\.{1,2}\/[^'"\n]+)(['"]\s*\))/gm,
    (match, prefix, importPath, suffix) => {
      if (shouldAddExtension(importPath)) {
        const fixedPath = fixPath(importPath)
        changes.push(`dynamic import: ${importPath} → ${fixedPath}`)
        modified = true
        return prefix + fixedPath + suffix
      }
      return match
    }
  )
  
  // 4. 标准化路径分隔符 (Windows 兼容)
  newContent = newContent.replace(
    /(import\s+[^'"\n]*['"])(\.{1,2}[\\\/][^'"\n]+)(['"])/gm,
    (match, prefix, importPath, suffix) => {
      const normalizedPath = importPath.replace(/\\/g, '/')
      if (normalizedPath !== importPath) {
        changes.push(`path separator: ${importPath} → ${normalizedPath}`)
        modified = true
        return prefix + normalizedPath + suffix
      }
      return match
    }
  )
  
  // 写入修改后的内容
  if (modified) {
    try {
      writeFileSync(filePath, newContent, 'utf8')
    } catch (error) {
      console.error(`❌ 写入文件失败 ${filePath}:`, error.message)
      return { modified: false, changes: [] }
    }
  }
  
  return { modified, changes }
}

/**
 * 判断是否应该添加 .js 扩展名
 */
function shouldAddExtension(importPath) {
  // 跳过已有扩展名的路径
  if (/\.(js|ts|jsx|tsx|json|node|mjs|cjs)$/i.test(importPath)) {
    return false
  }
  
  // 跳过 node_modules 包
  if (!importPath.startsWith('.')) {
    return false
  }
  
  // 跳过以 / 结尾的目录导入
  if (importPath.endsWith('/')) {
    return false
  }
  
  return true
}

/**
 * 修复路径格式
 */
function fixPath(importPath) {
  // 标准化路径分隔符
  let fixedPath = importPath.replace(/\\/g, '/')
  
  // 添加 .js 扩展名 (TypeScript 编译后会变成 .js)
  if (shouldAddExtension(fixedPath)) {
    fixedPath += '.js'
  }
  
  return fixedPath
}

/**
 * 主函数
 */
async function main() {
  console.log('🔧 WriteFlow ESM 导入路径修复工具')
  console.log('=' .repeat(50))
  console.log(`📁 扫描目录: ${TARGET_DIR}`)
  
  const sourceFiles = collectSourceFiles(TARGET_DIR)
  console.log(`📄 找到 ${sourceFiles.length} 个源文件`)
  
  if (sourceFiles.length === 0) {
    console.log('⚠️  没有找到需要处理的文件')
    return
  }
  
  let totalModified = 0
  let totalChanges = 0
  
  console.log('\n🔄 开始修复导入路径...')
  
  for (const filePath of sourceFiles) {
    const result = fixImportsInFile(filePath)
    
    if (result.modified) {
      totalModified++
      totalChanges += result.changes.length
      
      console.log(`✅ ${filePath}`)
      for (const change of result.changes) {
        console.log(`   - ${change}`)
      }
    }
  }
  
  console.log('\n📊 修复结果:')
  console.log(`   处理文件: ${sourceFiles.length}`)
  console.log(`   修改文件: ${totalModified}`)
  console.log(`   修复导入: ${totalChanges}`)
  
  if (totalModified > 0) {
    console.log('\n✅ ESM 导入路径修复完成!')
    console.log('💡 现在可以尝试运行 WriteFlow:')
    console.log('   node writeflow-cli.js --help')
  } else {
    console.log('\n✨ 所有导入路径已正确，无需修复')
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('💥 修复过程中出现错误:', error)
  process.exit(1)
})

// 启动修复工具
main().catch(error => {
  console.error('❌ 修复工具启动失败:', error)
  process.exit(1)
})