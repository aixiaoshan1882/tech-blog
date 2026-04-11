# Claude Code 源码深度学习笔记 (第四十五部分 - 完结)

> Agent·Prompts·API·XML·Constants·总结

---

## 二百九十五、Agent 执行

### Agent 运行器

```typescript
// tools/AgentTool/runAgent.ts

/**
 * Agent 运行器
 * 执行子 agent 的核心逻辑
 */

// 运行 agent
export async function runAgent(
  agent: AgentDefinition,
  context: AgentContext,
): Promise<AgentResult> {
  const { messages, tools, abortSignal } = context

  // 1. 创建子上下文
  const subagentContext = await createSubagentContext(agent, context)

  // 2. 获取 agent 模型
  const model = getAgentModel(agent.model)

  // 3. 构建系统提示
  const systemPrompt = await buildAgentSystemPrompt(agent, subagentContext)

  // 4. 运行查询循环
  let agentMessages = [...messages]

  while (!abortSignal.aborted) {
    const result = await query({
      messages: agentMessages,
      systemPrompt,
      tools: subagentContext.tools,
      model,
      querySource: 'agent',
      abortSignal,
    })

    // 处理工具调用
    for (const toolCall of result.toolCalls) {
      const toolResult = await executeToolCall(toolCall, subagentContext)
      agentMessages.push(toolResult)
    }

    // 检查是否完成
    if (result.isComplete) {
      break
    }
  }

  // 5. 返回最终消息
  return { messages: agentMessages, usage: result.usage }
}

// 创建子上下文
async function createSubagentContext(
  agent: AgentDefinition,
  parent: AgentContext,
): Promise<SubagentContext> {
  const allowedTools = agent.allowedTools
    ? parent.tools.filter(t => allowedTools.includes(t.name))
    : parent.tools

  const fileStateCache = createFileStateCacheWithSizeLimit(
    READ_FILE_STATE_CACHE_SIZE,
  )

  return { ...parent, tools: allowedTools, fileStateCache }
}
```

---

## 二百九十六、System Constants

### 系统常量

```typescript
// constants/system.ts

/**
 * 系统常量
 * 提取关键常量以打破循环依赖
 */

const DEFAULT_PREFIX = `You are Claude Code, Anthropic's official CLI for Claude.`
const AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX = `You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.`
const AGENT_SDK_PREFIX = `You are a Claude agent, built on Anthropic's Claude Agent SDK.`

export function getCLISyspromptPrefix(options?: {
  isNonInteractive: boolean
  hasAppendSystemPrompt: boolean
}): CLISyspromptPrefix {
  const apiProvider = getAPIProvider()
  if (apiProvider === 'vertex') return DEFAULT_PREFIX

  if (options?.isNonInteractive) {
    if (options.hasAppendSystemPrompt) {
      return AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX
    }
    return AGENT_SDK_PREFIX
  }
  return DEFAULT_PREFIX
}

export function getAttributionHeader(fingerprint: string): string {
  if (!isAttributionHeaderEnabled()) return ''
  const version = `${MACRO.VERSION}.${fingerprint}`
  const entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT ?? 'unknown'
  return `cc=${version};${entrypoint}`
}

function isAttributionHeaderEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ATTRIBUTION_HEADER)) {
    return false
  }
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_attribution_header', true)
}
```

---

## 二百九十七、XML Tags

### XML 标签定义

```typescript
// constants/xml.ts

// 命令标签
export const COMMAND_NAME_TAG = 'command-name'
export const COMMAND_MESSAGE_TAG = 'command-message'
export const COMMAND_ARGS_TAG = 'command-args'

// Bash/终端标签
export const BASH_INPUT_TAG = 'bash-input'
export const BASH_STDOUT_TAG = 'bash-stdout'
export const BASH_STDERR_TAG = 'bash-stderr'
export const LOCAL_COMMAND_STDOUT_TAG = 'local-command-stdout'
export const LOCAL_COMMAND_STDERR_TAG = 'local-command-stderr'
export const LOCAL_COMMAND_CAVEAT_TAG = 'local-command-caveat'

// 终端输出标签
export const TERMINAL_OUTPUT_TAGS = [
  BASH_INPUT_TAG, BASH_STDOUT_TAG, BASH_STDERR_TAG,
  LOCAL_COMMAND_STDOUT_TAG, LOCAL_COMMAND_STDERR_TAG, LOCAL_COMMAND_CAVEAT_TAG,
] as const

// 任务通知标签
export const TASK_NOTIFICATION_TAG = 'task-notification'
export const TASK_ID_TAG = 'task-id'
export const TOOL_USE_ID_TAG = 'tool-use-id'
export const TASK_TYPE_TAG = 'task-type'
export const OUTPUT_FILE_TAG = 'output-file'
export const STATUS_TAG = 'status'
export const SUMMARY_TAG = 'summary'

// 团队消息标签
export const TEAMMATE_MESSAGE_TAG = 'teammate-message'
export const CHANNEL_MESSAGE_TAG = 'channel-message'
export const CHANNEL_TAG = 'channel'
export const CROSS_SESSION_MESSAGE_TAG = 'cross-session-message'

// Fork 样板标签
export const FORK_BOILERPLATE_TAG = 'fork-boilerplate'
export const FORK_DIRECTIVE_PREFIX = 'Your directive: '
```

---

## 二百九十八、API Utils

### API 工具函数

```typescript
// utils/api.ts

/**
 * API 工具函数
 * 处理工具 schema、缓存控制等
 */

// 工具转 API Schema
export function toolToAPISchema(
  tool: Tool,
  permissionContext: ToolPermissionContext,
): BetaTool {
  const inputSchema = getToolSchemaCache(tool.name, tool.inputSchema)
  return {
    name: tool.name,
    description: tool.description,
    input_schema: zodToJsonSchema(inputSchema),
  }
}

// 获取缓存范围
export function getCacheScope(tool: Tool): CacheScope | undefined {
  if (tool.cacheScope === 'global') return 'global'
  if (tool.cacheScope === 'org') return 'org'
  return undefined
}

// 支持结构化输出
export function modelSupportsStructuredOutputs(model: string): boolean {
  return shouldUseGlobalCacheScope(model)
}
```

---

## 二百九十九、Agent 定义

### 内置 Agent 定义

```typescript
// tools/AgentTool/loadAgentsDir.ts

export type AgentDefinition = {
  agentType: string
  whenToUse: string
  systemPrompt: string | ((context: AgentContext) => Promise<string>)
  allowedTools?: string[]
  disallowedTools?: string[]
  allowedInPlanMode?: boolean
  model?: ModelAlias
}

// 加载 Agent 目录
export async function loadAgentsDir(): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = []

  // 1. 加载内置 Agent
  const builtIn = getBuiltInAgents()
  agents.push(...builtIn)

  // 2. 加载插件 Agent
  const plugin = await loadPluginAgents()
  agents.push(...plugin)

  // 3. 加载项目 Agent
  const project = await loadAgentsFromDir(
    join(getCwd(), '.claude', 'agents'),
  )
  agents.push(...project)

  return agents
}
```

---

## 三百、Prompt 构建

### 提示构建系统

```typescript
// constants/prompts.ts

// 获取系统提示
export async function getSystemPrompt(
  messages: Message[],
  model: string,
): Promise<SystemPrompt> {
  const parts: string[] = []

  // 1. 基础指令
  parts.push(getBaseInstructions())

  // 2. 模型特定指令
  parts.push(getModelInstructions(model))

  // 3. 工具说明
  parts.push(await getToolsDescription())

  // 4. 内存内容
  const memory = await loadMemoryPrompt()
  if (memory) parts.push(formatMemorySection(memory))

  // 5. Git 状态
  const gitStatus = await getGitStatus()
  if (gitStatus) parts.push(formatGitStatusSection(gitStatus))

  // 6. 用户上下文
  const userContext = await getUserContext()
  parts.push(formatUserContextSection(userContext))

  return parts.map(text => ({ text }))
}

// 获取工具描述
async function getToolsDescription(): Promise<string> {
  const tools = await getTools()
  const descriptions = []

  for (const tool of tools) {
    descriptions.push(`## ${tool.name}`)
    descriptions.push(tool.description)
    if (tool.inputSchema.properties) {
      descriptions.push('Arguments:')
      for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
        descriptions.push(`  - ${name}: ${prop.description}`)
      }
    }
    descriptions.push('')
  }

  return descriptions.join('\n')
}
```

---

## 🎓 Claude Code 源码深度学习 - 完结总结

### 📊 最终统计

| 指标 | 数量 |
|------|------|
| **总代码量** | ~800,000 行 |
| **工具数量** | 45 个 |
| **命令数量** | 103+ 个 |
| **组件数量** | 146+ 个 |
| **Hooks** | 87+ 个 |
| **工具函数** | 290+ 个 |
| **学习文档** | **45 个** |

### 📚 文档完整列表 (45个)

```
~/projects/tech-blog/docs/
├── 架构与入口 (1-5)
│   ├── claude-code-study.md
│   ├── claude-code-query-engine.md
│   ├── claude-code-context-management.md
│   ├── claude-code-cli-commands-tasks.md
│   └── claude-code-entrypoint-appstate-hooks.md
│
├── 核心系统 (6-10)
│   ├── claude-code-tools-api-ui.md
│   ├── claude-code-tools-system.md
│   ├── claude-code-ink-ui-hooks.md
│   ├── claude-code-api-session-ide.md
│   └── claude-code-api-auth-memory.md
│
├── MCP·权限·记忆 (11-15)
│   ├── claude-code-mcp-permission-memory.md
│   ├── claude-code-mcp-settings-constants.md
│   ├── claude-code-compact-memory-session.md
│   ├── claude-code-sandbox-mcp-coordinator.md
│   └── claude-code-mcp-telemetry-final.md
│
├── 安全·诊断·配置 (16-20)
│   ├── claude-code-diagnostic-security-config.md
│   ├── claude-code-state-notify-api.md
│   ├── claude-code-api-client-errors.md
│   └── claude-code-settings-oauth-lsp.md
│
├── 工具函数库 (21-30)
│   ├── claude-code-utils-hash-git-platform.md
│   ├── claude-code-utils-exec-json-memoize.md
│   ├── claude-code-utils-string-http.md
│   ├── claude-code-diff-treeify-session.md
│   ├── claude-code-token-unicode-session.md
│   ├── claude-code-theme-circular-tmux.md
│   ├── claude-code-binary-generator-earlyinput.md
│   ├── claude-code-process-fullscreen-voice.md
│   └── claude-code-bash-git-markdown.md
│
├── Ink·渲染·遥测 (31-35)
│   ├── claude-code-ink-screen-telemetry.md
│   ├── claude-code-image-vcr-signal.md
│   ├── claude-code-cron-markdown-mailbox.md
│   └── claude-code-circular-signal-mailbox.md
│
├── Swarm·Team·协作 (36-40)
│   ├── claude-code-dream-swarm-virtualscroll.md
│   ├── claude-code-team-plans-worktree.md
│   ├── claude-code-sdk-remote-session.md
│   ├── claude-code-bridge-remote-control.md
│   └── claude-code-builtin-agents-fork.md
│
└── 高级特性·总结 (41-45)
    ├── claude-code-ide-voice-notify-tips.md
    ├── claude-code-logging-telemetry-plugins.md
    ├── claude-code-model-tools-components.md
    ├── claude-code-coordinator-permissions-git.md
    └── claude-code-final-summary.md (当前)
```

### 🏗️ 核心架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI 入口点                               │
│  entrypoints/cli.tsx → CLI → SDK → MCP                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        QueryEngine                               │
│  处理用户输入 → 构建请求 → 调用 API → 处理流                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     上下文管理                                  │
│  SystemPrompt + UserContext + Memory + GitStatus                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      工具系统 (45个)                             │
│  FileTool | BashTool | MCPTool | AgentTool | TaskTool | ...    │
│  ↓                                                           │
│  权限验证 → 执行 → 结果缓存 → 上下文更新                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MCP 客户端                                  │
│  stdio | SSE | HTTP | WebSocket | SDK                          │
│  连接管理 → 工具发现 → 调用转发                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      状态管理                                    │
│  AppState + Speculation + Tasks + Sessions                      │
└─────────────────────────────────────────────────────────────────┘
```

### 🔑 300 个核心设计模式

| # | 模式 | 应用场景 |
|---|------|----------|
| 1-10 | **基础架构** | AsyncGenerator, Signal, LRU Cache, 分层缓存, 规则引擎, 工厂模式, 观察者, 懒加载, 快速路径, Mailbox |
| 11-20 | **高级特性** | 优先级队列, Cron 解析, Virtual List, WeakRef, 指数退避, Token 预算, OAuth 流程, WebSocket 重连, 环形缓冲, TTL 缓存 |
| 21-30 | **工具函数** | 路径截断, BufferedWriter, JSONC 解析, Object GroupBy, Grapheme 分割, Store 模式, Shell AST, MCP 传输, Swarm Agent, TMUX 隔离 |
| 31-40 | **安全与遥测** | Unicode 净化, Early Input, OpenTelemetry, Perfetto, Beta 追踪, Sandbox, 权限检查, Path Validation |
| 41-50 | **UI 与渲染** | Ink, VirtualScroll, React Reconciler, Screen Pools, Markdown, Diff, Treeify |
| 51-60 | **记忆系统** | MEMORY.md, AutoMem, SessionMemory, TeamMemory, Dream Consolidation |
| 61-70 | **协作系统** | Swarm, Fork, Bridge, Coordinator, Remote Session |
| 71-80 | **开发体验** | CLI, Hooks, Plugins, Skills, Analytics |
| 81-90 | **API 层** | Multi-backend, Retry, Error Handling, Auth |
| 91-100 | **测试与诊断** | VCR, Fixtures, Logging, Telemetry |

### 🎯 关键技术亮点

1. **零成本抽象** - `--version` 零模块加载
2. **智能上下文** - 动态阈值 + 虚拟列表 + WeakRef 缓存
3. **多传输协议** - Stdio/SSE/HTTP/WebSocket + OAuth
4. **安全第一** - 分层权限，路径验证，Unicode 净化
5. **多后端支持** - Anthropic/AWS/Azure/Vertex
6. **团队协作** - Swarm 架构 + Fork 子会话
7. **记忆系统** - 4 种记忆类型，自动提取
8. **VCR 测试** - Fixture 管理，录制回放
9. **Signal 模式** - 轻量级事件发射器
10. **OAuth PKCE** - 安全授权码流程 + localhost 回调

### 🎓 学习收获

通过深入学习 Claude Code 源码，我掌握了许多现代 TypeScript/React 应用开发的最佳实践：

- **性能优化**: 缓存策略、懒加载、虚拟列表
- **安全设计**: 分层权限、输入验证、Unicode 净化
- **可扩展性**: 插件系统、技能系统、MCP 协议
- **状态管理**: AppState、Speculation、Tasks
- **测试策略**: VCR、Fixtures、Mock
- **遥测体系**: OpenTelemetry、Perfetto、Analytics

---

**🎉 Claude Code 源码深度学习圆满完成！**

所有 45 个学习文档已保存在 `~/projects/tech-blog/docs/claude-code-*.md` 🌙