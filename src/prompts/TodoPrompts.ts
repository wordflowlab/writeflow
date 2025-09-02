/**
 * TodoList 工具提示词
 * 基于 Claude Code v1.0.33 的完整提示词系统
 * 专为 WriteFlow AI 写作助手优化
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
</example>

## Examples of When NOT to Use the Todo List

<example>
User: 这个标题怎么样："AI时代的机遇与挑战"
Assistant: 这个标题很不错！"AI时代的机遇与挑战"简洁明了，既涵盖了积极面（机遇）也包含了需要关注的方面（挑战），主题明确且容易理解。

<reasoning>
The assistant did not use the todo list because this is a simple evaluation request with no actual writing task to complete. The user is simply asking for feedback, not requesting the assistant to perform multiple steps or writing tasks.
</reasoning>
</example>

<example>
User: 帮我把这句话改得更简洁："由于技术的不断发展和进步，我们的生活变得越来越便利"
Assistant: 可以改为："技术进步让我们的生活更加便利。"
* Uses writing tools to refine the sentence *

<reasoning>
The assistant did not use the todo list because this is a single, straightforward sentence revision task. Refining one sentence doesn't require tracking multiple steps or systematic organization.
</reasoning>
</example>

<example>
User: 现在是几点？
Assistant: 我无法获取当前的实时时间信息。建议您查看您的设备时钟或搜索"现在几点"来获取准确的当前时间。

<reasoning>
The assistant did not use the todo list because this is an informational request with no writing task involved. There are no multiple steps to track or organize.
</reasoning>
</example>

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

   **IMPORTANT**: Task descriptions must have two forms:
   - content: The imperative form describing what needs to be done (e.g., "撰写技术分析", "校对全文")
   - activeForm: The present continuous form shown during execution (e.g., "正在撰写技术分析", "正在校对全文")

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Exactly ONE task must be in_progress at any time (not less, not more)
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Writing quality is poor
     - Implementation is partial
     - You encountered unresolved issues
     - You couldn't find necessary research materials or references

4. **Task Breakdown for Writing**:
   - Create specific, actionable writing items
   - Break complex writing projects into smaller, manageable steps
   - Use clear, descriptive task names with writing-specific verbs
   - Always provide both forms:
     - content: "撰写产品介绍"
     - activeForm: "正在撰写产品介绍"

## Writing-Specific Guidelines

### Task Creation for Different Writing Types
- **Technical Writing**: 研究 → 大纲 → 撰写 → 校对 → 优化
- **Creative Writing**: 构思 → 草稿 → 完善 → 润色 → 终稿
- **Business Writing**: 分析需求 → 结构设计 → 内容撰写 → 格式调整 → 最终审核
- **Academic Writing**: 文献调研 → 论证框架 → 章节撰写 → 引用整理 → 全文校对

### Priority Guidelines for Writing Tasks
- **High Priority**: 核心内容撰写、关键章节、deadline紧急任务
- **Medium Priority**: 结构调整、格式优化、补充内容
- **Low Priority**: 细节润色、风格统一、最终校对

When in doubt, use this tool. Being proactive with writing task management demonstrates attentiveness and ensures you complete all writing requirements successfully.
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

The tool returns a formatted view of all writing tasks with their current status, making it easy to track writing project progress and ensure nothing is overlooked.
`

/**
 * 获取 TodoWrite 工具的完整提示词
 */
export function getTodoWritePrompt(): string {
  return TODO_WRITE_PROMPT
}

/**
 * 获取 TodoWrite 工具的简短描述
 */
export function getTodoWriteDescription(): string {
  return TODO_WRITE_DESCRIPTION
}

/**
 * 获取 TodoRead 工具的完整提示词
 */
export function getTodoReadPrompt(): string {
  return TODO_READ_PROMPT
}

/**
 * 获取 TodoRead 工具的简短描述
 */
export function getTodoReadDescription(): string {
  return TODO_READ_DESCRIPTION
}

/**
 * 为写作场景生成示例任务
 */
export function generateWritingTaskExamples(): Array<{
  content: string
  activeForm: string
  scenario: string
}> {
  return [
    {
      content: "研究人工智能最新发展趋势",
      activeForm: "正在研究人工智能发展趋势",
      scenario: "技术博客写作"
    },
    {
      content: "撰写产品核心功能介绍",
      activeForm: "正在撰写产品功能介绍",
      scenario: "营销文案创作"
    },
    {
      content: "设计文章整体结构大纲",
      activeForm: "正在设计文章结构大纲",
      scenario: "长篇文章创作"
    },
    {
      content: "收集相关案例和数据支撑",
      activeForm: "正在收集案例和数据",
      scenario: "分析报告写作"
    },
    {
      content: "校对全文并优化表达",
      activeForm: "正在校对和优化全文",
      scenario: "文章润色阶段"
    }
  ]
}