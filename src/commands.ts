// 命令系统接口
export interface Command {
  name: string
  description: string
  execute: (args: string[]) => Promise<void>
}