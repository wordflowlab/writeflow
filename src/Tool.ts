// 工具系统接口
export interface Tool {
  name: string
  description: string | (() => Promise<string>)
  execute: (args: any) => Promise<any>
}

export type SetToolJSXFn = (jsx: React.ReactNode | null, shouldHidePromptInput?: boolean) => void