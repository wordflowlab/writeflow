/**
 * TodoList 工具提示词（迁移至 tools/writing 目录，便于与工具同域）
 */

export const TODO_WRITE_DESCRIPTION = `更新当前会话的任务列表。主动且频繁地使用此工具来追踪进度和待处理任务。`

export const TODO_WRITE_PROMPT = `
Use this tool to create and manage a structured task list for your current writing session. This helps you track progress, organize complex writing tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the writing task and overall progress of their writing requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multi-step writing tasks - When a writing task requires 3 or more distinct steps or actions
2. Non-trivial and complex writing tasks - Writing tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple writing tasks - When users provide a list of things to be written (numbered or comma-separated)
5. After receiving new writing instructions - Immediately capture user writing requirements as todos
6. When you start working on a writing task - Mark it as in_progress BEFORE beginning work. Ideally you should only have one todo as in_progress at a time
7. After completing a writing task - Mark it as completed and add any new follow-up writing tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward writing task
2. The writing task is trivial and tracking it provides no organizational benefit
3. The writing task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial writing task to do. In this case you are better off just doing the writing task directly.

## Examples of When to Use the Todo List

<example>
User: 我想写一篇关于人工智能的技术博客，包括研究背景、技术分析、应用案例和未来展望。记得要校对和优化。
Assistant: 我会帮你创建一篇关于人工智能的全面技术博客。让我创建一个任务列表来追踪这个写作项目的进展。
*Creates todo list with the following items:*
1. 研究人工智能的最新背景和发展趋势
2. 撰写技术分析部分 - 深度学习和机器学习算法
3. 收集和撰写应用案例 - 实际行业应用
4. 编写未来展望部分 - AI发展趋势预测
5. 校对全文并进行内容优化
*Begins working on the first task*

<reasoning>
The assistant used the todo list because:
1. Writing a comprehensive AI blog is a multi-step writing task requiring research, analysis, examples, and proofreading
2. The user explicitly requested multiple sections and post-processing (proofreading and optimization)
3. The assistant inferred that quality writing requires systematic approach with "校对和优化" as the final task
</reasoning>
</example>

<example>
User: 帮我写三个不同风格的产品介绍文案：一个正式的、一个活泼的、一个简洁的
Assistant: 我会帮你创建三种不同风格的产品介绍文案。让我创建任务列表来追踪每种风格的写作进度。
*Creates todo list with specific items for each writing style*

<reasoning>
The assistant used the todo list because:
1. The user provided multiple writing tasks in a comma-separated list (three different styles)
2. Each style requires different approach and tone, making it a complex multi-step writing task
3. The todo list helps ensure all three styles are completed systematically
4. This approach prevents missing any style variations and maintains writing quality
</reasoning>
</example>

<example>
User: 能否帮我优化这篇文章的结构和内容？我觉得逻辑不够清晰，需要重新组织段落顺序，增加过渡句，并且语言要更加生动。
Assistant: 我会帮助你全面优化这篇文章。首先，让我分析现有内容以识别具体的优化需求。
*Reviews article structure, paragraph flow, transitions, and language style*
Assistant: 在分析你的文章后，我发现了几个需要优化的方面。让我创建任务列表来系统性地处理这些优化工作。
*Creates todo list with items like: 1) 重新设计文章整体逻辑结构, 2) 调整段落顺序以增强逻辑流程, 3) 添加过渡句连接各段落, 4) 优化语言表达使其更加生动, 5) 最终审校和细节调整*
让我们先从重新设计整体逻辑结构开始。

<reasoning>
The assistant used the todo list because:
1. First, the assistant analyzed the content to identify specific optimization needs
2. Based on this analysis, it identified multiple optimization areas
3. Article optimization is a non-trivial task requiring multiple systematic steps
4. The todo list helps methodically track improvements across different aspects
5. This systematic approach ensures all optimization requirements are addressed
</reasoning>

## Operational Guidelines

1. **Task Creation Standards**:
   - Each writing task must include a clear action-oriented description
   - Provide both forms: content and activeForm
   - Use specific writing verbs (e.g., 研究/撰写/优化/校对)

2. **Task State Management**:
   - Exactly ONE task should be in_progress at any time
   - Update status immediately when switching tasks
   - Mark tasks as completed only when fully finished

## Writing-Specific Guidelines
- Technical: 研究 → 大纲 → 撰写 → 校对 → 优化
- Creative: 构思 → 草稿 → 完善 → 润色 → 终稿
- Business: 分析 → 结构 → 撰写 → 调整 → 审核

## Tool Invocation Format

### Preferred (Function Calling)
Use native function calling with the following schema:

- name: todo_write
- parameters: { "todos": Todo[] }

Each Todo item must contain: id, content, activeForm, status (one of pending|in_progress|completed), optional priority.

### Fallback (Traditional Markup)
If your provider does not support function calling, output ONLY the following block (no extra text):
<function_calls>
  <invoke name="TodoWrite">
    <parameter name="todos">[{"id":"1","content":"写开篇","activeForm":"正在写开篇","status":"in_progress"}]</parameter>
  </invoke>
</function_calls>
`

export const TODO_READ_DESCRIPTION = `读取当前会话的任务列表`

export const TODO_READ_PROMPT = `
Read the current todo list for the writing session. This tool helps you stay aware of:

- Current writing tasks and their status
- What writing work is in progress
- Completed writing milestones
- Upcoming writing tasks to tackle

Use this tool when you need to:
- Check the status of current writing projects
- Review what writing tasks have been completed
- Plan next steps in your writing workflow
- Provide status updates to the user about writing progress

## Tool Invocation Format

### Preferred (Function Calling)
- name: todo_read
- parameters: {}

### Fallback (Traditional Markup)
Output ONLY the following block when function calling is unavailable:
<function_calls>
  <invoke name="TodoRead">
    <parameter name="todos">[]</parameter>
  </invoke>
</function_calls>
`

/** 获取 TodoWrite 工具的完整提示词 */
export function getTodoWritePrompt(): string {
  return TODO_WRITE_PROMPT
}

/** 获取 TodoWrite 工具的简短描述 */
export function getTodoWriteDescription(): string {
  return TODO_WRITE_DESCRIPTION
}

/** 获取 TodoRead 工具的完整提示词 */
export function getTodoReadPrompt(): string {
  return TODO_READ_PROMPT
}

/** 获取 TodoRead 工具的简短描述 */
export function getTodoReadDescription(): string {
  return TODO_READ_DESCRIPTION
}

/** 为写作场景生成示例任务 */
export function generateWritingTaskExamples(): Array<{
  content: string
  activeForm: string
  scenario: string
}> {
  return [
    { content: '研究人工智能最新发展趋势', activeForm: '正在研究人工智能发展趋势', scenario: '技术博客写作' },
    { content: '撰写产品核心功能介绍', activeForm: '正在撰写产品功能介绍', scenario: '营销文案创作' },
    { content: '设计文章整体结构大纲', activeForm: '正在设计文章结构大纲', scenario: '长篇文章创作' },
    { content: '收集相关案例和数据支撑', activeForm: '正在收集案例和数据', scenario: '分析报告写作' },
    { content: '校对全文并优化表达', activeForm: '正在校对和优化全文', scenario: '文章润色阶段' },
  ]
}
