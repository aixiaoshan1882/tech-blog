# Claude Code 源码深度学习笔记 (第四十九部分)

> Permissions·Diagnostics·Session·Sink·Chrome

---

## 三百一十四、Yolo Classifier Yolo 分类器

### 自动模式 AI 分类器

```typescript
// utils/permissions/yoloClassifier.ts

/**
 * Yolo Classifier
 * 基于 AI 的自动权限分类器
 *
 * 决定工具调用是否自动批准或需要用户确认
 */

// 外部权限模板
const EXTERNAL_PERMISSIONS_TEMPLATE = txtRequire(
  require('./yolo-classifier-prompts/permissions_external.txt')
)

// Anthropic 权限模板
const ANTHROPIC_PERMISSIONS_TEMPLATE = txtRequire(
  require('./yolo-classifier-prompts/permissions_anthropic.txt')
)

// 分类结果
export type YoloClassifierResult = {
  behavior: 'allow' | 'ask' | 'deny'
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

// 分类请求
export async function classifyBashCommand(
  command: string,
  cwd: string,
  context: ClassifierContext,
): Promise<YoloClassifierResult> {
  // 1. 获取规则描述
  const descriptions = await getBashPromptAllowDescriptions(context)

  // 2. 构建提示
  const prompt = buildClassifierPrompt({
    command,
    cwd,
    allowDescriptions: descriptions,
  })

  // 3. 调用 AI 分类
  const response = await sideQuery({
    query: prompt,
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    model: getSmallFastModel(),
  })

  // 4. 解析结果
  return parseClassifierResponse(response)
}

// 构建分类提示
function buildClassifierPrompt(params: {
  command: string
  cwd: string
  allowDescriptions: string[]
}): string {
  return `
Command: ${params.command}
Working Directory: ${params.cwd}

Allowed Actions:
${params.allowDescriptions.map(d => `- ${d}`).join('\n')}

Classify this command as: allow | ask | deny

Response format:
{
  "behavior": "allow|ask|deny",
  "confidence": "high|medium|low",
  "reason": "..."
}
`
}
```

---

## 三百一十五、Shell Rule Matching Shell 规则匹配

### 权限规则解析

```typescript
// utils/permissions/shellRuleMatching.ts

/**
 * Shell 规则匹配
 * 解析和匹配 shell 命令权限规则
 */

// 规则类型
export type ShellPermissionRule =
  | { type: 'exact'; command: string }      // 精确匹配
  | { type: 'prefix'; prefix: string }       // 前缀匹配
  | { type: 'wildcard'; pattern: string }    // 通配符匹配

// 提取前缀 (legacy :* 语法)
export function permissionRuleExtractPrefix(
  permissionRule: string,
): string | null {
  const match = permissionRule.match(/^(.+):\*$/)
  return match?.[1] ?? null
}

// 检查是否有通配符
export function hasWildcards(pattern: string): boolean {
  // 以 :* 结尾的是前缀语法，不是通配符
  if (pattern.endsWith(':*')) {
    return false
  }

  // 检查未转义的 *
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*') {
      // 计算前面的反斜杠数量
      let backslashCount = 0
      let j = i - 1
      while (j >= 0 && pattern[j] === '\\') {
        backslashCount++
        j--
      }
      // 偶数个反斜杠 (包括 0) 表示未转义
      if (backslashCount % 2 === 0) {
        return true
      }
    }
  }
  return false
}

// 转义占位符
const ESCAPED_STAR_PLACEHOLDER = '\x00ESCAPED_STAR\x00'
const ESCAPED_BACKSLASH_PLACEHOLDER = '\x00ESCAPED_BACKSLASH\x00'

// 解析规则
export function parsePermissionRule(
  rule: string,
): ShellPermissionRule | null {
  // 精确匹配
  if (!hasWildcards(rule)) {
    return { type: 'exact', command: rule }
  }

  // 前缀匹配
  const prefixMatch = rule.match(/^(.+):\*$/)
  if (prefixMatch) {
    return { type: 'prefix', prefix: prefixMatch[1]! }
  }

  // 通配符匹配
  return { type: 'wildcard', pattern: rule }
}

// 匹配命令
export function matchesRule(
  command: string,
  rule: ShellPermissionRule,
): boolean {
  switch (rule.type) {
    case 'exact':
      return command === rule.command

    case 'prefix':
      return command.startsWith(rule.prefix + ':')

    case 'wildcard':
      return matchesWildcard(command, rule.pattern)
  }
}

// 通配符匹配
function matchesWildcard(command: string, pattern: string): boolean {
  // 转义特殊字符
  const escaped = pattern
    .replace(/\\/g, ESCAPED_BACKSLASH_PLACEHOLDER)
    .replace(/\*/g, ESCAPED_STAR_PLACEHOLDER)

  // 转换为正则表达式
  const regexPattern = escaped
    .replace(ESCAPED_STAR_PLACEHOLDER, '.*')
    .replace(ESCAPED_BACKSLASH_PLACEHOLDER, '\\')

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(command)
}
```

---

## 三百一十六、Claude in Chrome Chrome 集成

### 浏览器扩展集成

```typescript
// utils/claudeInChrome/setup.ts

/**
 * Claude in Chrome
 * Chrome 扩展集成
 */

// 检查是否应启用
export function shouldEnableClaudeInChrome(
  chromeFlag?: boolean,
): boolean {
  // 非交互式会话默认禁用
  if (getIsNonInteractiveSession() && chromeFlag !== true) {
    return false
  }

  // CLI 标志
  if (chromeFlag === true) return true
  if (chromeFlag === false) return false

  // 环境变量
  if (isEnvTruthy(process.env.CLAUDE_CODE_ENABLE_CFC)) return true
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ENABLE_CFC)) return false

  // 默认配置
  const config = getGlobalConfig()
  if (config.claudeInChromeDefaultEnabled !== undefined) {
    return config.claudeInChromeDefaultEnabled
  }

  return false
}

// 检查扩展是否安装
export async function isChromeExtensionInstalled(): Promise<boolean> {
  // 检查 Chrome 原生消息主机
  const chromePath = join(
    homedir(),
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    'Native MessagingHosts',
    `${NATIVE_HOST_IDENTIFIER}.json`,
  )

  try {
    const manifest = JSON.parse(await readFile(chromePath, 'utf-8'))
    return manifest.name === NATIVE_HOST_IDENTIFIER
  } catch {
    return false
  }
}

// 获取浏览器工具
export function getBrowserTools(): BrowserTool[] {
  return BROWSER_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }))
}
```

---

## 三百一十七、Diag Logs 诊断日志

### 诊断日志系统

```typescript
// utils/diagLogs.ts

/**
 * Diagnostic Logs
 * 记录诊断信息到日志文件
 *
 * 重要: 不得包含任何 PII，包括文件路径、项目名、仓库名、提示等
 */

type DiagnosticLogLevel = 'debug' | 'info' | 'warn' | 'error'

type DiagnosticLogEntry = {
  timestamp: string
  level: DiagnosticLogLevel
  event: string
  data: Record<string, unknown>
}

// 记录诊断日志 (同步 IO)
export function logForDiagnosticsNoPII(
  level: DiagnosticLogLevel,
  event: string,
  data?: Record<string, unknown>,
): void {
  const logFile = getDiagnosticLogFile()
  if (!logFile) return

  const entry: DiagnosticLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data: data ?? {},
  }

  const line = jsonStringify(entry) + '\n'
  try {
    fs.appendFileSync(logFile, line)
  } catch {
    // 静默失败
  }
}

// 包装异步函数并记录时间
export async function withDiagnosticsTiming<T>(
  event: string,
  fn: () => Promise<T>,
  getData?: (result: T) => Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now()
  logForDiagnosticsNoPII('info', `${event}_started`)

  try {
    const result = await fn()
    const duration = Date.now() - startTime

    logForDiagnosticsNoPII('info', `${event}_completed`, {
      duration_ms: duration,
      ...(getData ? getData(result) : {}),
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    logForDiagnosticsNoPII('error', `${event}_failed`, {
      duration_ms: duration,
      error: errorMessage(error),
    })

    throw error
  }
}
```

---

## 三百一十八、Sinks 接收器

### 日志接收器初始化

```typescript
// utils/sinks.ts

/**
 * Sinks
 * 分析和错误日志接收器初始化
 *
 * 叶子模块 - 避免 setup.ts 的循环导入
 */
export function initSinks(): void {
  initializeErrorLogSink()
  initializeAnalyticsSink()
}
```

---

## 三百一十九、Error Log Sink 错误日志接收器

### 错误日志持久化

```typescript
// utils/errorLogSink.ts

/**
 * Error Log Sink
 * 基于文件的错误日志记录
 */

// JSONL 写入器
type JsonlWriter = {
  write: (obj: object) => void
  flush: () => void
  dispose: () => void
}

// 创建 JSONL 写入器
function createJsonlWriter(options: {
  writeFn: (content: string) => void
  flushIntervalMs?: number
  maxBufferSize?: number
}): JsonlWriter {
  const writer = createBufferedWriter(options)
  return {
    write(obj: object): void {
      writer.write(jsonStringify(obj) + '\n')
    },
    flush: writer.flush,
    dispose: writer.dispose,
  }
}

// 缓冲写入器缓存
const logWriters = new Map<string, JsonlWriter>()

// 获取错误日志路径
export function getErrorsPath(): string {
  return join(CACHE_PATHS.errors(), DATE + '.jsonl')
}

// 获取 MCP 日志路径
export function getMCPLogsPath(serverName: string): string {
  return join(CACHE_PATHS.mcpLogs(serverName), DATE + '.jsonl')
}

// 获取或创建写入器
function getOrCreateWriter(path: string): JsonlWriter {
  let writer = logWriters.get(path)
  if (!writer) {
    writer = createJsonlWriter({
      writeFn: (content) => fs.appendFileSync(path, content),
      flushIntervalMs: 1000,
      maxBufferSize: 64 * 1024,
    })
    logWriters.set(path, writer)
  }
  return writer
}

// 刷新所有写入器
export function _flushLogWritersForTesting(): void {
  for (const writer of logWriters.values()) {
    writer.flush()
  }
}

// 关闭时刷新
registerCleanup(async () => {
  for (const writer of logWriters.values()) {
    writer.flush()
  }
})
```

---

## 三百二十、Session Ingress Auth 会话入口认证

### WebSocket 认证

```typescript
// utils/sessionIngressAuth.ts

/**
 * Session Ingress Auth
 * 通过文件描述符或 well-known 文件获取认证令牌
 */

// 从文件描述符读取令牌
function getTokenFromFileDescriptor(): string | null {
  // 检查缓存
  const cachedToken = getSessionIngressToken()
  if (cachedToken !== undefined) {
    return cachedToken
  }

  const fdEnv = process.env.CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR

  if (!fdEnv) {
    // 无 FD 环境变量 - 尝试 well-known 文件
    const path =
      process.env.CLAUDE_SESSION_INGRESS_TOKEN_FILE ??
      CCR_SESSION_INGRESS_TOKEN_PATH
    const fromFile = readTokenFromWellKnownFile(path, 'session ingress token')
    setSessionIngressToken(fromFile)
    return fromFile
  }

  // 解析文件描述符
  const fd = parseInt(fdEnv, 10)
  if (Number.isNaN(fd)) {
    setSessionIngressToken(null)
    return null
  }

  try {
    // 从 /dev/fd 或 /proc/self/fd 读取
    const fdPath =
      process.platform === 'darwin' || process.platform === 'freebsd'
        ? `/dev/fd/${fd}`
        : `/proc/self/fd/${fd}`

    const token = fs.readFileSync(fdPath, { encoding: 'utf8' }).trim()
    if (!token) {
      setSessionIngressToken(null)
      return null
    }

    setSessionIngressToken(token)

    // 为子进程持久化
    maybePersistTokenForSubprocesses(
      CCR_SESSION_INGRESS_TOKEN_PATH,
      token,
      'session ingress token',
    )

    return token
  } catch (error) {
    // FD 读取失败 - 尝试 well-known 文件
    const path = process.env.CLAUDE_SESSION_INGRESS_TOKEN_FILE
    const fromFile = readTokenFromWellKnownFile(path, 'session ingress token')
    setSessionIngressToken(fromFile)
    return fromFile
  }
}
```

---

## 三百二十一、Session Storage 会话存储

### 会话持久化

```typescript
// utils/sessionStorage.ts

/**
 * Session Storage
 * 会话消息和状态持久化
 */

// 会话存储路径
function getSessionStoragePath(): string {
  return join(getClaudeConfigHomeDir(), 'sessions')
}

// 读取会话
export async function readSession(
  sessionId: string,
): Promise<SessionData | null> {
  const path = join(getSessionStoragePath(), `${sessionId}.jsonl`)

  try {
    const content = await readFile(path, 'utf-8')
    return parseSessionContent(content)
  } catch (e) {
    if (getErrnoCode(e) === 'ENOENT') return null
    throw e
  }
}

// 写入会话
export async function writeSession(
  sessionId: string,
  messages: Message[],
): Promise<void> {
  const path = join(getSessionStoragePath(), `${sessionId}.jsonl`)

  await mkdir(dirname(path), { recursive: true })

  const content = messages
    .map(m => jsonStringify(m))
    .join('\n') + '\n'

  await appendFile(path, content)
}

// 追加消息
export async function appendToSession(
  sessionId: string,
  message: Message,
): Promise<void> {
  const path = join(getSessionStoragePath(), `${sessionId}.jsonl`)

  const line = jsonStringify(message) + '\n'
  await appendFile(path, line)
}
```

---

## 三百二十二、Session Activity 会话活动

### 会话活跃度追踪

```typescript
// utils/sessionActivity.ts

/**
 * Session Activity
 * 追踪会话活跃度
 */

// 活跃度状态
type SessionActivity = {
  lastActivity: number      // 上次活动时间 (ms)
  totalMessages: number     // 总消息数
  totalToolCalls: number    // 总工具调用数
  startTime: number          // 开始时间
}

// 记录活动
export function recordActivity(
  sessionId: string,
  activity: Partial<SessionActivity>,
): void {
  const current = getActivity(sessionId)

  setActivity(sessionId, {
    ...current,
    lastActivity: Date.now(),
    totalMessages: (current.totalMessages ?? 0) + (activity.totalMessages ?? 0),
    totalToolCalls: (current.totalToolCalls ?? 0) + (activity.totalToolCalls ?? 0),
  })
}

// 获取活跃度
export function getActivity(
  sessionId: string,
): SessionActivity | null {
  return activityMap.get(sessionId) ?? null
}

// 检查是否活跃
export function isSessionActive(
  sessionId: string,
  timeoutMs: number = 30 * 60 * 1000,
): boolean {
  const activity = getActivity(sessionId)
  if (!activity) return false

  return Date.now() - activity.lastActivity < timeoutMs
}

// 清理不活跃的会话
export function cleanupInactiveSessions(
  timeoutMs: number = 30 * 60 * 1000,
): string[] {
  const removed: string[] = []

  for (const [sessionId, activity] of activityMap) {
    if (Date.now() - activity.lastActivity > timeoutMs) {
      activityMap.delete(sessionId)
      removed.push(sessionId)
    }
  }

  return removed
}
```

---

## 三百二十三、Session Restore 会话恢复

### 会话恢复机制

```typescript
// utils/sessionRestore.ts

/**
 * Session Restore
 * 从存储中恢复会话状态
 */

// 恢复选项
type RestoreOptions = {
  sessionId: string
  includeMessages?: boolean
  includeState?: boolean
  includeTools?: boolean
}

// 恢复会话
export async function restoreSession(
  options: RestoreOptions,
): Promise<RestoredSession | null> {
  const { sessionId, includeMessages = true } = options

  // 1. 读取会话数据
  const sessionData = await readSession(sessionId)
  if (!sessionData) return null

  // 2. 恢复消息
  const messages = includeMessages
    ? sessionData.messages
    : []

  // 3. 恢复状态
  const state = options.includeState
    ? await restoreSessionState(sessionId)
    : null

  // 4. 恢复工具
  const tools = options.includeTools
    ? await restoreSessionTools(sessionId)
    : []

  return {
    sessionId,
    messages,
    state,
    tools,
    createdAt: sessionData.createdAt,
    updatedAt: sessionData.updatedAt,
  }
}

// 获取恢复的会话 ID 列表
export async function getRestorableSessions(): Promise<
  Array<{ id: string; title: string; updatedAt: number }>
> {
  const sessionsDir = getSessionStoragePath()
  const files = await readdir(sessionsDir)

  const sessions = await Promise.all(
    files
      .filter(f => f.endsWith('.jsonl'))
      .map(async f => {
        const sessionId = f.replace('.jsonl', '')
        const data = await readSessionMetadata(sessionId)
        return {
          id: sessionId,
          title: data.title ?? 'Untitled',
          updatedAt: data.updatedAt,
        }
      })
  )

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}
```

---

## 三百二十四、Session Title 会话标题

### 自动生成会话标题

```typescript
// utils/sessionTitle.ts

/**
 * Session Title
 * 使用 AI 自动生成会话标题
 */

const TITLE_GENERATION_PROMPT = `Generate a concise, descriptive title for this conversation.
The title should be 3-6 words that capture the main topic or task.
Do not use quotes or special formatting.
Respond with ONLY the title, nothing else.`

// 生成标题
export async function generateSessionTitle(
  messages: Message[],
): Promise<string> {
  // 提取前几条消息
  const context = messages.slice(0, 5)
    .map(m => extractMessageContent(m))
    .join('\n\n')

  // 调用 AI 生成标题
  const title = await sideQuery({
    query: context,
    systemPrompt: TITLE_GENERATION_PROMPT,
    model: getSmallFastModel(),
  })

  // 清理标题
  return title.trim().slice(0, 100)
}

// 提取消息内容
function extractMessageContent(message: Message): string {
  if (message.type === 'user') {
    const content = 'message' in message ? message.message?.content : undefined
    return typeof content === 'string' ? content : ''
  }

  if (message.type === 'assistant') {
    const content = 'message' in message ? message.message?.content : undefined
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map(b => typeof b === 'string' ? b : 'text' in b ? b.text : '')
        .join(' ')
    }
  }

  return ''
}
```

---

## 三百二十五、Session Environment 会话环境

### 会话环境变量

```typescript
// utils/sessionEnvironment.ts

/**
 * Session Environment
 * 管理会话级别的环境变量
 */

// 设置会话环境变量
export function setSessionEnv(
  sessionId: string,
  key: string,
  value: string,
): void {
  const sessionEnv = getOrCreateSessionEnv(sessionId)
  sessionEnv[key] = value
}

// 获取会话环境变量
export function getSessionEnv(
  sessionId: string,
  key: string,
): string | undefined {
  return sessionEnvs.get(sessionId)?.[key]
}

// 获取所有会话环境变量
export function getAllSessionEnv(sessionId: string): Record<string, string> {
  return sessionEnvs.get(sessionId) ?? {}
}

// 删除会话环境变量
export function deleteSessionEnv(
  sessionId: string,
  key: string,
): void {
  const sessionEnv = sessionEnvs.get(sessionId)
  if (sessionEnv) {
    delete sessionEnv[key]
  }
}

// 清除会话环境
export function clearSessionEnv(sessionId: string): void {
  sessionEnvs.delete(sessionId)
}
```

---

## 三百二十六、Cache Paths 缓存路径

### 缓存目录管理

```typescript
// utils/cachePaths.ts

/**
 * Cache Paths
 * 管理各种缓存目录
 */

// 缓存路径
export const CACHE_PATHS = {
  // 错误日志
  errors(): string {
    return join(getClaudeConfigHomeDir(), 'cache', 'errors')
  },

  // MCP 日志
  mcpLogs(serverName: string): string {
    return join(getClaudeConfigHomeDir(), 'cache', 'mcp', serverName)
  },

  // 更新日志
  changelog(): string {
    return join(getClaudeConfigHomeDir(), 'cache', 'changelog.md')
  },

  // 临时文件
  temp(): string {
    return getClaudeTempDir()
  },

  // 插件缓存
  plugins(): string {
    return join(getClaudeConfigHomeDir(), 'cache', 'plugins')
  },

  // 市场缓存
  marketplace(): string {
    return join(getClaudeConfigHomeDir(), 'cache', 'marketplace')
  },
}
```

---

## 架构总结

| 模块 | 文件 | 核心功能 |
|------|------|----------|
| **YoloClassifier** | `utils/permissions/yoloClassifier.ts` | AI 权限分类 |
| **ShellRuleMatching** | `utils/permissions/shellRuleMatching.ts` | 规则解析匹配 |
| **ClaudeInChrome** | `utils/claudeInChrome/setup.ts` | Chrome 扩展集成 |
| **DiagLogs** | `utils/diagLogs.ts` | 诊断日志 |
| **Sinks** | `utils/sinks.ts` | 日志接收器 |
| **ErrorLogSink** | `utils/errorLogSink.ts` | 错误日志持久化 |
| **SessionIngressAuth** | `utils/sessionIngressAuth.ts` | WebSocket 认证 |
| **SessionStorage** | `utils/sessionStorage.ts` | 会话持久化 |
| **SessionActivity** | `utils/sessionActivity.ts` | 活跃度追踪 |
| **SessionRestore** | `utils/sessionRestore.ts` | 会话恢复 |
| **SessionTitle** | `utils/sessionTitle.ts` | AI 标题生成 |
| **SessionEnvironment** | `utils/sessionEnvironment.ts` | 会话环境变量 |
| **CachePaths** | `utils/cachePaths.ts` | 缓存目录管理 |