#!/usr/bin/env node

/**
 * Slidev 功能测试脚本
 */

import { SlidevGenerator } from '../dist/tools/slidev/SlidevGenerator.js'
import { SlideConverter } from '../dist/tools/slidev/SlideConverter.js'
import { readFileSync } from 'fs'
import { join } from 'path'

async function testGenerator() {
  console.log('测试 SlidevGenerator...')
  
  const generator = new SlidevGenerator()
  const result = await generator.execute({
    title: 'WriteFlow PPT 测试',
    subtitle: '验证基础功能',
    content: [
      '# 第一页\n\n这是第一页内容',
      '# 第二页\n\n- 要点1\n- 要点2',
      '# 第三页\n\n```js\nconsole.log("Hello")\n```'
    ],
    theme: 'default'
  })
  
  if (result.success) {
    console.log('✅ Generator 测试成功')
    console.log(`生成了 ${result.metadata?.slideCount} 页幻灯片`)
  } else {
    console.log('❌ Generator 测试失败:', result.error)
  }
}

async function testConverter() {
  console.log('\n测试 SlideConverter...')
  
  const converter = new SlideConverter()
  const markdown = readFileSync(join(process.cwd(), 'slidev-test.md'), 'utf-8')
  
  const result = await converter.execute({
    markdown,
    options: {
      splitBy: 'h2',
      maxSlides: 10,
      theme: 'seriph'
    }
  })
  
  if (result.success) {
    console.log('✅ Converter 测试成功')
    console.log(`转换为 ${result.conversionReport?.slideCount} 页幻灯片`)
    
    // 保存结果
    const fs = await import('fs')
    fs.writeFileSync('output.slidev.md', result.content || '')
    console.log('结果已保存到 test/output.slidev.md')
  } else {
    console.log('❌ Converter 测试失败:', result.error)
  }
}

async function main() {
  try {
    await testGenerator()
    await testConverter()
    console.log('\n🎉 所有测试完成！')
  } catch (error) {
    console.error('测试出错:', error)
    process.exit(1)
  }
}

main()