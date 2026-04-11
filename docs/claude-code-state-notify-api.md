# Claude Code 源码深度学习笔记 (第二十八部分)

> 状态管理·通知系统·API 客户端·服务层架构

---

## 一百五十八、状态管理 (Store)

### 简单 Store 实现

```typescript
// state/store.ts

type Listener = () => void
type OnChange<T> = (args: { newState: T; oldState: T }) => void

export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(
  initialState: T,
  onChange?: OnChange<T>,
): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,

    setState: (updater: (prev: T) => T) => {
      const prev = state
      const next = updater(prev)

      // 相同引用，跳过
      if (Object.is(next, prev)) return

      state = next
      onChange?.({ newState: next, oldState: prev })

      for (const listener of listeners) {
        listener()
      }
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

### AppState 类型

```typescript
// state/AppStateStore.ts

export type AppState = {
  // 通知
  notifications: {
    current: Notification | null
    queue: Notification[]
  }

  // Speculation (推测执行)
  speculation: SpeculationState

  // 任务状态
  task: TaskState

  // MCP 服务器
  mcpServers: MCPServerConnection[]

  // 插件
  plugins: {
    loaded: LoadedPlugin[]
    errors: PluginError[]
  }

  // 设置
  settings: SettingsJson
  permissionMode: PermissionMode

  // 主题
  theme: ThemeName

  // ... 更多字段
}
```

---

## 一百五十九、通知系统

### 通知队列

```typescript
// context/notifications.tsx

type Priority = 'low' | 'medium' | 'high' | 'immediate'

type BaseNotification = {
  key: string
  invalidates?: string[]  // 使其他通知失效
  priority: Priority
  timeoutMs?: number
  fold?: (acc: Notification, incoming: Notification) => Notification
}

type TextNotification = BaseNotification & {
  text: string
  color?: keyof Theme
}

type JSXNotification = BaseNotification & {
  jsx: React.ReactNode
}

export type Notification = TextNotification | JSXNotification

const DEFAULT_TIMEOUT_MS = 8000
```

### 通知处理

```typescript
export function useNotifications(): {
  addNotification: AddNotificationFn
  removeNotification: RemoveNotificationFn
} {
  const store = useAppStateStore()
  const setAppState = useSetAppState()

  const processQueue = useCallback(() => {
    setAppState(prev => {
      const next = getNext(prev.notifications.queue)

      // 忙或队列空
      if (prev.notifications.current !== null || !next) {
        return prev
      }

      // 设置定时清除
      currentTimeoutId = setTimeout((setAppState, nextKey, processQueue) => {
        currentTimeoutId = null
        setAppState(prev => {
          if (prev.notifications.current?.key !== nextKey) {
            return prev
          }
          return {
            ...prev,
            notifications: {
              ...prev.notifications,
              current: null,
            },
          }
        })
        processQueue()
      }, next.timeoutMs ?? DEFAULT_TIMEOUT_MS)

      return {
        ...prev,
        notifications: {
          queue: prev.notifications.queue.filter(_ => _ !== next),
          current: next,
        },
      }
    })
  }, [setAppState])

  // 添加通知
  const addNotification = useCallback((notif: Notification) => {
    if (notif.priority === 'immediate') {
      // 立即显示
      currentTimeoutId?.clearTimeout()
    }
    // ...
  }, [])

  return { addNotification, removeNotification }
}
```

---

## 一百六十、API 客户端

### 多后端支持

```typescript
// services/api/client.ts

import Anthropic from '@anthropic-ai/sdk'

// 环境变量配置
type ClientConfig = {
  // 直接 API
  // - ANTHROPIC_API_KEY

  // AWS Bedrock
  // - AWS credentials via aws-sdk
  // - AWS_REGION

  // Azure Foundry
  // - ANTHROPIC_FOUNDRY_RESOURCE
  // - ANTHROPIC_FOUNDRY_BASE_URL
  // - ANTHROPIC_FOUNDRY_API_KEY or Azure AD

  // Vertex AI
  // - VERTEX_REGION_* (模型特定区域)
  // - CLOUD_ML_REGION
  // - ANTHROPIC_VERTEX_PROJECT_ID
}

export function createApiClient(): Anthropic {
  const provider = getAPIProvider()

  switch (provider) {
    case 'anthropic':
      return createAnthropicClient()
    case 'aws':
      return createAWSClient()
    case 'azure':
      return createAzureClient()
    case 'vertex':
      return createVertexClient()
  }
}
```

### 认证处理

```typescript
// 获取 API Key
async function getApiKey(): Promise<string> {
  // 1. 尝试直接 API Key
  const directKey = getAnthropicApiKey()
  if (directKey) return directKey

  // 2. Claude.ai OAuth
  const oauthTokens = getClaudeAIOAuthTokens()
  if (oauthTokens) {
    await checkAndRefreshOAuthTokenIfNeeded()
    return oauthTokens.accessToken
  }

  // 3. AWS Bedrock
  if (isAWSProvider()) {
    return refreshAndGetAwsCredentials()
  }

  // 4. GCP Vertex
  if (isVertexProvider()) {
    await refreshGcpCredentialsIfNeeded()
  }

  throw new Error('No valid API credentials found')
}
```

---

## 一百六十一、服务层架构

### 服务目录结构

```
services/
├── api/                    # API 客户端
│   ├── client.ts           # 主客户端
│   ├── claude.ts          # Claude 特定
│   ├── filesApi.ts         # 文件 API
│   └── withRetry.ts       # 重试封装
├── analytics/              # 分析服务
├── mcp/                    # MCP 服务器
├── oauth/                  # OAuth 认证
├── plugins/                # 插件系统
├── settingsSync/           # 设置同步
├── teamMemorySync/         # 团队记忆同步
└── tools/                  # 工具服务
```

### 分析服务

```typescript
// services/analytics/index.ts

export function logEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  // 发送到分析后端
  sendToAnalytics({
    event,
    properties,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    userId: getUserId(),
  })
}

// GrowthBook 特性开关
export function getFeatureValue<T>(
  key: string,
  defaultValue: T,
): T {
  const features = getGrowthBookFeatures()
  const feature = features[key]

  if (!feature) return defaultValue

  // 类型检查
  if (typeof feature.value !== typeof defaultValue) {
    return defaultValue
  }

  return feature.value as T
}
```

---

## 一百六十二、API 重试机制

### 重试封装

```typescript
// services/api/withRetry.ts

const RETRY_DELAYS = [1000, 2000, 4000, 8000]  // 指数退避

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    shouldRetry?: (error: unknown) => boolean
  } = {},
): Promise<T> {
  const { maxRetries = 3, shouldRetry = isRetryableError } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error
      }

      const delay = RETRY_DELAYS[attempt] ?? 8000
      await sleep(delay)
    }
  }

  throw new Error('Unreachable')
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof NetworkError) return true
  if (error instanceof RateLimitError) return true
  if (error instanceof ServerError) return true
  return false
}
```

---

## 一百六十三、速率限制

### 速率限制处理

```typescript
// services/rateLimitMessages.ts

type RateLimitState = {
  remaining: number
  resetAt: number
  total: number
}

export function useRateLimit(): {
  canMakeRequest: () => boolean
  recordUsage: (count: number) => void
  waitForReset: () => Promise<void>
} {
  const state = useRef<RateLimitState>({
    remaining: 1000,
    resetAt: 0,
    total: 1000,
  })

  const canMakeRequest = () => {
    if (state.current.remaining <= 0) {
      return Date.now() >= state.current.resetAt
    }
    return true
  }

  const recordUsage = (count: number) => {
    state.current.remaining -= count
  }

  const waitForReset = async () => {
    const waitTime = state.current.resetAt - Date.now()
    if (waitTime > 0) {
      await sleep(waitTime)
    }
  }

  return { canMakeRequest, recordUsage, waitForReset }
}
```

---

## 一百六十四、插件系统

### 插件加载

```typescript
// services/plugins/pluginManager.ts

export type LoadedPlugin = {
  id: string
  name: string
  version: string
  tools: Tool[]
  hooks: Hook[]
}

export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const pluginDirs = getPluginDirectories()

  const plugins = await Promise.all(
    pluginDirs.map(async dir => {
      const manifest = await loadManifest(dir)
      if (!manifest) return null

      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        tools: await loadTools(dir, manifest),
        hooks: await loadHooks(dir, manifest),
      }
    }),
  )

  return plugins.filter(Boolean)
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Store** | `state/store.ts` | 简单状态容器 |
| **AppState** | `state/AppStateStore.ts` | 应用状态类型 |
| **通知** | `context/notifications.tsx` | 通知队列 |
| **API 客户端** | `services/api/client.ts` | 多后端 API |
| **分析** | `services/analytics/` | 事件跟踪 |
| **重试** | `services/api/withRetry.ts` | 指数退避 |
| **速率限制** | `services/rateLimitMessages.ts` | 限流处理 |
| **插件** | `services/plugins/` | 插件加载 |