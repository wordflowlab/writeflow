#!/usr/bin/env node

/**
 * 测试命令补全过滤修复效果
 */

import { AdvancedFuzzyMatcher } from './dist/utils/advancedFuzzyMatcher.js'

console.log('测试命令补全过滤修复\n')

const matcher = new AdvancedFuzzyMatcher()

// 所有命令列表
const commands = [
  'outline', 'rewrite', 'research', 'write', 'draft',
  'slide', 'slide-create', 'slide-convert', 
  'style', 'status', 'settings', 'search',
  'simplify', 'summarize',
  'help', 'model', 'clear', 'read', 'edit'
]

// 测试输入 's'
console.log('输入: /s')
console.log('期望: 只显示以 s 开头的命令\n')

const query = 's'
const results = []

for (const cmd of commands) {
  const result = matcher.match(cmd, query)
  if (result.matched) {
    results.push({
      command: cmd,
      score: result.score,
      algorithm: result.algorithm
    })
  }
}

// 按分数排序
results.sort((a, b) => b.score - a.score)

console.log('匹配结果:')
results.forEach(r => {
  const isCorrect = r.command.startsWith('s') ? '✅' : '❌'
  console.log(`  ${isCorrect} /${r.command} - 分数: ${r.score.toFixed(0)} (${r.algorithm})`)
})

console.log(`\n总计: ${results.length} 个匹配`)
console.log(`正确: ${results.filter(r => r.command.startsWith('s')).length} 个`)
console.log(`错误: ${results.filter(r => !r.command.startsWith('s')).length} 个`)

// 测试其他输入
console.log('\n\n其他测试:')

const testCases = ['sl', 'st', 'se', 'h', 'w']
for (const test of testCases) {
  console.log(`\n输入: /${test}`)
  const matches = commands.filter(cmd => {
    const result = matcher.match(cmd, test)
    return result.matched
  })
  console.log(`匹配: ${matches.join(', ') || '无'}`)
}