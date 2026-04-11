# Claude Code 源码深度学习笔记 (第十一部分)

> 日志系统 · 遥测系统 · 插件系统

---

## 五十七、日志系统

### 日志架构

```typescript
// utils/log.ts

// 内存错误日志
const MAX_IN_MEMORY_ERRORS = 100
let inMemoryErrorLog: Array<{ error: string; timestamp: string }> = []

// 日志 Sink 接口
export type ErrorLogSink = {
  logError: (error: Error) => void
  logMCPError: (serverName: string, error: unknown) => void
  logMCPDebug: (serverName: string, message: string) => void
  getErrorsPath: () => string
  getMCPLogsPath: (serverName: string) => string
}

// 日志队列 (Sink 附加前)
type QueuedErrorEvent =
  | { type: 'error'; error: Error }
  | { type: 'mcpError'; serverName: string; error: unknown }
  | { type: 'mcpDebug'; serverName: string; message: string }

const errorQueue: QueuedErrorEvent[] = []
let errorLogSink: ErrorLogSink | null = null
```

### 日志函数

```typescript
// 错误日志
export function logError(error: unknown): void {
  const err = toError(error)
  addToInMemoryErrorLog({
    error: err.message,
    timestamp: new Date().toISOString(),
  })

  if (errorLogSink) {
    errorLogSink.logError(err)
  } else {
    errorQueue.push({ type: 'error', error: err })
  }
}

// MCP 错误日志
export function logMCPError(serverName: string, error: unknown): void {
  if (errorLogSink) {
    errorLogSink.logMCPError(serverName, error)
  } else {
    errorQueue.push({ type: 'mcpError', serverName, error })
  }
}

// MCP 调试日志
export function logMCPDebug(serverName: string, message: string): void {
  if (errorLogSink) {
    errorLogSink.logMCPDebug(serverName, message)
  } else {
    errorQueue.push({ type: 'mcpDebug', serverName, message })
  }
}
```

### 日志标题

```typescript
// 获取日志显示标题
export function getLogDisplayTitle(
  log: LogOption,
  defaultTitle?: string,
): string {
  // 优先级: agentName > customTitle > summary > firstPrompt > defaultTitle
  const title =
    log.agentName ||
    log.customTitle ||
    log.summary ||
    (strippedFirstPrompt && !isAutonomousPrompt ? strippedFirstPrompt : undefined) ||
    defaultTitle ||
    (isAutonomousPrompt ? 'Autonomous session' : undefined) ||
    sessionId?.slice(0, 8) ||
    ''

  return stripDisplayTags(title).trim()
}
```

---

## 五十八、遥测系统 (Telemetry)

### OpenTelemetry 事件

```typescript
// utils/telemetry/events.ts

let eventSequence = 0

export async function logOTelEvent(
  eventName: string,
  metadata: { [key: string]: string | undefined } = {},
): Promise<void> {
  const eventLogger = getEventLogger()
  if (!eventLogger) return

  if (process.env.NODE_ENV === 'test') return

  const attributes: Attributes = {
    ...getTelemetryAttributes(),
    'event.name': eventName,
    'event.timestamp': new Date().toISOString(),
    'event.sequence': eventSequence++,
  }

  // 添加 prompt ID
  const promptId = getPromptId()
  if (promptId) {
    attributes['prompt.id'] = promptId
  }

  // 添加元数据
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      attributes[key] = value
    }
  }

  eventLogger.emit({
    body: `claude_code.${eventName}`,
    attributes,
  })
}

// 标记敏感内容
export function redactIfDisabled(content: string): string {
  return isUserPromptLoggingEnabled() ? content : '<REDACTED>'
}
```

### 会话追踪

```typescript
// utils/telemetry/sessionTracing.ts

// 追踪 span
export function startToolSpan(
  toolName: string,
  parentSpan?: Span,
): Span {
  return tracer.startSpan(`tool.${toolName}`, {
    parent: parentSpan,
    attributes: {
      'tool.name': toolName,
    },
  })
}

export function endToolSpan(span: Span, success: boolean): void {
  span.setAttributes({
    'tool.success': success,
    'tool.duration_ms': span.elapsedTime,
  })
  span.end()
}

// 追踪钩子
export function startHookSpan(hookName: string): Span {
  return tracer.startSpan(`hook.${hookName}`)
}
```

### BigQuery 导出

```typescript
// utils/telemetry/bigqueryExporter.ts

export interface BigQueryExporter {
  exportMetrics(metrics: Metric[]): Promise<void>
  exportEvents(events: Event[]): Promise<void>
}

// 批量导出
async function flushToBigQuery(): Promise<void> {
  const events = eventBuffer.splice(0, BATCH_SIZE)
  const metrics = metricBuffer.splice(0, BATCH_SIZE)

  await Promise.all([
    exporter.exportEvents(events),
    exporter.exportMetrics(metrics),
  ])
}
```

---

## 五十九、插件系统

### 插件类型

```typescript
// types/plugin.ts

export type LoadedPlugin = {
  name: string
  manifest: PluginManifest
  path: string
  source: string
  repository: string
  enabled?: boolean
  isBuiltin?: boolean        // 内置插件
  sha?: string               // Git commit SHA

  // 组件路径
  commandsPath?: string
  agentsPath?: string
  skillsPath?: string
  outputStylesPath?: string

  // 配置
  hooksConfig?: HooksSettings
  mcpServers?: Record<string, McpServerConfig>
  lspServers?: Record<string, LspServerConfig>
  settings?: Record<string, unknown>
}

export type PluginComponent =
  | 'commands'
  | 'agents'
  | 'skills'
  | 'hooks'
  | 'output-styles'
```

### 插件目录结构

```
my-plugin/
├── plugin.json          # 插件清单 (可选)
├── commands/             # 自定义斜杠命令
│   ├── build.md
│   └── deploy.md
├── agents/               # 自定义 Agent
│   └── test-runner.md
├── skills/              # 自定义技能
│   └── custom-skill.md
├── hooks/               # Hook 配置
│   └── hooks.json
├── output-styles/       # 输出样式
│   └── custom-style.md
└── mcp/                 # MCP 服务器配置
    └── server.json
```

### 插件加载器

```typescript
// utils/plugins/pluginLoader.ts

// 插件发现源 (按优先级)
const PLUGIN_DISCOVERY_SOURCES = [
  'marketplace-based plugins',   // plugin@marketplace 格式
  'session-only plugins',        // --plugin-dir 或 SDK
]

// 加载所有插件
export async function loadAllPlugins(): Promise<PluginLoadResult> {
  const results: LoadedPlugin[] = []
  const errors: PluginError[] = []

  // 1. 加载内置插件
  const builtinPlugins = await loadBuiltinPlugins()
  results.push(...builtinPlugins)

  // 2. 加载市场插件
  const marketplacePlugins = await loadMarketplacePlugins()
  results.push(...marketplacePlugins)

  // 3. 加载目录插件
  const dirPlugins = await loadPluginsFromDirs()
  results.push(...dirPlugins)

  // 4. 验证和去重
  const validated = validatePlugins(results)

  return { plugins: validated, errors }
}

// 加载插件 hooks
export async function loadPluginHooks(
  plugin: LoadedPlugin,
): Promise<HooksSettings | null> {
  if (!plugin.hooksConfig) return null

  // 解析变量
  const resolved = substituteUserConfigVariables(plugin.hooksConfig)
  return resolved
}
```

### 插件错误类型

```typescript
// types/plugin.ts

export type PluginError =
  | { type: 'generic-error'; message: string }
  | { type: 'plugin-not-found'; plugin: string }
  | { type: 'path-not-found'; path: string }
  | { type: 'git-auth-failed'; repository: string }
  | { type: 'git-timeout'; repository: string }
  | { type: 'network-error'; url: string }
  | { type: 'manifest-parse-error'; file: string }
  | { type: 'manifest-validation-error'; file: string; errors: string[] }
  | { type: 'marketplace-not-found'; marketplace: string }
  | { type: 'marketplace-load-failed'; marketplace: string }
```

### 插件验证

```typescript
// utils/plugins/validatePlugin.ts

export function validatePluginManifest(
  manifest: unknown,
): ValidationResult<PluginManifest> {
  const result = PluginManifestSchema.safeParse(manifest)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  }

  return { valid: true, manifest: result.data }
}

// 检查重复名称
export function checkDuplicateNames(
  plugins: LoadedPlugin[],
): string[] {
  const names = new Set<string>()
  const duplicates: string[] = []

  for (const plugin of plugins) {
    if (names.has(plugin.name)) {
      duplicates.push(plugin.name)
    }
    names.add(plugin.name)
  }

  return duplicates
}
```

---

## 六十、插件管理

### 已安装插件管理

```typescript
// utils/plugins/installedPluginsManager.ts

export interface InstalledPluginInfo {
  name: string
  version: string
  path: string
  enabled: boolean
  source: string
  lastUpdated: Date
}

export function getInstalledPlugins(): InstalledPluginInfo[] {
  const settings = getPluginSettings()
  const pluginsDir = getPluginsDirectory()

  return settings.enabledPlugins.map(name => ({
    name,
    version: readPluginVersion(pluginsDir, name),
    path: join(pluginsDir, name),
    enabled: true,
    source: settings.sources[name] ?? 'unknown',
    lastUpdated: readPluginLastUpdated(pluginsDir, name),
  }))
}
```

### 插件自动更新

```typescript
// utils/plugins/pluginAutoupdate.ts

export async function checkForPluginUpdates(): Promise<PluginUpdate[]> {
  const installed = getInstalledPlugins()
  const updates: PluginUpdate[] = []

  for (const plugin of installed) {
    const latest = await fetchLatestVersion(plugin.source)
    if (compareVersions(latest, plugin.version) > 0) {
      updates.push({
        name: plugin.name,
        from: plugin.version,
        to: latest,
      })
    }
  }

  return updates
}

export async function updatePlugin(
  name: string,
  version: string,
): Promise<void> {
  const plugin = getInstalledPlugin(name)
  const archive = await downloadPlugin(plugin.source, version)

  // 备份旧版本
  await backupPlugin(plugin.name)

  // 解压新版本
  await extractPlugin(archive, plugin.path)

  // 清理缓存
  await clearPluginCache(plugin.name)
}
```

### 插件市场

```typescript
// utils/plugins/marketplaceManager.ts

export interface MarketplaceEntry {
  name: string
  version: string
  description: string
  author: string
  repository: string
  downloads: number
  rating: number
  tags: string[]
}

export async function searchMarketplace(
  query: string,
  filters?: {
    tags?: string[]
    minRating?: number
    sort?: 'downloads' | 'rating' | 'recent'
  },
): Promise<MarketplaceEntry[]> {
  const results = await fetchMarketplaceAPI('/search', {
    q: query,
    ...filters,
  })

  return results.map(parseMarketplaceEntry)
}
```

---

## 六十一、诊断日志

```typescript
// utils/diagLogs.ts

export function logForDiagnosticsNoPII(
  level: 'info' | 'warn' | 'error',
  event: string,
  metadata?: Record<string, unknown>,
): void {
  // 只记录非敏感信息
  const safeMetadata = stripPII(metadata)

  if (isDiagnosticsEnabled()) {
    emitDiagEvent({
      level,
      event,
      timestamp: new Date().toISOString(),
      ...safeMetadata,
    })
  }
}

// 剥离 PII
function stripPII(metadata: Record<string, unknown>): Record<string, unknown> {
  const piiKeys = ['email', 'name', 'path', 'file', 'url']
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (piiKeys.some(k => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = value
    }
  }

  return result
}
```

---

## 六十二、重要设计模式

### 1. 事件缓冲区模式

```typescript
// 批量处理事件
class EventBuffer<T> {
  private buffer: T[] = []
  private timer?: NodeJS.Timeout

  constructor(
    private maxSize: number,
    private flushInterval: number,
    private flush: (events: T[]) => Promise<void>,
  ) {}

  async push(event: T): Promise<void> {
    this.buffer.push(event)

    if (this.buffer.length >= this.maxSize) {
      await this.flush(this.buffer.splice(0))
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flushBuffer(), this.flushInterval)
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flush(this.buffer.splice(0))
    }
    this.timer = undefined
  }
}
```

### 2. 插件验证链

```typescript
// 验证链
const validationChain = [
  validateManifestSchema,
  checkRequiredFields,
  checkDuplicateNames,
  checkCircularDeps,
  checkPermissions,
]

export async function validatePlugin(
  plugin: unknown,
): Promise<ValidationResult> {
  let errors: ValidationError[] = []

  for (const validator of validationChain) {
    const result = await validator(plugin)
    errors.push(...result.errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

### 3. 延迟加载模式

```typescript
// 插件组件延迟加载
export function createLazyPluginLoader(
  pluginPath: string,
): {
  loadCommands: () => Promise<Command[]>
  loadAgents: () => Promise<Agent[]>
  loadSkills: () => Promise<Skill[]>
} {
  return {
    loadCommands: memoize(async () => {
      const { commandsPath } = await loadPluginManifest(pluginPath)
      return commandsPath ? loadCommandsFromDir(commandsPath) : []
    }),
    loadAgents: memoize(async () => {
      const { agentsPath } = await loadPluginManifest(pluginPath)
      return agentsPath ? loadAgentsFromDir(agentsPath) : []
    }),
    loadSkills: memoize(async () => {
      const { skillsPath } = await loadPluginManifest(pluginPath)
      return skillsPath ? loadSkillsFromDir(skillsPath) : []
    }),
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **日志** | `utils/log.ts` | 错误日志 |
| **遥测** | `utils/telemetry/events.ts` | OpenTelemetry 事件 |
| **遥测** | `utils/telemetry/sessionTracing.ts` | 会话追踪 |
| **遥测** | `utils/telemetry/bigqueryExporter.ts` | BigQuery 导出 |
| **插件类型** | `types/plugin.ts` | 插件类型定义 |
| **插件加载** | `utils/plugins/pluginLoader.ts` | 插件发现和加载 |
| **插件验证** | `utils/plugins/validatePlugin.ts` | 插件验证 |
| **插件管理** | `utils/plugins/installedPluginsManager.ts` | 已安装插件 |
| **插件市场** | `utils/plugins/marketplaceManager.ts` | 市场搜索 |
| **自动更新** | `utils/plugins/pluginAutoupdate.ts` | 自动更新 |