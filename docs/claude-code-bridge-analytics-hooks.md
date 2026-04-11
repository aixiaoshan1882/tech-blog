# Claude Code 源码深度学习笔记 (第八部分)

> Bridge 系统 · Analytics · Hooks 系统

---

## 三十九、Bridge 远程协作系统

### Bridge 架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Bridge 远程协作架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      BridgeMain (桥接主程序)                          │   │
│  │  - 会话管理                                                           │   │
│  │  - 心跳保活                                                           │   │
│  │  - 断线重连 (指数退避)                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SessionRunner (会话运行器)                        │   │
│  │  - 创建会话进程                                                       │   │
│  │  - 工作目录管理                                                       │   │
│  │  - 进程生命周期                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    BridgeMessaging (消息传递)                          │   │
│  │  - stdin/stdout 管道                                                  │   │
│  │  - JSON-RPC 协议                                                      │   │
│  │  - 文件传输 (附件)                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 会话管理

```typescript
// bridge/types.ts
export type SessionHandle = {
  id: SessionId
  worktreeId: string
  bridgeId: string
  status: 'pending' | 'running' | 'done' | 'error'
  startedAt: Date
  endedAt?: Date
  exitCode?: number
}

export type SessionSpawnOpts = {
  cwd: string
  args?: string[]
  env?: Record<string, string>
  spawnMode: ' foreground' | 'background' | 'daemon'
}
```

### 断线重连 (指数退避)

```typescript
// bridge/bridgeMain.ts
const DEFAULT_BACKOFF: BackoffConfig = {
  connInitialMs: 2_000,       // 初始: 2s
  connCapMs: 120_000,         // 上限: 2 分钟
  connGiveUpMs: 600_000,      // 放弃: 10 分钟

  generalInitialMs: 500,      // 通用初始
  generalCapMs: 30_000,       // 通用上限
  generalGiveUpMs: 600_000,   // 放弃
}

// 重连策略
async function withReconnect<T>(
  operation: () => Promise<T>,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  let attempt = 0
  const backoff = DEFAULT_BACKOFF.connInitialMs

  while (attempt < MAX_RETRIES) {
    try {
      return await operation()
    } catch (error) {
      if (options.signal?.aborted) throw error

      attempt++
      const delay = Math.min(backoff * Math.pow(2, attempt - 1), DEFAULT_BACKOFF.connCapMs)
      await sleep(delay)
    }
  }

  throw new Error('Max reconnection attempts exceeded')
}
```

### JWT 认证

```typescript
// bridge/jwtUtils.ts
export function createTokenRefreshScheduler(
  getToken: () => string | null,
  onTokenRefreshed: (token: string) => void,
): () => void {
  const interval = setInterval(() => {
    const token = getToken()
    if (token && isTokenExpiringSoon(token)) {
      const refreshed = refreshToken(token)
      onTokenRefreshed(refreshed)
    }
  }, TOKEN_REFRESH_INTERVAL_MS)

  return () => clearInterval(interval)
}
```

---

## 四十、Analytics 遥测系统

### 事件日志架构

```typescript
// services/analytics/index.ts
/**
 * Analytics service - 事件日志公共服务
 *
 * 设计原则: 无依赖，避免循环导入
 * 事件在 sink 附加前排队
 */

// 事件队列
let eventQueue: QueuedEvent[] = []
let sink: AnalyticsSink | null = null

export type AnalyticsSink = {
  logEvent: (eventName: string, metadata: LogEventMetadata) => void
  logEventAsync: (eventName: string, metadata: LogEventMetadata) => Promise<void>
}

// 事件日志
export function logEvent(
  eventName: string,
  metadata: LogEventMetadata = {},
): void {
  if (sink) {
    sink.logEvent(eventName, metadata)
  } else {
    eventQueue.push({ eventName, metadata, async: false })
  }
}

// 异步事件日志
export function logEventAsync(
  eventName: string,
  metadata: LogEventMetadata = {},
): void {
  if (sink) {
    sink.logEventAsync(eventName, metadata)
  } else {
    eventQueue.push({ eventName, metadata, async: true })
  }
}
```

### 元数据安全

```typescript
// services/analytics/index.ts
/**
 * 标记类型 - 确保遥测元数据不包含敏感信息
 */
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never

/**
 * PII 标记类型 - 标记包含个人身份信息的字段
 */
export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = never

// 清理敏感字段
export function stripProtoFields<V>(
  metadata: Record<string, V>,
): Record<string, V> {
  let result: Record<string, V> | undefined
  for (const key in metadata) {
    if (key.startsWith('_PROTO_')) {
      if (result === undefined) result = { ...metadata }
      delete result[key]
    }
  }
  return result ?? metadata
}
```

### 事件类型定义

```typescript
// services/analytics/metadata.ts
export type AnalyticsEvent =
  | 'tengu_tool_use'
  | 'tengu_tool_result'
  | 'tengu_message_sent'
  | 'tengu_compact_triggered'
  | 'tengu_session_start'
  | 'tengu_session_end'

export type ToolUseEvent = {
  event: 'tengu_tool_use'
  toolName: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  success: boolean
}
```

---

## 四十一、Hooks 系统

### Hook 事件类型

```typescript
// types/hooks.ts
export type HookEvent =
  | 'pre_tool_use'      // 工具调用前
  | 'post_tool_use'     // 工具调用后
  | 'pre_compact'       // 压缩前
  | 'post_compact'      // 压缩后
  | 'session_start'     // 会话开始
  | 'session_end'       // 会话结束
  | 'setup'             // 设置时
  | 'stop'              // 停止时

export type HookCallback = {
  name: string
  event: HookEvent
  command: string
  async: boolean
}

export type HookInput = {
  sessionId: string
  timestamp: string
  cwd: string
}

export type PreToolUseHookInput = HookInput & {
  toolName: string
  toolInput: Record<string, unknown>
}

export type PostToolUseHookInput = HookInput & {
  toolName: string
  toolInput: Record<string, unknown>
  toolResult: unknown
  success: boolean
}
```

### Hook 执行

```typescript
// utils/hooks.ts
export async function runHook(
  hook: HookCallback,
  input: HookInput,
): Promise<HookResult> {
  const { command, async } = hook

  if (async) {
    // 异步 Hook: 不阻塞执行
    spawn(command, { cwd: input.cwd, detached: true })
    return { allowed: true }
  } else {
    // 同步 Hook: 等待结果
    const result = await execFile(command, {
      cwd: input.cwd,
      timeout: HOOK_TIMEOUT_MS,
    })

    return parseHookOutput(result.stdout)
  }
}

// 前置工具 Hook
export async function runPreToolUseHooks(
  toolName: string,
  input: Record<string, unknown>,
  context: HookContext,
): Promise<HookResult> {
  const hooks = getHooks('pre_tool_use')

  for (const hook of hooks) {
    if (!matchesToolFilter(hook, toolName)) continue

    const result = await runHook(hook, {
      ...context,
      toolName,
      toolInput: input,
    })

    if (!result.allowed) return result
  }

  return { allowed: true }
}

// 后置工具 Hook
export async function runPostToolUseHooks(
  toolName: string,
  input: Record<string, unknown>,
  result: unknown,
  context: HookContext,
): Promise<void> {
  const hooks = getHooks('post_tool_use')

  for (const hook of hooks) {
    if (!matchesToolFilter(hook, toolName)) continue
    await runHook(hook, { ...context, toolName, toolInput: input, toolResult: result })
  }
}
```

### Hook 配置

```typescript
// utils/hooks/hooksConfigManager.ts
export interface HookConfig {
  pre_tool_use?: HookDefinition[]
  post_tool_use?: HookDefinition[]
  pre_compact?: HookDefinition[]
  post_compact?: HookDefinition[]
}

export interface HookDefinition {
  name: string
  command: string
  async?: boolean
  when?: {
    tool?: string | string[]
    prompt?: RegExp
  }
}

// 加载 Hook 配置
export function loadHooksConfig(): HookConfig {
  const settings = getSettings()
  return settings.hooks ?? {}
}
```

---

## 四十二、沙箱安全系统

### Sandbox 适配器

```typescript
// utils/sandbox/sandbox-adapter.ts
import {
  SandboxManager,
  SandboxRuntimeConfigSchema,
} from '@anthropic-ai/sandbox-runtime'

export class SandboxSecurityManager {
  private manager: SandboxManager

  async checkPermission(
    tool: string,
    input: Record<string, unknown>,
  ): Promise<boolean> {
    const config = this.buildSecurityConfig()
    return this.manager.checkPermission(tool, input, config)
  }

  private buildSecurityConfig(): SandboxRuntimeConfig {
    return {
      // 文件系统限制
      fsRead: this.buildReadRestrictions(),
      fsWrite: this.buildWriteRestrictions(),

      // 网络限制
      network: this.buildNetworkRestrictions(),

      // 忽略违规
      ignoreViolations: getIgnoreViolationsConfig(),
    }
  }

  private buildReadRestrictions(): FsReadRestrictionConfig {
    const allowedPaths = [
      '~/**',                    // 主目录
      './**',                    // 当前目录
      ...getAdditionalDirectories(),
    ]

    return {
      allowedPaths,
      denyPaths: ['~/.ssh/**', '/etc/passwd'],
    }
  }

  private buildNetworkRestrictions(): NetworkRestrictionConfig {
    return {
      allowedHosts: getAllowedHosts(),
      denyHosts: ['localhost', '127.0.0.1'],
    }
  }
}
```

---

## 四十三、并发生成器工具

```typescript
// utils/generators.ts
/**
 * 并发执行多个生成器，带上限控制
 */
export async function* all<A>(
  generators: AsyncGenerator<A, void>[],
  concurrencyCap = Infinity,
): AsyncGenerator<A, void> {
  const waiting = [...generators]
  const promises = new Set<Promise<QueuedGenerator<A>>>()

  // 启动初始批次
  while (promises.size < concurrencyCap && waiting.length > 0) {
    const gen = waiting.shift()!
    promises.add(next(gen))
  }

  while (promises.size > 0) {
    // 等待任何一个完成
    const { done, value, generator, promise } = await Promise.race(promises)
    promises.delete(promise)

    if (!done) {
      // 继续执行
      promises.add(next(generator))
      if (value !== undefined) yield value
    } else if (waiting.length > 0) {
      // 启动新生成器
      const nextGen = waiting.shift()!
      promises.add(next(nextGen))
    }
  }
}

// 使用示例
async function executeTools(tools: Tool[]) {
  const generators = tools.map(tool => executeTool(tool))

  for await (const result of all(generators, 10)) {
    // 最多 10 个并发
    console.log(result)
  }
}
```

---

## 四十四、会话持久化

```typescript
// utils/sessionStorage.ts
export interface PersistedSession {
  id: SessionId
  messages: SerializedMessage[]
  state: {
    cwd: string
    model: string
    tools: string[]
  }
  createdAt: Date
  updatedAt: Date
}

// 保存会话
export async function saveSession(
  sessionId: SessionId,
  messages: Message[],
): Promise<void> {
  const path = getSessionPath(sessionId)

  const data: PersistedSession = {
    id: sessionId,
    messages: messages.map(serializeMessage),
    state: getCurrentState(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await writeFile(path, jsonStringify(data), 'utf-8')
}

// 加载会话
export async function loadSession(
  sessionId: SessionId,
): Promise<PersistedSession | null> {
  const path = getSessionPath(sessionId)

  if (!await pathExists(path)) {
    return null
  }

  const content = await readFile(path, 'utf-8')
  return jsonParse(content)
}

// 获取会话路径
function getSessionPath(sessionId: SessionId): string {
  return join(getSessionDir(), `${sessionId}.json`)
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Bridge** | `bridge/bridgeMain.ts` | 远程协作主程序 |
| **Bridge** | `bridge/sessionRunner.ts` | 会话进程管理 |
| **Analytics** | `services/analytics/index.ts` | 事件日志 |
| **Analytics** | `services/analytics/metadata.ts` | 事件类型定义 |
| **Hooks** | `utils/hooks.ts` | Hook 执行器 |
| **Hooks** | `types/hooks.ts` | Hook 类型定义 |
| **Sandbox** | `utils/sandbox/sandbox-adapter.ts` | 沙箱安全 |
| **Generator** | `utils/generators.ts` | 并发控制 |
| **Session** | `utils/sessionStorage.ts` | 会话持久化 |