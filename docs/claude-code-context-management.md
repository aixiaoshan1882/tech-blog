# Claude Code 源码深度学习笔记 (第四部分)

> 上下文管理系统 - Context Management

## 十八、上下文管理架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         上下文分层 (Context Layers)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               System Prompt (系统提示)                               │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │   │
│  │  │  Base Prompt    │ │ Tool Prompts    │ │  Style/Format      │  │   │
│  │  │  (核心指令)     │ │ (工具描述)       │ │  (输出格式)         │  │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               User Context (用户上下文)                             │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │   │
│  │  │  CLAUDE.md      │ │  Memory Files  │ │  Current Date      │  │   │
│  │  │  (项目知识)      │ │  (记忆文件)    │ │  (当前日期)         │  │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               System Context (系统上下文)                           │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │   │
│  │  │  Git Status     │ │  Branch Info    │ │  Working Dir       │  │   │
│  │  │  (Git状态)      │ │  (分支信息)      │ │  (工作目录)         │  │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Session Messages (会话消息)                            │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │   │
│  │  │  User Messages   │ │  Assistant MSGs │ │  Tool Results       │  │   │
│  │  │  (用户输入)      │ │  (AI回复)       │ │  (工具结果)         │  │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │               Context Optimization (上下文优化)                       │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐  │   │
│  │  │  Compact        │ │  Micro-Compact │ │  Auto-Compact      │  │   │
│  │  │  (压缩/摘要)    │ │  (工具结果清除) │ │  (自动压缩)         │  │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 十九、系统提示构建 (System Prompt)

### 系统提示分段 (systemPromptSections.ts)

```typescript
// 核心抽象: SystemPromptSection
type SystemPromptSection = {
  name: string
  compute: () => string | null | Promise<string | null>
  cacheBreak: boolean  // 是否破坏缓存
}

// 创建可缓存的段落
export function systemPromptSection(
  name: string,
  compute: ComputeFn,
): SystemPromptSection {
  return { name, compute, cacheBreak: false }
}

// 创建易变的段落 (每次都重新计算)
export function DANGMOUS_uncachedSystemPromptSection(
  name: string,
  compute: ComputeFn,
  reason: string,  // 必须说明为什么需要破坏缓存
): SystemPromptSection {
  return { name, compute, cacheBreak: true }
}

// 解析所有段落
export async function resolveSystemPromptSections(
  sections: SystemPromptSection[],
): Promise<(string | null)[]> {
  const cache = getSystemPromptSectionCache()
  
  return Promise.all(
    sections.map(async s => {
      if (!s.cacheBreak && cache.has(s.name)) {
        return cache.get(s.name) ?? null
      }
      const value = await s.compute()
      setSystemPromptSectionCacheEntry(s.name, value)
      return value
    })
  )
}
```

### 提示构建 (prompts.ts)

```typescript
export const getSystemPrompt = memoize(async (): Promise<string[]> => {
  const sections = [
    // 核心指令
    systemPromptSection('core', computeCorePrompt),
    
    // 工具描述 (动态)
    systemPromptSection('tools', () => buildToolDescriptions(tools)),
    
    // Git 状态 (可选)
    gitStatus && systemPromptSection('git', () => gitStatus),
    
    // CLAUDE.md 内容
    systemPromptSection('claudeMd', () => getClaudeMd()),
  ]
  
  return resolveSystemPromptSections(sections)
})
```

## 二十、用户上下文 (User Context)

### CLAUDE.md 和 Memory

```typescript
export const getUserContext = memoize(async (): Promise<{
  [k: string]: string
}> => {
  // 跳过自动发现 (--bare 模式)
  const shouldDisableClaudeMd = 
    isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_CLAUDE_MDS) ||
    (isBareMode() && getAdditionalDirectoriesForClaudeMd().length === 0)
  
  // 获取 CLAUDE.md 文件
  const claudeMd = shouldDisableClaudeMd
    ? null
    : getClaudeMds(filterInjectedMemoryFiles(await getMemoryFiles()))
  
  return {
    ...(claudeMd && { claudeMd }),
    currentDate: `Today's date is ${getLocalISODate()}.`,
  }
})
```

### 缓存管理

```typescript
// 清除所有上下文缓存 (在 /clear 和 /compact 时调用)
export function clearSystemPromptSections(): void {
  clearSystemPromptSectionState()
  clearBetaHeaderLatches()
}
```

## 二十一、会话消息管理

### 消息类型

```typescript
type Message = 
  | UserMessage        // 用户消息
  | AssistantMessage  // AI 助手消息
  | SystemMessage     // 系统消息 (工具输出等)
  | ProgressMessage   // 进度消息
  | AttachmentMessage // 附件消息

// 用户消息
type UserMessage = {
  type: 'user'
  message: {
    role: 'user'
    content: string | ContentBlock[]
  }
  isMeta: boolean           // 元消息 (不显示)
  isVirtual: boolean        // 虚拟消息 (仅内部)
  isCompactSummary: boolean // 压缩摘要
}

// 助手消息
type AssistantMessage = {
  type: 'assistant'
  message: {
    role: 'assistant'
    content: ContentBlock[]  // TextBlock | ToolUseBlock | ThinkingBlock
  }
  isMeta: boolean
}
```

### 消息规范化 (normalizeMessagesForAPI)

```typescript
export function normalizeMessagesForAPI(
  messages: Message[],
  tools: Tools = [],
): (UserMessage | AssistantMessage)[] {
  // 1. 重新排序附件 (冒泡到 tool result 或 assistant message 之前)
  const reorderedMessages = reorderAttachmentsForAPI(messages)
  
  // 2. 过滤虚拟消息 (REPL 内部工具调用等)
  .filter(m => !(m.type === 'user' || m.type === 'assistant') && m.isVirtual)
  
  // 3. 过滤系统消息 (除了 local_command)
  .filter(m => {
    if (m.type === 'progress') return false
    if (m.type === 'system' && !isSystemLocalCommandMessage(m)) return false
    return true
  })
  
  // 4. 转换 local_command 为 user message
  // 5. 合并连续的用户消息
  // ...
}
```

## 二十二、上下文压缩 (Compact)

### 压缩机制

```typescript
// compact.ts - 主要压缩逻辑
export async function compactMessages(
  messages: Message[],
  options: {
    maxTokens: number
    preserveRecent: number  // 保留最近 N 条消息
  }
): Promise<{
  compacted: Message[]
  summary: string  // 生成的摘要
}> {
  // 1. 分析上下文
  const analysis = analyzeContext(messages)
  
  // 2. 识别可压缩的内容
  const duplicateReads = analysis.duplicateFileReads
  
  // 3. 生成摘要
  const summary = await generateSummary(
    messages.slice(0, -options.preserveRecent)
  )
  
  // 4. 返回压缩后的消息
  return {
    compacted: [
      ...summaryMessage(summary),
      ...messages.slice(-options.preserveRecent)
    ],
    summary
  }
}
```

### 上下文分析

```typescript
// contextAnalysis.ts
export function analyzeContext(messages: Message[]): TokenStats {
  const stats: TokenStats = {
    toolRequests: new Map(),    // 工具调用统计
    toolResults: new Map(),     // 工具结果统计
    humanMessages: 0,
    assistantMessages: 0,
    duplicateFileReads: new Map(),  // 重复读取的文件
    total: 0,
  }
  
  messages.forEach(msg => {
    if (msg.type === 'tool_use') {
      // 统计工具调用
    }
    if (msg.type === 'tool_result') {
      // 统计工具结果
    }
  })
  
  // 计算重复文件读取
  // 如果同一文件被读取多次，标记为可压缩
  
  return stats
}
```

### Micro-Compact (轻量压缩)

```typescript
// microCompact.ts - 工具结果清除
const COMPACTABLE_TOOLS = new Set([
  FILE_READ_TOOL_NAME,
  GREP_TOOL_NAME,
  GLOB_TOOL_NAME,
  WEB_SEARCH_TOOL_NAME,
  // ...
])

// 清除旧工具结果内容，保留引用
export function microCompact(
  messages: Message[],
  maxAge: number = 1000 * 60 * 60  // 1小时
): Message[] {
  return messages.map(msg => {
    if (isToolResult(msg) && isCompactableTool(msg.toolName)) {
      if (msg.timestamp < Date.now() - maxAge) {
        return {
          ...msg,
          content: TIME_BASED_MC_CLEARED_MESSAGE
        }
      }
    }
    return msg
  })
}
```

## 二十三、自动压缩 (Auto-Compact)

```typescript
// autoCompact.ts
export function calculateTokenWarningState(
  contextTokens: number,
  maxTokens: number,
  model: string
): 'ok' | 'warning' | 'critical' {
  const ratio = contextTokens / maxTokens
  
  if (ratio > 0.95) return 'critical'
  if (ratio > 0.80) return 'warning'
  return 'ok'
}

// 触发自动压缩
export function shouldAutoCompact(
  contextTokens: number,
  model: string
): boolean {
  const threshold = getAutoCompactThreshold(model)
  return contextTokens > threshold
}
```

## 二十四、缓存键管理

```typescript
// queryContext.ts
export async function fetchSystemPromptParts({
  tools,
  mainLoopModel,
  additionalWorkingDirectories,
  mcpClients,
  customSystemPrompt,
}: {
  // ...
}): Promise<{
  defaultSystemPrompt: string[]
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
}> {
  // 并行获取三个部分
  const [defaultSystemPrompt, userContext, systemContext] = await Promise.all([
    // 系统提示 (可能为空，使用自定义提示时)
    customSystemPrompt !== undefined
      ? Promise.resolve([])
      : getSystemPrompt(tools, mainLoopModel, additionalWorkingDirectories, mcpClients),
    
    // 用户上下文
    getUserContext(),
    
    // 系统上下文 (可能为空)
    customSystemPrompt !== undefined ? Promise.resolve({}) : getSystemContext(),
  ])
  
  return { defaultSystemPrompt, userContext, systemContext }
}
```

## 二十五、关键设计模式

### 1. 分层缓存

```typescript
// 第一层: SystemPromptSection 缓存
const cache = getSystemPromptSectionCache()

// 第二层: getSystemContext / getUserContext 缓存
export const getUserContext = memoize(async () => { ... })

// 第三层: 查询级别的缓存键
```

### 2. 渐进式上下文

```typescript
// 不是一次性加载所有上下文
// 而是在需要时按需计算

const context = await buildContext({
  includeGit: shouldIncludeGitInstructions(),
  includeMemory: !isBareMode(),
  includeTools: true,
})
```

### 3. 可插拔的上下文源

```typescript
type ContextSource = {
  name: string
  enabled: boolean
  compute: () => Promise<string>
  priority: number
}

// 注册上下文源
registerContextSource({
  name: 'claudeMd',
  enabled: () => !isDisabled(),
  compute: () => getClaudeMd(),
  priority: 1,
})
```

---

## 架构总结

| 组件 | 文件 | 职责 |
|------|------|------|
| 系统提示分段 | `constants/systemPromptSections.ts` | 提示模块化 |
| 提示构建 | `constants/prompts.ts` | 组装系统提示 |
| 用户上下文 | `context.ts` | CLAUDE.md/Memory |
| 消息规范化 | `utils/messages.ts` | 消息转换 |
| 上下文压缩 | `services/compact/compact.ts` | 压缩算法 |
| 上下文分析 | `utils/contextAnalysis.ts` | Token 统计 |
| 微压缩 | `services/compact/microCompact.ts` | 轻量压缩 |
| 自动压缩 | `services/compact/autoCompact.ts` | 阈值触发 |