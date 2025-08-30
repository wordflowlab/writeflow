import { describe, test, expect } from '@jest/globals'
import { getVersion, getVersionString } from '@/utils/version.js'

describe('Core Functionality Tests', () => {
  describe('Version Utils', () => {
    test('should return valid version', () => {
      const version = getVersion()
      expect(version).toMatch(/^\d+\.\d+\.\d+/)
    })

    test('should return formatted version string', () => {
      const versionString = getVersionString()
      expect(versionString).toMatch(/^v\d+\.\d+\.\d+/)
    })

    test('should support custom prefix', () => {
      const versionString = getVersionString('version ')
      expect(versionString).toMatch(/^version \d+\.\d+\.\d+/)
    })
  })

  describe('Basic Functionality', () => {
    test('should have valid project structure', () => {
      const fs = require('fs')
      const path = require('path')
      
      // 验证关键文件存在
      const packageJsonExists = fs.existsSync('package.json')
      const srcDirExists = fs.existsSync('src')
      
      expect(packageJsonExists).toBe(true)
      expect(srcDirExists).toBe(true)
    })
  })
})