# Claude Code 源码深度学习笔记 (第三十五部分 - 完结)

> MCP 验证·日期解析·WebSocket 传输·Ripgrep·Glob·遥测追踪

---

## 二百一十三、MCP Elicitation 验证

### 表单验证

```typescript
// utils/mcp/elicitationValidation.ts

export type ValidationResult = {
  value?: string | number | boolean
  isValid: boolean
  error?: string
}

// 字符串格式验证
const STRING_FORMATS = {
  email: { description: 'email address', example: 'user@example.com' },
  uri: { description: 'URI', example: 'https://example.com' },
  date: { description: 'date', example: '2024-03-15' },
  'date-time': { description: 'date-time', example: '2024-03-15T14:30:00Z' },
}

// 检查是否为枚举 schema
export const isEnumSchema = (
  schema: PrimitiveSchemaDefinition,
): schema is EnumSchema => {
  return schema.type === 'string' && ('enum' in schema || 'oneOf' in schema)
}

// 检查是否为多选枚举 schema
export function isMultiSelectEnumSchema(
  schema: PrimitiveSchemaDefinition,
): schema is MultiSelectEnumSchema {
  return (
    schema.type === 'array' &&
    'items' in schema &&
    typeof schema.items === 'object' &&
    ('enum' in schema.items || 'anyOf' in schema.items)
  )
}

// 验证输入值
export function validateInput(
  value: unknown,
  schema: PrimitiveSchemaDefinition,
): ValidationResult {
  // 枚举验证
  if (isEnumSchema(schema)) {
    const enumValues = 'enum' in schema ? schema.enum : schema.oneOf.map(o => o.const)
    if (!enumValues.includes(value as string)) {
      return {
        isValid: false,
        error: `Must be one of: ${enumValues.join(', ')}`,
      }
    }
    return { isValid: true, value }
  }

  // 字符串格式验证
  if (schema.type === 'string' && schema.format) {
    const format = STRING_FORMATS[schema.format]
    if (format && typeof value === 'string') {
      if (!matchesFormat(value, schema.format)) {
        return {
          isValid: false,
          error: `Invalid ${format.description}. Example: ${format.example}`,
        }
      }
    }
  }

  return { isValid: true, value }
}
```

---

## 二百一十四、自然语言日期解析

### Haiku 驱动的日期解析

```typescript
// utils/mcp/dateTimeParser.ts

export type DateTimeParseResult =
  | { success: true; value: string }
  | { success: false; error: string }

// 使用 Haiku 解析自然语言日期
export async function parseNaturalLanguageDateTime(
  input: string,
  format: 'date' | 'date-time',
  signal: AbortSignal,
): Promise<DateTimeParseResult> {
  const now = new Date()
  const timezoneOffset = -now.getTimezoneOffset()
  const tzSign = timezoneOffset >= 0 ? '+' : '-'
  const tzHours = String(Math.abs(Math.floor(timezoneOffset / 60))).padStart(2, '0')
  const tzMinutes = String(Math.abs(timezoneOffset % 60)).padStart(2, '0')
  const timezone = `${tzSign}${tzHours}:${tzMinutes}`

  // 构建系统提示
  const systemPrompt = asSystemPrompt([
    'You are a date/time parser that converts natural language into ISO 8601 format.',
    'You MUST respond with ONLY the ISO 8601 formatted string, with no explanation.',
    'If the input is incomplete or unparseable, respond with exactly "INVALID".',
  ])

  // 构建用户提示
  const userPrompt = `Current context:
- Current date and time: ${now.toISOString()} (UTC)
- Local timezone: ${timezone}
- Day of week: ${now.toLocaleDateString('en-US', { weekday: 'long' })}

User input: "${input}"

Parse into ${format === 'date' ? 'YYYY-MM-DD' : 'ISO 8601 date-time'}.`

  try {
    const result = await queryHaiku({
      systemPrompt,
      userPrompt,
      signal,
      options: { querySource: 'mcp_datetime_parse', ... },
    })

    const text = extractTextContent(result)
    const trimmed = text.trim()

    if (trimmed === 'INVALID') {
      return { success: false, error: 'Could not parse date/time' }
    }

    return { success: true, value: trimmed }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

---

## 二百一十五、WebSocket 传输

### MCP WebSocket 传输实现

```typescript
// utils/mcpWebSocketTransport.ts

export class WebSocketTransport implements Transport {
  private started = false
  private opened: Promise<void>
  private isBun = typeof Bun !== 'undefined'

  constructor(private ws: WebSocketLike) {
    this.opened = new Promise((resolve, reject) => {
      if (this.ws.readyState === WS_OPEN) {
        resolve()
      } else if (this.isBun) {
        // Bun 原生 WebSocket
        const nws = this.ws as unknown as globalThis.WebSocket
        nws.addEventListener('open', onOpen)
        nws.addEventListener('error', onError)
      } else {
        // ws 库
        const nws = this.ws as unknown as WsWebSocket
        nws.on('open', () => resolve())
        nws.on('error', error => reject(error))
      }
    })
  }

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  // 启动传输
  async start(): Promise<void> {
    if (this.started) return
    this.started = true
    await this.opened
  }

  // 发送消息
  send(message: JSONRPCMessage): void {
    this.ws.send(jsonStringify(message))
  }

  // 关闭传输
  async close(): Promise<void> {
    this.ws.close()
  }
}
```

---

## 二百一十六、Ripgrep 封装

### 跨平台 Ripgrep

```typescript
// utils/ripgrep.ts

type RipgrepConfig = {
  mode: 'system' | 'builtin' | 'embedded'
  command: string
  args: string[]
  argv0?: string
}

const getRipgrepConfig = memoize((): RipgrepConfig => {
  // 优先使用系统 ripgrep
  if (isEnvDefinedFalsy(process.env.USE_BUILTIN_RIPGREP)) {
    const { cmd: systemPath } = findExecutable('rg', [])
    if (systemPath !== 'rg') {
      // 安全: 使用命令名 'rg' 而不是完整路径，防止 PATH 劫持
      return { mode: 'system', command: 'rg', args: [] }
    }
  }

  // 内置模式: ripgrep 静态编译到 bun 中
  if (isInBundledMode()) {
    return {
      mode: 'embedded',
      command: process.execPath,
      args: ['--no-config'],
      argv0: 'rg',  // argv0='rg' 分发到内置 ripgrep
    }
  }

  // 回退到 vendored ripgrep
  const rgRoot = path.resolve(__dirname, 'vendor', 'ripgrep')
  const command = process.platform === 'win32'
    ? path.resolve(rgRoot, `${process.arch}-win32`, 'rg.exe')
    : path.resolve(rgRoot, `${process.arch}-${process.platform}`, 'rg')

  return { mode: 'builtin', command, args: [] }
})

// 执行 ripgrep
export async function ripGrep(options: RipgrepOptions): Promise<RipgrepResult> {
  const { rgPath, rgArgs, argv0 } = ripgrepCommand()

  return new Promise((resolve, reject) => {
    const child = spawn(rgPath, rgArgs.concat(options.args), {
      argv0,
      cwd: options.cwd,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })

    child.on('close', code => {
      resolve({ stdout, stderr, exitCode: code })
    })

    child.on('error', reject)
  })
}
```

---

## 二百一十七、Glob 模式匹配

### Glob 基础目录提取

```typescript
// utils/glob.ts

// 从 glob 模式提取静态基础目录
export function extractGlobBaseDirectory(pattern: string): {
  baseDir: string
  relativePattern: string
} {
  // 找到第一个 glob 特殊字符
  const globChars = /[*?[{]/
  const match = pattern.match(globChars)

  if (!match || match.index === undefined) {
    // 没有 glob 字符 -  literal 路径
    return { baseDir: dirname(pattern), relativePattern: basename(pattern) }
  }

  // 获取 glob 字符之前的静态前缀
  const staticPrefix = pattern.slice(0, match.index)
  const lastSepIndex = Math.max(
    staticPrefix.lastIndexOf('/'),
    staticPrefix.lastIndexOf(sep),
  )

  if (lastSepIndex === -1) {
    return { baseDir: '', relativePattern: pattern }
  }

  let baseDir = staticPrefix.slice(0, lastSepIndex)
  const relativePattern = pattern.slice(lastSepIndex + 1)

  // 处理根目录模式
  if (baseDir === '' && lastSepIndex === 0) {
    baseDir = '/'
  }

  // 处理 Windows 驱动器根路径
  if (getPlatform() === 'windows' && /^[A-Za-z]:$/.test(baseDir)) {
    baseDir = baseDir + sep
  }

  return { baseDir, relativePattern }
}

// 执行 glob
export async function glob(
  filePattern: string,
  cwd: string,
  { limit, offset }: { limit: number; offset: number },
  abortSignal: AbortSignal,
  toolPermissionContext: ToolPermissionContext,
): Promise<{ files: string[]; truncated: boolean }> {
  // 处理绝对路径
  if (isAbsolute(filePattern)) {
    const { baseDir, relativePattern } = extractGlobBaseDirectory(filePattern)
    if (baseDir) {
      cwd = baseDir
      filePattern = relativePattern
    }
  }

  // 使用 ripgrep 执行 glob
  const results = await ripGrep({
    args: [
      '--files',
      '--glob', filePattern,
      '--', cwd,
    ],
    cwd,
    abortSignal,
  })

  // 分页
  const allFiles = results.stdout.split('\n').filter(Boolean)
  return {
    files: allFiles.slice(offset, offset + limit),
    truncated: allFiles.length > offset + limit,
  }
}
```

---

## 二百一十八、会话追踪 (OpenTelemetry)

### OpenTelemetry 集成

```typescript
// utils/telemetry/sessionTracing.ts

import { context as otelContext, type Span, trace } from '@opentelemetry/api'
import { AsyncLocalStorage } from 'async_hooks'

// ALS 存储 SpanContext，提供强引用防止 GC
const interactionContext = new AsyncLocalStorage<SpanContext | undefined>()
const toolContext = new AsyncLocalStorage<SpanContext | undefined>()

// 30 分钟 TTL
const SPAN_TTL_MS = 30 * 60 * 1000

type SpanType =
  | 'interaction'
  | 'llm_request'
  | 'tool'
  | 'tool.blocked_on_user'
  | 'tool.execution'
  | 'hook'

interface SpanContext {
  span: Span
  startTime: number
  attributes: Record<string, string | number | boolean>
  ended?: boolean
  perfettoSpanId?: string
}

// 开始交互 span
export function startInteractionSpan(
  attributes: Record<string, string | number | boolean>,
): SpanContext {
  const tracer = trace.getTracer('claude-code')

  const span = tracer.startSpan('interaction', {
    attributes: {
      'interaction.id': generateUUID(),
      ...attributes,
    },
  })

  const ctx: SpanContext = {
    span,
    startTime: Date.now(),
    attributes,
  }

  interactionContext.set(ctx)
  return ctx
}

// 开始工具 span
export function startToolSpan(
  toolName: string,
  inputAttributes: Record<string, string | number | boolean>,
): SpanContext {
  const parentCtx = otelContext.get()
  const tracer = trace.getTracer('claude-code')

  const span = tracer.startSpan('tool', {
    attributes: {
      'tool.name': toolName,
      ...inputAttributes,
    },
    links: parentCtx ? [{ context: parentCtx }] : undefined,
  })

  const ctx: SpanContext = {
    span,
    startTime: Date.now(),
    attributes: { 'tool.name': toolName, ...inputAttributes },
  }

  // 存储强引用防止 GC
  const spanId = generateUUID()
  strongSpans.set(spanId, ctx)

  return ctx
}

// 结束 span
export function endSpan(ctx: SpanContext): void {
  if (ctx.ended) return
  ctx.ended = true

  ctx.span.setAttributes({
    'duration_ms': Date.now() - ctx.startTime,
  })

  ctx.span.end()

  // 清理
  strongSpans.delete(ctx.span.spanContext().spanId)
}
```

---

## 二百一十九、Perfetto 追踪

### Perfetto 集成

```typescript
// utils/telemetry/perfettoTracing.ts

// Perfetto 是 Google 的系统追踪工具

export function isPerfettoTracingEnabled(): boolean {
  if (!process.env.OTEL_TRACES_EXPORTER?.includes('perfetto')) {
    return false
  }
  return isEnvTruthy(process.env.ENABLE_PERFETTO_TRACING)
}

// 开始 LLM 请求 span
export function startLLMRequestPerfettoSpan(
  requestId: string,
  model: string,
): string {
  if (!isPerfettoTracingEnabled()) return ''

  const traceEvent = {
    name: `LLM Request: ${model}`,
    cat: 'llm',
    ts: performance.now() * 1000, // microseconds
    pid: process.pid,
    tid: getCurrentThreadId(),
    args: { requestId, model },
  }

  // 发送到 Perfetto
  sendToPerfetto(traceEvent)

  return requestId
}

// 结束 LLM 请求 span
export function endLLMRequestPerfettoSpan(
  spanId: string,
  responseTokens: number,
  durationMs: number,
): void {
  if (!isPerfettoTracingEnabled()) return

  const traceEvent = {
    name: 'LLM Response',
    cat: 'llm',
    ts: performance.now() * 1000,
    pid: process.pid,
    tid: getCurrentThreadId(),
    dur: durationMs * 1000, // microseconds
    args: { spanId, responseTokens },
  }

  sendToPerfetto(traceEvent)
}
```

---

## 二百二十、Beta 遥测属性

### Beta 追踪属性

```typescript
// utils/telemetry/betaSessionTracing.ts

// 添加 LLM 请求属性
export function addBetaLLMRequestAttributes(
  span: Span,
  model: string,
  contextTokens: number,
  temperature: number,
  maxTokens: number,
): void {
  span.setAttributes({
    'llm.model': model,
    'llm.context_tokens': contextTokens,
    'llm.temperature': temperature,
    'llm.max_tokens': maxTokens,
  })
}

// 添加 LLM 响应属性
export function addBetaLLMResponseAttributes(
  span: Span,
  outputTokens: number,
  stopReason: string,
  durationMs: number,
): void {
  span.setAttributes({
    'llm.output_tokens': outputTokens,
    'llm.stop_reason': stopReason,
    'llm.duration_ms': durationMs,
  })
}

// 添加工具输入属性
export function addBetaToolInputAttributes(
  span: Span,
  toolName: string,
  inputSize: number,
): void {
  span.setAttributes({
    'tool.name': toolName,
    'tool.input_size': inputSize,
  })
}

// 添加工具结果属性
export function addBetaToolResultAttributes(
  span: Span,
  toolName: string,
  outputSize: number,
  durationMs: number,
): void {
  span.setAttributes({
    'tool.name': toolName,
    'tool.output_size': outputSize,
    'tool.duration_ms': durationMs,
  })
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **MCP 验证** | `utils/mcp/elicitationValidation.ts` | 表单验证 |
| **日期解析** | `utils/mcp/dateTimeParser.ts` | 自然语言日期 |
| **WebSocket** | `utils/mcpWebSocketTransport.ts` | MCP 传输 |
| **Ripgrep** | `utils/ripgrep.ts` | 跨平台搜索 |
| **Glob** | `utils/glob.ts` | 文件模式匹配 |
| **会话追踪** | `utils/telemetry/sessionTracing.ts` | OpenTelemetry |
| **Perfetto** | `utils/telemetry/perfettoTracing.ts` | 系统追踪 |
| **Beta 遥测** | `utils/telemetry/betaSessionTracing.ts` | 追踪属性 |

---

## 🎓 Claude Code 源码深度学习 - 完结总结

### 📚 文档完整列表 (35 个)

```
~/projects/tech-blog/docs/
├── 架构与入口
│   ├── claude-code-study.md
│   ├── claude-code-query-engine.md
│   └── claude-code-cli-commands-tasks.md
├── 核心系统
│   ├── claude-code-context-management.md
│   ├── claude-code-tools-api-ui.md
│   ├── claude-code-tools-system.md
│   └── claude-code-ink-ui-hooks.md
├── MCP·权限·记忆
│   ├── claude-code-mcp-permission-memory.md
│   ├── claude-code-mcp-settings-constants.md
│   └── claude-code-compact-memory-session.md
├── 安全·诊断·配置
│   ├── claude-code-diagnostic-security-config.md
│   ├── claude-code-api-auth-memory.md
│   └── claude-code-coordinator-permissions-git.md
├── 日志·遥测·插件
│   ├── claude-code-logging-telemetry-plugins.md
│   └── claude-code-model-tools-components.md
├── 团队·协作·计划
│   ├── claude-code-team-plans-worktree.md
│   ├── claude-code-sdk-remote-session.md
│   └── claude-code-bridge-remote-control.md
├── 内置 Agent·Fork
│   └── claude-code-builtin-agents-fork.md
├── IDE·语音·通知
│   └── claude-code-ide-voice-notify-tips.md
├── 图像·VCR·Signal
│   └── claude-code-image-vcr-signal.md
├── Cron·Markdown·Mailbox
│   └── claude-code-cron-markdown-mailbox.md
├── 工具函数库 I
│   ├── claude-code-utils-hash-git-platform.md
│   ├── claude-code-utils-exec-json-memoize.md
│   └── claude-code-state-notify-api.md
├── 工具函数库 II
│   ├── claude-code-utils-string-http.md
│   ├── claude-code-theme-circular-tmux.md
│   └── claude-code-token-unicode-session.md
├── 工具函数库 III
│   └── claude-code-binary-generator-earlyinput.md
├── Diff·Treeify·会话
│   └── claude-code-diff-treeify-session.md
└── MCP·遥测
    └── (当前文档)
```

### 📊 源码规模统计

| 指标 | 数量 |
|------|------|
| **总代码量** | ~800,000 行 |
| **工具数量** | 45 个 |
| **命令数量** | 103+ 个 |
| **组件数量** | 146+ 个 |
| **Hooks** | 87+ 个 |
| **工具函数** | 290+ 个 |
| **服务模块** | 20+ 个 |
| **学习文档** | **35 个** |

### 🎯 35 个核心设计模式

| # | 模式 | 应用场景 |
|---|------|----------|
| 1-10 | **基础架构** | AsyncGenerator, Signal, LRU Cache, 分层缓存, 规则引擎, 工厂模式, 观察者, 懒加载, 快速路径, Mailbox |
| 11-20 | **高级特性** | 优先级队列, Cron 解析, Virtual List, WeakRef, 指数退避, Token 预算, OAuth 流程, WebSocket 重连, 环形缓冲, TTL 缓存 |
| 21-30 | **工具函数** | 路径截断, BufferedWriter, JSONC 解析, Object GroupBy, Grapheme 分割, Store 模式, Shell AST, MCP 传输, Swarm Agent, TMUX 隔离 |
| 31-35 | **安全与遥测** | Unicode 净化, Early Input, OpenTelemetry, Perfetto, Beta 追踪 |

### 🔑 关键架构亮点

1. **零成本抽象**: `--version` 零模块加载
2. **流式处理**: AsyncGenerator yield* 管道
3. **智能上下文**: 动态阈值 + 虚拟列表 + WeakRef 缓存
4. **多传输协议**: Stdio/SSE/HTTP/WebSocket + OAuth
5. **安全第一**: 分层权限，路径验证，Unicode 净化
6. **多后端支持**: Anthropic/AWS/Azure/Vertex
7. **团队协作**: Swarm 架构 + Fork 子会话
8. **记忆系统**: 4 种记忆类型，自动提取
9. **VCR 测试**: Fixture 管理，录制回放
10. **Signal 模式**: 轻量级事件发射器

---

**🎓 学习完成！所有 35 个文档已保存在 `~/projects/tech-blog/docs/` 目录中。**