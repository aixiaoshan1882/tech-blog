# Claude Code 源码深度学习笔记 (第六部分)

> MCP 协议实现 · 权限系统 · 记忆系统

---

## 三十一、MCP 协议实现 (Model Context Protocol)

### MCP 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP 架构                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Claude Code                                                               │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    MCPConnectionManager                              │   │
│  │  - 管理所有 MCP 服务器连接                                            │   │
│  │  - 处理连接/断开/重连                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       MCPTool                                        │   │
│  │  - 工具名称规范化                                                     │   │
│  │  - 参数类型转换                                                       │   │
│  │  - 结果处理                                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                    │
│       ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              MCP Client (SDK)                                        │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │   │
│  │  │ StdioClient  │ │ SSEClient   │ │ HTTPClient   │                │   │
│  │  │ Transport   │ │ Transport   │ │ Transport    │                │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### MCP 服务器配置

```typescript
// services/mcp/types.ts
export const TransportSchema = z.enum(['stdio', 'sse', 'sse-ide', 'http', 'ws', 'sdk'])

// Stdio 配置 (本地进程)
export const McpStdioServerConfigSchema = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
})

// SSE 配置 (远程服务器)
export const McpSSEServerConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: McpOAuthConfigSchema.optional(),
})

// HTTP 配置
export const McpHTTPServerConfigSchema = z.object({
  type: z.literal('http'),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: McpOAuthConfigSchema.optional(),
})

// WebSocket 配置
export const McpWebSocketServerConfigSchema = z.object({
  type: z.literal('ws'),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  tls: z.object({ ... }).optional(),
})
```

### MCP OAuth 配置

```typescript
export const McpOAuthConfigSchema = z.object({
  clientId: z.string().optional(),
  callbackPort: z.number().int().positive().optional(),
  authServerMetadataUrl: z.string().url().optional(),
  xaa: z.boolean().optional(),  // Cross-App Access
})

// XAA (SEP-990): 跨应用访问
const McpXaaConfigSchema = z.boolean()
```

### MCP 工具调用

```typescript
// services/mcp/client.ts
export class McpToolCallError extends TelemetrySafeError {
  constructor(
    message: string,
    telemetryMessage: string,
    readonly mcpMeta?: { _meta?: Record<string, unknown> },
  ) {
    super(message, telemetryMessage)
    this.name = 'McpToolCallError'
  }
}

// 工具名称规范化
export function buildMcpToolName(serverName: string, toolName: string): string {
  return `${serverName}:${toolName}`
}

// 会话过期检测
export function isMcpSessionExpiredError(error: Error): boolean {
  const httpStatus = 'code' in error ? error.code : undefined
  if (httpStatus !== 404) return false
  // MCP 服务器返回 {"error":{"code":-32001,"message":"Session not found"}}
  return error.message.includes('-32001')
}
```

### MCP 连接管理

```typescript
// 多种传输协议支持
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { WebSocketTransport } from '../../utils/mcpWebSocketTransport.js'

// 创建 MCP 客户端
export async function createMCPClient(
  config: McpServerConfig,
): Promise<Client> {
  const transport = await createTransport(config)
  const client = new Client({ ... })
  await client.connect(transport)
  return client
}

// 传输协议选择
async function createTransport(config: McpServerConfig): Promise<Transport> {
  switch (config.type) {
    case 'stdio':
      return new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      })
    case 'sse':
      return new SSEClientTransport(new URL(config.url), {
        headers: config.headers,
      })
    case 'http':
      return new StreamableHTTPClientTransport(new URL(config.url), {
        headers: config.headers,
      })
    case 'ws':
      return new WebSocketTransport(config.url, config.tls)
  }
}
```

---

## 三十二、权限系统 (Permission System)

### 权限模式

```typescript
// types/permissions.ts
export const PERMISSION_MODES = [
  'acceptEdits',   // 接受所有编辑
  'bypassPermissions',  // 绕过权限检查
  'default',       // 默认模式
  'dontAsk',       // 不询问
  'plan',          // 计划模式
  'auto',          // 自动模式 (需要 TRANSCRIPT_CLASSIFIER)
] as const

export type PermissionMode = 'acceptEdits' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan' | 'auto' | 'bubble'
```

### 权限规则

```typescript
// types/permissions.ts
export type PermissionRuleSource =
  | 'userSettings'      // 用户设置
  | 'projectSettings'   // 项目设置
  | 'localSettings'    // 本地设置
  | 'flagSettings'     // CLI 标志
  | 'policySettings'   // 策略设置
  | 'cliArg'           // CLI 参数
  | 'command'          // 命令
  | 'session'          // 会话

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

export type PermissionRule = {
  source: PermissionRuleSource
  ruleBehavior: PermissionBehavior
  ruleValue: {
    toolName: string
    ruleContent?: string  // 可选的规则内容
  }
}
```

### 权限检查流程

```typescript
// utils/permissions/permissions.ts
export async function checkToolPermission(
  tool: Tool,
  input: Record<string, unknown>,
  context: ToolUseContext,
): Promise<PermissionResult> {
  // 1. 获取工具名称 (处理别名)
  const toolName = getToolNameForPermissionCheck(tool.name)

  // 2. 查找匹配的权限规则
  const rules = await findMatchingRules(toolName, input)

  // 3. 应用规则优先级
  const topRule = rules.sort((a, b) =>
    getRulePriority(a.source) - getRulePriority(b.source)
  )[0]

  if (!topRule) {
    // 无规则，默认询问
    return { behavior: 'ask' }
  }

  // 4. 执行规则
  switch (topRule.ruleBehavior) {
    case 'allow':
      return { behavior: 'allow' }
    case 'deny':
      return { behavior: 'deny', reason: topRule.ruleValue.ruleContent }
    case 'ask':
      return { behavior: 'ask' }
  }
}

// 权限规则匹配
async function findMatchingRules(
  toolName: string,
  input: Record<string, unknown>,
): Promise<PermissionRule[]> {
  const rules = await loadAllPermissionRules()

  return rules.filter(rule => {
    if (rule.ruleValue.toolName !== toolName) return false

    // 如果有规则内容，检查匹配
    if (rule.ruleValue.ruleContent) {
      return matchRuleContent(rule.ruleValue.ruleContent, input)
    }

    return true  // 通配符匹配
  })
}
```

### 权限规则语法

```typescript
// utils/permissions/permissionRuleParser.ts
// 格式: ToolName(content) 或 ToolName(*)

// 特殊字符转义
export function escapeRuleContent(content: string): string {
  return content
    .replace(/\\/g, '\\\\')  // 转义反斜杠
    .replace(/\(/g, '\\(')    // 转义左括号
    .replace(/\)/g, '\\)')    // 转义右括号
}

// 内容匹配
function matchRuleContent(
  ruleContent: string,
  input: Record<string, unknown>,
): boolean {
  // glob 风格匹配
  if (ruleContent === '*') return true

  // 字符串包含匹配
  const inputStr = JSON.stringify(input)
  return inputStr.includes(ruleContent)
}

// 工具名称别名 (兼容旧名称)
const LEGACY_TOOL_NAME_ALIASES = {
  'Task': 'Agent',
  'KillShell': 'TaskStop',
  'AgentOutputTool': 'TaskOutput',
  'BashOutputTool': 'TaskOutput',
}
```

### 权限更新

```typescript
// types/permissions.ts
export type PermissionUpdateDestination =
  | 'userSettings'
  | 'projectSettings'
  | 'localSettings'
  | 'session'
  | 'cliArg'

export type PermissionUpdate =
  | { type: 'addRules'; rules: PermissionRule[]; destination: PermissionUpdateDestination }
  | { type: 'removeRules'; ruleValues: PermissionRuleValue[] }
  | { type: 'clearRules'; destination: PermissionUpdateDestination }
  | { type: 'setMode'; mode: PermissionMode }
```

---

## 三十三、记忆系统 (Memory System)

### 记忆类型

```typescript
// memdir/memoryTypes.ts
export const MEMORY_FRONTMATTER_EXAMPLE = `
---
types:
  - type: project
    description: 项目记忆
  - type: personal
    description: 个人记忆
---
`

export const WHAT_NOT_TO_SAVE_SECTION = `
## 什么不应该保存
- 敏感信息 (密码、密钥)
- 临时调试信息
- 可以重新生成的内容
`

export const WHEN_TO_ACCESS_SECTION = `
## 何时访问记忆
- 会话开始时自动加载
- 可以通过 /memory 命令手动访问
`
```

### 记忆入口点

```typescript
// memdir/memdir.ts
export const ENTRYPOINT_NAME = 'MEMORY.md'
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000

// 截断过长的 MEMORY.md
export function truncateEntrypointContent(
  raw: string,
): EntrypointTruncation {
  const trimmed = raw.trim()
  const contentLines = trimmed.split('\n')
  const lineCount = contentLines.length
  const byteCount = trimmed.length

  // 超过限制时截断
  if (lineCount > MAX_ENTRYPOINT_LINES || byteCount > MAX_ENTRYPOINT_BYTES) {
    let truncated = contentLines
      .slice(0, MAX_ENTRYPOINT_LINES)
      .join('\n')

    if (truncated.length > MAX_ENTRYPOINT_BYTES) {
      const cutAt = truncated.lastIndexOf('\n', MAX_ENTRYPOINT_BYTES)
      truncated = truncated.slice(0, cutAt)
    }

    return {
      content: truncated + '\n\n> WARNING: MEMORY.md was truncated...',
      lineCount,
      byteCount,
      wasLineTruncated: lineCount > MAX_ENTRYPOINT_LINES,
      wasByteTruncated: byteCount > MAX_ENTRYPOINT_BYTES,
    }
  }

  return { content: trimmed, lineCount, byteCount, ... }
}
```

### 自动记忆路径

```typescript
// memdir/paths.ts
export function getAutoMemPath(): string | null {
  // 优先级: CLAUDE_MEM_PATH > 项目 .claude/memory > ~/.claude/memory
  if (process.env.CLAUDE_MEM_PATH) {
    return process.env.CLAUDE_MEM_PATH
  }

  const projectMem = join('.claude', 'memory')
  if (existsSync(projectMem)) {
    return projectMem
  }

  const globalMem = join(os.homedir(), '.claude', 'memory')
  if (existsSync(globalMem)) {
    return globalMem
  }

  return null
}

export function isAutoMemoryEnabled(): boolean {
  return getAutoMemPath() !== null
}
```

### 记忆加载

```typescript
// memdir/memdir.ts
export async function loadMemoryPrompt(): Promise<string | null> {
  const memPath = getAutoMemPath()
  if (!memPath) return null

  const entrypoint = join(memPath, ENTRYPOINT_NAME)
  if (!existsSync(entrypoint)) return null

  const content = await readFile(entrypoint, 'utf-8')
  const { content: truncated } = truncateEntrypointContent(content)

  return `# Memory\n\n${truncated}`
}

// 扫描所有记忆文件
export async function scanMemoryDir(): Promise<MemoryFile[]> {
  const memPath = getAutoMemPath()
  if (!memPath) return []

  const files = await glob(join(memPath, '**/*.md'))

  return Promise.all(
    files.map(async file => ({
      path: file,
      content: await readFile(file, 'utf-8'),
      stat: await stat(file),
    }))
  )
}
```

### 团队记忆 (Team Memory)

```typescript
// memdir/teamMemPaths.ts (TEAMMEM feature)
export function getTeamMemPaths(): string[] {
  const paths: string[] = []

  // 添加团队记忆路径
  if (feature('TEAMMEM')) {
    paths.push(join('.claude', 'team-memory'))
  }

  return paths
}

// 同步团队记忆到本地
export async function syncTeamMemory(): Promise<void> {
  const paths = getTeamMemPaths()

  for (const path of paths) {
    if (existsSync(path)) {
      await pullFromRemote(path)
      await pushToRemote(path)
    }
  }
}
```

### 记忆类型定义

```typescript
// memdir/memoryTypes.ts
export type MemoryType =
  | 'project'      // 项目知识
  | 'personal'     // 个人偏好
  | 'team'         // 团队共享
  | 'context'      // 当前上下文

export interface MemoryFile {
  path: string
  content: string
  type: MemoryType
  lastModified: Date
  tags: string[]
}

// 记忆相关类型
export interface MemoryReference {
  type: 'memory'
  path: string
  snippet: string
  relevance: number
}
```

---

## 三十四、关键设计模式

### 1. 插件化架构 (MCP)

```typescript
// MCP 服务器配置驱动
interface MCPServerConfig {
  name: string
  type: 'stdio' | 'sse' | 'http' | 'ws'
  // ... 其他配置
}

// 连接管理器统一接口
interface MCPConnectionManager {
  connect(config: MCPServerConfig): Promise<void>
  disconnect(name: string): Promise<void>
  getTools(name: string): Promise<Tool[]>
  callTool(name: string, tool: string, args: object): Promise<unknown>
}

// 支持热插拔
function registerMCPClient(name: string, client: MCPConnectionManager) {
  clients.set(name, client)
}
```

### 2. 分层权限检查

```typescript
// 权限检查分层
async function checkPermission(
  tool: Tool,
  input: object,
  context: ToolUseContext,
): Promise<PermissionResult> {
  // 层级 1: CLI 强制参数 (最高优先级)
  if (context.cliArgs.bypassPermissions) {
    return { behavior: 'allow' }
  }

  // 层级 2: 内置规则 (如 always-deny)
  const builtIn = checkBuiltInRules(tool.name)
  if (builtIn) return builtIn

  // 层级 3: 用户配置的规则
  const userRule = await findUserRule(tool.name, input)
  if (userRule) return executeRule(userRule)

  // 层级 4: 默认行为
  return { behavior: 'ask' }
}
```

### 3. 记忆自动加载

```typescript
// 会话开始时自动加载记忆
async function initializeSession(): Promise<void> {
  // 1. 加载 MEMORY.md
  const memoryPrompt = await loadMemoryPrompt()

  // 2. 加载项目CLAUDE.md
  const claudeMd = await loadClaudeMd()

  // 3. 加载团队记忆
  const teamMemory = feature('TEAMMEM')
    ? await loadTeamMemory()
    : null

  // 4. 合并到上下文
  setSystemContext({
    memory: memoryPrompt,
    projectKnowledge: claudeMd,
    teamContext: teamMemory,
  })
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **MCP 协议** | `services/mcp/client.ts` | MCP 服务器连接管理 |
| **MCP 类型** | `services/mcp/types.ts` | 配置 schema 和类型 |
| **MCP 工具** | `tools/MCPTool/` | MCP 工具封装 |
| **权限系统** | `utils/permissions/permissions.ts` | 权限检查核心 |
| **权限规则** | `utils/permissions/PermissionRule.ts` | 规则定义 |
| **权限解析** | `utils/permissions/permissionRuleParser.ts` | 规则解析 |
| **记忆系统** | `memdir/memdir.ts` | 记忆加载 |
| **记忆路径** | `memdir/paths.ts` | 记忆文件路径 |
| **记忆类型** | `memdir/memoryTypes.ts` | 记忆类型定义 |