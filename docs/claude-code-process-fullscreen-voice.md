# Claude Code 源码深度学习笔记 (第三十七部分)

> 进程处理·全屏检测·插件安装·MCP连接管理·记忆提取·Analytics·Voice·API重试

---

## 二百二十八、进程处理 (Process Utils)

### EPIPE 处理与标准输出

```typescript
// utils/process.ts

// 处理管道断开错误 (如 `claude -p | head -1`)
function handleEPIPE(
  stream: NodeJS.WriteStream,
): (err: NodeJS.ErrnoException) => void {
  return (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') {
      stream.destroy()
    }
  }
}

// 注册进程输出错误处理器
export function registerProcessOutputErrorHandlers(): void {
  process.stdout.on('error', handleEPIPE(process.stdout))
  process.stderr.on('error', handleEPIPE(process.stderr))
}

// 写入 stdout/stderr
export function writeToStdout(data: string): void {
  if (!stream.destroyed) {
    stream.write(data)
  }
}

// 等待 stdin 数据，超时返回 true
export function peekForStdinData(
  stream: NodeJS.EventEmitter,
  ms: number,
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const done = (timedOut: boolean) => {
      clearTimeout(peek)
      stream.off('end', onEnd)
      stream.off('data', onFirstData)
      resolve(timedOut)
    }
    const onEnd = () => done(false)
    const onFirstData = () => clearTimeout(peek)
    const peek = setTimeout(done, ms, true)
    stream.once('end', onEnd)
    stream.once('data', onFirstData)
  })
}
```

---

## 二百二十九、全屏检测 (Fullscreen)

### iTerm2 tmux 控制模式检测

```typescript
// utils/fullscreen.ts

// 环境变量启发式判断 iTerm2 的 tmux 集成模式
function isTmuxControlModeEnvHeuristic(): boolean {
  if (!process.env.TMUX) return false
  if (process.env.TERM_PROGRAM !== 'iTerm.app') return false
  // 常规 tmux 设置 TERM 为 screen-* 或 tmux-*
  // -CC 模式下 iTerm2 设置自己的 TERM (xterm-*)
  const term = process.env.TERM ?? ''
  return !term.startsWith('screen') && !term.startsWith('tmux')
}

// 同步探测 tmux 控制模式
function probeTmuxControlModeSync(): void {
  // 使用 spawnSync 因为答案影响是否进入全屏
  // 异步探测会与 React 渲染竞争导致问题
  try {
    const result = spawnSync(
      'tmux',
      ['display-message', '-p', '#{client_control_mode}'],
      { encoding: 'utf8', timeout: 2000 },
    )
    tmuxControlModeProbed = result.stdout.trim() === '1'
  } catch {
    tmuxControlModeProbed = false
  }
}

// 进入全屏
export function enterFullscreen(): void {
  // 禁用 tmux 鼠标模式
  // ...
}

// 检测全屏状态
export function isFullscreen(): boolean {
  // ...
}
```

---

## 二百三十、插件安装管理器

### 后台插件安装

```typescript
// services/plugins/PluginInstallationManager.ts

/**
 * 后台插件和市场安装管理器
 * 处理来自可信来源的自动安装，不阻塞启动
 */

// 更新市场安装状态
function updateMarketplaceStatus(
  setAppState: SetAppState,
  name: string,
  status: 'pending' | 'installing' | 'installed' | 'failed',
  error?: string,
): void {
  setAppState(prevState => ({
    ...prevState,
    plugins: {
      ...prevState.plugins,
      installationStatus: {
        ...prevState.plugins.installationStatus,
        marketplaces: prevState.plugins.installationStatus.marketplaces.map(
          m => (m.name === name ? { ...m, status, error } : m)
        ),
      },
    },
  }))
}

// 执行后台插件安装
export async function performBackgroundPluginInstallations(
  setAppState: SetAppState,
): Promise<void> {
  // 计算差异
  const declared = getDeclaredMarketplaces()
  const materialized = await loadKnownMarketplacesConfig().catch(() => ({}))
  const diff = diffMarketplaces(declared, materialized)

  // 初始化待安装状态
  setAppState(prev => ({
    ...prev,
    plugins: {
      ...prev.plugins,
      installationStatus: {
        ...prev.plugins.installationStatus,
        marketplaces: pendingNames.map(name => ({
          name,
          status: 'pending' as const,
        })),
      },
    },
  }))

  // 协调市场
  await reconcileMarketplaces(diff, {
    onProgress: (name, status) => {
      updateMarketplaceStatus(setAppState, name, status)
    },
  })
}
```

---

## 二百三十一、MCP 连接管理器

### React Context 管理

```typescript
// services/mcp/MCPConnectionManager.tsx

interface MCPConnectionContextValue {
  reconnectMcpServer: (serverName: string) => Promise<{
    client: MCPServerConnection
    tools: Tool[]
    commands: Command[]
    resources?: ServerResource[]
  }>
  toggleMcpServer: (serverName: string) => Promise<void>
}

const MCPConnectionContext = createContext<MCPConnectionContextValue | null>(null)

// 重连 MCP 服务器
export function useMcpReconnect() {
  const context = useContext(MCPConnectionContext)
  if (!context) {
    throw new Error('useMcpReconnect must be used within MCPConnectionManager')
  }
  return context.reconnectMcpServer
}

// 切换 MCP 服务器
export function useMcpToggleEnabled() {
  const context = useContext(MCPConnectionContext)
  if (!context) {
    throw new Error('useMcpToggleEnabled must be used within MCPConnectionManager')
  }
  return context.toggleMcpServer
}

// 提供商组件
export function MCPConnectionManager({
  children,
  dynamicMcpConfig,
  isStrictMcpConfig,
}) {
  const {
    reconnectMcpServer,
    toggleMcpServer,
  } = useManageMCPConnections(dynamicMcpConfig, isStrictMcpConfig)

  const value = useMemo(
    () => ({ reconnectMcpServer, toggleMcpServer }),
    [reconnectMcpServer, toggleMcpServer],
  )

  return (
    <MCPConnectionContext.Provider value={value}>
      {children}
    </MCPConnectionContext.Provider>
  )
}
```

---

## 二百三十二、记忆提取 (Extract Memories)

### 自动记忆提取

```typescript
// services/extractMemories/extractMemories.ts

/**
 * 从当前会话记录中提取持久记忆
 * 并写入自动记忆目录 (~/.claude/projects/<path>/memory/)
 *
 * 通过 handleStopHooks 在每次查询循环结束时运行
 * 使用 fork agent 模式 - 共享父级的 prompt cache
 */

// 检查消息是否对模型可见
function isModelVisibleMessage(message: Message): boolean {
  return message.type === 'user' || message.type === 'assistant'
}

// 运行记忆提取
async function runExtraction(
  transcript: Message[],
  context: REPLHookContext,
): Promise<void> {
  // 构建提取提示
  const prompt = buildExtractAutoOnlyPrompt(transcript)

  // 使用 fork agent 执行
  const result = await runForkedAgent({
    prompt,
    name: 'extract-memory',
    agent: 'auto-memory',
  })

  // 写入记忆文件
  for (const [path, content] of Object.entries(result.files)) {
    await writeFile(join(getAutoMemPath(), path), content)
  }

  // 创建记忆保存消息
  const memorySavedMsg = createMemorySavedMessage(result.summary)
  context.addAssistantMessage(memorySavedMsg)
}

// 初始化记忆提取
export function initExtractMemories(): (context: REPLHookContext) => Promise<void> {
  return async (context: REPLHookContext) => {
    if (!isAutoMemoryEnabled()) return
    if (getIsRemoteMode()) return

    try {
      await runExtraction(context.messages, context)
    } catch (error) {
      logError(error as Error)
    }
  }
}
```

---

## 二百三十三、GrowthBook Feature Flag

### Feature Flag 系统

```typescript
// services/analytics/growthbook.ts

/**
 * GrowthBook SDK 集成用于 Feature Flag 管理
 */

// 用户属性
export type GrowthBookUserAttributes = {
  id: string
  sessionId: string
  deviceID: string
  platform: 'win32' | 'darwin' | 'linux'
  apiBaseUrlHost?: string
  organizationUUID?: string
  accountUUID?: string
  userType?: string
  subscriptionType?: string
  rateLimitTier?: string
  firstTokenTime?: number
  email?: string
  appVersion?: string
  github?: GitHubActionsMetadata
}

// 初始化 GrowthBook 客户端
export function initGrowthBook(): GrowthBook {
  const gb = new GrowthBook({
    apiHost: 'https://cdn.growthbook.io',
    clientKey: getGrowthBookClientKey(),
    enableRetries: true,
    enableDebugMode: isEnvTruthy('GROWTHBOOK_DEBUG'),
  })

  // 设置用户属性
  gb.setAttributes(userAttributes)

  // 设置远程 eval
  if (feature('GROWTHBOOK_REMOTE_EVAL')) {
    gb.useRemoteEval()
  }

  return gb
}

// 获取特性值
export function getFeatureValue<T>(
  featureName: string,
  defaultValue: T,
): T {
  const value = client?.getFeatureValue(featureName, defaultValue)
  return value ?? defaultValue
}

// 获取特性值 (可能为 null/stale)
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  featureName: string,
  defaultValue: T,
): T | null {
  return client?.getFeatureValue(featureName, defaultValue) ?? null
}
```

---

## 二百三十四、Voice 服务

### 语音录制

```typescript
// services/voice.ts

// 录音采样率
const RECORDING_SAMPLE_RATE = 16000
const RECORDING_CHANNELS = 1

// SoX 静音检测
const SILENCE_DURATION_SECS = '2.0'
const SILENCE_THRESHOLD = '3%'

// 懒加载原生音频模块
type AudioNapi = typeof import('audio-capture-napi')
let audioNapi: AudioNapi | null = null
let audioNapiPromise: Promise<AudioNapi> | null = null

function loadAudioNapi(): Promise<AudioNapi> {
  audioNapiPromise ??= (async () => {
    const t0 = Date.now()
    const mod = await import('audio-capture-napi')
    mod.isNativeAudioAvailable()  // 触发延迟加载
    audioNapi = mod
    logForDebugging(`[voice] audio-capture-napi loaded in ${Date.now() - t0}ms`)
    return mod
  })()
  return audioNapiPromise
}

// 检查录音可用性
function checkRecordingAvailability(): Promise<boolean> {
  if (getPlatform() === 'darwin') {
    // macOS: 使用原生 CoreAudio
    return loadAudioNapi().then(napi => napi.isNativeAudioAvailable())
  }
  if (getPlatform() === 'linux') {
    // Linux: 优先 SoX，回退到 arecord
    if (hasCommand('rec')) return Promise.resolve(true)
    return probeArecord().then(r => r.ok)
  }
  return Promise.resolve(false)
}

// 开始录音
async function startRecording(): Promise<void> {
  const available = await checkRecordingAvailability()
  if (!available) {
    throw new Error('Recording not available')
  }

  // 使用原生模块或 SoX 录音
  // ...
}
```

---

## 二百三十五、API 重试逻辑

### 指数退避重试

```typescript
// services/api/withRetry.ts

const DEFAULT_MAX_RETRIES = 10
const FLOOR_OUTPUT_TOKENS = 3000
const MAX_529_RETRIES = 3
export const BASE_DELAY_MS = 500

// 前台查询源 (用户等待结果) - 会在 529 时重试
const FOREGROUND_529_RETRY_SOURCES = new Set<QuerySource>([
  'repl_main_thread',
  'repl_main_thread:outputStyle:custom',
  'sdk',
  'agent:custom',
  'agent:default',
  'compact',
  'hook_agent',
  'auto_mode',  // 安全分类器必须完成
])

// 获取重试延迟
export function getRetryDelay(
  attempt: number,
  baseDelay: number = BASE_DELAY_MS,
): number {
  // 指数退避: baseDelay * 2^attempt + jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  const jitter = Math.random() * 1000
  return Math.min(exponentialDelay + jitter, 30_000)  // 最大 30 秒
}

// 执行带重试的 API 调用
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    onRetry?: (error: Error, attempt: number) => void
  },
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= (options.maxRetries ?? DEFAULT_MAX_RETRIES); attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // 检查是否应该重试
      if (!shouldRetry(error, attempt)) {
        throw error
      }

      // 特殊处理 529 错误
      if (isError(error, '529') && !FOREGROUND_529_RETRY_SOURCES.has(source)) {
        throw error
      }

      options.onRetry?.(lastError, attempt)

      // 等待后重试
      await sleep(getRetryDelay(attempt))
    }
  }

  throw lastError!
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Process Utils** | `utils/process.ts` | EPIPE 处理，stdout/stderr |
| **Fullscreen** | `utils/fullscreen.ts` | iTerm2 tmux 控制模式检测 |
| **Plugins** | `services/plugins/` | 后台插件安装管理 |
| **MCP Manager** | `services/mcp/MCPConnectionManager.tsx` | MCP 连接 React Context |
| **Extract Memories** | `services/extractMemories/` | 自动记忆提取 |
| **GrowthBook** | `services/analytics/growthbook.ts` | Feature Flag 系统 |
| **Voice** | `services/voice.ts` | 语音录制服务 |
| **API Retry** | `services/api/withRetry.ts` | 指数退避重试 |