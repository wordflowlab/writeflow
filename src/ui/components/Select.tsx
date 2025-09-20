import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import figures from 'figures'

export interface SelectOption {
  label: string
  value: string
  description?: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  focus?: boolean
}

export function Select({
  options,
  value,
  onChange,
  onSubmit,
  placeholder = '选择一个选项...',
  focus = true
}: SelectProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (value) {
      const index = options.findIndex(opt => opt.value === value)
      return index >= 0 ? index : 0
    }
    return 0
  })

  const handleInput = useCallback((input: string, key: any) => {
    if (!focus) {
      return
    }

    if ((key as any).upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1))
    } else if ((key as any).downArrow) {
      setSelectedIndex(prev => Math.min(options.length - 1, prev + 1))
    } else if ((key as any).return || input === ' ') {
      const selectedOption = options[selectedIndex]
      if (selectedOption) {
        onChange?.(selectedOption.value)
        onSubmit?.(selectedOption.value)
      }
    }
  }, [focus, options, selectedIndex, onChange, onSubmit])

  useInput(handleInput)

  if (options.length === 0) {
    return <Text color="gray">{placeholder}</Text>
  }

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const isSelected = index === selectedIndex
        return (
          <Box key={option.value} flexDirection="column">
            <Text color={isSelected ? 'blue' : undefined}>
              {isSelected ? figures.pointer : ' '} {option.label}
            </Text>
            {isSelected && option.description && (
              <Box paddingLeft={2}>
                <Text color="gray">{option.description}</Text>
              </Box>
            )}
          </Box>
        )
      })}
    </Box>
  )
}