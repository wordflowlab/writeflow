/**
 * 内容处理模块导出
 */

// ContentAnalyzer
export { 
  ContentAnalyzer,
  getContentAnalyzer,
  analyzeContentForCollapsible,
  isCreativeContent
} from './ContentAnalyzer.js'

// CollapsibleManager  
export {
  CollapsibleManager,
  getCollapsibleManager,
  createCollapsibleContentBlocks,
  type CollapsibleOptions
} from './CollapsibleManager.js'

// ContentProcessor
export {
  ContentProcessor,
  getContentProcessor,
  processAIResponse,
  processSmartContent,
  type ContentProcessingOptions,
  type ContentProcessingResult
} from './ContentProcessor.js'