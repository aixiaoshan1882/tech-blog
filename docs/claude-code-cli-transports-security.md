# Claude Code 源码深度学习笔记 (第四十八部分)

> AgenticSearch·Telemetry·Setup·AutoMode·CLI·Transports

---

## 三百零一、Agentic Session Search 智能会话搜索

### 语义搜索会话

```typescript
// utils/agenticSessionSearch.ts

/**
 * 智能会话搜索
 * 基于 AI 的语义搜索历史会话
 */

const MAX_TRANSCRIPT_CHARS = 2000
const MAX_MESSAGES_TO_SCAN = 100
const MAX_SESSIONS_TO_SEARCH = 100

const SESSION_SEARCH_SYSTEM_PROMPT = `Your goal is to find relevant sessions based on a user's search query.

You will be given a list of sessions with their metadata and a search query. Identify which sessions are most relevant to the query.

Each session may include:
- Title (display name or custom title)
- Tag (user-assigned category, shown as [tag: name])
- Branch (git branch name)
- Summary (AI-generated summary)
- First message (beginning of the conversation)
- Transcript (excerpt of conversation content)

IMPORTANT: Tags are user-assigned labels that indicate the session's topic or category. If the query matches a tag exactly or partially, those sessions should be highly prioritized.

For each session, consider (in order of priority):
1. Exact tag matches (highest priority)
2. Partial tag matches or tag-related terms
3. Title matches
4. Branch name matches
5. Summary and transcript content matches
6. Semantic similarity and related concepts

CRITICAL: Be VERY inclusive in your matching. Include sessions that:
- Contain the query term anywhere in any field
- Are semantically related to the query
- Discuss topics that could be related to the query

Respond with ONLY the JSON object:
{"relevant_indices": [2, 5, 0]}`

// 提取消息文本
function extractMessageText(message: SerializedMessage): string {
  if (message.type !== 'user' && message.type !== 'assistant') {
    return ''
  }

  const content = 'message' in message ? message.message?.content : undefined
  if (!content) return ''

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(block => {
        if (typeof block === 'string') return block
        if ('text' in block && typeof block.text === 'string') return block.text
        return ''
      })
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

// 搜索会话
export async function agenticSessionSearch(
  query: string,
): Promise<SessionSearchResult[]> {
  // 1. 加载会话列表
  const sessions = await loadRecentSessions(MAX_SESSIONS_TO_SEARCH)

  // 2. 构建搜索上下文
  const sessionContexts = sessions.map(session => ({
    id: session.id,
    title: session.title,
    tag: session.tag,
    branch: session.branch,
    summary: session.summary,
    firstMessage: extractMessageText(session.messages[0]),
    transcript: extractTranscript(session.messages),
  }))

  // 3. 调用 AI 搜索
  const result = await sideQuery({
    query,
    systemPrompt: SESSION_SEARCH_SYSTEM_PROMPT,
    context: { sessions: sessionContexts },
  })

  // 4. 解析结果
  const { relevant_indices } = JSON.parse(result)
  return relevant_indices.map((i: number) => sessions[i])
}
```

---

## 三百零二、Perfetto Tracing 性能追踪

### Chrome Trace Event 追踪

```typescript
// utils/telemetry/perfettoTracing.ts

/**
 * Perfetto Tracing
 * 生成 Chrome Trace Event 格式的追踪文件
 *
 * 使用方式:
 * 1. 设置 CLAUDE_CODE_PERFETTO_TRACE=1
 * 2. 运行 Claude Code
 * 3. 在 ui.perfetto.dev 打开追踪文件
 */

// Trace Event 格式类型
export type TraceEventPhase =
  | 'B' // Begin duration event
  | 'E' // End duration event
  | 'X' // Complete event (with duration)
  | 'i' // Instant event
  | 'C' // Counter event
  | 'b' // Async begin
  | 'n' // Async instant
  | 'e' // Async end
  | 'M' // Metadata event

export type TraceEvent = {
  name: string
  cat: string
  ph: TraceEventPhase
  ts: number    // 微秒
  pid: number   // Process ID
  tid: number   // Thread ID
  dur?: number  // 持续时间 (微秒)
  args?: Record<string, unknown>
  id?: string
  scope?: string
}

// Agent 信息
type AgentInfo = {
  agentId: string
  agentName: string
  parentAgentId?: string
  processId: number
  threadId: number
}

// 追踪事件
export function startInteractionPerfettoSpan(
  sessionId: string,
  agentId: string,
): string {
  const event: TraceEvent = {
    name: `Interaction ${sessionId}`,
    cat: 'interaction',
    ph: 'B',
    ts: performance.now() * 1000, // 转换为微秒
    pid: 1,
    tid: hashAgentName(agentId),
    args: { sessionId, agentId },
  }

  addTraceEvent(event)
  return sessionId
}

// 追踪 API 请求
export function startLLMRequestPerfettoSpan(
  requestId: string,
  model: string,
  promptTokens: number,
): string {
  const event: TraceEvent = {
    name: `LLM Request ${requestId}`,
    cat: 'llm',
    ph: 'B',
    ts: performance.now() * 1000,
    pid: 1,
    tid: 1,
    args: { requestId, model, promptTokens },
  }

  addTraceEvent(event)
  return requestId
}

// 追踪工具执行
export function startToolPerfettoSpan(
  toolName: string,
  toolCallId: string,
): string {
  const event: TraceEvent = {
    name: `Tool ${toolName}`,
    cat: 'tool',
    ph: 'B',
    ts: performance.now() * 1000,
    pid: 1,
    tid: hashAgentName(toolName),
    args: { toolName, toolCallId },
  }

  addTraceEvent(event)
  return toolCallId
}

// 结束追踪 span
export function endPerfettoSpan(spanId: string): void {
  const event: TraceEvent = {
    name: 'End',
    cat: 'end',
    ph: 'E',
    ts: performance.now() * 1000,
    pid: 1,
    tid: 1,
    args: { spanId },
  }

  addTraceEvent(event)
}

// 写入追踪文件
export function writePerfettoTrace(): void {
  const tracePath = join(
    getClaudeConfigHomeDir(),
    'traces',
    `trace-${getSessionId()}.json`,
  )

  mkdirSync(dirname(tracePath), { recursive: true })
  writeFileSync(tracePath, jsonStringify(traceEvents))
}
```

---

## 三百零三、Session Tracing 会话追踪

### OpenTelemetry 集成

```typescript
// utils/telemetry/sessionTracing.ts

/**
 * Session Tracing
 * 基于 OpenTelemetry 的高级追踪系统
 *
 * 使用 ALS (AsyncLocalStorage) 管理 span 上下文
 */

// ALS 存储 SpanContext
const interactionContext = new AsyncLocalStorage<SpanContext | undefined>()
const toolContext = new AsyncLocalStorage<SpanContext | undefined>()
const activeSpans = new Map<string, WeakRef<SpanContext>>()

// 强引用存储 (防止 GC)
const strongSpans = new Map<string, SpanContext>()
const SPAN_TTL_MS = 30 * 60 * 1000 // 30 分钟

type SpanContext = {
  span: Span
  startTime: number
  attributes: Record<string, string | number | boolean>
  ended?: boolean
  perfettoSpanId?: string
}

// 开始交互 span
export async function startInteractionSpan(
  attributes: Record<string, string | number | boolean>,
): Promise<string> {
  const tracer = trace.getTracer('claude-code')

  const span = tracer.startSpan('interaction', {
    startTime: new Date(),
  })

  const spanId = generateSpanId()
  const context: SpanContext = {
    span,
    startTime: Date.now(),
    attributes,
  }

  // 存储强引用
  strongSpans.set(spanId, context)

  // 设置 ALS
  interactionContext.enterWith(context)

  // 启动 Perfetto
  const perfettoSpanId = startInteractionPerfettoSpan(
    getSessionId(),
    getAgentId(),
  )
  context.perfettoSpanId = perfettoSpanId

  return spanId
}

// 开始工具 span
export async function startToolSpan(
  toolName: string,
  input: unknown,
): Promise<string> {
  const tracer = trace.getTracer('claude-code')

  const span = tracer.startSpan(`tool.${toolName}`, {
    startTime: new Date(),
  })

  // 设置属性
  span.setAttributes({
    'tool.name': toolName,
    'tool.input': truncateContent(input),
  })

  const spanId = generateSpanId()
  const context: SpanContext = {
    span,
    startTime: Date.now(),
    attributes: { 'tool.name': toolName },
  }

  strongSpans.set(spanId, context)

  // 启动 Perfetto
  const perfettoSpanId = startToolPerfettoSpan(toolName, spanId)
  context.perfettoSpanId = perfettoSpanId

  return spanId
}

// 结束 span
export function endSpan(spanId: string, result?: unknown): void {
  const context = strongSpans.get(spanId)
  if (!context || context.ended) return

  context.ended = true
  context.span.setAttributes({
    'result': truncateContent(result),
    'duration_ms': Date.now() - context.startTime,
  })
  context.span.end()

  // 结束 Perfetto span
  if (context.perfettoSpanId) {
    endPerfettoSpan(context.perfettoSpanId)
  }

  // 清理
  strongSpans.delete(spanId)
}
```

---

## 三百零四、Setup 初始化

### 应用初始化流程

```typescript
// setup.ts

/**
 * Setup 流程
 * CLI 启动时的初始化步骤
 */

export async function setup(
  cwd: string,
  permissionMode: PermissionMode,
  allowDangerouslySkipPermissions: boolean,
  worktreeEnabled: boolean,
  worktreeName: string | undefined,
  tmuxEnabled: boolean,
  customSessionId?: string | null,
  worktreePRNumber?: number,
  messagingSocketPath?: string,
): Promise<void> {
  // 1. 检查 Node.js 版本
  const nodeVersion = process.version.match(/^v(\d+)\./)?.[1]
  if (!nodeVersion || parseInt(nodeVersion) < 18) {
    console.error(chalk.bold.red(
      'Error: Claude Code requires Node.js version 18 or higher.',
    ))
    process.exit(1)
  }

  // 2. 设置工作目录
  setCwd(cwd)
  setOriginalCwd(cwd)

  // 3. 查找 Git 根目录
  const gitRoot = await findCanonicalGitRoot(cwd)
  if (gitRoot) {
    setProjectRoot(gitRoot)
  }

  // 4. 初始化会话
  const sessionId = customSessionId ?? asSessionId(randomUUID())
  switchSession(sessionId)

  // 5. 初始化 Session Memory
  await initSessionMemory()

  // 6. 加载配置
  const config = await getCurrentProjectConfig()

  // 7. 初始化 Hooks
  updateHooksConfigSnapshot()
  await initializeFileChangedWatcher()

  // 8. 创建 Worktree (如果启用)
  if (worktreeEnabled && worktreeName) {
    await createWorktreeForSession(worktreeName, worktreePRNumber)
  }

  // 9. 创建 TMUX Session (如果启用)
  if (tmuxEnabled) {
    const tmuxSession = generateTmuxSessionName(sessionId)
    await createTmuxSessionForWorktree(tmuxSession)
  }

  // 10. 初始化分析服务
  initSinks()

  // 11. 预取 API Key
  await prefetchApiKeyFromApiKeyHelperIfSafe()

  // 12. 检查发布说明
  await checkForReleaseNotes()
}
```

---

## 三百零五、Auto Mode 自动模式

### AI 分类器自动批准

```typescript
// cli/handlers/autoMode.ts

/**
 * Auto Mode
 * 基于 AI 分类器自动决定工具调用是否需要用户确认
 */

const CRITIQUE_SYSTEM_PROMPT =
  'You are an expert reviewer of auto mode classifier rules for Claude Code.\n' +
  '\n' +
  'Claude Code has an "auto mode" that uses an AI classifier to decide whether ' +
  'tool calls should be auto-approved or require user confirmation.\n' +
  '\n' +
  'For each rule, evaluate:\n' +
  '1. **Clarity**: Is the rule unambiguous?\n' +
  '2. **Completeness**: Are there gaps or edge cases?\n' +
  '3. **Conflicts**: Do any of the rules conflict?\n' +
  '4. **Actionability**: Is the rule specific enough?'

// 三类规则
type AutoModeRules = {
  allow: string[]      // 自动批准的规则
  soft_deny: string[]  // 阻止的规则 (需要确认)
  environment: string[] // 环境上下文
}

// 获取默认规则
export function getDefaultExternalAutoModeRules(): AutoModeRules {
  return {
    allow: [
      'Read any file',
      'Search for text patterns',
      'Run tests',
      'Execute safe shell commands',
    ],
    soft_deny: [
      'Delete files',
      'Push to remote',
      'Execute destructive commands',
    ],
    environment: [
      'Running in a development environment',
      'Project has tests configured',
    ],
  }
}

// 规则审查
export async function autoModeCritiqueHandler(
  options: { model?: string }
): Promise<void> {
  const config = getAutoModeConfig()

  // 使用 AI 审查规则
  const critique = await sideQuery({
    query: 'Review these auto mode rules',
    systemPrompt: CRITIQUE_SYSTEM_PROMPT,
    context: { rules: config },
    model: options.model,
  })

  process.stdout.write(critique)
}
```

---

## 三百零六、Hybrid Transport 混合传输

### WebSocket + HTTP 混合模式

```typescript
// cli/transports/HybridTransport.ts

/**
 * Hybrid Transport
 * WebSocket 读取 + HTTP POST 写入
 *
 * 解决桥接模式下的写入冲突问题
 */

const BATCH_FLUSH_INTERVAL_MS = 100
const POST_TIMEOUT_MS = 15_000
const CLOSE_GRACE_MS = 3000

/**
 * 混合传输: WebSocket 读取, HTTP POST 写入
 *
 * 写入流程:
 *   write(stream_event) ─┐
 *                        │ (100ms timer)
 *                        ▼
 *   write(other) ────► uploader.enqueue() ──► postOnce()
 *
 * stream_event 消息累积最多 100ms 再入队 (减少 POST 数量)
 */
export class HybridTransport extends WebSocketTransport {
  private postUrl: string
  private uploader: SerialBatchEventUploader<StdoutMessage>

  // stream_event 缓冲
  private streamEventBuffer: StdoutMessage[] = []
  private streamEventTimer: ReturnType<typeof setTimeout> | null = null

  constructor(url: URL, headers: Record<string, string> = {}) {
    super(url, headers)

    this.postUrl = convertWsUrlToPostUrl(url)
    this.uploader = new SerialBatchEventUploader({
      maxBatchSize: 500,
      maxQueueSize: 10000,
      flushIntervalMs: BATCH_FLUSH_INTERVAL_MS,
    })

    // 监听写入事件
    this.uploader.on('flush', this.handleFlush.bind(this))
  }

  // 写入流事件 (缓冲)
  write(message: JSONRPCMessage): void {
    if (isStreamEvent(message)) {
      this.streamEventBuffer.push(message)

      // 设置 100ms 刷新定时器
      if (!this.streamEventTimer) {
        this.streamEventTimer = setTimeout(() => {
          this.flushStreamBuffer()
        }, BATCH_FLUSH_INTERVAL_MS)
      }
    } else {
      // 非流事件先刷新缓冲
      this.flushStreamBuffer()
      this.uploader.enqueue(message)
    }
  }

  // 刷新流事件缓冲
  private flushStreamBuffer(): void {
    if (this.streamEventTimer) {
      clearTimeout(this.streamEventTimer)
      this.streamEventTimer = null
    }

    if (this.streamEventBuffer.length > 0) {
      this.uploader.enqueue(this.streamEventBuffer)
      this.streamEventBuffer = []
    }
  }

  // 批量刷新
  private async handleFlush(batch: StdoutMessage[]): Promise<void> {
    await this.postWithRetry(batch)
  }

  // POST 重试
  private async postWithRetry(batch: StdoutMessage[]): Promise<void> {
    let failures = 0

    while (true) {
      try {
        await axios.post(this.postUrl, batch, {
          headers: this.getAuthHeaders(),
          timeout: POST_TIMEOUT_MS,
        })
        return
      } catch (error) {
        failures++
        if (!isRetryable(error)) {
          throw error
        }

        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, failures), 30000)
        await sleep(delay + Math.random() * 1000)
      }
    }
  }
}
```

---

## 三百零七、CLI Commands CLI 命令系统

### 核心命令

```typescript
// commands/init.ts

/**
 * /init 命令
 * 交互式初始化 CLAUDE.md
 */

const NEW_INIT_PROMPT = `Set up a minimal CLAUDE.md for this repo. CLAUDE.md is loaded into every Claude Code session.

## Phase 1: Ask what to set up

Use AskUserQuestion to find out:
- "Which CLAUDE.md files should /init set up?"
  Options: "Project CLAUDE.md" | "Personal CLAUDE.local.md" | "Both"

- "Also set up skills and hooks?"
  Options: "Skills + hooks" | "Skills only" | "Hooks only" | "Neither"

## Phase 2: Explore the codebase

Launch a subagent to survey:
- package.json, Cargo.toml, pyproject.toml, go.mod
- README, Makefile, CI config
- Existing CLAUDE.md, .claude/rules/
- .cursor/rules, .cursorrules
- .github/copilot-instructions.md

Detect:
- Build, test, lint commands
- Languages, frameworks, package manager
- Project structure
- Formatter configuration

## Phase 3: Fill in gaps

Ask about:
- Non-obvious commands or gotchas
- Branch/PR conventions
- Required env setup
- Testing quirks

Synthesize proposal into:
- **Hook**: deterministic shell command on tool event
- **Skill**: on-demand workflow
- **CLAUDE.md note**: behavior guideline`

// commands/memory/memory.tsx

/**
 * /memory 命令
 * 交互式编辑记忆文件
 */

export function MemoryCommand({ onDone }) {
  return (
    <Dialog title="Memory" onCancel={handleCancel}>
      <MemoryFileSelector
        onSelect={handleSelectMemoryFile}
        onCancel={handleCancel}
      />
      <Text dimColor>
        Learn more: <Link url="https://code.claude.com/docs/en/memory" />
      </Text>
    </Dialog>
  )

  async function handleSelectMemoryFile(memoryPath: string) {
    // 使用 $EDITOR 或 $VISUAL 打开文件
    await editFileInEditor(memoryPath)
    onDone(`Opened memory file at ${memoryPath}`)
  }
}
```

---

## 三百零八、MCP Instructions Delta MCP 指令增量

### 增量更新 MCP 指令

```typescript
// utils/mcpInstructionsDelta.ts

/**
 * MCP Instructions Delta
 * 增量更新 MCP 服务器指令
 *
 * 避免每次重新发送完整指令
 */

// 增量类型
export type McpInstructionsDelta = {
  addedNames: string[]      // 新增的服务器名称
  addedBlocks: string[]     // 新增的指令块
  removedNames: string[]     // 移除的服务器名称
}

// 客户端侧指令
export type ClientSideInstruction = {
  serverName: string
  block: string
}

// 检查是否启用增量更新
export function isMcpInstructionsDeltaEnabled(): boolean {
  if (isEnvTruthy(process.env.CLAUDE_CODE_MCP_INSTR_DELTA)) return true
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_MCP_INSTR_DELTA)) return false
  return (
    process.env.USER_TYPE === 'ant' ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_basalt_3kr', false)
  )
}

// 计算增量
export function getMcpInstructionsDelta(
  mcpClients: MCPServerConnection[],
  messages: Message[],
  clientSideInstructions: ClientSideInstruction[],
): McpInstructionsDelta | null {
  // 1. 从消息中提取已宣布的服务器
  const announced = new Set<string>()
  for (const msg of messages) {
    if (msg.type !== 'attachment') continue
    if (msg.attachment.type !== 'mcp_instructions_delta') continue
    for (const n of msg.attachment.addedNames) announced.add(n)
    for (const n of msg.attachment.removedNames) announced.delete(n)
  }

  // 2. 获取当前连接的服务器
  const connected = mcpClients.filter(
    (c): c is ConnectedMCPServer => c.type === 'connected',
  )
  const connectedNames = new Set(connected.map(c => c.name))

  // 3. 计算差异
  const addedNames: string[] = []
  const addedBlocks: string[] = []
  const removedNames: string[] = []

  // 新增
  for (const name of connectedNames) {
    if (!announced.has(name)) {
      addedNames.push(name)
      addedBlocks.push(getInstructionsBlock(name, mcpClients))
    }
  }

  // 移除
  for (const name of announced) {
    if (!connectedNames.has(name)) {
      removedNames.push(name)
    }
  }

  if (addedNames.length === 0 && removedNames.length === 0) {
    return null
  }

  return { addedNames, addedBlocks, removedNames }
}
```

---

## 三百零九、Lockfile 锁文件

### 懒加载锁文件

```typescript
// utils/lockfile.ts

/**
 * Lazy accessor for proper-lockfile
 *
 * proper-lockfile 依赖 graceful-fs，会 monkey-patch 所有 fs 方法
 * 静态导入会增加启动时间 (约 8ms)
 *
 * 改用懒加载，只在实际需要锁时导入
 */

import type { CheckOptions, LockOptions, UnlockOptions } from 'proper-lockfile'

let _lockfile: typeof import('proper-lockfile') | undefined

function getLockfile() {
  if (!_lockfile) {
    _lockfile = require('proper-lockfile')
  }
  return _lockfile
}

export function lock(
  file: string,
  options?: LockOptions,
): Promise<() => Promise<void>> {
  return getLockfile().lock(file, options)
}

export function lockSync(file: string, options?: LockOptions): () => void {
  return getLockfile().lockSync(file, options)
}

export function unlock(
  file: string,
  options?: UnlockOptions,
): Promise<void> {
  return getLockfile().unlock(file, options)
}

export function check(file: string, options?: CheckOptions): Promise<boolean> {
  return getLockfile().check(file, options)
}
```

---

## 三百一十、Cleanup Registry 清理注册表

### 优雅关闭清理

```typescript
// utils/cleanupRegistry.ts

/**
 * Global cleanup registry
 * 在优雅关闭时运行清理函数
 */

// 全局清理函数集合
const cleanupFunctions = new Set<() => Promise<void>>()

// 注册清理函数
export function registerCleanup(
  cleanupFn: () => Promise<void>,
): () => void {
  cleanupFunctions.add(cleanupFn)
  // 返回注销函数
  return () => cleanupFunctions.delete(cleanupFn)
}

// 运行所有清理函数
export async function runCleanupFunctions(): Promise<void> {
  await Promise.all(
    Array.from(cleanupFunctions).map(fn => fn())
  )
}
```

---

## 三百一十一、Release Notes 发布说明

### 动态获取更新日志

```typescript
// utils/releaseNotes.ts

/**
 * Release Notes
 * 从 GitHub 动态获取更新日志
 *
 * 流程:
 * 1. 用户更新到新版本
 * 2. 后台获取更新日志并缓存
 * 3. 下次启动时显示缓存的更新
 */

// CHANGELOG_URL = 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md'
const RAW_CHANGELOG_URL =
  'https://raw.githubusercontent.com/anthropics/claude-code/refs/heads/main/CHANGELOG.md'

// 缓存路径: ~/.claude/cache/changelog.md
function getChangelogCachePath(): string {
  return join(getClaudeConfigHomeDir(), 'cache', 'changelog.md')
}

// 内存缓存
let changelogMemoryCache: string | null = null

// 获取更新日志
export async function getReleaseNotes(): Promise<string> {
  // 1. 先检查内存缓存
  if (changelogMemoryCache) {
    return changelogMemoryCache
  }

  // 2. 检查缓存文件
  const cachePath = getChangelogCachePath()
  try {
    changelogMemoryCache = await readFile(cachePath, 'utf-8')
    return changelogMemoryCache
  } catch (e) {
    if (getErrnoCode(e) !== 'ENOENT') throw e
  }

  // 3. 后台获取
  await fetchAndCacheChangelog()

  return changelogMemoryCache ?? ''
}

// 获取并缓存更新日志
async function fetchAndCacheChangelog(): Promise<void> {
  try {
    const response = await axios.get(RAW_CHANGELOG_URL)
    const content = response.data

    // 解析版本
    const versions = parseChangelogVersions(content)

    // 缓存
    const cachePath = getChangelogCachePath()
    await mkdir(dirname(cachePath), { recursive: true })
    await writeFile(cachePath, versions.slice(0, MAX_RELEASE_NOTES_SHOWN))

    changelogMemoryCache = versions.slice(0, MAX_RELEASE_NOTES_SHOWN)
  } catch (error) {
    logError(error)
  }
}
```

---

## 三百一十二、Embedded Search Tools 嵌入式搜索工具

### 内置搜索工具

```typescript
// utils/embeddedTools.ts

/**
 * 嵌入式搜索工具
 * ant-native 构建包含 bfs/ugrep
 *
 * 当启用时:
 * - Bash 中的 find/grep 被 shell 函数替代
 * - 调用 bun 二进制文件 (argv0='bfs' / argv0='ugrep')
 * - 从工具注册表中移除 Glob/Grep 工具
 */

export function hasEmbeddedSearchTools(): boolean {
  if (!isEnvTruthy(process.env.EMBEDDED_SEARCH_TOOLS)) return false

  const e = process.env.CLAUDE_CODE_ENTRYPOINT
  return (
    e !== 'sdk-ts' &&
    e !== 'sdk-py' &&
    e !== 'sdk-cli' &&
    e !== 'local-agent'
  )
}

// 嵌入式搜索工具路径
export function embeddedSearchToolsBinaryPath(): string {
  return process.execPath
}
```

---

## 三百一十三、WebSocket Transport WebSocket 传输

### MCP WebSocket

```typescript
// utils/mcpWebSocketTransport.ts

/**
 * WebSocket Transport
 * MCP 的 WebSocket 传输实现
 */

// WebSocket 就绪状态
const WS_CONNECTING = 0
const WS_OPEN = 1

// WebSocket 接口
type WebSocketLike = {
  readonly readyState: number
  close(): void
  send(data: string): void
}

export class WebSocketTransport implements Transport {
  private started = false
  private opened: Promise<void>
  private isBun = typeof Bun !== 'undefined'

  constructor(private ws: WebSocketLike) {
    this.opened = new Promise((resolve, reject) => {
      if (this.ws.readyState === WS_OPEN) {
        resolve()
      } else if (this.isBun) {
        // Bun WebSocket
        const nws = this.ws as unknown as globalThis.WebSocket
        nws.addEventListener('open', () => resolve())
        nws.addEventListener('error', (event) => reject(event))
      } else {
        // ws WebSocket
        const nws = this.ws as unknown as WsWebSocket
        nws.on('open', () => resolve())
        nws.on('error', (error) => reject(error))
      }
    })
  }

  // 发送消息
  send(message: JSONRPCMessage): void {
    if (this.ws.readyState !== WS_OPEN) {
      throw new Error('WebSocket not connected')
    }

    this.ws.send(JSON.stringify(message))
  }

  // 开始接收
  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    await this.opened

    if (this.isBun) {
      const nws = this.ws as unknown as globalThis.WebSocket
      nws.addEventListener('message', this.onBunMessage)
      nws.addEventListener('error', this.onBunError)
      nws.addEventListener('close', this.onBunClose)
    } else {
      const nws = this.ws as unknown as WsWebSocket
      nws.on('message', this.onNodeMessage)
      nws.on('error', this.onNodeError)
      nws.on('close', this.onNodeClose)
    }
  }

  // 关闭
  close(): void {
    this.ws.close()
  }
}
```

---

## 架构总结

| 模块 | 文件 | 核心功能 |
|------|------|----------|
| **AgenticSearch** | `utils/agenticSessionSearch.ts` | 语义搜索会话 |
| **Perfetto** | `utils/telemetry/perfettoTracing.ts` | Chrome Trace Event 追踪 |
| **SessionTracing** | `utils/telemetry/sessionTracing.ts` | OpenTelemetry 集成 |
| **Setup** | `setup.ts` | CLI 初始化流程 |
| **AutoMode** | `cli/handlers/autoMode.ts` | AI 分类器自动批准 |
| **HybridTransport** | `cli/transports/HybridTransport.ts` | WebSocket + HTTP |
| **MCP Delta** | `utils/mcpInstructionsDelta.ts` | MCP 指令增量更新 |
| **Lockfile** | `utils/lockfile.ts` | 懒加载文件锁 |
| **Cleanup** | `utils/cleanupRegistry.ts` | 关闭清理注册表 |
| **ReleaseNotes** | `utils/releaseNotes.ts` | 动态更新日志 |
| **Embedded** | `utils/embeddedTools.ts` | 内置搜索工具 |
| **WebSocket** | `utils/mcpWebSocketTransport.ts` | MCP WebSocket |