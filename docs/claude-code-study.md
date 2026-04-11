# Claude Code 源码深度学习笔记 (第三部分)

> API层、权限系统、MCP集成

## 十三、API 客户端架构

### Anthropic 客户端工厂 (services/api/client.ts)

```typescript
export async function getAnthropicClient({
  apiKey,
  maxRetries,
  model,
  fetchOverride,
}: {
  apiKey?: string
  maxRetries: number
  model?: string
  fetchOverride?: ClientOptions['fetch']
}): Promise<Anthropic> {
  // 多 provider 支持
  const provider = getAPIProvider()

  switch (provider) {
    case 'aws':
      // AWS Bedrock
      const awsCredentials = await refreshAndGetAwsCredentials()
      return new Anthropic({
        authToken: awsCredentials,
        // AWS 特殊配置...
      })

    case 'vertex':
      // GCP Vertex AI
      const gcpCredentials = await refreshGcpCredentialsIfNeeded()
      return new Anthropic({
        authToken: gcpCredentials,
        // Vertex 特殊配置...
      })

    case 'foundry':
      // Azure Foundry
      return new Anthropic({
        baseURL: process.env.ANTHROPIC_FOUNDRY_BASE_URL,
        apiKey: process.env.ANTHROPIC_FOUNDRY_API_KEY,
      })

    case 'direct':
    default:
      // 直接 API
      const key = apiKey ?? await getAnthropicApiKey()
      return new Anthropic({ apiKey: key })
  }
}
```

### 支持的 Provider

| Provider | 环境变量 | 认证方式 |
|----------|----------|----------|
| Direct API | `ANTHROPIC_API_KEY` | API Key |
| AWS Bedrock | `AWS_*` | AWS Credentials |
| GCP Vertex | `VERTEX_*`, `GOOGLE_APPLICATION_CREDENTIALS` | GCP Credentials |
| Azure Foundry | `ANTHROPIC_FOUNDRY_*` | API Key / Azure AD |

## 十四、重试机制 (withRetry.ts)

### 智能重试策略

```typescript
const DEFAULT_MAX_RETRIES = 10
const BASE_DELAY_MS = 500
const MAX_529_RETRIES = 3

// 指数退避
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number }
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (isRetryable(error)) {
        // 指数退避: 500ms, 1000ms, 2000ms...
        const delay = BASE_DELAY_MS * Math.pow(2, i)
        await sleep(delay)
        continue
      }

      throw error
    }
  }

  throw lastError!
}

// 可重试错误判断
function isRetryable(error: APIError): boolean {
  return (
    error.status === 429 ||  // Rate limit
    error.status === 529 ||  // Overloaded (特殊处理)
    error.status >= 500      // Server error
  )
}
```

### 特殊处理: 529 错误

```typescript
// 529 (Overloaded) 特殊处理
const FOREGROUND_529_RETRY_SOURCES = new Set([
  'repl_main_thread',
  'sdk',
  'agent:custom',
  'compact',
  'auto_mode',  // 安全分类器必须完成
])

function shouldRetry529(source?: QuerySource): boolean {
  return source === undefined || FOREGROUND_529_RETRY_SOURCES.has(source)
}
```

## 十五、权限系统

### 权限模式 (PermissionMode)

```typescript
type PermissionMode =
  | 'acceptSelected'      // 接受选定的
  | 'auto'               // 自动模式
  | 'bypass'            // 绕过
  | 'deny'               // 拒绝
  | 'denySelected'      // 拒绝选定的

type PermissionRuleValue = 'allow' | 'deny' | 'allow_without_execution'

type PermissionRule = {
  value: PermissionRuleValue
  source: PermissionRuleSource
  pattern: string  // glob 模式或正则
}
```

### 权限检查流程

```typescript
async function checkToolPermission(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolUseContext
): Promise<PermissionResult> {
  // 1. 获取权限规则
  const rules = await loadAllPermissionRulesFromDisk()

  // 2. 匹配规则
  for (const rule of rules) {
    if (matchesPattern(toolName, rule.pattern)) {
      return {
        behavior: rule.value,
        message: `Rule from ${rule.source}`
      }
    }
  }

  // 3. 默认行为
  return { behavior: 'prompt', message: 'No matching rule' }
}
```

### 危险模式防护

```typescript
const DANGEROUS_BASH_PATTERNS = [
  'rm -rf /',
  ':(){:|:&};:',  // Fork bomb
  'curl | sh',
  'wget | sh',
]

function validateDangerousPatterns(command: string): boolean {
  return !DANGEROUS_BASH_PATTERNS.some(pattern =>
    command.includes(pattern)
  )
}
```

## 十六、MCP 工具集成

### MCP 工具定义 (MCPTool.ts)

```typescript
export const MCPTool = buildTool({
  isMcp: true,
  name: 'mcp',

  inputSchema: z.object({}).passthrough(),  // MCP 定义自己的 schema
  outputSchema: z.string(),

  async call(input, context): Promise<{ data: string }> {
    // 委托给 MCP 客户端
    const result = await mcpClient.callTool(
      this.mcpToolName,
      input
    )
    return { data: result }
  },

  renderToolUseMessage() { /* UI 渲染 */ },
  renderToolResultMessage() { /* 结果渲染 */ },
})
```

### MCP 客户端管理

```typescript
interface McpClient {
  connect(config: McpServerConfig): Promise<void>
  disconnect(): Promise<void>
  callTool(name: string, args: object): Promise<string>
  listTools(): Promise<McpTool[]>
}

// 支持的传输协议
type Transport = 'stdio' | 'sse' | 'http' | 'ws'
```

## 十七、工具权限检查

### 权限上下文

```typescript
type ToolPermissionContext = {
  cwd: string
  env: Record<string, string>
  rules: PermissionRule[]
  mode: PermissionMode
}

interface ToolUseContext {
  abortController: AbortController
  options: {
    tools: Tools
    permissionContext: ToolPermissionContext
  }
}
```

### 权限检查钩子

```typescript
async function checkPermissions(
  tool: ToolDef,
  input: unknown,
  context: ToolUseContext
): Promise<PermissionResult> {
  // 1. 检查模式
  if (context.options.permissionContext.mode === 'bypass') {
    return { behavior: 'allow' }
  }

  // 2. 匹配规则
  const result = matchingRuleForInput(
    tool.name,
    input,
    context.options.permissionContext.rules
  )

  if (result) {
    return result
  }

  // 3. 默认 prompt
  return { behavior: 'prompt' }
}
```

---

## 架构模式总结

### 1. Provider 抽象
```typescript
// 支持多后端 (AWS, GCP, Azure, Direct)
getAPIProvider() → provider-specific client
```

### 2. 智能重试
```typescript
// 指数退避 + 特殊错误处理
BASE_DELAY_MS * Math.pow(2, retryCount)
```

### 3. 权限分层
```typescript
// bypass > deny > allow > prompt
```

### 4. MCP 抽象
```typescript
// 通用工具接口 + MCP 特定实现
```

---

## 关键文件索引

| 模块 | 文件 |
|------|------|
| API 客户端 | `services/api/client.ts` |
| 重试逻辑 | `services/api/withRetry.ts` |
| 权限设置 | `utils/permissions/permissionSetup.ts` |
| 权限规则 | `utils/permissions/permissions.ts` |
| 危险模式 | `utils/permissions/dangerousPatterns.ts` |
| MCP 工具 | `tools/MCPTool/MCPTool.ts` |
| MCP 客户端 | `services/mcp/client.ts` |