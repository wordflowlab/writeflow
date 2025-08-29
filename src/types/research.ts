export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  relevanceScore: number
  publishDate?: string
  author?: string
  domain: string
}

export interface ResearchRequest {
  topic: string
  depth: 'surface' | 'standard' | 'deep'
  maxSources: number
  timeRange: 'week' | 'month' | 'year' | 'unlimited'
  language: 'chinese' | 'english' | 'both'
  sourceTypes: ('academic' | 'news' | 'blog' | 'official')[]
}

export interface ResearchReport {
  topic: string
  summary: string
  keyFindings: string[]
  sources: SearchResult[]
  analysis: {
    currentState: string
    majorPlayers: string[]
    marketSize?: string
    challenges: string[]
    opportunities: string[]
  }
  latestDevelopments: string[]
  perspectives: {
    supporters: string[]
    critics: string[]
    academic: string[]
    industry: string[]
  }
  authoritativeSources: string[]
  writingSuggestions: string[]
  generatedAt: string
}

export interface FactCheckResult {
  claim: string
  verdict: 'true' | 'false' | 'partly-true' | 'unclear' | 'unverifiable'
  confidence: number
  sources: SearchResult[]
  explanation: string
  contradictoryEvidence?: string[]
  supportingEvidence?: string[]
}

export interface Citation {
  id: string
  type: 'article' | 'paper' | 'book' | 'website' | 'report'
  title: string
  authors: string[]
  publication: string
  date: string
  url?: string
  doi?: string
  pages?: string
  abstract?: string
}