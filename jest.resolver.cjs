// Jest resolver 用于处理 ESM 模块导入
const { resolve, dirname } = require('path')
const { existsSync } = require('fs')

module.exports = function resolver(request, options) {
  // 只处理项目内部的 .js 导入
  if (request.endsWith('.js')) {
    // 检查是否是相对导入
    if (request.startsWith('./') || request.startsWith('../')) {
      // 检查调用文件是否在项目src目录下
      const callerPath = options.basedir
      if (callerPath && callerPath.includes('/src/')) {
        const tsPath = request.replace(/\.js$/, '.ts')
        const resolvedTsPath = resolve(callerPath, tsPath)
        
        // 检查对应的.ts文件是否存在
        if (existsSync(resolvedTsPath)) {
          return resolvedTsPath
        }
      }
    }
  }
  
  // 对于其他情况，使用默认的解析逻辑
  return options.defaultResolver(request, options)
}