# Claude Code 源码深度学习笔记 (第二十一部分)

> Bridge API · 远程控制 · 权限桥 · 工作模式

---

## 一百一十二、Bridge API

### Bridge 配置

```typescript
// bridge/types.ts

export type BridgeConfig = {
  dir: string                    // 工作目录
  machineName: string           // 机器名称
  branch: string                // Git 分支
  gitRepoUrl: string | null     // Git 仓库 URL
  maxSessions: number           // 最大会话数
  spawnMode: SpawnMode           // spawn 模式
  sandbox: boolean               // 沙箱模式
  bridgeId: string              // Bridge 实例 ID
  workerType: string             // 工作类型
  environmentId: string         // 环境 ID
}

// Spawn 模式
export type SpawnMode =
  | 'single-session'   // 单会话模式
  | 'worktree'        // Worktree 隔离模式
  | 'same-dir'        // 共享目录模式
```

### Work 数据类型

```typescript
// Work 响应
export type WorkResponse = {
  id: string
  type: 'work'
  environment_id: string
  state: string
  data: WorkData
  secret: string  // base64url 编码的 JSON
  created_at: string
}

// Work 数据
export type WorkData = {
  type: 'session' | 'healthcheck'
  id: string
}

// Work Secret 内容
export type WorkSecret = {
  version: number
  session_ingress_token: string
  api_base_url: string
  sources: Array<{
    type: string
    git_info?: { type: string; repo: string; ref?: string; token?: string }
  }>
  auth: Array<{ type: string; token: string }>
  claude_code_args?: Record<string, string>
  mcp_config?: unknown
  environment_variables?: Record<string, string>
  use_code_sessions?: boolean
}
```

### Bridge 客户端

```typescript
// bridge/bridgeApi.ts

export interface BridgeApiClient {
  register(data: BridgeRegisterRequest): Promise<BridgeRegisterResponse>
  pollWork(environmentId: string): Promise<WorkResponse | null>
  ackWork(workId: string): Promise<void>
  completeSession(sessionId: string, status: SessionDoneStatus): Promise<void>
  sendSessionActivity(sessionId: string, activity: SessionActivity): Promise<void>
}

export function createBridgeApiClient(deps: BridgeApiDeps): BridgeApiClient {
  const baseUrl = deps.baseUrl

  async function request<T>(
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const accessToken = resolveAuth()

    try {
      const response = await axios({
        url: `${baseUrl}${path}`,
        headers: getHeaders(accessToken),
        ...options,
      })
      return response.data
    } catch (error) {
      if (isAuthError(error)) {
        const refreshed = await deps.onAuth401?.(accessToken)
        if (refreshed) {
          // 重试一次
          const response = await axios(...)
          return response.data
        }
      }
      throw error
    }
  }

  return {
    async register(data) {
      return request('/environments', { method: 'POST', data })
    },

    async pollWork(environmentId) {
      return request(`/environments/${environmentId}/work`)
    },

    async ackWork(workId) {
      return request(`/work/${workId}/ack`, { method: 'POST' })
    },

    async completeSession(sessionId, status) {
      return request(`/sessions/${sessionId}/complete`, {
        method: 'POST',
        data: { status },
      })
    },
  }
}
```

---

## 一百一十三、远程控制

### 远程控制流程

```typescript
// 远程控制连接流程
async function startRemoteControl(args: string[]): Promise<void> {
  // 1. 检查认证
  if (!getClaudeAIOAuthTokens()?.accessToken) {
    throw new Error(BRIDGE_LOGIN_ERROR)
  }

  // 2. 检查策略限制
  await waitForPolicyLimitsToLoad()
  if (!isPolicyAllowed('allow_remote_control')) {
    throw new Error('Remote Control is disabled by policy')
  }

  // 3. 创建 Bridge 配置
  const config: BridgeConfig = {
    dir: process.cwd(),
    machineName: getMachineName(),
    branch: getCurrentBranch(),
    gitRepoUrl: getGitRepoUrl(),
    maxSessions: 4,
    spawnMode: 'worktree',
    sandbox: true,
    bridgeId: generateUUID(),
    workerType: 'claude_code',
    environmentId: generateUUID(),
  }

  // 4. 启动 Bridge Main
  await bridgeMain([config])
}
```

### Bridge Main 循环

```typescript
// bridge/bridgeMain.ts

export async function bridgeMain(args: string[]): Promise<void> {
  const config = parseBridgeConfig(args)

  // 1. 注册环境
  const api = createBridgeApiClient({
    baseUrl: getBridgeApiUrl(),
    getAccessToken: () => getClaudeAIOAuthTokens()?.accessToken,
    runnerVersion: VERSION,
  })

  const registration = await api.register({
    machine_name: config.machineName,
    directory: config.dir,
    branch: config.branch,
    max_sessions: config.maxSessions,
    spawn_mode: config.spawnMode,
  })

  // 2. 轮询工作
  while (true) {
    const work = await api.pollWork(registration.environment_id)

    if (work?.type === 'healthcheck') {
      // 心跳响应
      await api.ackWork(work.id)
      continue
    }

    if (work?.type === 'session') {
      // 启动会话
      await handleSessionWork(work, config)
    }

    // 短暂休眠
    await sleep(1000)
  }
}
```

---

## 一百一十四、权限桥

### 权限同步

```typescript
// remote/remotePermissionBridge.ts

export type RemotePermissionRequest = {
  toolName: string
  input: Record<string, unknown>
  toolUseId: string
}

export async function syncPermissionToRemote(
  sessionId: string,
  request: RemotePermissionRequest,
): Promise<RemotePermissionResponse> {
  const response = await sendPermissionRequest(sessionId, {
    type: 'permission_request',
    requestId: generateUUID(),
    request,
  })

  return new Promise((resolve, reject) => {
    // 等待响应
    const timeout = setTimeout(() => {
      reject(new Error('Permission request timeout'))
    }, 30000)

    pendingPermissions.set(response.requestId, (result) => {
      clearTimeout(timeout)
      resolve(result)
    })
  })
}
```

### 权限响应处理

```typescript
// 处理权限响应
function handlePermissionResponse(
  response: RemotePermissionResponse,
): void {
  const handler = pendingPermissions.get(response.requestId)

  if (handler) {
    handler(response)
    pendingPermissions.delete(response.requestId)
  }
}
```

---

## 一百一十五、会话活动追踪

### 活动类型

```typescript
// bridge/types.ts

export type SessionActivityType =
  | 'tool_start'   // 工具开始
  | 'text'         // 文本输出
  | 'result'       // 结果
  | 'error'        // 错误

export type SessionActivity = {
  type: SessionActivityType
  summary: string  // 如 "Editing src/foo.ts"
  timestamp: number
}

// 发送会话活动
async function sendActivity(
  sessionId: string,
  activity: SessionActivity,
): Promise<void> {
  await api.sendSessionActivity(sessionId, activity)
}

// 使用
await sendActivity(sessionId, {
  type: 'tool_start',
  summary: `Running ${toolName}`,
  timestamp: Date.now(),
})
```

---

## 一百一十六、重要设计模式

### 1. 安全 ID 验证

```typescript
// 验证 Bridge ID 防止路径遍历
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export function validateBridgeId(id: string, label: string): string {
  if (!id || !SAFE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${label}: contains unsafe characters`)
  }
  return id
}
```

### 2. 指数退避重试

```typescript
// API 请求重试
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (isFatalError(error)) {
        throw error
      }

      // 指数退避
      await sleep(Math.min(1000 * Math.pow(2, i), 10000))
    }
  }

  throw lastError
}
```

### 3. 心跳保活

```typescript
// 心跳机制
async function startHealthcheck(
  environmentId: string,
  intervalMs = 30000,
): Promise<void> {
  while (true) {
    const work = await api.pollWork(environmentId)

    if (work?.type === 'healthcheck') {
      await api.ackWork(work.id)
    }

    await sleep(intervalMs)
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Bridge 类型** | `bridge/types.ts` | 类型定义 |
| **Bridge API** | `bridge/bridgeApi.ts` | API 客户端 |
| **Bridge Main** | `bridge/bridgeMain.ts` | 主循环 |
| **会话管理** | `bridge/sessionRunner.ts` | 会话运行 |
| **权限桥** | `remote/remotePermissionBridge.ts` | 权限同步 |
| **WebSocket** | `remote/SessionsWebSocket.ts` | WS 连接 |
| **Direct Connect** | `server/directConnectManager.ts` | 直连 |