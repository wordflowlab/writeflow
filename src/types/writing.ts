export interface OutlineSection {
  title: string
  content: string
  wordCount: number
  keyPoints: string[]
  supportingMaterials?: string[]
}

export interface ArticleOutline {
  title: string
  alternativeTitles: string[]
  introduction: {
    coreQuestion: string
    value: string
    hook: string
  }
  sections: OutlineSection[]
  conclusion: {
    summary: string
    outlook: string
  }
  writingTips: string[]
  targetWordCount: number
  style: string
  audience: string
}

export interface RewriteOptions {
  style: 'popular' | 'formal' | 'technical' | 'academic' | 'marketing' | 'narrative'
  tone?: 'professional' | 'casual' | 'friendly' | 'authoritative'
  keepStructure?: boolean
  preserveLength?: boolean
  targetAudience?: string
}

export interface StyleAdaptationResult {
  originalText: string
  adaptedText: string
  changes: Array<{
    type: 'vocabulary' | 'tone' | 'structure' | 'format'
    original: string
    adapted: string
    reason: string
  }>
  styleMetrics: {
    readabilityScore: number
    formalityLevel: number
    technicalDensity: number
  }
}

export interface GrammarCheck {
  type: 'grammar' | 'spelling' | 'punctuation' | 'style'
  severity: 'error' | 'warning' | 'suggestion'
  message: string
  position: {
    start: number
    end: number
    line: number
    column: number
  }
  suggestions: string[]
  rule?: string
}

export interface GrammarCheckResult {
  issues: GrammarCheck[]
  correctedText: string
  statistics: {
    totalIssues: number
    errorCount: number
    warningCount: number
    suggestionCount: number
  }
}

export interface AIWritingConfig {
  anthropicApiKey: string
  model: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
}