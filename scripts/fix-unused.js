#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 修复未使用的参数 - 添加下划线前缀
function fixUnusedParams(content) {
  // 修复命令处理函数中的 context 参数
  content = content.replace(/\(args(?::[^,)]+)?,\s*context(?::[^)]+)?\)/g, (match) => {
    if (match.includes('_context')) return match
    return match.replace('context', '_context')
  })

  // 修复其他未使用的参数
  content = content.replace(/\(([^)]*)\bargs\b([^)]*)\)/g, (match, before, after) => {
    if (match.includes('_args')) return match
    return match.replace(/\bargs\b/, '_args')
  })

  // 修复 error 参数
  content = content.replace(/catch\s*\(\s*error\s*\)/g, 'catch (_error)')
  content = content.replace(/\}\s*catch\s*\(\s*error(?::[^)]+)?\s*\)\s*\{/g, (match) => {
    if (match.includes('_error')) return match
    return match.replace('error', '_error')
  })

  // 修复 promise 参数
  content = content.replace(/\(([^,)]*),\s*promise\)/g, (match, arg1) => {
    return `(${arg1}, _promise)`
  })

  // 修复 opacity 参数
  content = content.replace(/\(([^,)]*),\s*([^,)]*),\s*opacity(?::[^)]+)?\)/g, (match, arg1, arg2) => {
    return match.replace('opacity', '_opacity')
  })

  return content
}

// 删除未使用的导入
function removeUnusedImports(content) {
  const lines = content.split('\n')
  const newLines = []

  for (const line of lines) {
    // 跳过明显未使用的导入
    if (line.includes('import') && line.includes(' from ')) {
      const imports = line.match(/import\s*(?:\{([^}]+)\}|(\w+))\s*from/)
      if (imports) {
        const importedItems = imports[1] ? imports[1].split(',').map(i => i.trim()) : [imports[2]]
        const usedItems = []

        for (const item of importedItems) {
          const name = item.split(' as ')[0].trim()
          const alias = item.includes(' as ') ? item.split(' as ')[1].trim() : name

          // 检查是否在文件中使用（排除导入行本身）
          const restContent = lines.filter((l, i) => i !== lines.indexOf(line)).join('\n')
          if (new RegExp(`\\b${alias}\\b`).test(restContent)) {
            usedItems.push(item)
          }
        }

        if (usedItems.length > 0 && usedItems.length < importedItems.length) {
          // 重构导入语句
          const newImport = line.replace(/\{[^}]+\}/, `{ ${usedItems.join(', ')} }`)
          newLines.push(newImport)
        } else if (usedItems.length === 0) {
          // 跳过完全未使用的导入
          continue
        } else {
          newLines.push(line)
        }
      } else {
        newLines.push(line)
      }
    } else {
      newLines.push(line)
    }
  }

  return newLines.join('\n')
}

async function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    const originalContent = content

    // 应用修复
    content = fixUnusedParams(content)
    content = removeUnusedImports(content)

    // 只有内容改变时才写入
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content)
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`)
      return true
    }
    return false
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    return false
  }
}

async function main() {
  const srcDir = path.join(__dirname, '..', 'src')
  const files = await glob(`${srcDir}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/dist/**']
  })

  console.log(`Found ${files.length} TypeScript files to process...`)

  let fixedCount = 0
  for (const file of files) {
    if (await processFile(file)) {
      fixedCount++
    }
  }

  console.log(`\n✨ Fixed ${fixedCount} files`)
}

main().catch(console.error)