import React, { useState, useEffect } from 'react'
import { Text, Box } from 'ink'

interface AnimatedTextProps {
  text: string
  isAnimated?: boolean
  onColorChange?: (color: string) => void
  elapsedSeconds?: number
  tokenCount?: number
  showTodoHint?: boolean
}

export function AnimatedText({ text, isAnimated = false, onColorChange, elapsedSeconds = 0, tokenCount = 0, showTodoHint = false }: AnimatedTextProps) {
  const [currentColor, setCurrentColor] = useState('yellow')

  // 可用的随机颜色池
  const colorPool = [
    'red', 'green', 'yellow', 'blue', 'magenta', 'cyan',
    'white', 'gray', 'redBright', 'greenBright', 'yellowBright',
    'blueBright', 'magentaBright', 'cyanBright', 'whiteBright'
  ] as const

  useEffect(() => {
    if (!isAnimated) return

    const timer = setInterval(() => {
      // 随机选择一个颜色，确保不与当前颜色相同
      const availableColors = colorPool.filter(color => color !== currentColor)
      const randomIndex = Math.floor(Math.random() * availableColors.length)
      const newColor = availableColors[randomIndex]
      setCurrentColor(newColor)
      // 通知父组件颜色变化
      onColorChange?.(newColor)
    }, 600) // 600ms间隔，给用户足够时间看到每种颜色

    return () => clearInterval(timer)
  }, [isAnimated, currentColor, colorPool, onColorChange])

  // 初始颜色通知
  useEffect(() => {
    if (isAnimated) {
      onColorChange?.(currentColor)
    }
  }, [isAnimated, currentColor, onColorChange])

  // 分离主文字和括号内容
  const parseText = (fullText: string) => {
    // 查找括号内容的位置
    const match = fullText.match(/^(.+?)(\s*\([^)]+\))$/)
    if (match) {
      return {
        mainText: match[1],
        bracketContent: match[2]
      }
    }
    return {
      mainText: fullText,
      bracketContent: ''
    }
  }

  const { mainText, bracketContent } = parseText(text)
  
  // 构建执行信息
  const executionInfo = isAnimated && (elapsedSeconds > 0 || tokenCount > 0) 
    ? ` (${elapsedSeconds}s, ${tokenCount} tokens • esc to interrupt${showTodoHint ? ' • ctrl+t to hide todos' : ''})`
    : bracketContent

  return (
    <Box flexDirection="row">
      <Text color={isAnimated ? currentColor : 'yellow'}>
        {mainText}
      </Text>
      {executionInfo && (
        <Text color="gray" dimColor>
          {executionInfo}
        </Text>
      )}
    </Box>
  )
}