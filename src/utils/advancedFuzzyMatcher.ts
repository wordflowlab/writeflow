/**
 * 高级模糊匹配算法
 * 
 * 灵感来源：
 * - 中文拼音输入法（搜狗、百度）
 * - IDE 智能补全（VSCode、IntelliJ）
 * - 终端模糊查找器（fzf、peco）
 * 
 * 核心特性：
 * - 连字符感知匹配 (slide → slide-create)
 * - 缩写匹配 (sc → slide-create)
 * - 子序列匹配
 * - 词边界加分
 */

export interface MatchResult {
  score: number
  matched: boolean
  algorithm: string
}

export class AdvancedFuzzyMatcher {
  /**
   * 主匹配函数 - 组合多种算法
   */
  match(candidate: string, query: string): MatchResult {
    // 规范化输入
    const text = candidate.toLowerCase()
    const pattern = query.toLowerCase()
    
    // 快速精确匹配 - 给予巨大分数
    if (text === pattern) {
      return { score: 10000, matched: true, algorithm: 'exact' }
    }
    
    // 尝试所有算法并组合分数
    const algorithms = [
      this.exactPrefixMatch(text, pattern),
      this.hyphenAwareMatch(text, pattern),
      this.wordBoundaryMatch(text, pattern),
      this.abbreviationMatch(text, pattern),
      this.subsequenceMatch(text, pattern),
      this.fuzzySegmentMatch(text, pattern),
    ]
    
    // 获取最佳分数
    let bestScore = 0
    let bestAlgorithm = 'none'
    
    for (const result of algorithms) {
      if (result.score > bestScore) {
        bestScore = result.score
        bestAlgorithm = result.algorithm
      }
    }
    
    return {
      score: bestScore,
      matched: bestScore > 10,
      algorithm: bestAlgorithm
    }
  }
  
  /**
   * 精确前缀匹配
   */
  private exactPrefixMatch(text: string, pattern: string): { score: number; algorithm: string } {
    if (text.startsWith(pattern)) {
      const coverage = pattern.length / text.length
      // 前缀匹配的高基础分数以优先显示
      return { score: 1000 + coverage * 500, algorithm: 'prefix' }
    }
    return { score: 0, algorithm: 'prefix' }
  }
  
  /**
   * 连字符感知匹配 (slide → slide-create-outline)
   * 将连字符视为可选的词边界
   */
  private hyphenAwareMatch(text: string, pattern: string): { score: number; algorithm: string } {
    // 按连字符分割并尝试匹配
    const words = text.split('-')
    
    // 检查模式是否匹配连字符单词的开头
    if (words[0].startsWith(pattern)) {
      const coverage = pattern.length / words[0].length
      return { score: 300 + coverage * 100, algorithm: 'hyphen-prefix' }
    }
    
    // 检查模式是否匹配连接的单词（忽略连字符）
    const concatenated = words.join('')
    if (concatenated.startsWith(pattern)) {
      const coverage = pattern.length / concatenated.length
      return { score: 250 + coverage * 100, algorithm: 'hyphen-concat' }
    }
    
    // 检查模式是否匹配任何单词开头
    for (let i = 0; i < words.length; i++) {
      if (words[i].startsWith(pattern)) {
        return { score: 200 - i * 10, algorithm: 'hyphen-word' }
      }
    }
    
    return { score: 0, algorithm: 'hyphen' }
  }
  
  /**
   * 词边界匹配 (sc → slide-create)
   * 匹配词边界处的字符
   */
  private wordBoundaryMatch(text: string, pattern: string): { score: number; algorithm: string } {
    const words = text.split(/[-_\s]+/)
    let patternIdx = 0
    let score = 0
    let matched = false
    
    for (const word of words) {
      if (patternIdx >= pattern.length) break
      
      if (word[0] === pattern[patternIdx]) {
        score += 50 // 词边界匹配加分
        patternIdx++
        matched = true
        
        // 尝试在此单词中匹配更多字符
        for (let i = 1; i < word.length && patternIdx < pattern.length; i++) {
          if (word[i] === pattern[patternIdx]) {
            score += 20
            patternIdx++
          }
        }
      }
    }
    
    if (matched && patternIdx === pattern.length) {
      return { score, algorithm: 'word-boundary' }
    }
    
    return { score: 0, algorithm: 'word-boundary' }
  }
  
  /**
   * 缩写匹配 (sl → slide, sc → slide-create)
   */
  private abbreviationMatch(text: string, pattern: string): { score: number; algorithm: string } {
    let textIdx = 0
    let patternIdx = 0
    let score = 0
    let lastMatchIdx = -1
    
    while (patternIdx < pattern.length && textIdx < text.length) {
      if (text[textIdx] === pattern[patternIdx]) {
        // 计算位置分数
        const gap = lastMatchIdx === -1 ? 0 : textIdx - lastMatchIdx - 1
        
        if (textIdx === 0) {
          score += 50 // 首字符匹配
        } else if (lastMatchIdx >= 0 && gap === 0) {
          score += 30 // 连续匹配
        } else if (text[textIdx - 1] === '-' || text[textIdx - 1] === '_') {
          score += 40 // 词边界匹配
        } else {
          score += Math.max(5, 20 - gap * 2) // 距离惩罚
        }
        
        lastMatchIdx = textIdx
        patternIdx++
      }
      textIdx++
    }
    
    if (patternIdx === pattern.length) {
      // 紧凑匹配加分
      const spread = lastMatchIdx / pattern.length
      if (spread <= 3) score += 50
      else if (spread <= 5) score += 30
      
      return { score, algorithm: 'abbreviation' }
    }
    
    return { score: 0, algorithm: 'abbreviation' }
  }
  
  /**
   * 子序列匹配 - 字符按顺序出现
   */
  private subsequenceMatch(text: string, pattern: string): { score: number; algorithm: string } {
    let textIdx = 0
    let patternIdx = 0
    let score = 0
    
    while (patternIdx < pattern.length && textIdx < text.length) {
      if (text[textIdx] === pattern[patternIdx]) {
        score += 10
        patternIdx++
      }
      textIdx++
    }
    
    if (patternIdx === pattern.length) {
      // 分散度惩罚
      const spread = textIdx / pattern.length
      score = Math.max(10, score - spread * 5)
      return { score, algorithm: 'subsequence' }
    }
    
    return { score: 0, algorithm: 'subsequence' }
  }
  
  /**
   * 模糊段匹配 (sld → slide)
   * 灵活匹配段
   */
  private fuzzySegmentMatch(text: string, pattern: string): { score: number; algorithm: string } {
    // 删除连字符和下划线进行匹配
    const cleanText = text.replace(/[-_]/g, '')
    const cleanPattern = pattern.replace(/[-_]/g, '')
    
    // 检查清理后的模式是否是清理后文本的前缀
    if (cleanText.startsWith(cleanPattern)) {
      const coverage = cleanPattern.length / cleanText.length
      return { score: 150 + coverage * 100, algorithm: 'fuzzy-segment' }
    }
    
    // 检查模式是否出现在清理后的文本中
    const index = cleanText.indexOf(cleanPattern)
    if (index !== -1) {
      const positionPenalty = index * 5
      return { score: Math.max(50, 100 - positionPenalty), algorithm: 'fuzzy-contains' }
    }
    
    return { score: 0, algorithm: 'fuzzy-segment' }
  }
}

// 导出单例实例和辅助函数
export const advancedMatcher = new AdvancedFuzzyMatcher()

export function matchAdvanced(candidate: string, query: string): MatchResult {
  return advancedMatcher.match(candidate, query)
}

export function matchManyAdvanced(
  candidates: string[], 
  query: string,
  minScore: number = 10
): Array<{ candidate: string; score: number; algorithm: string }> {
  return candidates
    .map(candidate => {
      const result = advancedMatcher.match(candidate, query)
      return {
        candidate,
        score: result.score,
        algorithm: result.algorithm
      }
    })
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
}