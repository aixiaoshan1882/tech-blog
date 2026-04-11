# Claude Code 源码深度学习笔记 (第九部分)

> 工具系统架构 · Token 估算 · 成本追踪

---

## 四十五、工具系统架构

### 工具类型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         工具类型 (45个工具)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  文件操作:                                                                  │
│  ├── FileReadTool     (读取文件)                                           │
│  ├── FileWriteTool    (写入文件)                                           │
│  ├── FileEditTool     (编辑文件)                                           │
│  ├── GlobTool         (文件匹配)                                           │
│  └── GrepTool         (内容搜索)                                           │
│                                                                             │
│  命令执行:                                                                  │
│  ├── BashTool         (Shell 命令)                                        │
│  ├── PowerShellTool   (PowerShell)                                        │
│  └── REPLTool         (交互式 REPL)                                        │
│                                                                             │
│  任务管理:                                                                  │
│  ├── TaskCreateTool   (创建任务)                                           │
│  ├── TaskListTool     (列出任务)                                           │
│  ├── TaskOutputTool   (任务输出)                                           │
│  ├── TaskStopTool     (停止任务)                                           │
│  └── TaskGetTool      (获取任务)                                           │
│                                                                             │
│  网络操作:                                                                  │
│  ├── WebSearchTool    (网页搜索)                                           │
│  └── WebFetchTool     (网页抓取)                                           │
│                                                                             │
│  Agent/团队:                                                               │
│  ├── AgentTool        (子 Agent)                                          │
│  ├── SkillTool        (技能调用)                                           │
│  ├── TeamCreateTool   (创建团队)                                           │
│  └── SendMessageTool  (发送消息)                                           │
│                                                                             │
│  MCP 工具:                                                                 │
│  ├── MCPTool          (MCP 服务器工具)                                     │
│  ├── ListMcpResourcesTool  (列出资源)                                      │
│  └── ReadMcpResourceTool   (读取资源)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tool 接口定义

```typescript
// Tool.ts
export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  // 工具名称
  readonly name: string

  // 可选别名
  aliases?: string[]

  // 简短描述 (ToolSearch 用)
  searchHint?: string

  // 输入 Schema
  readonly inputSchema: Input

  // 执行函数
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<Output>>

  // 描述生成
  description(
    input: z.infer<Input>,
    options: ToolDescriptionOptions,
  ): Promise<string>

  // 是否并发安全 (可并行执行)
  isConcurrencySafe(input: z.infer<Input>): boolean

  // 是否只读
  isReadOnly(input: z.infer<Input>): boolean

  // 是否破坏性操作
  isDestructive?(input: z.infer<Input>): boolean

  // 工具执行时用户新消息的处理
  interruptBehavior?(): 'cancel' | 'block'

  // 是否是搜索/读取命令
  isSearchOrReadCommand?(input: z.infer<Input>): {
    isSearch: boolean
    isRead: boolean
    isList?: boolean
  }

  // 最大结果大小
  maxResultSizeChars: number
}
```

### BashTool 命令分类

```typescript
// tools/BashTool/BashTool.tsx

// 搜索命令 (可折叠)
const BASH_SEARCH_COMMANDS = new Set([
  'find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis'
])

// 读取命令 (可折叠)
const BASH_READ_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more',
  'wc', 'stat', 'file', 'strings',
  'jq', 'awk', 'cut', 'sort', 'uniq', 'tr'
])

// 目录列表命令
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du'])

// 语义中性命令 (不影响命令性质)
const BASH_SEMANTIC_NEUTRAL_COMMANDS = new Set([
  'echo', 'printf', 'true', 'false', ':'
])

// 静默命令 (成功无输出)
const BASH_SILENT_COMMANDS = new Set([
  'mv', 'cp', 'rm', 'mkdir', 'rmdir',
  'chmod', 'chown', 'chgrp', 'touch', 'ln', 'cd'
])

// 判断命令类型
export function isSearchOrReadBashCommand(command: string): {
  isSearch: boolean
  isRead: boolean
  isList: boolean
} {
  const parts = splitCommandWithOperators(command)
  // 管道中所有命令都必须是只读才是只读
}
```

### 工具注册

```typescript
// tools.ts
export function getAllBaseTools(): Tools {
  return [
    BashTool,
    FileEditTool,
    FileReadTool,
    FileWriteTool,
    GlobTool,
    GrepTool,
    // ...
  ]
}

// 条件编译 - 根据 feature flag 排除工具
const cronTools = feature('AGENT_TRIGGERS')
  ? [
      CronCreateTool,
      CronDeleteTool,
      CronListTool,
    ]
  : []

// 延迟加载 - 避免循环依赖
const getTeamCreateTool = () =>
  require('./tools/TeamCreateTool/TeamCreateTool.js').TeamCreateTool
```

---

## 四十六、Token 估算

### Token 统计

```typescript
// services/tokenEstimation.ts

/**
 * 计算消息的 token 数量
 */
export async function countTokens(
  messages: Message[],
  model: string,
): Promise<number> {
  const provider = getAPIProvider()

  switch (provider) {
    case 'anthropic':
      // 直接调用 API
      return await countTokensWithAnthropic(messages, model)

    case 'aws':
      // AWS Bedrock
      return await countTokensWithBedrock(messages, model)

    case 'gcp':
      // GCP Vertex
      return await countTokensWithVertex(messages, model)
  }
}

/**
 * 粗略估算 (不调用 API)
 */
export function roughTokenCountEstimation(text: string): number {
  // 中文字符 ≈ 2 tokens
  // 英文字符 ≈ 0.25 tokens
  // 代码 ≈ 0.4 tokens

  let count = 0
  for (const char of text) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      count += 2  // 中文
    } else if (/[a-zA-Z]/.test(char)) {
      count += 0.25  // 英文
    } else {
      count += 1  // 其他
    }
  }
  return Math.ceil(count)
}
```

### 上下文窗口

```typescript
// utils/context.ts
export function getContextWindowForModel(model: string): number {
  const windows: Record<string, number> = {
    'claude-opus-4-6': 200000,
    'claude-sonnet-4-6': 200000,
    'claude-haiku-4-5': 200000,
  }
  return windows[model] ?? 100000
}

export function getContextWindowUsage(
  inputTokens: number,
  outputTokens: number,
  model: string,
): { used: number; total: number; percent: number } {
  const total = getContextWindowForModel(model)
  const used = inputTokens + outputTokens
  return {
    used,
    total,
    percent: (used / total) * 100,
  }
}
```

---

## 四十七、成本追踪

### 成本计算

```typescript
// cost-tracker.ts
export function calculateUSDCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 15, output: 75 },    // $15/M input, $75/M output
    'claude-sonnet-4-6': { input: 3, output: 15 },
    'claude-haiku-4-5': { input: 0.8, output: 4 },
  }

  const p = pricing[model] ?? { input: 3, output: 15 }
  const inputCost = (inputTokens / 1_000_000) * p.input
  const outputCost = (outputTokens / 1_000_000) * p.output

  return inputCost + outputCost
}

// 格式化输出
export function formatCost(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${(costUSD * 1000).toFixed(2)}/K`
  }
  return `$${costUSD.toFixed(4)}`
}
```

### 使用统计

```typescript
// bootstrap/state.ts
export interface CostState {
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationInputTokens: number
  totalCacheReadInputTokens: number
  totalLinesAdded: number
  totalLinesRemoved: number
  totalAPIRequests: number
  totalAPIDuration: number
}

// 状态管理
function getCostState(): CostState {
  return {
    totalCostUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    // ...
  }
}

export function addToTotalCostState(
  inputTokens: number,
  outputTokens: number,
  costUSD: number,
): void {
  const state = getCostState()
  state.totalInputTokens += inputTokens
  state.totalOutputTokens += outputTokens
  state.totalCostUSD += costUSD
}
```

---

## 四十八、系统提示结构

### 提示分段

```typescript
// constants/prompts.ts

// 动态内容边界 (用于缓存)
export const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

// 分段函数
function getSimpleSystemSection(): string {
  return [
    '# System',
    'All text you output outside of tool use is displayed to the user.',
    'Tools are executed in a user-selected permission mode.',
    // ...
  ].join('\n')
}

function getLanguageSection(language: string): string {
  return `# Language
Always respond in ${language}.`
}

function getOutputStyleSection(config: OutputStyleConfig): string {
  return `# Output Style: ${config.name}
${config.prompt}`
}

// MCP 指令
function getMcpInstructionsSection(
  mcpClients: MCPServerConnection[],
): string | null {
  if (!mcpClients?.length) return null
  return getMcpInstructions(mcpClients)
}
```

### 构建系统提示

```typescript
// constants/prompts.ts
export function buildSystemPrompt(
  options: {
    model: string
    mcpClients: MCPServerConnection[]
    outputStyleConfig: OutputStyleConfig | null
    languagePreference: string | undefined
  }
): string[] {
  const sections = [
    // 静态部分 (可缓存)
    getSimpleIntroSection(options.outputStyleConfig),
    getSimpleSystemSection(),
    getToolDescriptionsSection(),

    // 动态边界
    SYSTEM_PROMPT_DYNAMIC_BOUNDARY,

    // 动态部分 (不可缓存)
    getLanguageSection(options.languagePreference),
    getOutputStyleSection(options.outputStyleConfig),
    getMcpInstructionsSection(options.mcpClients),
  ]

  return sections.filter(Boolean)
}
```

---

## 四十九、CLI 命令系统

### 命令注册

```typescript
// commands.ts
export type Command = {
  name: string
  description: string
  execute: (args: string[], context: CommandContext) => Promise<void>
}

// 内置命令
export const builtInCommands: Command[] = [
  {
    name: 'help',
    description: 'Show help information',
    execute: async (args) => {
      console.log(getHelpText())
    },
  },
  {
    name: 'clear',
    description: 'Clear the conversation',
    execute: async (args) => {
      await clearConversation()
    },
  },
  {
    name: 'compact',
    description: 'Compact the conversation',
    execute: async (args) => {
      await compactConversation()
    },
  },
]

// 斜杠命令 (Slash Commands)
export const slashCommands: Command[] = [
  {
    name: '/model',
    description: 'Switch model',
    execute: async (args) => {
      await switchModel(args[0])
    },
  },
  {
    name: '/prompt',
    description: 'Set custom prompt',
    execute: async (args) => {
      await setCustomPrompt(args.join(' '))
    },
  },
]
```

### 命令执行

```typescript
// 处理用户输入
export async function processInput(
  input: string,
  context: CommandContext,
): Promise<CommandResult> {
  // 1. 检查是否是命令
  if (input.startsWith('/')) {
    const [name, ...args] = input.slice(1).split(' ')
    const command = findCommand(name)
    if (command) {
      await command.execute(args, context)
      return { type: 'command' }
    }
  }

  // 2. 普通消息
  return { type: 'message', content: input }
}
```

---

## 五十、重要设计模式

### 1. 工具分类模式

```typescript
// 工具按功能分类
type ToolCategory = 'file' | 'bash' | 'network' | 'task' | 'mcp' | 'agent'

function categorizeTool(tool: Tool): ToolCategory {
  if (tool instanceof FileTool) return 'file'
  if (tool instanceof BashTool) return 'bash'
  if (tool instanceof NetworkTool) return 'network'
  if (tool instanceof TaskTool) return 'task'
  if (tool.isMcp) return 'mcp'
  return 'agent'
}

// 并发安全判断
function canRunConcurrently(tools: Tool[]): boolean {
  return tools.every(t => t.isConcurrencySafe)
}
```

### 2. 延迟加载模式

```typescript
// 避免循环依赖
const getTeamCreateTool = () =>
  require('./tools/TeamCreateTool/TeamCreateTool.js').TeamCreateTool

// 条件编译
const cronTools = feature('AGENT_TRIGGERS')
  ? [CronCreateTool, CronDeleteTool, CronListTool]
  : []
```

### 3. 命令模式

```typescript
// 统一的命令接口
interface Command {
  name: string
  execute(args: string[]): Promise<void>
}

// 命令注册表
const commands = new Map<string, Command>()

function registerCommand(command: Command) {
  commands.set(command.name, command)
}

function executeCommand(name: string, args: string[]) {
  const command = commands.get(name)
  if (!command) throw new Error(`Unknown command: ${name}`)
  return command.execute(args)
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **工具定义** | `Tool.ts` | 工具接口 |
| **工具注册** | `tools.ts` | 工具注册表 |
| **BashTool** | `tools/BashTool/BashTool.tsx` | Shell 执行 |
| **Token 估算** | `services/tokenEstimation.ts` | Token 统计 |
| **成本追踪** | `cost-tracker.ts` | 成本计算 |
| **系统提示** | `constants/prompts.ts` | 提示构建 |
| **CLI 命令** | `commands.ts` | 命令系统 |