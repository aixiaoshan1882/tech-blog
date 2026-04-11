# Claude Code 源码深度学习笔记 (第二十二部分)

> 内置 Agent · Fork 子 Agent · 嵌入式搜索 · Agent 工具

---

## 一百一十七、内置 Agent

### 内置 Agent 列表

```typescript
// tools/AgentTool/builtInAgents.ts

export function getBuiltInAgents(): AgentDefinition[] {
  const agents = [
    GENERAL_PURPOSE_AGENT,    // 通用 Agent
    STATUSLINE_SETUP_AGENT,  // 状态栏设置
  ]

  if (areExplorePlanAgentsEnabled()) {
    agents.push(
      EXPLORE_AGENT,         // 探索 Agent
      PLAN_AGENT,           // 计划 Agent
    )
  }

  // 非 SDK 入口点添加代码指南
  if (!isSDKEntrypoint()) {
    agents.push(CLAUDE_CODE_GUIDE_AGENT)
  }

  if (feature('VERIFICATION_AGENT')) {
    agents.push(VERIFICATION_AGENT)
  }

  return agents
}
```

### Explore Agent

```typescript
// tools/AgentTool/built-in/exploreAgent.ts

export const EXPLORE_AGENT: BuiltInAgentDefinition = {
  agentType: 'Explore',
  whenToUse: 'Fast agent for exploring codebases. Use for finding files by patterns, searching code for keywords.',

  // 只读模式 - 禁止修改文件
  disallowedTools: [
    AGENT_TOOL_NAME,
    FILE_EDIT_TOOL_NAME,
    FILE_WRITE_TOOL_NAME,
  ],

  // 使用 haiku 模型以提高速度
  model: 'haiku',

  // 最小查询次数
  minQueries: 3,
}

// 系统提示
function getExploreSystemPrompt(): string {
  return `You are a file search specialist.
  === CRITICAL: READ-ONLY MODE ===
  You are STRICTLY PROHIBITED from:
  - Creating new files
  - Modifying existing files
  - Deleting files
  Your role is EXCLUSIVELY to search and analyze existing code.`
}
```

### Plan Agent

```typescript
// tools/AgentTool/built-in/planAgent.ts

export const PLAN_AGENT: BuiltInAgentDefinition = {
  agentType: 'Plan',
  whenToUse: 'Software architect for designing implementation plans.',

  disallowedTools: [
    AGENT_TOOL_NAME,
    FILE_EDIT_TOOL_NAME,
    FILE_WRITE_TOOL_NAME,
  ],

  model: 'sonnet',
}

// Plan Agent 流程
function getPlanV2SystemPrompt(): string {
  return `You are a software architect and planning specialist.
  1. Understand Requirements
  2. Explore Thoroughly (read files, find patterns)
  3. Design Solution
  4. Detail the Plan
     - Step-by-step implementation
     - Critical files (3-5)
     - Dependencies and sequencing
  === READ-ONLY MODE ===
  You CANNOT write, edit, or modify any files.`
}
```

---

## 一百一十八、Fork 子 Agent

### Fork 特性

```typescript
// tools/AgentTool/forkSubagent.ts

// Fork 特性开关
export function isForkSubagentEnabled(): boolean {
  if (feature('FORK_SUBAGENT')) {
    if (isCoordinatorMode()) return false
    if (getIsNonInteractiveSession()) return false
    return true
  }
  return false
}

// Fork Agent 定义
export const FORK_AGENT = {
  agentType: 'fork',
  tools: ['*'],              // 继承父 Agent 的工具池
  maxTurns: 200,
  model: 'inherit',         // 继承父 Agent 的模型
  permissionMode: 'bubble', // 权限请求冒泡到父终端
  source: 'built-in',
}
```

### Fork 触发条件

```typescript
// 当省略 subagent_type 时触发隐式 Fork
const forkAgentInput = {
  task: '分析这个代码库',
  // 没有 subagent_type → 触发 Fork
}
```

### Fork 子会话消息

```typescript
// 构建 Fork 子会话消息
export function buildForkMessages(
  parentMessages: Message[],
): Message[] {
  // 1. 保留父 Assistant 消息 (所有 tool_use blocks)
  const messages = parentMessages.filter(m => m.type === 'assistant')

  // 2. 添加 Fork 标记
  messages.push(createForkBoilerplateMessage())

  // 3. 添加用户任务消息
  messages.push(createUserMessage(content))

  // 4. 所有 tool_result 替换为占位符
  messages.map(m => {
    if (m.type === 'user') {
      return {
        ...m,
        message: {
          content: m.message.content.map(block => {
            if (block.type === 'tool_result') {
              return { ...block, content: FORK_PLACEHOLDER_RESULT }
            }
            return block
          }),
        },
      }
    }
    return m
  })

  return messages
}
```

### 防止递归 Fork

```typescript
// 检测是否在 Fork 子会话中
export function isInForkChild(messages: Message[]): boolean {
  return messages.some(m => {
    if (m.type !== 'user') return false
    const content = m.message.content
    return content.some(
      block =>
        block.type === 'text' &&
        block.text.includes(`<${FORK_BOILERPLATE_TAG}>`),
    )
  })
}
```

---

## 一百一十九、嵌入式搜索工具

### 嵌入式工具检测

```typescript
// utils/embeddedTools.ts

// 检查是否有嵌入式搜索工具
export function hasEmbeddedSearchTools(): boolean {
  if (!isEnvTruthy(process.env.EMBEDDED_SEARCH_TOOLS)) return false

  // SDK 入口点不使用嵌入式工具
  const e = process.env.CLAUDE_CODE_ENTRYPOINT
  return !['sdk-ts', 'sdk-py', 'sdk-cli', 'local-agent'].includes(e)
}

// 嵌入式搜索工具路径
export function embeddedSearchToolsBinaryPath(): string {
  return process.execPath
}
```

### BFS 和 UGREP

```typescript
// 当 hasEmbeddedSearchTools() 为 true 时:
// - `find` 和 `grep` 命令被 shell 函数覆盖
// - 调用 bun 二进制文件的 bfs/ugrep 实现
// - 专用的 Glob/Grep 工具从工具注册表中移除

// Shell 函数覆盖示例
// find() { /path/to/bun run bfs "$@"; }
// grep() { /path/to/bun run ugrep "$@"; }
```

---

## 一百二十、Agent 工具定义

### 内置 Agent 定义

```typescript
// tools/AgentTool/loadAgentsDir.ts

export interface BuiltInAgentDefinition extends AgentDefinition {
  source: 'built-in'
  baseDir: 'built-in'
}

export interface AgentDefinition {
  agentType: string
  whenToUse: string
  tools: string[] | ['*']
  maxTurns?: number
  model?: 'inherit' | ModelName
  permissionMode?: PermissionMode
  disallowedTools?: string[]
  getSystemPrompt?: () => string
  preambles?: AgentPreamble[]
}
```

### Agent 颜色管理

```typescript
// tools/AgentTool/agentColorManager.ts

export type AgentColorName =
  | 'blue' | 'green' | 'orange' | 'purple' | 'red'
  | 'yellow' | 'pink' | 'cyan' | 'gray'

export function getAgentColor(
  agentType: string,
): AgentColorName {
  // 根据 agent 类型返回固定颜色
  const colorMap: Record<string, AgentColorName> = {
    'Explore': 'blue',
    'Plan': 'purple',
    'General': 'green',
    'fork': 'orange',
  }

  return colorMap[agentType] ?? 'gray'
}
```

---

## 一百二十一、重要设计模式

### 1. Agent 工厂模式

```typescript
// 创建 Agent 实例
export function createAgent(
  definition: AgentDefinition,
  options: AgentOptions,
): Agent {
  return {
    id: generateUUID(),
    type: definition.agentType,
    model: resolveModel(definition.model, options),
    tools: loadTools(definition.tools),
    maxTurns: definition.maxTurns ?? 100,
    permissionMode: definition.permissionMode ?? 'default',

    async run(input: AgentInput): Promise<AgentOutput> {
      const messages = buildMessages(input)
      return this.execute(messages)
    },
  }
}
```

### 2. 权限模式冒泡

```typescript
// 权限请求冒泡到父会话
async function handlePermissionBubbling(
  request: PermissionRequest,
): Promise<PermissionResponse> {
  // Fork 子会话的权限请求发送到父终端
  if (this.permissionMode === 'bubble') {
    return sendToParentSession({
      type: 'permission_request',
      request,
      toolUseId: this.toolUseId,
    })
  }

  // 默认: 在当前会话中处理
  return this.askUser(request)
}
```

### 3. 模型继承

```typescript
// Fork 子会话继承父模型
function resolveAgentModel(
  definition: AgentDefinition,
  parentModel?: ModelName,
): ModelName {
  if (definition.model === 'inherit') {
    return parentModel ?? getDefaultModel()
  }
  return definition.model
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **内置 Agent** | `tools/AgentTool/builtInAgents.ts` | Agent 注册 |
| **Explore** | `tools/AgentTool/built-in/exploreAgent.ts` | 探索 Agent |
| **Plan** | `tools/AgentTool/built-in/planAgent.ts` | 计划 Agent |
| **Fork** | `tools/AgentTool/forkSubagent.ts` | Fork 子 Agent |
| **颜色** | `tools/AgentTool/agentColorManager.ts` | Agent 颜色 |
| **嵌入式** | `utils/embeddedTools.ts` | 嵌入式搜索 |
| **加载** | `tools/AgentTool/loadAgentsDir.ts` | Agent 加载 |