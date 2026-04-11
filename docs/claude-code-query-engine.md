# Claude Code 源码深度学习笔记 (第五部分)

> QueryEngine 查询引擎 + 任务系统

## 二十六、QueryEngine 核心架构

### 查询引擎分层

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QueryEngine 架构                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    submitMessage()                                   │   │
│  │  ├── 1. 准备上下文 (fetchSystemPromptParts)                        │   │
│  │  ├── 2. 构建查询 (buildQuery)                                       │   │
│  │  ├── 3. 执行查询 (query with retry)                                 │   │
│  │  ├── 4. 处理结果 (流式处理)                                          │   │
│  │  └── 5. 循环直到完成 (while true)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    query() 函数                                      │   │
│  │  ├── 1. 规范化消息 (normalizeMessagesForAPI)                       │   │
│  │  ├── 2. 上下文压缩检查 (autoCompact)                                │   │
│  │  ├── 3. 工具结果预算 (toolResultBudget)                             │   │
│  │  ├── 4. API 调用 (withRetry)                                        │   │
│  │  └── 5. 流式事件处理 (yield StreamEvent)                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    withRetry() 重试机制                              │   │
│  │  ├── 1. 指数退避 (BASE_DELAY_MS * 2^attempt)                       │   │
│  │  ├── 2. 特殊错误处理 (529/429/401)                                  │   │
│  │  ├── 3. 模型降级 (FallbackTriggeredError)                          │   │
│  │  └── 4. 前台/后台源区分                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### QueryEngine 类结构

```typescript
// QueryEngine.ts
export class QueryEngine {
  private config: QueryEngineConfig      // 配置
  private mutableMessages: Message[]     // 可变消息
  private abortController: AbortController // 中止控制器
  private permissionDenials: SDKPermissionDenial[]  // 权限拒绝
  private totalUsage: NonNullableUsage   // 总用量
  private readFileState: FileStateCache  // 文件读取缓存
  private discoveredSkillNames: Set<string>  // 发现的技能
  private loadedNestedMemoryPaths: Set<string>  // 加载的嵌套内存路径

  async *submitMessage(
    prompt: string | ContentBlockParam[],
    options?: { uuid?: string; isMeta?: boolean },
  ): AsyncGenerator<SDKMessage, void, unknown> {
    // 1. 获取系统提示部分
    const { defaultSystemPrompt, userContext, systemContext } = 
      await fetchSystemPromptParts({ ... })

    // 2. 构建查询上下文
    const queryContext = await buildQueryContext({
      systemPrompt: defaultSystemPrompt,
      userContext,
      systemContext,
      messages: this.mutableMessages,
    })

    // 3. 执行查询循环
    for await (const event of query(queryContext)) {
      // 处理流式事件
      yield event
    }
  }
}
```

### 查询上下文构建

```typescript
// query.ts - 核心查询循环
async function* query(
  deps: QueryDeps,
): AsyncGenerator<StreamEvent, void, unknown> {
  let state: QueryState = deps.initialState

  while (true) {
    // 1. 获取消息用于查询
    let messagesForQuery = [...getMessagesAfterCompactBoundary(messages)]

    // 2. 应用工具结果预算
    messagesForQuery = await applyToolResultBudget(
      messagesForQuery,
      toolUseContext.contentReplacementState,
    )

    // 3. 应用微压缩 (snip)
    if (feature('HISTORY_SNIP')) {
      const { messages: snipped, snipTokensFreed } = 
        snipProjection?.getSnipProjection(messagesForQuery) ?? 
        { messages: messagesForQuery, snipTokensFreed: 0 }
      messagesForQuery = snipped
    }

    // 4. 检查自动压缩
    if (shouldAutoCompact(tracking)) {
      const { messages: compacted, boundary } = 
        await compactMessages(messagesForQuery, options)
      yield* yieldCompactBoundary(boundary)
      messagesForQuery = compacted
    }

    // 5. 执行 API 调用 (带重试)
    yield* withRetry(
      getClient,
      async (client, attempt, context) => {
        return client.messages.stream({
          model: context.model,
          max_tokens: getMaxOutputTokens(context.model),
          system: buildSystemPrompt(queryContext),
          messages: messagesForQuery,
        })
      },
      options
    )
  }
}
```

## 二十七、重试机制 (withRetry)

### 重试策略

```typescript
// withRetry.ts
const DEFAULT_MAX_RETRIES = 10
const BASE_DELAY_MS = 500
const MAX_529_RETRIES = 3

// 前台源 (用户等待，必须重试)
const FOREGROUND_529_RETRY_SOURCES = new Set([
  'repl_main_thread',
  'sdk',
  'agent:default',
  'compact',
  'auto_mode',
])

export async function* withRetry<T>(
  getClient,
  operation,
  options,
): AsyncGenerator<SystemAPIErrorMessage, T> {
  let consecutive529Errors = 0

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await operation(client, attempt, context)
      yield* emitRetriesExhausted(attempt - 1)
      return result
    } catch (error) {
      if (is529Error(error) && shouldRetry529(querySource)) {
        consecutive529Errors++
        if (consecutive529Errors <= MAX_529_RETRIES) {
          // 指数退避
          const delay = BASE_DELAY_MS * Math.pow(2, consecutive529Errors)
          await sleep(delay)
          continue
        }
      }

      if (is429Error(error)) {
        // 处理速率限制
        await handleRateLimit(error)
        continue
      }

      if (is401Error(error)) {
        // 刷新凭证
        await refreshCredentials()
        continue
      }

      // 不可恢复错误
      throw error
    }
  }
}
```

### 错误处理分类

```typescript
// 错误类型判断
function categorizeRetryableAPIError(error: unknown): {
  type: 'rate_limit' | 'capacity' | 'auth' | 'transient' | 'permanent'
  retryAfter?: number
} {
  if (is529Error(error)) return { type: 'capacity' }
  if (is429Error(error)) return { type: 'rate_limit', retryAfter: getRetryAfter(error) }
  if (is401Error(error)) return { type: 'auth' }
  if (isNetworkError(error)) return { type: 'transient' }
  return { type: 'permanent' }
}
```

## 二十八、任务系统 (Task Framework)

### 任务类型

```typescript
// tasks/types.ts
export type TaskState =
  | LocalShellTaskState      // 本地 Shell 任务
  | LocalAgentTaskState      // 本地 Agent 任务
  | RemoteAgentTaskState     // 远程 Agent 任务
  | InProcessTeammateTaskState  // 进程内队友任务
  | LocalWorkflowTaskState   // 本地工作流任务
  | MonitorMpmcTaskState     // 监控任务
  | DreamTaskState           // 梦想任务

// 判断是否为后台任务
export function isBackgroundTask(task: TaskState): boolean {
  if (task.status !== 'running' && task.status !== 'pending') {
    return false
  }
  if ('isBackgrounded' in task && task.isBackgrounded === false) {
    return false
  }
  return true
}
```

### 任务框架

```typescript
// utils/task/framework.ts
export function updateTaskState<T extends TaskState>(
  taskId: string,
  setAppState: SetAppState,
  updater: (task: T) => T,
): void {
  setAppState(prev => {
    const task = prev.tasks?.[taskId] as T | undefined
    if (!task) return prev

    const updated = updater(task)
    if (updated === task) return prev  // 无变化，跳过

    return {
      ...prev,
      tasks: { ...prev.tasks, [taskId]: updated }
    }
  })
}

export function registerTask(
  task: TaskState,
  setAppState: SetAppState,
): void {
  setAppState(prev => ({
    ...prev,
    tasks: { ...prev.tasks, [task.id]: task }
  }))
}
```

### 进度追踪

```typescript
// tasks/LocalAgentTask/LocalAgentTask.tsx
export type ProgressTracker = {
  toolUseCount: number
  latestInputTokens: number       // 累计输入 (API 本身就是累计)
  cumulativeOutputTokens: number  // 累计输出 (需要求和)
  recentActivities: ToolActivity[]
}

export function createProgressTracker(): ProgressTracker {
  return {
    toolUseCount: 0,
    latestInputTokens: 0,
    cumulativeOutputTokens: 0,
    recentActivities: []
  }
}

export function updateProgressFromMessage(
  tracker: ProgressTracker,
  message: Message,
): void {
  if (message.type !== 'assistant') return

  // 保留最新的输入 token (API 返回的是累计值)
  tracker.latestInputTokens = message.message.usage.input_tokens

  // 累加输出 token
  tracker.cumulativeOutputTokens += message.message.usage.output_tokens

  // 记录工具调用
  for (const content of message.message.content) {
    if (content.type === 'tool_use') {
      tracker.toolUseCount++
      tracker.recentActivities.push({
        toolName: content.name,
        input: content.input,
      })
    }
  }

  // 保持最近 5 个活动
  while (tracker.recentActivities.length > MAX_RECENT_ACTIVITIES) {
    tracker.recentActivities.shift()
  }
}
```

## 二十九、API 客户端多提供者支持

```typescript
// services/api/client.ts
export function createApiClient(): Anthropic {
  const provider = getAPIProvider()  // 'anthropic' | 'aws' | 'gcp' | 'azure'

  switch (provider) {
    case 'aws':
      return new Anthropic({
        apiKey: await refreshAndGetAwsCredentials(),
        baseURL: getAwsBedrockUrl(),
      })

    case 'gcp':
      return new Anthropic({
        apiKey: 'unused',  // GCP 使用 credentials
        baseURL: getVertexUrl(),
        httpOptions: {
          headers: {
            'Authorization': `Bearer ${await getGcpToken()}`,
          }
        }
      })

    case 'azure':
      return new Anthropic({
        apiKey: getAzureApiKey(),
        baseURL: getAzureFoundryUrl(),
      })

    default:
      return new Anthropic({
        apiKey: getAnthropicApiKey(),
      })
  }
}
```

## 三十、关键设计模式

### 1. 异步生成器模式 (流式处理)

```typescript
// QueryEngine 返回 AsyncGenerator
async *submitMessage(
  prompt: string,
): AsyncGenerator<SDKMessage, void, unknown> {
  yield { type: 'stream_request_start' }

  for await (const event of query(queryContext)) {
    yield event  // 流式 yield 每个事件
  }
}

// 调用者可以逐步处理
for await (const event of engine.submitMessage(prompt)) {
  switch (event.type) {
    case 'assistant_message':
      displayMessage(event.message)
      break
    case 'tool_use':
      showToolUse(event.toolUse)
      break
  }
}
```

### 2. 状态快照模式

```typescript
// 任务状态更新时保留 UI 状态
export function registerTask(
  task: TaskState,
  setAppState: SetAppState,
): void {
  setAppState(prev => {
    const existing = prev.tasks[task.id]
    // 合并时保留 UI 状态
    const merged = existing && 'retain' in existing
      ? {
          ...task,
          retain: existing.retain,        // 保留用户标记
          startTime: existing.startTime,  // 保留开始时间
          messages: existing.messages,    // 保留消息
        }
      : task
    return { ...prev, tasks: { ...prev.tasks, [task.id]: merged } }
  })
}
```

### 3. 内存安全 AbortController

```typescript
// 使用 WeakRef 避免内存泄漏
export function createChildAbortController(
  parent: AbortController,
): AbortController {
  const controller = new AbortController()

  // 使用 WeakRef 监听父中止信号
  const watcher = new FinalizationRegistry<string>(key => {
    // 父被垃圾回收时清理
  })

  // 当父中止时自动中止子
  if (parent.signal.aborted) {
    controller.abort(parent.signal.reason)
  } else {
    parent.signal.addEventListener('abort', () => {
      controller.abort(parent.signal.reason)
    }, { once: true })
  }

  return controller
}
```

---

## 架构总结

| 组件 | 文件 | 职责 |
|------|------|------|
| QueryEngine | `QueryEngine.ts` | 查询生命周期管理 |
| 查询循环 | `query.ts` | 消息处理和 API 调用 |
| 重试机制 | `services/api/withRetry.ts` | 指数退避、错误处理 |
| 任务框架 | `utils/task/framework.ts` | 任务注册/更新 |
| 进度追踪 | `tasks/LocalAgentTask/LocalAgentTask.tsx` | Token 统计 |
| API 客户端 | `services/api/client.ts` | 多 Provider 支持 |