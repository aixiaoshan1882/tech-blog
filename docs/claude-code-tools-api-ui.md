# Claude Code 源码深度学习笔记 (第七部分)

> 工具执行系统 · API 层 · UI 组件架构

---

## 三十五、工具执行系统 (Tool Execution)

### 工具执行流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        工具执行流程                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI 模型输出 ToolUseBlock                                                   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  StreamingToolExecutor                               │   │
│  │  - 并发安全检查 (isConcurrencySafe)                                   │   │
│  │  - 工具排队 (queued → executing → completed)                         │   │
│  │  - 结果缓冲 (按接收顺序输出)                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  runToolUse (toolExecution.ts)                        │   │
│  │  - 权限检查 (canUseTool)                                              │   │
│  │  - 工具查找 (findToolByName)                                          │   │
│  │  - 执行 + 流式进度                                                     │   │
│  │  - 错误分类 (TelemetrySafeError / ErrorCode)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    工具Hooks                                         │   │
│  │  - runPreToolUseHooks: 执行前                                       │   │
│  │  - runPostToolUseHooks: 执行后                                      │   │
│  │  - runPostToolUseFailureHooks: 失败后                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### StreamingToolExecutor 并发控制

```typescript
// services/tools/StreamingToolExecutor.ts
type ToolStatus = 'queued' | 'executing' | 'completed' | 'yielded'

type TrackedTool = {
  id: string
  block: ToolUseBlock
  status: ToolStatus
  isConcurrencySafe: boolean      // 是否并发安全
  promise?: Promise<void>
  results?: Message[]
  pendingProgress: Message[]      // 进度消息立即输出
}

// 工具分类
// 并发安全工具: Read, Glob, Grep, WebSearch 等读取操作
// 非并发安全工具: Bash, Write, Edit 等写入操作

addTool(block: ToolUseBlock, assistantMessage: AssistantMessage): void {
  const toolDefinition = findToolByName(this.toolDefinitions, block.name)
  const isConcurrencySafe = toolDefinition?.isConcurrentSafe ?? false

  this.tools.push({
    id: block.id,
    block,
    status: 'queued',
    isConcurrencySafe,
    pendingProgress: [],
  })

  // 检查是否可以开始执行
  this.tryStartExecution()
}

private tryStartExecution(): void {
  // 查找下一个可执行的工具
  const next = this.tools.find(tool =>
    tool.status === 'queued' &&
    this.canExecuteConcurrently(tool)
  )

  if (next) {
    next.status = 'executing'
    next.promise = this.executeTool(next)
  }
}

private canExecuteConcurrently(tool: TrackedTool): boolean {
  if (!tool.isConcurrencySafe) {
    // 非并发安全工具：检查是否有其他工具在执行
    return !this.tools.some(t =>
      t.status === 'executing' || t.status === 'queued'
    )
  }
  // 并发安全工具：检查并发数限制
  const concurrentCount = this.tools.filter(
    t => t.status === 'executing' && t.isConcurrencySafe
  ).length
  return concurrentCount < MAX_CONCURRENT_SAFE_TOOLS
}
```

### 权限检查与执行

```typescript
// services/tools/toolExecution.ts
async function* streamedCheckPermissionsAndCallTool(
  tool: Tool,
  toolUseID: string,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  canUseTool: CanUseToolFn,
  assistantMessage: AssistantMessage,
  ...
): AsyncGenerator<MessageUpdate, void, unknown> {
  // 1. 权限检查
  const decision = await canUseTool(
    tool,
    input,
    toolUseContext,
    assistantMessage,
    toolUseID,
    false,
  )

  // 2. 根据权限决定执行
  switch (decision.behavior) {
    case 'allow':
      // 执行工具
      yield* executeTool(tool, input, toolUseContext, ...)
      break
    case 'deny':
      // 返回拒绝消息
      yield createRejectionMessage(tool.name, decision.reason)
      break
    case 'ask':
      // 暂停并等待用户确认
      yield createPermissionRequest(tool, input)
      // 等待用户响应...
      break
  }
}

// 错误分类 (用于遥测)
function classifyToolError(error: unknown): string {
  if (error instanceof TelemetrySafeError) {
    return error.telemetryMessage.slice(0, 200)
  }
  if (error instanceof Error) {
    // Node.js 文件系统错误
    const errnoCode = getErrnoCode(error)
    if (typeof errnoCode === 'string') {
      return `Error:${errnoCode}`  // ENOENT, EACCES 等
    }
    return error.name.slice(0, 60)
  }
  return 'UnknownError'
}
```

### 工具 Hooks

```typescript
// services/tools/toolHooks.ts
type ToolHook = {
  name: string
  run: (context: ToolUseContext) => Promise<void> | void
}

// 前置 Hooks
async function runPreToolUseHooks(
  tool: Tool,
  input: Record<string, unknown>,
  context: ToolUseContext,
): Promise<HookResult> {
  for (const hook of preToolUseHooks) {
    const result = await hook.run(context)
    if (result.blocked) {
      return result  // 阻止执行
    }
  }
  return { allowed: true }
}

// 后置 Hooks
async function runPostToolUseHooks(
  tool: Tool,
  result: unknown,
  context: ToolUseContext,
): Promise<void> {
  for (const hook of postToolUseHooks) {
    await hook.run(context)
  }
}
```

---

## 三十六、API 层封装

### API 客户端架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API 客户端分层                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  QueryEngine                                                                │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     query() 函数                                    │   │
│  │  - 消息规范化                                                         │   │
│  │  - 上下文组装                                                         │   │
│  │  - 事件流处理                                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    withRetry()                                      │   │
│  │  - 指数退避                                                           │   │
│  │  - 错误分类处理                                                       │   │
│  │  - 模型降级                                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 messages.stream() API                                 │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │   │
│  │  │ Anthropic   │ │ AWS Bedrock  │ │ GCP Vertex  │                │   │
│  │  │ (官方)       │ │              │ │              │                │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │   │
│  │  ┌──────────────┐ ┌──────────────┐                                  │   │
│  │  │ Azure       │ │ Claude.ai   │                                  │   │
│  │  │ Foundry     │ │ Proxy       │                                  │   │
│  │  └──────────────┘ └──────────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 多 Provider 支持

```typescript
// utils/model/providers.ts
export type APIProvider = 'anthropic' | 'aws' | 'gcp' | 'azure'

export function getAPIProvider(): APIProvider {
  if (process.env.ANTHROPIC_AWS_REGION) return 'aws'
  if (process.env.VERTEX_REGION) return 'gcp'
  if (process.env.ANTHROPIC_FOUNDRY_RESOURCE) return 'azure'
  return 'anthropic'
}

// services/api/client.ts
export function createApiClient(): Anthropic {
  const provider = getAPIProvider()

  switch (provider) {
    case 'aws':
      return new Anthropic({
        apiKey: 'unused',
        baseURL: getAwsBedrockUrl(region),
        httpOptions: {
          // AWS 签名由 SDK 处理
        }
      })

    case 'gcp':
      return new Anthropic({
        apiKey: 'unused',
        baseURL: getVertexUrl(project, region),
        httpOptions: {
          headers: {
            'Authorization': `Bearer ${getGcpToken()}`,
          }
        }
      })

    case 'azure':
      return new Anthropic({
        apiKey: getAzureApiKey(),
        baseURL: getAzureFoundryUrl(),
      })
  }
}
```

### API 事件流处理

```typescript
// services/api/claude.ts
export type StreamEvent =
  | { type: 'content_block_delta'; delta: ContentBlockDelta }
  | { type: 'content_block_start'; block: ContentBlock }
  | { type: 'message_delta'; delta: MessageDelta; usage: Usage }
  | { type: 'message_start'; message: Message }
  | { type: 'error'; error: APIError }
  | { type: 'done' }

// 流式处理
async function* streamMessage(
  params: MessageStreamParams,
): AsyncGenerator<StreamEvent, AssistantMessage> {
  const client = await getApiClient()
  const stream = await client.messages.stream(params)

  let assistantMessage: AssistantMessage

  for await (const event of stream) {
    switch (event.type) {
      case 'message_start':
        assistantMessage = createAssistantMessage(event.message)
        yield { type: 'message_start', message: event.message }
        break

      case 'content_block_start':
        yield { type: 'content_block_start', block: event.block }
        break

      case 'content_block_delta':
        yield { type: 'content_block_delta', delta: event.delta }
        break

      case 'message_delta':
        yield { type: 'message_delta', delta: event.delta, usage: event.usage }
        break

      case 'message_stop':
        yield { type: 'done' }
        break
    }
  }

  return assistantMessage!
}
```

### 消息规范化

```typescript
// utils/api.ts
export function normalizeMessagesForAPI(
  messages: Message[],
): NormalizedMessage[] {
  return messages
    .filter(m => !m.isVirtual)  // 过滤虚拟消息
    .filter(m => !m.isMeta)     // 过滤元消息
    .map(m => normalizeMessage(m))
}

export function normalizeMessage(message: Message): NormalizedMessage {
  if (message.type === 'user') {
    return {
      role: 'user',
      content: normalizeContent(message.message.content),
    }
  }

  if (message.type === 'assistant') {
    return {
      role: 'assistant',
      content: normalizeContent(message.message.content),
    }
  }

  // system 消息转换为 user 消息
  if (message.type === 'system') {
    return {
      role: 'user',
      content: message.content,
    }
  }
}

function normalizeContent(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  return content
}
```

---

## 三十七、UI 组件架构

### 组件结构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         React 组件架构                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          App.tsx                                     │   │
│  │  - AppStateProvider (全局状态)                                       │   │
│  │  - StatsProvider (统计)                                             │   │
│  │  - FpsMetricsProvider (FPS)                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FullscreenLayout                                  │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │   │
│  │  │ StatusLine  │ │ Messages    │ │ PromptInput  │                │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │   │
│  │  ┌──────────────┐ ┌──────────────┐                                │   │
│  │  │ TokenWarning │ │ TaskListV2  │                                │   │
│  │  └──────────────┘ └──────────────┘                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Messages.tsx                                  │   │
│  │  - VirtualMessageList (虚拟列表)                                    │   │
│  │  - MessageRow (消息行)                                               │   │
│  │  - AssistantThinkingMessage (思考中)                                 │   │
│  │  - StreamingMarkdown (流式渲染)                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 状态管理

```typescript
// state/AppState.ts
export interface AppState {
  // 消息
  messages: Message[]

  // 任务
  tasks: Record<string, TaskState>

  // 设置
  settings: Settings

  // 工具权限
  toolPermissionContext: ToolPermissionContext

  // MCP 连接
  mcpConnections: MCPServerConnection[]

  // 会话
  session: {
    id: string
    startTime: Date
    model: string
  }
}

// 状态更新
export function updateAppState(
  prev: AppState,
  update: Partial<AppState>,
): AppState {
  return { ...prev, ...update }
}

// 订阅变化
export function onChangeAppState(
  newState: AppState,
  oldState: AppState,
): void {
  // 通知订阅者
  notifySubscribers(newState, oldState)
}
```

### 虚拟消息列表 (VirtualList)

```typescript
// components/VirtualMessageList.tsx
// 高性能虚拟列表，只渲染可见区域的消息

export function VirtualMessageList({
  messages,
  estimatedItemHeight = 100,
}: {
  messages: Message[]
  estimatedItemHeight?: number
}) {
  const containerRef = useRef<HTMLDivElement>()
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  // 计算可见范围
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / estimatedItemHeight)
    const visibleCount = Math.ceil(viewportHeight / estimatedItemHeight)
    const buffer = 5  // 缓冲区

    return {
      start: Math.max(0, startIndex - buffer),
      end: Math.min(messages.length, startIndex + visibleCount + buffer),
    }
  }, [scrollTop, viewportHeight])

  // 渲染可见消息
  const visibleMessages = useMemo(() =>
    messages.slice(visibleRange.start, visibleRange.end),
    [visibleRange]
  )

  // 总高度占位
  const totalHeight = messages.length * estimatedItemHeight

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: viewportHeight, overflow: 'auto' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleMessages.map((message, i) => (
          <div
            key={message.uuid}
            style={{
              position: 'absolute',
              top: (visibleRange.start + i) * estimatedItemHeight,
              height: estimatedItemHeight,
            }}
          >
            <MessageRow message={message} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### React Compiler (react/compiler-runtime)

```typescript
// App.tsx 使用了 React Compiler (试验性)
// 编译时自动优化 useMemo/useCallback 依赖

export function App({ children, initialState }: Props) {
  // React Compiler 自动生成的优化版本
  const $ = _c(9)  // 缓存槽数量

  let t1
  if ($[0] !== children || $[1] !== initialState) {
    t1 = <AppStateProvider>{children}</AppStateProvider>
    $[0] = children
    $[1] = initialState
    $[2] = t1
  } else {
    t1 = $[2]  // 复用缓存
  }

  return t1
}
```

### 消息渲染流水线

```typescript
// components/Messages.tsx
// 消息处理流水线

function processMessages(messages: Message[]): RenderableMessage[] {
  // 1. 规范化消息
  let processed = normalizeMessages(messages)

  // 2. 应用分组 (减少重复)
  processed = applyGrouping(processed)

  // 3. 折叠后台任务通知
  processed = collapseBackgroundBashNotifications(processed)

  // 4. 折叠 Hook 摘要
  processed = collapseHookSummaries(processed)

  // 5. 折叠读取/搜索组
  processed = collapseReadSearchGroups(processed)

  // 6. 过滤元消息
  processed = processed.filter(m => !m.isMeta)

  return processed
}
```

---

## 三十八、关键设计模式

### 1. 并发控制模式

```typescript
// 令牌桶 + 互斥锁
class ConcurrencyController {
  private running = 0
  private maxConcurrent = 10

  async execute<T>(
    task: () => Promise<T>,
    options: { exclusive?: boolean } = {},
  ): Promise<T> {
    if (options.exclusive) {
      // 互斥任务：等待所有其他任务完成
      while (this.running > 0) {
        await waitForNextTask()
      }
    } else {
      // 普通任务：等待有空闲槽
      while (this.running >= this.maxConcurrent) {
        await waitForNextTask()
      }
    }

    this.running++
    try {
      return await task()
    } finally {
      this.running--
    }
  }
}
```

### 2. 流式处理模式

```typescript
// AsyncGenerator 实现流式处理
async function* createStreamProcessor<T>(
  source: AsyncIterable<T>,
): AsyncGenerator<ProcessedChunk> {
  for await (const item of source) {
    const processed = await processItem(item)
    yield processed  // 立即输出，不等待全部完成
  }
}

// 使用
for await (const chunk of createStreamProcessor(apiStream)) {
  updateUI(chunk)
}
```

### 3. 虚拟列表优化

```typescript
// 虚拟列表核心公式
const visibleStartIndex = Math.floor(scrollTop / itemHeight)
const visibleCount = Math.ceil(viewportHeight / itemHeight)
const buffer = 5  // 上下各 5 个缓冲

const renderStart = Math.max(0, visibleStartIndex - buffer)
const renderEnd = Math.min(totalItems, visibleStartIndex + visibleCount + buffer)
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **工具执行** | `services/tools/StreamingToolExecutor.ts` | 并发控制 |
| **工具执行** | `services/tools/toolExecution.ts` | 权限检查 |
| **API 层** | `services/api/claude.ts` | API 调用 |
| **API 层** | `services/api/client.ts` | 多 Provider |
| **API 层** | `services/api/withRetry.ts` | 重试机制 |
| **UI 组件** | `components/App.tsx` | 根组件 |
| **UI 组件** | `components/Messages.tsx` | 消息列表 |
| **UI 组件** | `components/VirtualMessageList.tsx` | 虚拟列表 |
| **状态管理** | `state/AppState.ts` | 全局状态 |