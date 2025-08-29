export interface PublishTarget {
  platform: 'wechat' | 'zhihu' | 'medium' | 'github' | 'blog'
  config: PlatformConfig
}

export interface PlatformConfig {
  apiKey?: string
  username?: string
  formatStyle?: string
  autoTags?: boolean
  imageStyle?: string
  [key: string]: any
}

export interface PublishResult {
  platform: string
  success: boolean
  url?: string
  publishId?: string
  error?: string
  warnings?: string[]
}

export interface WeChatFormat {
  title: string
  content: string
  images: WeChatImage[]
  tags: string[]
  summary: string
}

export interface WeChatImage {
  src: string
  alt: string
  caption?: string
  position: 'inline' | 'center' | 'left' | 'right'
}

export interface ZhihuFormat {
  title: string
  content: string
  tags: string[]
  topic?: string
  references: string[]
  imageStyle: 'original' | 'compressed'
}

export interface MediumFormat {
  title: string
  subtitle?: string
  content: string
  tags: string[]
  canonicalUrl?: string
  license: string
}