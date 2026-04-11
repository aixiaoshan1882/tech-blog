# Claude Code 源码深度学习笔记 (第四十四部分)

> Entrypoints·AppState·QueryEngine·Hooks·Analytics·Plugins·Skills·Memdir

---

## 二百八十五、CLI Entrypoint

### 命令行入口点

```typescript
// entrypoints/cli.tsx

/**
 * CLI 入口点
 * 快速路径优化 - 零模块加载
 */

// 零模块加载的 --version
if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
  console.log(`${MACRO.VERSION} (Claude Code)`)
  return
}

// --dump-system-prompt 快速路径
if (args[0] === '--dump-system-prompt') {
  const model = args[args.indexOf('--model') + 1] || getMainLoopModel()
  const prompt = await getSystemPrompt([], model)
  console.log(prompt.join('\n'))
  return
}

// CCR 环境内存限制
if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  process.env.NODE_OPTIONS = '--max-old-space-size=8192'
}

// 主函数
async function main(): Promise<void> {
  // 动态导入启动分析器
  const { profileCheckpoint } = await import('../utils/startupProfiler.js')
  profileCheckpoint('cli_entry')

  // 加载完整 CLI
  const { runCLI } = await import('../cli/run.js')
  await runCLI()
}
```

---

## 二百八十六、AppState 应用状态

### 状态管理

```typescript
// state/AppStateStore.ts

/**
 * 应用状态管理
 * 使用 TypeScript 类型定义完整的状态结构
 */

// 推测状态
export type SpeculationState =
  | { status: 'idle' }
  | {
      status: 'active'
      id: string
      abort: () => void
      startTime: number
      messagesRef: { current: Message[] }
      writtenPathsRef: { current: Set<string> }
      boundary: CompletionBoundary | null
      suggestionLength: number
      toolUseCount: number
      isPipelined: boolean
    }

// 完成边界
export type CompletionBoundary =
  | { type: 'complete'; completedAt: number; outputTokens: number }
  | { type: 'bash'; command: string; completedAt: number }
  | { type: 'edit'; toolName: string; filePath: string; completedAt: number }
  | { type: 'denied_tool'; toolName: string; detail: string; completedAt: number }

// 应用状态
export type AppState = {
  // 消息
  messages: Message[]

  // 工具
  tools: Tools
  allowedTools: string[]

  // MCP
  mcpServers: Record<string, MCPServerConnection>
  mcpResources: Map<string, ServerResource[]>

  // 任务
  tasks: Record<string, TaskState>

  // 推测执行
  speculation: SpeculationState

  // 设置
  settings: SettingsJson
  permissionMode: PermissionMode

  // 主题
  theme: ThemeName
}

// 创建空状态
export function createEmptyAppState(): AppState {
  return {
    messages: [],
    tools: {},
    allowedTools: [],
    mcpServers: {},
    mcpResources: new Map(),
    tasks: {},
    speculation: IDLE_SPECULATION_STATE,
    settings: {},
    permissionMode: 'ask',
    theme: 'dark',
  }
}
```

---

## 二百八十七、QueryEngine 查询引擎

### 查询处理

```typescript
// QueryEngine.ts

/**
 * 查询引擎
 * 处理用户输入并调用模型
 */

// 查询选项
type QueryOptions = {
  messages: Message[]
  model?: string
  systemPrompt: SystemPrompt
  tools: Tools
  querySource?: QuerySource
  abortSignal?: AbortSignal
}

// 执行查询
export async function query(options: QueryOptions): Promise<QueryResult> {
  const {
    messages,
    model,
    systemPrompt,
    tools,
    querySource,
    abortSignal,
  } = options

  // 1. 准备请求
  const request = await buildAPIRequest({
    messages,
    model,
    systemPrompt,
    tools,
  })

  // 2. 调用 API
  const stream = await callAPI(request, { signal: abortSignal })

  // 3. 处理流
  for await (const event of stream) {
    switch (event.type) {
      case 'content_block':
        // 处理内容块
        break
      case 'tool_use':
        // 处理工具调用
        break
      case 'message_delta':
        // 处理消息增量
        break
    }
  }

  // 4. 返回结果
  return { messages: updatedMessages, usage }
}
```

---

## 二百八十八、Context 上下文

### 上下文管理

```typescript
// context.ts

/**
 * 上下文管理
 * 系统提示和用户上下文
 */

// 获取 Git 状态
export const getGitStatus = memoize(async (): Promise<string | null> => {
  if (!await getIsGit()) return null

  const [branch, mainBranch, status, log, userName] = await Promise.all([
    getBranch(),
    getDefaultBranch(),
    execFileNoThrow(gitExe(), ['status', '--short']),
    execFileNoThrow(gitExe(), ['log', '--oneline', '-n', '5']),
    execFileNoThrow(gitExe(), ['config', 'user.name']),
  ])

  return formatGitStatus({ branch, mainBranch, status, log, userName })
})

// 获取用户上下文
export function getUserContext(): Promise<UserContext> {
  return memoize(async () => {
    const gitStatus = await getGitStatus()
    const memoryPrompt = await loadMemoryPrompt()
    const claudeMd = await getClaudeMds()

    return {
      gitStatus,
      memoryPrompt,
      claudeMd,
      // ...
    }
  })()
}
```

---

## 二百八十九、Hooks 钩子系统

### 钩子注册和执行

```typescript
// utils/hooks/postSamplingHooks.ts

/**
 * 后采样钩子
 * 模型采样完成后执行
 */

export type REPLHookContext = {
  messages: Message[]
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  toolUseContext: ToolUseContext
  querySource?: QuerySource
}

export type PostSamplingHook = (
  context: REPLHookContext,
) => Promise<void> | void

// 内部注册表
const postSamplingHooks: PostSamplingHook[] = []

// 注册钩子
export function registerPostSamplingHook(hook: PostSamplingHook): void {
  postSamplingHooks.push(hook)
}

// 执行所有钩子
export async function executePostSamplingHooks(
  messages: Message[],
  systemPrompt: SystemPrompt,
  userContext: { [k: string]: string },
  systemContext: { [k: string]: string },
  toolUseContext: ToolUseContext,
  querySource?: QuerySource,
): Promise<void> {
  const context: REPLHookContext = {
    messages,
    systemPrompt,
    userContext,
    systemContext,
    toolUseContext,
    querySource,
  }

  for (const hook of postSamplingHooks) {
    try {
      await hook(context)
    } catch (error) {
      logError(toError(error))
    }
  }
}
```

---

## 二百九十、Analytics 分析服务

### 事件日志

```typescript
// services/analytics/index.ts

/**
 * 分析服务
 * 公共 API 用于事件日志
 *
 * 设计: 无依赖避免循环导入
 * 事件在 attachAnalyticsSink() 调用前排队
 */

// 事件队列
type QueuedEvent = {
  eventName: string
  metadata: LogEventMetadata
  async: boolean
}

// 分析接收器接口
export type AnalyticsSink = {
  logEvent: (eventName: string, metadata: LogEventMetadata) => void
  logEventAsync: (eventName: string, metadata: LogEventMetadata) => Promise<void>
}

// 记录事件
export function logEvent(
  eventName: string,
  metadata: Record<string, boolean | number | undefined>,
): void {
  if (sink) {
    sink.logEvent(eventName, metadata)
  } else {
    eventQueue.push({ eventName, metadata, async: false })
  }
}

// 异步记录事件
export async function logEventAsync(
  eventName: string,
  metadata: Record<string, boolean | number | undefined>,
): Promise<void> {
  if (sink) {
    await sink.logEventAsync(eventName, metadata)
  } else {
    eventQueue.push({ eventName, metadata, async: true })
  }
}

// 剥离 _PROTO_* 键
export function stripProtoFields<V>(
  metadata: Record<string, V>,
): Record<string, V> {
  let result: Record<string, V> | undefined
  for (const key in metadata) {
    if (key.startsWith('_PROTO_')) {
      if (result === undefined) {
        result = { ...metadata }
      }
      delete result[key]
    }
  }
  return result ?? metadata
}
```

---

## 二百九十一、Plugin Loader 插件加载

### 插件系统

```typescript
// utils/plugins/pluginLoader.ts

/**
 * 插件加载器
 * 从市场、git 仓库等来源发现、加载和验证插件
 *
 * 插件目录结构:
 * my-plugin/
 * ├── plugin.json      # 可选清单
 * ├── commands/        # 自定义斜杠命令
 * ├── agents/          # 自定义 AI agents
 * └── hooks/           # 钩子配置
 */

// 加载结果
type PluginLoadResult = {
  plugin: LoadedPlugin
  errors: PluginError[]
}

// 加载所有插件
export async function loadAllPlugins(): Promise<LoadedPlugin[]> {
  const plugins: LoadedPlugin[] = []
  const errors: PluginError[] = []

  // 1. 加载内置插件
  const builtin = getBuiltinPlugins()
  plugins.push(...builtin)

  // 2. 加载市场插件
  const marketplace = await loadMarketplacePlugins()
  plugins.push(...marketplace)

  // 3. 加载本地插件
  const local = await loadLocalPlugins()
  plugins.push(...local)

  return plugins
}

// 验证插件清单
export function validatePluginManifest(
  manifest: unknown,
): PluginManifest | null {
  // 验证清单结构
  // 返回 null 如果无效
}

// 加载插件钩子
export async function loadPluginHooks(
  plugin: LoadedPlugin,
): Promise<HooksSettings | null> {
  const hooksPath = join(plugin.path, 'hooks', 'hooks.json')
  if (!await pathExists(hooksPath)) return null

  const content = await readFile(hooksPath, 'utf-8')
  return safeParseJSON(content)
}
```

---

## 二百九十二、Skills 技能系统

### 技能加载

```typescript
// skills/loadSkillsDir.ts

/**
 * 技能加载
 * 从 skills 目录加载技能
 */

export type LoadedFrom =
  | 'commands_DEPRECATED'
  | 'skills'
  | 'plugin'
  | 'managed'
  | 'bundled'
  | 'mcp'

// 获取技能路径
export function getSkillsPath(
  source: SettingSource | 'plugin',
  dir: 'skills' | 'commands',
): string {
  switch (source) {
    case 'user':
      return join(getClaudeConfigHomeDir(), dir)
    case 'project':
      return join(getCwd(), '.claude', dir)
    case 'managed':
      return join(getManagedFilePath(), dir)
    case 'plugin':
      return join(pluginDir, 'skills')
  }
}

// 加载技能
export async function loadSkills(): Promise<LoadedSkill[]> {
  const skills: LoadedSkill[] = []

  // 加载内置技能
  const bundled = await loadBundledSkills()
  skills.push(...bundled)

  // 加载用户技能
  const user = await loadSkillsFromDir(
    getSkillsPath('user', 'skills'),
    'skills',
  )
  skills.push(...user)

  // 加载项目技能
  const project = await loadSkillsFromDir(
    getSkillsPath('project', 'skills'),
    'skills',
  )
  skills.push(...project)

  return skills
}

// 解析 frontmatter
export function parseFrontmatter(content: string): FrontmatterData {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter = safeParseJSON(match[1])
  return { frontmatter, body: match[2] }
}
```

---

## 二百九十三、Memdir 记忆目录

### 记忆管理

```typescript
// memdir/memdir.ts

/**
 * 记忆目录管理
 * MEMORY.md 和自动记忆
 */

// 入口点名称
export const ENTRYPOINT_NAME = 'MEMORY.md'
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000

// 截断入口点内容
export function truncateEntrypointContent(
  raw: string,
): EntrypointTruncation {
  const trimmed = raw.trim()
  const contentLines = trimmed.split('\n')
  const lineCount = contentLines.length
  const byteCount = trimmed.length

  const wasLineTruncated = lineCount > MAX_ENTRYPOINT_LINES
  const wasByteTruncated = byteCount > MAX_ENTRYPOINT_BYTES

  if (!wasLineTruncated && !wasByteTruncated) {
    return { content: trimmed, lineCount, byteCount, wasLineTruncated, wasByteTruncated }
  }

  // 先按行截断
  let truncated = wasLineTruncated
    ? contentLines.slice(0, MAX_ENTRYPOINT_LINES).join('\n')
    : trimmed

  // 再按字节截断
  if (wasByteTruncated && truncated.length > MAX_ENTRYPOINT_BYTES) {
    truncated = truncateAtByteLimit(truncated, MAX_ENTRYPOINT_BYTES)
  }

  return {
    content: truncated,
    lineCount: truncated.split('\n').length,
    byteCount: truncated.length,
    wasLineTruncated,
    wasByteTruncated,
  }
}

// 加载记忆提示
export async function loadMemoryPrompt(): Promise<string> {
  const memoryFiles = await getMemoryFiles()
  const prompts = []

  for (const file of memoryFiles) {
    const truncated = truncateEntrypointContent(file.content)
    prompts.push(truncated.content)
  }

  return prompts.join('\n\n')
}
```

---

## 二百九十四、System Prompts 系统提示

### 提示构建

```typescript
// constants/prompts.ts

/**
 * 系统提示构建
 * 组合各种部分构建完整系统提示
 */

// 获取系统提示
export async function getSystemPrompt(
  context: REPLContext,
  model: string,
): Promise<SystemPrompt> {
  const parts: string[] = []

  // 1. 基础指令
  parts.push(BASE_INSTRUCTIONS)

  // 2. 模型特定指令
  parts.push(getModelInstructions(model))

  // 3. 工具说明
  parts.push(getToolsDescription(context.tools))

  // 4. 内存内容
  const memory = await loadMemoryPrompt()
  if (memory) {
    parts.push(`\n${MEMORY_SECTION}\n${memory}`)
  }

  // 5. Git 状态
  const gitStatus = await getGitStatus()
  if (gitStatus) {
    parts.push(`\n${GIT_STATUS_SECTION}\n${gitStatus}`)
  }

  return parts.map(text => ({ text }))
}

// 获取工具描述
function getToolsDescription(tools: Tools): string {
  const descriptions = []

  for (const tool of Object.values(tools)) {
    descriptions.push(`## ${tool.name}`)
    descriptions.push(tool.description)
    descriptions.push('')
  }

  return descriptions.join('\n')
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **CLI Entry** | `entrypoints/cli.tsx` | 命令行入口 |
| **AppState** | `state/AppStateStore.ts` | 状态管理 |
| **QueryEngine** | `QueryEngine.ts` | 查询处理 |
| **Context** | `context.ts` | 上下文管理 |
| **Hooks** | `utils/hooks/postSamplingHooks.ts` | 钩子系统 |
| **Analytics** | `services/analytics/index.ts` | 分析服务 |
| **Plugin Loader** | `utils/plugins/pluginLoader.ts` | 插件加载 |
| **Skills** | `skills/loadSkillsDir.ts` | 技能系统 |
| **Memdir** | `memdir/memdir.ts` | 记忆目录 |
| **Prompts** | `constants/prompts.ts` | 系统提示 |