# Claude Code 源码深度学习笔记 (第二十部分)

> Agent SDK · 远程会话 · Direct Connect · 核心类型

---

## 一百零六、Agent SDK

### SDK 核心类型

```typescript
// entrypoints/sdk/coreTypes.ts

// 钩子事件类型
export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'PreCompact',
  'PostCompact',
  'PermissionRequest',
  'PermissionDenied',
  'Setup',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
  'Elicitation',
  'ElicitationResult',
  'ConfigChange',
  'WorktreeCreate',
  'WorktreeRemove',
  'InstructionsLoaded',
  'CwdChanged',
  'FileChanged',
] as const

// 退出原因
export const EXIT_REASONS = [
  'clear',
  'resume',
  'logout',
  'prompt_input_exit',
  'other',
  'bypass_permissions_disabled',
] as const
```

### SDK 消息类型

```typescript
// entrypoints/sdk/coreTypes.ts

export type SDKMessage =
  | SDKUserMessage
  | SDKResultMessage
  | SDKSessionInfo

export interface SDKUserMessage {
  type: 'user_message'
  message: {
    role: 'user'
    content: string
  }
}

export interface SDKResultMessage {
  type: 'result'
  result: CallToolResult
}

export interface SDKSessionInfo {
  type: 'session_info'
  session: {
    id: string
    model: string
    tools: string[]
  }
}
```

### SDK MCP 工具定义

```typescript
// SDK 工具定义
export type SdkMcpToolDefinition<Schema extends AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
  annotations?: ToolAnnotations
  searchHint?: string
  handler: (
    args: InferShape<Schema>,
    extra: unknown,
  ) => Promise<CallToolResult>
}

// 示例: 创建 MCP 工具
export function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: {
    annotations?: ToolAnnotations
    searchHint?: string
    alwaysLoad?: boolean
  },
): SdkMcpToolDefinition<Schema> {
  return {
    name,
    description,
    inputSchema,
    handler,
    ...extras,
  }
}
```

---

## 一百零七、远程会话管理

### 远程会话配置

```typescript
// remote/RemoteSessionManager.ts

export type RemoteSessionConfig = {
  sessionId: string
  getAccessToken: () => string
  orgUuid: string
  hasInitialPrompt?: boolean  // 是否有初始提示
  viewerOnly?: boolean        // 纯查看器模式
}

export type RemoteSessionCallbacks = {
  onMessage: (message: SDKMessage) => void
  onPermissionRequest: (
    request: SDKControlPermissionRequest,
    requestId: string,
  ) => void
  onPermissionCancelled?: (requestId: string, toolUseId?: string) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}
```

### 权限响应

```typescript
// 远程权限响应类型
export type RemotePermissionResponse =
  | {
      behavior: 'allow'
      updatedInput: Record<string, unknown>
    }
  | {
      behavior: 'deny'
      message: string
    }

// 权限请求处理
async function handlePermissionRequest(
  request: SDKControlPermissionRequest,
  requestId: string,
): Promise<RemotePermissionResponse> {
  // 发送到 UI 等待用户响应
  const response = await waitForUserPermission(request)

  return {
    behavior: response.approved ? 'allow' : 'deny',
    updatedInput: response.updatedInput ?? {},
  }
}
```

### WebSocket 会话

```typescript
// remote/SessionsWebSocket.ts

export class SessionsWebSocket {
  private ws: WebSocket | null = null

  constructor(
    private config: RemoteSessionConfig,
    private callbacks: RemoteSessionCallbacks,
  ) {}

  connect(): void {
    const url = `wss://api.claude.ai/sessions/${this.config.sessionId}/ws`

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.config.getAccessToken()}`,
      },
    })

    this.ws.addEventListener('open', () => {
      this.callbacks.onConnected?.()
    })

    this.ws.addEventListener('message', (event) => {
      const message = parseMessage(event.data)
      this.routeMessage(message)
    })

    this.ws.addEventListener('close', () => {
      this.callbacks.onDisconnected?.()
    })
  }

  send(message: SDKMessage): void {
    this.ws?.send(JSON.stringify(message))
  }

  private routeMessage(message: SDKMessage | SDKControlRequest): void {
    if (isSDKMessage(message)) {
      this.callbacks.onMessage(message)
    } else if (message.type === 'control_request') {
      if (message.request.type === 'permission') {
        this.callbacks.onPermissionRequest(
          message.request,
          message.requestId,
        )
      }
    }
  }
}
```

---

## 一百零八、Direct Connect

### Direct Connect 配置

```typescript
// server/directConnectManager.ts

export type DirectConnectConfig = {
  serverUrl: string
  sessionId: string
  wsUrl: string
  authToken?: string
}

export type DirectConnectCallbacks = {
  onMessage: (message: SDKMessage) => void
  onPermissionRequest: (
    request: SDKControlPermissionRequest,
    requestId: string,
  ) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}
```

### Direct Connect 会话管理器

```typescript
// server/directConnectManager.ts

export class DirectConnectSessionManager {
  private ws: WebSocket | null = null

  constructor(
    private config: DirectConnectConfig,
    private callbacks: DirectConnectCallbacks,
  ) {}

  connect(): void {
    const headers: Record<string, string> = {}

    if (this.config.authToken) {
      headers['authorization'] = `Bearer ${this.config.authToken}`
    }

    this.ws = new WebSocket(this.config.wsUrl, {
      headers,
    } as unknown as string[])

    this.ws.addEventListener('open', () => {
      this.callbacks.onConnected?.()
    })

    this.ws.addEventListener('message', (event) => {
      const lines = data.split('\n').filter(l => l.trim())

      for (const line of lines) {
        const raw = jsonParse(line)
        if (isStdoutMessage(raw)) {
          this.callbacks.onMessage(raw)
        }
      }
    })
  }

  send(message: SDKMessage): void {
    this.ws?.send(jsonStringify(message))
  }

  disconnect(): void {
    this.ws?.close()
  }
}
```

---

## 一百零九、类型生成

### Zod Schema 生成

```typescript
// entrypoints/sdk/coreSchemas.ts

// Zod schemas 用于运行时验证
export const SDKMessageSchema = z.discriminatedUnion('type', [
  SDKUserMessageSchema,
  SDKResultMessageSchema,
  SDKSessionInfoSchema,
])

export const SDKControlRequestSchema = z.discriminatedUnion('type', [
  SDKControlPermissionRequestSchema,
  SDKControlCancelRequestSchema,
])

// 生成类型 (运行 bun scripts/generate-sdk-types.ts)
export type SDKMessage = z.infer<typeof SDKMessageSchema>
```

### 生成类型文件

```typescript
// entrypoints/sdk/coreTypes.generated.ts

// 从 coreSchemas.ts 自动生成
// 不要手动编辑此文件

export type SDKMessage =
  | SDKUserMessage
  | SDKResultMessage
  | SDKSessionInfo

export interface SDKUserMessage {
  type: 'user_message'
  message: {
    role: 'user'
    content: string
  }
}

// ...
```

---

## 一百一十、重要设计模式

### 1. WebSocket 重连

```typescript
// 重连逻辑
class ReconnectingWebSocket {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private baseDelayMs = 1000

  async connect(): Promise<void> {
    try {
      await this.establishConnection()
      this.reconnectAttempts = 0
    } catch (error) {
      await this.handleConnectionError(error)
    }
  }

  private async handleConnectionError(error: Error): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw error
    }

    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, this.reconnectAttempts),
      30000,
    )

    await sleep(delay)
    this.reconnectAttempts++

    return this.connect()
  }
}
```

### 2. 消息路由

```typescript
// 消息类型守卫
function isSDKMessage(
  message: SDKMessage | SDKControlRequest | SDKControlResponse,
): message is SDKMessage {
  return (
    message.type !== 'control_request' &&
    message.type !== 'control_response' &&
    message.type !== 'control_cancel_request'
  )
}

// 路由消息
function routeMessage(
  message: SDKMessage | SDKControlRequest,
): void {
  if (isSDKMessage(message)) {
    // 处理 SDK 消息
    handleSDKMessage(message)
  } else if (message.type === 'control_request') {
    // 处理控制请求
    handleControlRequest(message)
  }
}
```

### 3. SDK MCP 服务器

```typescript
// 创建 MCP 服务器
export function createSdkMcpServer(options: CreateSdkMcpServerOptions) {
  return {
    name: options.name,
    version: options.version ?? '1.0.0',
    tools: options.tools ?? [],

    // 处理工具调用
    async handleToolCall(name: string, args: unknown) {
      const tool = this.tools.find(t => t.name === name)
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
      }

      return tool.handler(args, {})
    },
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **SDK 类型** | `entrypoints/sdk/coreTypes.ts` | 核心类型 |
| **SDK Schema** | `entrypoints/sdk/coreSchemas.ts` | Zod schemas |
| **Agent SDK** | `entrypoints/agentSdkTypes.ts` | SDK 入口 |
| **远程会话** | `remote/RemoteSessionManager.ts` | 远程管理 |
| **WebSocket** | `remote/SessionsWebSocket.ts` | WS 连接 |
| **Direct Connect** | `server/directConnectManager.ts` | 直连管理 |
| **权限桥** | `remote/remotePermissionBridge.ts` | 权限同步 |