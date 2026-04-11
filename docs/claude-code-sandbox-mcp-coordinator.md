# Claude Code 源码深度学习笔记 (第四十三部分)

> Sandbox·MCP Client·Coordinator·Tool·更多

---

## 二百七十八、Sandbox 沙箱

### 沙箱适配器

```typescript
// utils/sandbox/sandbox-adapter.ts

/**
 * 沙箱运行时适配器
 * 包装 @anthropic-ai/sandbox-runtime 包
 */

// 沙箱配置
type SandboxRuntimeConfig = {
  // 文件系统限制
  readRestrictions?: FsReadRestrictionConfig[]
  writeRestrictions?: FsWriteRestrictionConfig[]

  // 网络限制
  networkRestrictions?: NetworkRestrictionConfig[]

  // 忽略违规
  ignoreViolations?: IgnoreViolationsConfig

  // 依赖检查
  dependencyCheck?: SandboxDependencyCheck
}

// 文件系统限制
type FsReadRestrictionConfig = {
  pattern: string           // glob 模式
  allowedPaths?: string[]   // 允许的路径
}

// 网络限制
type NetworkRestrictionConfig = {
  allow: NetworkHostPattern[]
  deny?: NetworkHostPattern[]
}

type NetworkHostPattern = {
  host: string | '*'
  port?: number | '*'
}

// 违规事件
type SandboxViolationEvent = {
  type: 'read' | 'write' | 'network'
  path?: string
  reason: string
}

// 创建沙箱管理器
export class SandboxManager {
  private violations: SandboxViolationStore

  async createSandbox(config: SandboxRuntimeConfig): Promise<Sandbox> {
    // 创建隔离环境
    // 应用限制配置
  }

  // 检查违规
  checkViolation(event: SandboxViolationEvent): void {
    this.violations.record(event)
  }
}

// 权限规则转换
function permissionRuleValueFromString(
  ruleString: string,
): PermissionRuleValue {
  // "bash:ls -la" -> { toolName: 'bash', ruleContent: 'ls -la' }
  const matches = ruleString.match(/^([^(]+)\(([^)]+)\)$/)
  if (!matches) {
    return { toolName: ruleString }
  }
  return { toolName: matches[1], ruleContent: matches[2] }
}
```

---

## 二百七十九、MCP Client

### MCP SDK 客户端

```typescript
// services/mcp/client.ts

/**
 * MCP 客户端实现
 * 支持多种传输协议
 */

// 传输协议选择
type TransportType = 'stdio' | 'sse' | 'http' | 'ws' | 'sdk'

// 创建 MCP 客户端
export async function createMCPClient(
  config: McpServerConfig,
): Promise<MCPServerConnection> {
  const transport = await createTransport(config)

  const client = new Client({
    name: 'claude-code',
    version: '1.0',
  }, {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  })

  await client.connect(transport)

  return {
    client,
    tools: await loadTools(client),
    resources: await loadResources(client),
  }
}

// 创建传输
async function createTransport(
  config: McpServerConfig,
): Promise<Transport> {
  switch (config.type) {
    case 'stdio':
      return new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env,
      })

    case 'sse':
      return new SSEClientTransport(config.url, {
        headers: config.headers,
      })

    case 'http':
      return new StreamableHTTPClientTransport(config.url, {
        headers: config.headers,
      })

    case 'ws':
      return new WebSocketClientTransport(config.url)

    case 'sdk':
      // SDK 控制传输
      return createSdkControlTransport()
  }
}

// 调用 MCP 工具
export async function callMCPTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<CallToolResult> {
  try {
    return await client.callTool(toolName, args, { signal })
  } catch (error) {
    if (error instanceof McpError) {
      throw new Error(`MCP tool error: ${error.message}`)
    }
    throw error
  }
}

// 列出 MCP 工具
export async function listMCPTools(
  client: Client,
): Promise<ListToolsResult> {
  return await client.listTools()
}
```

---

## 二百八十、MCP Config

### MCP 配置管理

```typescript
// services/mcp/config.ts

/**
 * MCP 服务器配置管理
 * 从多个来源加载配置
 */

// 获取配置路径
function getEnterpriseMcpFilePath(): string {
  return join(getManagedFilePath(), 'managed-mcp.json')
}

// 添加作用域到服务器配置
function addScopeToServers(
  servers: Record<string, McpServerConfig> | undefined,
  scope: ConfigScope,
): Record<string, ScopedMcpServerConfig> {
  if (!servers) return {}

  const scoped: Record<string, ScopedMcpServerConfig> = {}
  for (const [name, config] of Object.entries(servers)) {
    scoped[name] = { ...config, scope }
  }
  return scoped
}

// 加载 MCP 配置
export async function loadMCPConfig(): Promise<Record<string, ScopedMcpServerConfig>> {
  const configs: Record<string, ScopedMcpServerConfig> = {}

  // 1. 全局配置
  const global = getGlobalConfig()
  if (global.mcpServers) {
    Object.assign(configs, addScopeToServers(global.mcpServers, 'user'))
  }

  // 2. 项目配置
  const project = getCurrentProjectConfig()
  if (project?.mcpServers) {
    Object.assign(configs, addScopeToServers(project.mcpServers, 'project'))
  }

  // 3. 托管配置
  const managedPath = getEnterpriseMcpFilePath()
  if (await pathExists(managedPath)) {
    const managed = await readFile(managedPath, 'utf-8')
    const parsed = safeParseJSON(managed)
    if (parsed?.mcpServers) {
      Object.assign(configs, addScopeToServers(parsed.mcpServers, 'managed'))
    }
  }

  // 4. 插件 MCP 服务器
  const pluginServers = await getPluginMcpServers()
  Object.assign(configs, addScopeToServers(pluginServers, 'local'))

  return configs
}

// 验证 MCP 配置
export function validateMCPConfig(
  config: unknown,
): ValidationResult {
  return McpServerConfigSchema.safeParse(config)
}
```

---

## 二百八十一、Coordinator Mode

### 协调器模式

```typescript
// coordinator/coordinatorMode.ts

/**
 * 协调器模式
 * 多 Agent 协作模式
 */

// 检查协调器模式
export function isCoordinatorMode(): boolean {
  if (feature('COORDINATOR_MODE')) {
    return isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)
  }
  return false
}

// 内部 Agent 工具
const INTERNAL_WORKER_TOOLS = new Set([
  TEAM_CREATE_TOOL_NAME,
  TEAM_DELETE_TOOL_NAME,
  SEND_MESSAGE_TOOL_NAME,
  SYNTHETIC_OUTPUT_TOOL_NAME,
])

// 获取协调器用户上下文
export function getCoordinatorUserContext(
  context: CoordinatorContext,
): CoordinatorUserContext {
  return {
    scratchpadDir: context.scratchpadDir,
    allowedTools: getCoordinatorAllowedTools(context),
    // ...
  }
}

// 获取协调器允许的工具
function getCoordinatorAllowedTools(
  context: CoordinatorContext,
): string[] {
  // 协调器可以使用所有内置工具
  // 工作线程只能使用指定工具
  return ASYNC_AGENT_ALLOWED_TOOLS
}

// 匹配会话模式
export function matchSessionMode(
  sessionMode: 'coordinator' | 'normal' | undefined,
): string | undefined {
  const currentIsCoordinator = isCoordinatorMode()
  const sessionIsCoordinator = sessionMode === 'coordinator'

  if (currentIsCoordinator === sessionIsCoordinator) {
    return undefined
  }

  // 切换模式
  if (sessionIsCoordinator) {
    process.env.CLAUDE_CODE_COORDINATOR_MODE = '1'
    return 'Entered coordinator mode to match resumed session.'
  } else {
    delete process.env.CLAUDE_CODE_COORDINATOR_MODE
    return 'Exited coordinator mode to match resumed session.'
  }
}
```

---

## 二百八十二、Tool 基类

### 工具定义

```typescript
// Tool.ts

/**
 * 工具系统核心类型
 */

// 工具定义
export type ToolDef = {
  name: string
  description: string
  inputSchema: ToolInputJSONSchema
  outputSchema?: ToolOutputSchema

  // 权限
  permission?: ToolPermission

  // 进度回调
  onProgress?: (progress: ToolProgressData) => void

  // 是否允许在 Plan 模式使用
  allowedInPlanMode?: boolean
}

// 工具权限
type ToolPermission = {
  mode: PermissionMode
  reason?: string
}

// 工具执行上下文
type ToolUseContext = {
  messages: Message[]
  attachments: AttachmentMessage[]
  toolUseId: string
  toolUseName: string
  abortController: AbortController

  // 进度
  onProgress?: (progress: ToolProgressData) => void
}

// 工具结果
type ToolResult = {
  success: boolean
  output?: ContentBlockParam[]
  error?: string
}

// 构建工具
export function buildTool<T extends ToolDef>(
  definition: T,
  execute: (input: unknown, context: ToolUseContext) => Promise<ToolResult>,
): Tool {
  return {
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,

    async execute(input, context) {
      // 验证输入
      const validated = definition.inputSchema.parse(input)

      // 执行前钩子
      await context.preHooks?.()

      // 执行
      const result = await execute(validated, context)

      // 执行后钩子
      await context.postHooks?.()

      return result
    },
  }
}
```

---

## 二百八十三、Tool Registry

### 工具注册表

```typescript
// tools/registry.ts

/**
 * 工具注册表
 * 管理所有可用工具
 */

// 工具注册表
class ToolRegistry {
  private tools = new Map<string, Tool>()
  private byCategory = new Map<string, Set<string>>()

  // 注册工具
  register(tool: Tool, category: string): void {
    this.tools.set(tool.name, tool)

    if (!this.byCategory.has(category)) {
      this.byCategory.set(category, new Set())
    }
    this.byCategory.get(category)!.add(tool.name)
  }

  // 获取工具
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  // 列出所有工具
  listAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  // 按类别列出
  listByCategory(category: string): Tool[] {
    const names = this.byCategory.get(category) ?? new Set()
    return Array.from(names).map(name => this.tools.get(name)!).filter(Boolean)
  }

  // 搜索工具
  search(query: string): Tool[] {
    return this.listAll().filter(tool =>
      tool.name.includes(query) ||
      tool.description.includes(query)
    )
  }
}

// 内置工具类别
const TOOL_CATEGORIES = {
  file: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
  bash: ['Bash', 'PowerShell'],
  agent: ['Agent', 'Task'],
  mcp: ['MCPTool'],
  system: ['Todo', 'WebSearch', 'WebFetch'],
}

// 全局注册表
export const globalToolRegistry = new ToolRegistry()

// 注册内置工具
function registerBuiltinTools(): void {
  // 文件工具
  for (const name of TOOL_CATEGORIES.file) {
    const tool = loadBuiltinTool(name)
    globalToolRegistry.register(tool, 'file')
  }

  // Bash 工具
  globalToolRegistry.register(BashTool, 'bash')

  // Agent 工具
  globalToolRegistry.register(AgentTool, 'agent')
}
```

---

## 二百八十四、MCP Elicitation

### MCP 表单验证

```typescript
// utils/mcp/elicitationValidation.ts

/**
 * MCP  elicitation 验证
 * 表单输入验证
 */

// 验证输入
export function validateInput(
  value: unknown,
  schema: PrimitiveSchemaDefinition,
): ValidationResult {
  // 枚举验证
  if (isEnumSchema(schema)) {
    const enumValues = schema.enum ?? schema.oneOf?.map(o => o.const)
    if (!enumValues.includes(value)) {
      return {
        isValid: false,
        error: `Must be one of: ${enumValues.join(', ')}`,
      }
    }
  }

  // 字符串格式
  if (schema.type === 'string' && schema.format) {
    if (!matchesFormat(value, schema.format)) {
      return {
        isValid: false,
        error: `Invalid ${STRING_FORMATS[schema.format].description}`,
      }
    }
  }

  // 数字范围
  if (schema.type === 'number' || schema.type === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      return { isValid: false, error: `Minimum value: ${schema.minimum}` }
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      return { isValid: false, error: `Maximum value: ${schema.maximum}` }
    }
  }

  return { isValid: true, value }
}

// 字符串格式验证
const STRING_FORMATS = {
  email: { description: 'email address', example: 'user@example.com' },
  uri: { description: 'URI', example: 'https://example.com' },
  date: { description: 'date', example: '2024-03-15' },
  'date-time': { description: 'date-time', example: '2024-03-15T14:30:00Z' },
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Sandbox** | `utils/sandbox/sandbox-adapter.ts` | 沙箱隔离 |
| **MCP Client** | `services/mcp/client.ts` | MCP SDK 客户端 |
| **MCP Config** | `services/mcp/config.ts` | MCP 配置管理 |
| **Coordinator** | `coordinator/coordinatorMode.ts` | 协调器模式 |
| **Tool** | `Tool.ts` | 工具基类 |
| **Registry** | `tools/registry.ts` | 工具注册表 |
| **Elicitation** | `utils/mcp/elicitationValidation.ts` | 表单验证 |