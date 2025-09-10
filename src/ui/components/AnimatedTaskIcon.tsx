import React, { useState, useEffect } from 'react'
import { Text } from 'ink'

interface AnimatedTaskIconProps {
  isActive?: boolean
  color?: string
}

export function AnimatedTaskIcon({ isActive = true, color = 'cyan' }: AnimatedTaskIconProps) {
  const [starIndex, setStarIndex] = useState(0)

  // 多种星星符号，但颜色保持一致
  const starStates = [
    '★',  // 实心五角星
    '☆',  // 空心五角星
    '✦',  // 四角星
    '✧',  // 小四角星
    '⋆',  // 小星星
    '·',  // 小点
    ' ',  // 空格
    '·'   // 小点回升
  ]

  useEffect(() => {
    if (!isActive) return

    const timer = setInterval(() => {
      setStarIndex(prev => (prev + 1) % starStates.length)
    }, 350) // 350ms间隔

    return () => clearInterval(timer)
  }, [isActive, starStates.length])

  if (!isActive) return null

  return (
    <Text color={color}>
      {starStates[starIndex]}
    </Text>
  )
}