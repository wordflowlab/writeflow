export const DESCRIPTION = '基于 ripgrep 的强大搜索工具'

export const PROMPT = `基于 ripgrep 的强大搜索工具，用于在文件和目录中搜索文本模式。

使用指南:
- 始终使用 Grep 工具进行搜索任务，绝不要通过 Bash 工具调用 \`grep\` 或 \`rg\` 命令
- Grep 工具已针对正确权限和访问进行优化
- 支持完整的正则表达式语法（如 "log.*Error", "function\\s+\\w+"）

文件过滤选项:
- glob 参数：使用 glob 模式过滤文件（如 "*.js", "**/*.tsx"）
- type 参数：按文件类型过滤（如 "js", "py", "rust"）
- type 参数比 glob 更高效，适用于标准文件类型

输出模式:
- "content"：显示匹配的行内容
- "files_with_matches"：只显示文件路径（默认）
- "count"：显示匹配计数

上下文选项（仅限 content 模式）:
- -A：显示匹配行后的 N 行
- -B：显示匹配行前的 N 行
- -C：显示匹配行前后各 N 行
- -n：显示行号
- -i：忽略大小写

搜索范围:
- path 参数：指定搜索的文件或目录，默认为当前工作目录
- head_limit：限制输出的前 N 个结果

模式语法注意事项:
- 使用 ripgrep 语法（不是 grep）
- 字面量大括号需要转义：使用 \`interface\\{\\}\` 查找 \`interface{}\`
- 默认单行匹配：模式只在单行内匹配
- 跨行模式：使用 \`multiline: true\` 启用多行匹配（如 \`struct \\{[\\s\\S]*?field\`）

常用搜索场景:

1. **代码搜索**:
   - 查找函数定义：\`function\\s+functionName\`
   - 查找类定义：\`class\\s+ClassName\`
   - 查找导入语句：\`import.*from\`
   - 查找配置项：\`config\\.\\w+\`

2. **文件内容分析**:
   - 错误日志：\`ERROR|error|Error\`
   - TODO 标记：\`TODO|FIXME|BUG\`
   - 版本信息：\`version.*=|"version"\`

3. **项目结构理解**:
   - 查找所有 TypeScript 文件：type="ts"
   - 查找测试文件：glob="**/*test*"
   - 查找配置文件：glob="*.{json,yaml,yml}"

最佳实践:

1. **文件过滤优先级**:
   - 优先使用 type 参数（性能更好）
   - glob 用于复杂模式匹配
   - 组合使用获得精确结果

2. **搜索策略**:
   - 开放性搜索：使用 Task 工具进行多轮搜索
   - 精确搜索：使用具体的正则表达式模式
   - 大型代码库：先按文件类型过滤

3. **输出控制**:
   - 初探阶段：使用 files_with_matches 了解影响范围
   - 详细分析：使用 content 模式查看具体内容
   - 统计分析：使用 count 模式了解频次

4. **上下文获取**:
   - 使用 -C 参数获取匹配行的上下文
   - 对于函数或类定义，增加更多上下文行
   - 结合行号(-n)便于定位

错误处理:
- 无匹配结果：返回空结果，不是错误
- 正则表达式错误：检查模式语法
- 权限问题：工具会自动处理访问权限

性能优化:
- head_limit 参数控制输出大小
- 合理使用文件过滤减少搜索范围
- 避免过于宽泛的搜索模式

安全注意事项:
- 工具会自动处理文件权限和访问控制
- 避免搜索敏感信息（如密钥、密码）
- 注意搜索范围，避免不必要的隐私文件访问`

export const TOOL_NAME_FOR_PROMPT = 'Grep'