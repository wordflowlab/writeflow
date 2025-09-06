// Mock for marked module to avoid ESM issues in Jest
export const marked = {
  parse: (markdown: string) => `<p>${markdown}</p>`
}

export interface Token {
  type: string
  raw: string
}