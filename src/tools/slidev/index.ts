/**
 * Slidev 工具集导出
 */

export { SlidevGenerator, type SlidevGeneratorInput, type SlidevGeneratorOutput } from './SlidevGenerator.js'
export { SlideConverter, type SlideConverterInput, type SlideConverterOutput } from './SlideConverter.js'

// 工具映射（用于动态加载）
export const slidevTools = {
  SlidevGenerator: () => import('./SlidevGenerator.js'),
  SlideConverter: () => import('./SlideConverter.js')
}

export default slidevTools