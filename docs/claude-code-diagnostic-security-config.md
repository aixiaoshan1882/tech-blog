# Claude Code 源码深度学习笔记 (第十部分)

> 诊断系统 · 安全验证 · 配置系统

---

## 五十一、诊断系统 (LSP/Diagnostic)

### LSP 服务器管理

```typescript
// services/lsp/LSPServerManager.ts

export type LSPServerManager = {
  initialize(): Promise<void>
  shutdown(): Promise<void>
  getServerForFile(filePath: string): LSPServerInstance | undefined
  ensureServerStarted(filePath: string): Promise<LSPServerInstance | undefined>
  sendRequest<T>(filePath: string, method: string, params: unknown): Promise<T | undefined>
  openFile(filePath: string, content: string): Promise<void>
  changeFile(filePath: string, content: string): Promise<void>
  saveFile(filePath: string): Promise<void>
  closeFile(filePath: string): Promise<void>
}

// 工厂函数模式
export function createLSPServerManager(): LSPServerManager {
  const servers = new Map<string, LSPServerInstance>()
  const extensionMap = new Map<string, string[]>()
  const openedFiles = new Map<string, string>()

  async function initialize(): Promise<void> {
    const result = await getAllLspServers()
    // 构建扩展名 → 服务器映射
    for (const [name, config] of Object.entries(result.servers)) {
      for (const ext of Object.keys(config.extensionToLanguage)) {
        extensionMap.set(ext, [...(extensionMap.get(ext) ?? []), name])
      }
    }
  }

  function getServerForFile(filePath: string): LSPServerInstance | undefined {
    const ext = path.extname(filePath)
    const serverNames = extensionMap.get(ext)
    return servers.get(serverNames?.[0] ?? '')
  }

  // ... 其他方法
}
```

### 诊断追踪

```typescript
// services/diagnosticTracking.ts

export interface Diagnostic {
  message: string
  severity: 'Error' | 'Warning' | 'Info' | 'Hint'
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  source?: string
  code?: string
}

export class DiagnosticTrackingService {
  private static instance: DiagnosticTrackingService | undefined
  private baseline = new Map<string, Diagnostic[]>()
  private initialized = false
  private mcpClient: MCPServerConnection | undefined

  static getInstance(): DiagnosticTrackingService {
    if (!DiagnosticTrackingService.instance) {
      DiagnosticTrackingService.instance = new DiagnosticTrackingService()
    }
    return DiagnosticTrackingService.instance
  }

  async shutdown(): Promise<void> {
    this.initialized = false
    this.baseline.clear()
  }

  reset() {
    this.baseline.clear()
  }
}
```

### LSP 诊断注册表

```typescript
// services/lsp/LSPDiagnosticRegistry.ts
export class LSPDiagnosticRegistry {
  private diagnostics = new Map<string, Diagnostic[]>()

  // 注册文件的诊断
  setDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
    this.diagnostics.set(uri, diagnostics)
  }

  // 获取文件的诊断
  getDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) ?? []
  }

  // 清除文件的诊断
  clearDiagnostics(uri: string): void {
    this.diagnostics.delete(uri)
  }

  // 获取所有诊断
  getAllDiagnostics(): Map<string, Diagnostic[]> {
    return new Map(this.diagnostics)
  }
}
```

---

## 五十二、错误处理系统

### 错误类型层次

```typescript
// utils/errors.ts

// 基础错误
export class ClaudeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

// 中止错误
export class AbortError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'AbortError'
  }
}

export function isAbortError(e: unknown): boolean {
  return (
    e instanceof AbortError ||
    e instanceof APIUserAbortError ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

// Shell 错误
export class ShellError extends Error {
  constructor(
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly code: number,
    public readonly interrupted: boolean,
  ) {
    super('Shell command failed')
    this.name = 'ShellError'
  }
}

// 配置解析错误
export class ConfigParseError extends Error {
  filePath: string
  defaultConfig: unknown

  constructor(message: string, filePath: string, defaultConfig: unknown) {
    super(message)
    this.name = 'ConfigParseError'
    this.filePath = filePath
    this.defaultConfig = defaultConfig
  }
}

// 遥测安全错误
export class TelemetrySafeError extends Error {
  readonly telemetryMessage: string

  constructor(message: string, telemetryMessage?: string) {
    super(message)
    this.name = 'TelemetrySafeError'
    this.telemetryMessage = telemetryMessage ?? message
  }
}
```

### 错误处理模式

```typescript
// 统一错误处理
async function handleError(error: unknown): Promise<void> {
  if (isAbortError(error)) {
    // 用户中止
    return
  }

  if (error instanceof ShellError) {
    // Shell 命令失败
    logError(`Shell failed: ${error.stderr}`)
    return
  }

  if (error instanceof ConfigParseError) {
    // 配置错误
    logError(`Config parse error in ${error.filePath}`)
    // 使用默认配置
    return error.defaultConfig
  }

  if (error instanceof TelemetrySafeError) {
    // 遥测安全错误
    logEvent('error', { message: error.telemetryMessage })
    return
  }

  // 未知错误
  logError(error)
}

// 错误代码提取
export function getErrnoCode(error: Error): string | undefined {
  return (error as NodeJS.ErrnoException).code
}

// 常见错误码
const ERROR_CODES = {
  ENOENT: 'File not found',
  EACCES: 'Permission denied',
  ECONNREFUSED: 'Connection refused',
  ETIMEDOUT: 'Connection timed out',
}
```

---

## 五十三、配置系统

### 设置类型

```typescript
// utils/settings/types.ts
export type SettingsJson = {
  permissionMode?: PermissionMode
  mcpServers?: Record<string, MCPServerConfig>
  hooks?: HookConfig
  agents?: AgentConfig[]
  // ...
}

// 设置源优先级
export type SettingSource =
  | 'localSettings'      // .claude.json
  | 'projectSettings'    // claude.settings.json
  | 'userSettings'       // ~/.claude/settings.json
  | 'flagSettings'       // CLI --setting
  | 'policySettings'     // 托管策略
  | 'mdm'               // 移动设备管理 (macOS)
  | 'cliArg'            // CLI 参数

export const SETTING_SOURCES: SettingSource[] = [
  'cliArg',
  'flagSettings',
  'mdm',
  'policySettings',
  'projectSettings',
  'localSettings',
  'userSettings',
]
```

### 设置加载

```typescript
// utils/settings/settings.ts

// 加载所有设置
export async function loadAllSettings(): Promise<SettingsJson> {
  const sources = getEnabledSettingSources()
  let merged: SettingsJson = {}

  for (const source of sources) {
    const { settings, errors } = await loadSettingsForSource(source)
    if (errors.length > 0) {
      logValidationErrors(errors)
    }
    merged = mergeWith(merged, settings, settingsMergeCustomizer)
  }

  return merged
}

// 托管设置 (drop-in 模式)
export function loadManagedFileSettings(): {
  settings: SettingsJson | null
  errors: ValidationError[]
} {
  // 基础文件 + drop-in 目录
  const base = loadSettingsFile(getManagedSettingsFilePath())
  const dropInDir = getManagedSettingsDropInDir()

  const dropInFiles = readdirSync(dropInDir)
    .filter(d => d.name.endsWith('.json'))

  let merged = base
  for (const file of dropInFiles.sort()) {
    const content = loadSettingsFile(file)
    merged = mergeWith(merged, content, settingsMergeCustomizer)
  }

  return merged
}
```

### 设置缓存

```typescript
// utils/settings/settingsCache.ts

const settingsCache = new Map<SettingSource, SettingsJson>()
const parsedFileCache = new Map<string, ParsedFile>()

export function getCachedSettingsForSource(
  source: SettingSource,
): SettingsJson | undefined {
  return settingsCache.get(source)
}

export function setCachedSettingsForSource(
  source: SettingSource,
  settings: SettingsJson,
): void {
  settingsCache.set(source, settings)
}

export function resetSettingsCache(): void {
  settingsCache.clear()
  parsedFileCache.clear()
}
```

### 设置验证

```typescript
// utils/settings/validation.ts

export function validateSettings(
  settings: unknown,
): SettingsWithErrors {
  const result = SettingsSchema.safeParse(settings)

  if (result.success) {
    return { settings: result.data, errors: [] }
  }

  const errors: ValidationError[] = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))

  return { settings: {}, errors }
}

export function formatZodError(error: ZodError): string {
  return error.issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('\n')
}
```

---

## 五十四、安全验证

### 文件权限验证

```typescript
// tools/BashTool/bashPermissions.ts

export function checkBashPermission(
  command: string,
  context: ToolPermissionContext,
): PermissionResult {
  // 检查是否匹配允许规则
  for (const [source, rules] of Object.entries(context.alwaysAllowRules)) {
    for (const rule of rules) {
      if (matchCommand(command, rule)) {
        return { behavior: 'allow' }
      }
    }
  }

  // 检查是否匹配拒绝规则
  for (const [source, rules] of Object.entries(context.alwaysDenyRules)) {
    for (const rule of rules) {
      if (matchCommand(command, rule)) {
        return { behavior: 'deny', reason: 'Matched deny rule' }
      }
    }
  }

  // 默认询问
  return { behavior: 'ask' }
}

function matchCommand(command: string, rule: PermissionRule): boolean {
  if (rule.ruleContent === '*') return true
  return command.includes(rule.ruleContent)
}
```

### 路径验证

```typescript
// tools/BashTool/pathValidation.ts

export function validatePath(
  path: string,
  context: ToolPermissionContext,
): ValidationResult {
  // 检查路径是否在允许的目录内
  const allowedDirs = getAllowedDirectories(context)

  for (const dir of allowedDirs) {
    if (path.startsWith(dir)) {
      return { result: true }
    }
  }

  // 检查是否是危险路径
  if (isDangerousPath(path)) {
    return {
      result: false,
      message: `Path ${path} is not allowed`,
      errorCode: 403,
    }
  }

  return { result: true }
}

function isDangerousPath(path: string): boolean {
  const dangerous = [
    '/etc/passwd',
    '/etc/shadow',
    '~/.ssh/',
    '/sys/',
    '/proc/',
  ]
  return dangerous.some(d => path.includes(d))
}
```

### 只读验证

```typescript
// tools/BashTool/readOnlyValidation.ts

export function checkReadOnlyConstraints(
  command: string,
): { isReadOnly: boolean; reason?: string } {
  // 读取命令
  const readCommands = ['cat', 'head', 'tail', 'less', 'grep', 'find']
  const baseCommand = command.split('|')[0].trim().split(/\s+/)[0]

  if (readCommands.includes(baseCommand)) {
    return { isReadOnly: true }
  }

  // 写入命令
  const writeCommands = ['rm', 'mv', 'cp', 'chmod', 'chown']
  if (writeCommands.some(c => command.includes(` ${c} `))) {
    return { isReadOnly: false }
  }

  return { isReadOnly: true }
}
```

---

## 五十五、敏感操作警告

### 破坏性命令警告

```typescript
// tools/BashTool/destructiveCommandWarning.ts

const DESTRUCTIVE_COMMANDS = new Set([
  'rm -rf',
  'dd',
  'mkfs',
  ':(){:|:&};:',  // fork bomb
  '> /dev/sda',
])

export function checkDestructiveCommand(command: string): {
  isDestructive: boolean
  warning?: string
} {
  if (DESTRUCTIVE_COMMANDS.has(command)) {
    return {
      isDestructive: true,
      warning: `Destructive command detected: ${command}`,
    }
  }

  // 检查危险模式
  if (/rm\s+-rf\s+\//.test(command)) {
    return {
      isDestructive: true,
      warning: 'Recursive delete from root detected',
    }
  }

  return { isDestructive: false }
}
```

### Sed 编辑验证

```typescript
// tools/BashTool/sedValidation.ts

export function validateSedCommand(command: string): ValidationResult {
  // 危险模式: 直接修改原文件 (没有 -i 但有写操作)
  if (/\bsed\b.*-i\b.*'[^']*'/.test(command)) {
    // sed -i 直接修改
    return { result: true }
  }

  // 检查是否包含管道到危险命令
  if (/\|.*\bdd\b/.test(command)) {
    return {
      result: false,
      message: 'Pipe to dd is not allowed',
      errorCode: 403,
    }
  }

  return { result: true }
}
```

---

## 五十六、重要设计模式

### 1. 单例模式

```typescript
// 诊断服务单例
export class DiagnosticTrackingService {
  private static instance: DiagnosticTrackingService | undefined

  static getInstance(): DiagnosticTrackingService {
    if (!DiagnosticTrackingService.instance) {
      DiagnosticTrackingService.instance = new DiagnosticTrackingService()
    }
    return DiagnosticTrackingService.instance
  }
}
```

### 2. 工厂函数模式

```typescript
// 工厂函数代替类
export function createLSPServerManager(): LSPServerManager {
  const servers = new Map()

  return {
    initialize: async () => { /* ... */ },
    shutdown: async () => { /* ... */ },
    sendRequest: async (file, method, params) => { /* ... */ },
  }
}
```

### 3. 链式合并

```typescript
// 多源设置合并
function mergeSettings(...sources: SettingsJson[]): SettingsJson {
  return sources.reduce(
    (merged, current) => mergeWith(merged, current, settingsMergeCustomizer),
    {}
  )
}

// 自定义合并逻辑
function settingsMergeCustomizer(
  obj: unknown,
  src: unknown,
  key: string,
): unknown {
  if (key === 'mcpServers') {
    // MCP 服务器使用替换而非合并
    return src
  }
  // 默认合并行为
  return undefined
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **LSP 管理** | `services/lsp/LSPServerManager.ts` | LSP 服务器生命周期 |
| **诊断追踪** | `services/diagnosticTracking.ts` | 诊断信息管理 |
| **诊断注册** | `services/lsp/LSPDiagnosticRegistry.ts` | 诊断注册表 |
| **错误处理** | `utils/errors.ts` | 错误类型定义 |
| **设置管理** | `utils/settings/settings.ts` | 设置加载 |
| **设置缓存** | `utils/settings/settingsCache.ts` | 设置缓存 |
| **设置验证** | `utils/settings/validation.ts` | 设置验证 |
| **权限验证** | `tools/BashTool/bashPermissions.ts` | Bash 权限 |
| **路径验证** | `tools/BashTool/pathValidation.ts` | 路径安全 |
| **破坏性警告** | `tools/BashTool/destructiveCommandWarning.ts` | 危险命令检测 |