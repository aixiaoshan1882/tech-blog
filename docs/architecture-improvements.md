# 技术博客项目 - 架构改进

> 吸收 Claude Code 架构思想的改进

## 一、应用学到的轻量级 Store 模式

将 Zustand 替换为自定义 Store (类似 Claude Code 的 `createStore`):

```typescript
// src/store/createStore.ts
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
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

## 二、工具执行器 (参考 StreamingToolExecutor)

```typescript
// src/utils/toolExecutor.ts

type ToolStatus = 'queued' | 'executing' | 'completed'

interface TrackedTool {
  id: string
  name: string
  input: any
  status: ToolStatus
  promise?: Promise<any>
}

/**
 * 串行工具执行器 - 每次只执行一个工具
 */
export class SerialToolExecutor {
  private queue: TrackedTool[] = []
  private isExecuting = false

  async add(tool: { id: string; name: string; input: any; execute: () => Promise<any> }) {
    this.queue.push({
      id: tool.id,
      name: tool.name,
      input: tool.input,
      status: 'queued'
    })
    this.process()
  }

  private async process() {
    if (this.isExecuting || this.queue.length === 0) return
    
    this.isExecuting = true
    const tool = this.queue.shift()!
    tool.status = 'executing'

    try {
      const result = await tool.execute()
      tool.status = 'completed'
      return result
    } finally {
      this.isExecuting = false
      this.process() // 下一个
    }
  }
}
```

## 三、API 封装改进 (学习 MCP 客户端模式)

```typescript
// src/api/createApiClient.ts

type ApiTransport = 
  | { type: 'http'; baseURL: string }
  | { type: 'cloudflare'; worker: any }

interface ApiConfig {
  transport: ApiTransport
  timeout: number
  retries: number
}

/**
 * API 客户端 - 参考 MCP 客户端架构
 */
export function createApiClient(config: ApiConfig) {
  const { transport, timeout, retries } = config

  async function request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    let lastError: Error
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await doRequest(method, path, body)
        return response as T
      } catch (error) {
        lastError = error as Error
        if (isRetryable(error)) {
          await delay(Math.pow(2, i) * 1000) // 指数退避
          continue
        }
        throw error
      }
    }
    throw lastError!
  }

  function doRequest(method: string, path: string, body?: any) {
    // 实现...
  }

  return {
    get: (path: string) => request('GET', path),
    post: (path: string, body: any) => request('POST', path, body),
    put: (path: string, body: any) => request('PUT', path, body),
    delete: (path: string) => request('DELETE', path),
  }
}
```

## 四、渐进式初始化

```typescript
// src/main.ts

async function bootstrap() {
  // 1. 并行启动基础服务
  await Promise.all([
    loadSettings(),      // 设置加载
    loadUser(),         // 用户加载
    prefetchMcp(),     // MCP 预取
  ])

  // 2. 初始化 UI
  render()

  // 3. 后台任务
  startBackgroundTasks()
}
```

## 五、条件特性开关

```typescript
// src/utils/features.ts

// 开发环境特性
const features = {
  ENABLE_ANALYTICS: process.env.NODE_ENV === 'production',
  ENABLE_VOICE: true,
  ENABLE_TEAMMATES: false,
}

export function feature(name: keyof typeof features): boolean {
  return features[name] ?? false
}
```

---

## 学习来源对应

| 学习点 | Claude Code 源文件 | 应用位置 |
|--------|-------------------|----------|
| 轻量 Store | `state/store.ts` | `src/store/` |
| 工具执行器 | `services/tools/StreamingToolExecutor.ts` | 工具模块 |
| MCP 客户端 | `services/mcp/client.ts` | API 层 |
| Bridge | `bridge/replBridge.ts` | (可选) 远程 |
| 条件编译 | `main.tsx` | 打包配置 |