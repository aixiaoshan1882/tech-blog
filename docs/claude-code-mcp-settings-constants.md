# Claude Code 源码深度学习笔记 (第十九部分)

> MCP 客户端 · 设置系统 · 常量与提示 · 工具常量

---

## 一百零一、MCP 客户端深度解析

### 传输协议支持

```typescript
// services/mcp/client.ts

// 支持的传输类型
export type Transport = 'stdio' | 'sse' | 'sse-ide' | 'http' | 'ws' | 'ws-ide' | 'sdk'

// Stdio 传输 (本地进程)
const stdioTransport = new StdioClientTransport({
  command: config.command,
  args: config.args ?? [],
  env: config.env,
})

// SSE 传输 (服务器发送事件)
const sseTransport = new SSEClientTransport(new URL(config.url), {
  headers: config.headers,
})

// WebSocket 传输
const wsTransport = new WebSocketTransport(config.url, {
  headers: config.headers,
})

// Streamable HTTP 传输
const httpTransport = new StreamableHTTPClientTransport(config.url, {
  headers: headersFactory(),
})
```

### MCP 服务器配置

```typescript
// services/mcp/types.ts

// Stdio 服务器配置
export const McpStdioServerConfigSchema = z.object({
  type: z.literal('stdio').optional(),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
})

// SSE 服务器配置
export const McpSSEServerConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: McpOAuthConfigSchema.optional(),
})

// HTTP 服务器配置
export const McpHTTPServerConfigSchema = z.object({
  type: z.literal('http'),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: McpOAuthConfigSchema.optional(),
})
```

### OAuth 配置

```typescript
// MCP OAuth 支持
export const McpOAuthConfigSchema = z.object({
  clientId: z.string().optional(),
  callbackPort: z.number().int().positive().optional(),
  authServerMetadataUrl: z.string().url().optional(),
  // XAA (Cross-App Access)
  xaa: z.boolean().optional(),
})

// XAA 配置用于 SEP-990
export const McpXaaConfigSchema = z.boolean()
```

### MCP 资源管理

```typescript
// 列出 MCP 资源
export const ListMcpResourcesTool = buildTool({
  name: 'ListMcpResources',
  inputSchema: z.object({
    server: z.string().optional().describe('MCP 服务器名称'),
  }),

  async call({ server }, context) {
    const resources = await listMCPResources(server)
    return { resources }
  },
})

// 读取 MCP 资源
export const ReadMcpResourceTool = buildTool({
  name: 'ReadMcpResource',
  inputSchema: z.object({
    uri: z.string().describe('资源 URI'),
  }),

  async call({ uri }, context) {
    const content = await readMCPResource(uri)
    return { content }
  },
})
```

---

## 一百零二、设置系统

### 设置类型

```typescript
// utils/settings/types.ts

export const PermissionsSchema = z.object({
  allow: z.array(PermissionRuleSchema()).optional(),
  deny: z.array(PermissionRuleSchema()).optional(),
  ask: z.array(PermissionRuleSchema()).optional(),
  defaultMode: z.enum(PERMISSION_MODES).optional(),
  disableBypassPermissionsMode: z.enum(['disable']).optional(),
  additionalDirectories: z.array(z.string()).optional(),
})

export const EnvironmentVariablesSchema = z.record(z.string(), z.coerce.string())

export const CliSettingsSchema = z.object({
  permissions: PermissionsSchema.optional(),
  env: EnvironmentVariablesSchema.optional(),
  mountablePaths: MountablePathsSchema.optional(),
})
```

### 设置作用域

```typescript
// 设置源优先级
export const ConfigScopeSchema = z.enum([
  'local',      // 本地项目 (.claude.json)
  'user',       // 用户级别 (~/.claude/settings.json)
  'project',    // 项目级别
  'dynamic',    // 动态配置
  'enterprise',  // 企业托管
  'claudeai',   // Claude.ai 云端
  'managed',    // 托管设置
])
```

### 设置验证

```typescript
// utils/settings/validation.ts

export function validateSettings(
  settings: unknown,
): ValidationResult {
  const result = CliSettingsSchema.safeParse(settings)

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    }
  }

  return { valid: true, settings: result.data }
}
```

### 设置变更检测

```typescript
// utils/settings/changeDetector.ts

export class SettingsChangeDetector {
  private previousSettings: unknown

  detectChanges(): SettingsDiff | null {
    const current = getCurrentSettings()

    if (deepEqual(current, this.previousSettings)) {
      return null
    }

    const diff = computeDiff(this.previousSettings, current)
    this.previousSettings = current

    return diff
  }

  async applyChanges(diff: SettingsDiff): Promise<void> {
    for (const change of diff.changes) {
      switch (change.type) {
        case 'add':
          await handleSettingAdd(change.key, change.value)
          break
        case 'remove':
          await handleSettingRemove(change.key)
          break
        case 'update':
          await handleSettingUpdate(change.key, change.value)
          break
      }
    }
  }
}
```

---

## 一百零三、常量与提示

### 系统提示构建

```typescript
// constants/prompts.ts

export async function getSystemPrompt(
  messages: Message[],
  model: string,
): Promise<string[]> {
  const sections: string[] = []

  // 1. 模型信息
  sections.push(getModelSection(model))

  // 2. 系统提示
  sections.push(await buildSystemPrompt())

  // 3. 可用工具
  sections.push(getToolsSection())

  // 4. MCP 服务器指令
  sections.push(await getMCPSection())

  // 5. 记忆系统
  sections.push(await loadMemoryPrompt())

  // 6. 输出样式
  sections.push(getOutputStyleSection())

  return sections
}
```

### 工具名称常量

```typescript
// constants/

// 工具名称
export const BASH_TOOL_NAME = 'Bash'
export const FILE_READ_TOOL_NAME = 'Read'
export const FILE_WRITE_TOOL_NAME = 'Write'
export const FILE_EDIT_TOOL_NAME = 'Edit'
export const GLOB_TOOL_NAME = 'Glob'
export const GREP_TOOL_NAME = 'Grep'
export const AGENT_TOOL_NAME = 'Agent'
export const MCPTool_NAME = 'MCPTool'

// 命令名称
export const COMMAND_NAME = 'claude'
export const AGENT_COMMAND_NAME = 'agent'
```

### XML 标签常量

```typescript
// constants/xml.ts

export const TICK_TAG = ' tick="true"'
export const CODE_TAG_PREFIX = '<code>'
export const CODE_TAG_SUFFIX = '</code>'

// 特殊标签
export const TAG_PATTERNS = {
  tick: /\b(tick)="([^"]*)"/,
  code: /<code>(.*?)<\/code>/,
}
```

---

## 一百零四、输出样式

### 样式配置

```typescript
// constants/outputStyles.ts

export interface OutputStyleConfig {
  name: string
  systemPrompt: string[]
  messagePrefix?: string
  messageSuffix?: string
}

export const OUTPUT_STYLES: OutputStyle[] = [
  {
    name: 'concise',
    description: '简洁输出，适合快速响应',
    sections: [
      'Respond directly without preamble.',
      'Keep responses brief.',
    ],
  },
  {
    name: 'detailed',
    description: '详细输出，适合复杂任务',
    sections: [
      'Provide thorough explanations.',
      'Include context and reasoning.',
    ],
  },
  {
    name: 'developer',
    description: '开发者风格，适合代码任务',
    sections: [
      'Focus on technical accuracy.',
      'Include code examples.',
    ],
  },
]
```

### 样式选择

```typescript
// 获取输出样式
export function getOutputStyleConfig(style: string): OutputStyleConfig {
  const found = OUTPUT_STYLES.find(s => s.name === style)

  if (!found) {
    return OUTPUT_STYLES[0] // 默认简洁样式
  }

  return found
}
```

---

## 一百零五、重要设计模式

### 1. 传输协议抽象

```typescript
// 统一的传输接口
interface MCPTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: JSONRPCMessage): Promise<void>
  onMessage(handler: (msg: JSONRPCMessage) => void): void
}

// 根据配置创建传输
function createTransport(config: ServerConfig): MCPTransport {
  switch (config.type) {
    case 'stdio':
      return new StdioClientTransport(config)
    case 'sse':
      return new SSEClientTransport(new URL(config.url))
    case 'http':
    case 'ws':
      return new StreamableHTTPClientTransport(config.url)
    default:
      throw new Error(`Unsupported transport: ${config.type}`)
  }
}
```

### 2. 设置验证链

```typescript
// 验证链
const validators = [
  validateSchema,
  validatePermissions,
  validatePaths,
  validateEnvVars,
]

export async function validateSettings(
  settings: unknown,
): Promise<ValidationResult> {
  let errors: ValidationError[] = []

  for (const validator of validators) {
    const result = await validator(settings)
    errors.push(...result.errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

### 3. 懒加载常量化

```typescript
// 使用 lazySchema 避免循环依赖
const McpServerConfigSchema = lazySchema(() =>
  z.union([
    McpStdioServerConfigSchema(),
    McpSSEServerConfigSchema(),
    McpHTTPServerConfigSchema(),
    McpWebSocketServerConfigSchema(),
  ])
)
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **MCP 客户端** | `services/mcp/client.ts` | MCP 通信 |
| **MCP 类型** | `services/mcp/types.ts` | 配置类型 |
| **MCP OAuth** | `services/mcp/oauth.ts` | OAuth 认证 |
| **设置类型** | `utils/settings/types.ts` | 设置定义 |
| **设置验证** | `utils/settings/validation.ts` | 验证 |
| **变更检测** | `utils/settings/changeDetector.ts` | 变更追踪 |
| **提示构建** | `constants/prompts.ts` | 系统提示 |
| **工具常量** | `constants/*.ts` | 常量定义 |