#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 修复参数引用错误
function fixParamReferences(content) {
  const lines = content.split('\n')
  const fixedLines = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // 检测函数参数定义行
    if (line.includes('async getPromptForCommand(') ||
        line.includes('async call(') ||
        line.includes('.catch(') ||
        line.includes('} catch (')) {

      // 查找参数名称
      const paramMatch = line.match(/\b_args\b|\b_context\b|\b_error\b|\b_promise\b/)

      if (paramMatch) {
        const underscoreName = paramMatch[0]
        const originalName = underscoreName.substring(1)

        // 在函数体内查找使用了原始名称的地方
        let inFunctionBody = false
        let braceDepth = 0

        for (let j = i; j < lines.length; j++) {
          const checkLine = lines[j]

          // 跟踪大括号深度
          for (const char of checkLine) {
            if (char === '{') {
              braceDepth++
              inFunctionBody = true
            } else if (char === '}') {
              braceDepth--
              if (braceDepth === 0) {
                break
              }
            }
          }

          // 如果在函数体内，替换对原始参数名的引用
          if (inFunctionBody && j > i) {
            // 使用正则表达式精确匹配单词边界
            const regex = new RegExp(`\\b${originalName}\\b(?![a-zA-Z0-9_:])`, 'g')
            if (regex.test(lines[j])) {
              lines[j] = lines[j].replace(regex, underscoreName)
            }
          }

          if (braceDepth === 0 && inFunctionBody) {
            break
          }
        }
      }
    }

    fixedLines.push(line)
  }

  return fixedLines.join('\n')
}

// 修复特定的错误模式
function fixSpecificErrors(content) {
  // 修复 Key 类型引用
  content = content.replace(/\bKey\b/g, 'string')

  // 修复 FileCompletionItem 类型引用
  content = content.replace(/: FileCompletionItem/g, ': typeof FileCompletionItem')

  // 修复 error 引用（在 catch 块中）
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('} catch (_error)')) {
      // 查找 catch 块内容
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        if (lines[j].includes('}')) break
        // 替换 error 为 _error
        lines[j] = lines[j].replace(/\berror\b/g, '_error')
      }
    }
  }

  return lines.join('\n')
}

async function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    const originalContent = content

    // 应用修复
    content = fixParamReferences(content)
    content = fixSpecificErrors(content)

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