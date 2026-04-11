# Claude Code 源码深度学习笔记 (第四十二部分)

> API·Client·SessionMemory·IDE·AgentTool·PlanAgent

---

## 二百六十九、API Client

### 多后端 API 客户端

```typescript
// services/api/client.ts

/**
 * API 客户端支持多后端:
 * - Anthropic Direct API (ANTHROPIC_API_KEY)
 * - AWS Bedrock
 * - Azure Foundry
 * - Google Vertex AI
 */

// 创建 Anthropic 客户端
function createAnthropicClient(): Anthropic {
  const provider = getAPIProvider()

  switch (provider) {
    case 'anthropic':
      return new Anthropic({ apiKey: getAnthropicApiKey() })

    case 'bedrock':
      return new Anthropic({
        apiKey: 'placeholder', // AWS credentials via environment
        baseURL: `https://bedrock.${getAWSRegion()}.amazonaws.com`,
      })

    case 'azure':
      return new Anthropic({
        apiKey: process.env.ANTHROPIC_FOUNDRY_API_KEY,
        baseURL: `${process.env.ANTHROPIC_FOUNDRY_BASE_URL}/anthropic/v1/messages`,
      })

    case 'vertex':
      const { GoogleAuth } = await import('google-auth-library')
      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
      })
      return new Anthropic({
        auth: auth,
        baseURL: `https://${getVertexRegionForModel(model)}.aiplatform.googleapis.com/v1`,
      })
  }
}

// 获取认证头
async function getAuthHeaders(): Promise<Record<string, string>> {
  const provider = getAPIProvider()

  if (provider === 'anthropic') {
    const tokens = await getClaudeAIOAuthTokens()
    if (tokens) {
      return { Authorization: `Bearer ${tokens.accessToken}` }
    }
  }

  if (provider === 'bedrock') {
    const credentials = await refreshAndGetAwsCredentials()
    return { 'x-amz-custom-authorization': credentials.authorizationToken }
  }

  return {}
}
```

---

## 二百七十、API 错误处理

### 错误分类和处理

```typescript
// services/api/errors.ts

/**
 * API 错误处理
 * - 401: 认证错误
 * - 429: 速率限制
 * - 500-599: 服务器错误
 * - 529: 服务不可用
 */

export function formatAPIError(error: APIError): string {
  const status = error.status

  // 认证错误
  if (status === 401) {
    return 'Authentication failed. Please run /login'
  }

  // 速率限制
  if (status === 429) {
    const retryAfter = error.headers?.['retry-after']
    const waitTime = retryAfter ? parseInt(retryAfter, 10) : 60
    return `Rate limited. Try again in ${waitTime} seconds`
  }

  // 服务不可用
  if (status === 529) {
    return 'Service temporarily unavailable. Please try again later'
  }

  // 上下文过长
  if (isPromptTooLongError(error)) {
    const { actual, limit } = parsePromptTooLongTokens(error)
    return `Context window exceeded: ${actual} > ${limit} tokens`
  }

  // 通用错误
  return `API Error: ${error.message}`
}

// 解析上下文过长的 token 计数
function parsePromptTooLongTokens(error: APIError): { actual: number; limit: number } {
  const match = error.message.match(/(\d+)\s+tokens.*?maximum\s+is\s+(\d+)/)
  return {
    actual: parseInt(match?.[1] ?? '0', 10),
    limit: parseInt(match?.[2] ?? '0', 10),
  }
}

// 错误重试判断
function shouldRetry(error: APIError): boolean {
  if (error.status === 529) return true
  if (error.status === 429) return true
  if (error.status >= 500) return true
  return false
}
```

---

## 二百七十一、Session Memory

### 会话记忆管理

```typescript
// services/SessionMemory/sessionMemoryUtils.ts

/**
 * 会话记忆工具函数
 * 避免循环依赖的轻量级模块
 */

// 配置
export type SessionMemoryConfig = {
  minimumMessageTokensToInit: number   // 初始化最小 token 数
  minimumTokensBetweenUpdate: number  // 更新最小增长 token 数
  toolCallsBetweenUpdates: number     // 更新间隔工具调用数
}

export const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig = {
  minimumMessageTokensToInit: 10000,
  minimumTokensBetweenUpdate: 5000,
  toolCallsBetweenUpdates: 3,
}

// 提取超时
const EXTRACTION_WAIT_TIMEOUT_MS = 15000
const EXTRACTION_STALE_THRESHOLD_MS = 60000  // 1 分钟

// 获取最后总结的消息 ID
export function getLastSummarizedMessageId(): string | undefined {
  return lastSummarizedMessageId
}

// 设置最后总结的消息 ID
export function setLastSummarizedMessageId(messageId: string | undefined): void {
  lastSummarizedMessageId = messageId
}

// 检查提取是否过期
export function isExtractionStale(): boolean {
  if (!extractionStartedAt) return false
  return Date.now() - extractionStartedAt > EXTRACTION_STALE_THRESHOLD_MS
}
```

---

## 二百七十二、Session Storage

### 会话持久化存储

```typescript
// utils/sessionStorage.ts

/**
 * 会话存储管理
 * - messages/ - 消息历史
 * - state.json - 状态
 * - memory/ - 记忆文件
 */

// 会话目录结构
// ~/.claude/sessions/<session-id>/
//   ├── messages.jsonl      # 消息历史
//   ├── state.json          # 状态
//   ├── memory/             # 记忆
//   └── artifacts/          # 工件

export interface SessionStorage {
  // 读取消息
  readMessages(): Promise<SerializedMessage[]>

  // 追加消息
  appendMessage(msg: SerializedMessage): Promise<void>

  // 读取状态
  readState(): Promise<SessionState>

  // 保存状态
  saveState(state: SessionState): Promise<void>

  // 获取会话路径
  getSessionPath(): string
}

// 读取文件尾部 (用于流式追加)
export function readFileTailSync(
  path: string,
  lines: number,
): string | null {
  const fd = openSync(path, 'r')
  const stat = fstatSync(fd)
  const lineEnding = os.EOL === '\r\n' ? 2 : 1

  // 从文件末尾向前读取
  let bytesRead = 0
  let lineCount = 0
  const buf = Buffer.alloc(1024)

  while (lineCount <= lines && bytesRead < stat.size) {
    const pos = stat.size - bytesRead - buf.length
    if (pos < 0) {
      buf.fill(0, 0, buf.length + pos)
      readSync(fd, buf, -pos, Math.max(0, bytesRead), 0)
      bytesRead += buf.length + pos
    } else {
      readSync(fd, buf, 0, buf.length, pos)
      bytesRead += buf.length
    }

    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i] === 10) { // '\n'
        lineCount++
        if (lineCount > lines) break
      }
    }
  }

  closeSync(fd)
  return buf.toString('utf-8', buf.length - bytesRead)
}
```

---

## 二百七十三、MCP Types

### MCP 配置架构

```typescript
// services/mcp/types.ts

/**
 * MCP 服务器配置类型
 * 支持多种传输协议和认证方式
 */

// 配置作用域
const ConfigScopeSchema = z.enum([
  'local',      // 本地命令
  'user',       // 用户级
  'project',    // 项目级
  'dynamic',    // 动态 (IDE)
  'enterprise', // 企业托管
  'claudeai',   // Claude.ai 官方
  'managed',    // 托管
])

// 传输协议
const TransportSchema = z.enum([
  'stdio',   // 标准输入输出
  'sse',     // Server-Sent Events
  'sse-ide', // IDE SSE
  'http',    // HTTP
  'ws',      // WebSocket
  'sdk',     // SDK 控制传输
])

// STDIO 服务器配置
const McpStdioServerConfigSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
})

// SSE 服务器配置
const McpSSEServerConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  headersHelper: z.string().optional(),
  oauth: McpOAuthConfigSchema.optional(),
})

// OAuth 配置
const McpOAuthConfigSchema = z.object({
  clientId: z.string().optional(),
  callbackPort: z.number().int().positive().optional(),
  authServerMetadataUrl: z.string().url().optional(),
  xaa: z.boolean().optional(),  // Cross-App Access
})
```

---

## 二百七十四、IDE 集成

### IDE 扩展集成

```typescript
// utils/ide.ts

/**
 * IDE 集成
 * - 自动检测 IDE 类型
 * - 插件安装
 * - 通信协议
 */

type IDEType = 'vscode' | 'jetbrains' | 'cursor' | 'windsurf'

type DetectedIDEInfo = {
  name: IDEType
  url: string           // WebSocket/ SSE URL
  authToken?: string    // 认证 token
  pid?: number          // IDE 进程 ID
  workspaceFolders?: string[]
}

// 检测 IDE
export async function detectIDE(): Promise<DetectedIDEInfo | null> {
  // 检查 lockfile
  const lockfile = await findIDELockfile()
  if (lockfile) {
    return parseLockfile(lockfile)
  }

  // 检查环境变量
  if (process.env.VSCODE_IPC_HOOK_CLANGD) {
    return { name: 'vscode', url: process.env.VSCODE_IPC_HOOK_CLANGD }
  }

  return null
}

// 初始化 IDE 集成
export function initializeIdeIntegration(
  onDetected: (ide: DetectedIDEInfo) => void,
  onInstallNeeded: () => void,
): void {
  // 1. 检测已安装的 IDE
  const detected = await detectIDE()
  if (detected) {
    onDetected(detected)
    return
  }

  // 2. 检查插件安装状态
  const pluginStatus = await checkPluginStatus()
  if (pluginStatus === 'not_installed') {
    onInstallNeeded()
  }
}

// 检查 JetBrains 插件
export function isJetBrainsPluginInstalledCached(): boolean {
  // 检查 plugin path
  // ...
}
```

---

## 二百七十五、Built-in Agents

### 内置 Agent 定义

```typescript
// tools/AgentTool/builtInAgents.ts

/**
 * 内置 Agent
 * - General Purpose
 * - Explore
 * - Plan
 * - Verification
 * - Statusline Setup
 * - Claude Code Guide
 */

// 获取内置 Agent
export function getBuiltInAgents(): AgentDefinition[] {
  const agents: AgentDefinition[] = [
    GENERAL_PURPOSE_AGENT,
    STATUSLINE_SETUP_AGENT,
  ]

  if (areExplorePlanAgentsEnabled()) {
    agents.push(EXPLORE_AGENT, PLAN_AGENT)
  }

  // 非 SDK 入口点包含 Claude Code Guide
  if (process.env.CLAUDE_CODE_ENTRYPOINT !== 'sdk-*') {
    agents.push(CLAUDE_CODE_GUIDE_AGENT)
  }

  if (feature('VERIFICATION_AGENT')) {
    agents.push(VERIFICATION_AGENT)
  }

  return agents
}
```

---

## 二百七十六、Plan Agent

### 计划 Agent

```typescript
// tools/AgentTool/built-in/planAgent.ts

/**
 * Plan Agent - 只读计划 Agent
 * 探索代码库并设计实现计划
 */

export const PLAN_AGENT: BuiltInAgentDefinition = {
  agentType: 'Plan',
  disallowedTools: [
    AGENT_TOOL_NAME,
    EXIT_PLAN_MODE_TOOL_NAME,
    FILE_EDIT_TOOL_NAME,
    FILE_WRITE_TOOL_NAME,
    NOTEBOOK_EDIT_TOOL_NAME,
    // ... 更多写操作工具
  ],

  systemPrompt: `
You are a software architect and planning specialist.

=== CRITICAL: READ-ONLY MODE ===

You are STRICTLY PROHIBITED from:
- Creating new files
- Modifying existing files
- Deleting files
- Running modification commands

Your role is EXCLUSIVELY to explore and plan.

## Your Process

1. **Understand Requirements**
2. **Explore Thoroughly** (read-only)
3. **Design Solution**
4. **Detail the Plan**

## Required Output

End with:
### Critical Files for Implementation
List 3-5 critical files for implementation
`,
}

// Plan Agent 特点:
// - 只读模式，禁止所有写操作
// - 工具调用限制
// - 专注于探索和计划
// - 输出关键文件列表
```

---

## 二百七十七、Verification Agent

### 验证 Agent

```typescript
// tools/AgentTool/built-in/verificationAgent.ts

/**
 * Verification Agent
 * 验证代码变更的正确性
 */

// Verification Agent 配置
export const VERIFICATION_AGENT: BuiltInAgentDefinition = {
  agentType: 'Verification',

  allowedTools: [
    BASH_TOOL_NAME,        // 只读命令
    FILE_READ_TOOL_NAME,   // 读取文件
    GREP_TOOL_NAME,        // 搜索
    GLOB_TOOL_NAME,        // 文件匹配
  ],

  disallowedTools: [
    FILE_EDIT_TOOL_NAME,
    FILE_WRITE_TOOL_NAME,
    // ... 所有写操作
  ],

  systemPrompt: `
You verify code changes are correct and complete.

1. Run tests
2. Check edge cases
3. Verify functionality
4. Report issues
`,
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **API Client** | `services/api/client.ts` | 多后端支持 |
| **API Errors** | `services/api/errors.ts` | 错误处理 |
| **Session Memory** | `services/SessionMemory/` | 会话记忆 |
| **Session Storage** | `utils/sessionStorage.ts` | 会话持久化 |
| **MCP Types** | `services/mcp/types.ts` | MCP 配置 |
| **IDE Integration** | `utils/ide.ts` | IDE 集成 |
| **Built-in Agents** | `tools/AgentTool/builtInAgents.ts` | 内置 Agent |
| **Plan Agent** | `tools/AgentTool/built-in/planAgent.ts` | 只读计划 |