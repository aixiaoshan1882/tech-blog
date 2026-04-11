# Claude Code 源码深度学习笔记 (第十七部分)

> 上下文压缩 · 内存目录 · 会话存储 · 记忆系统

---

## 九十一、上下文压缩系统

### 压缩架构

```typescript
// services/compact/compact.ts

export async function compactMessages(
  messages: Message[],
  options: CompactOptions,
): Promise<CompactResult> {
  const {
    maxTokens,
    model,
    reason,
    isPreCompact,
  } = options

  // 1. 分析上下文
  const analysis = await analyzeContext(messages)

  // 2. 执行压缩前钩子
  await executePreCompactHooks(messages, analysis)

  // 3. 生成摘要
  const summary = await generateCompactSummary(messages, {
    maxTokens: maxTokens - COMPACT_MAX_OUTPUT_TOKENS,
    model,
  })

  // 4. 替换消息
  const compressed = replaceMessagesWithSummary(messages, summary)

  // 5. 添加压缩边界消息
  const withBoundary = addCompactBoundary(compressed, summary)

  // 6. 执行压缩后钩子
  await executePostCompactHooks(withBoundary)

  return {
    messages: withBoundary,
    summary,
    tokensSaved: analysis.totalTokens - countTokens(withBoundary),
  }
}
```

### 压缩类型

```typescript
// services/compact/

// 1. microCompact - 轻量级压缩
// 只压缩最后一个 Turn，保留大多数上下文

// 2. sessionMemoryCompact - 会话记忆压缩
// 将重要信息提取到会话记忆文件

// 3. timeBasedMC - 基于时间的压缩
// 定期压缩旧消息

// 4. autoCompact - 自动压缩
// 根据上下文大小自动触发
```

### 压缩触发条件

```typescript
// services/compact/autoCompact.ts

export interface AutoCompactConfig {
  enabled: boolean
  thresholdPercent: number      // 达到上下文 % 时触发
  minMessagesBetween: number    // 最小消息间隔
  checkIntervalMs: number
}

export async function checkAndCompact(): Promise<void> {
  const config = getAutoCompactConfig()

  if (!config.enabled) return

  const currentUsage = getContextUsage()
  const percentUsed = (currentUsage / getContextLimit()) * 100

  if (percentUsed >= config.thresholdPercent) {
    await compactMessages({
      reason: 'auto',
      threshold: config.thresholdPercent,
    })
  }
}
```

---

## 九十二、内存目录系统

### MEMORY.md 结构

```typescript
// memdir/memdir.ts

export const ENTRYPOINT_NAME = 'MEMORY.md'
export const MAX_ENTRYPOINT_LINES = 200
export const MAX_ENTRYPOINT_BYTES = 25_000

export interface EntrypointTruncation {
  content: string
  lineCount: number
  byteCount: number
  wasLineTruncated: boolean
  wasByteTruncated: boolean
}

// 截断过长的 MEMORY.md
export function truncateEntrypointContent(raw: string): EntrypointTruncation {
  const contentLines = raw.split('\n')
  const lineCount = contentLines.length
  const byteCount = raw.length

  // 行数截断
  if (lineCount > MAX_ENTRYPOINT_LINES) {
    const truncated = contentLines.slice(0, MAX_ENTRYPOINT_LINES).join('\n')
    return {
      content: truncated,
      lineCount,
      byteCount,
      wasLineTruncated: true,
      wasByteTruncated: false,
    }
  }

  // 字节数截断
  if (byteCount > MAX_ENTRYPOINT_BYTES) {
    const cutAt = truncated.lastIndexOf('\n', MAX_ENTRYPOINT_BYTES)
    return {
      content: truncated.slice(0, cutAt),
      lineCount,
      byteCount,
      wasLineTruncated: false,
      wasByteTruncated: true,
    }
  }

  return {
    content: raw,
    lineCount,
    byteCount,
    wasLineTruncated: false,
    wasByteTruncated: false,
  }
}
```

### 记忆类型分类

```typescript
// memdir/memoryTypes.ts

export const MEMORY_TYPES = [
  'user',      // 用户信息
  'feedback',  // 反馈指导
  'project',   // 项目状态
  'reference', // 外部引用
] as const

export type MemoryType = (typeof MEMORY_TYPES)[number]

// 记忆文件格式
export interface MemoryFile {
  type: MemoryType
  title: string
  content: string
  createdAt: string
  updatedAt: string
  tags?: string[]
}

// 记忆存储结构
// ~/.claude/memory/
// ├── MEMORY.md           # 主入口
// ├── user/
// │   └── *.md
// ├── feedback/
// │   └── *.md
// ├── project/
// │   └── *.md
// └── reference/
//     └── *.md
```

### 记忆读写

```typescript
// memdir/findRelevantMemories.ts

export async function findRelevantMemories(
  query: string,
  options?: FindOptions,
): Promise<MemoryMatch[]> {
  const {
    types = MEMORY_TYPES,
    limit = 10,
    minSimilarity = 0.7,
  } = options ?? {}

  // 1. 扫描记忆目录
  const files = await scanMemoryDirectory()

  // 2. 向量化查询
  const queryEmbedding = await embedText(query)

  // 3. 计算相似度
  const scored: Array<{ file: MemoryFile; score: number }> = []

  for (const file of files) {
    if (!types.includes(file.type)) continue

    const fileEmbedding = await embedText(file.content)
    const score = cosineSimilarity(queryEmbedding, fileEmbedding)

    if (score >= minSimilarity) {
      scored.push({ file, score })
    }
  }

  // 4. 排序返回
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({ ...s.file, relevance: s.score }))
}
```

---

## 九十三、会话存储系统

### 会话文件结构

```typescript
// utils/sessionStorage.ts

export interface SessionData {
  sessionId: SessionId
  createdAt: number
  messages: SerializedMessage[]
  metadata: SessionMetadata
  cost?: CostSummary
}

export interface SessionMetadata {
  model: string
  workingDirectory: string
  branch?: string
  title?: string
  turnCount: number
  inputTokens: number
  outputTokens: number
}

// 会话目录结构
// ~/.claude/sessions/
// └── <session-id>/
//     ├── session.json      # 会话数据
//     ├── messages.jsonl    # 消息流
//     ├── cost.json         # 成本摘要
//     └── artifacts/        # 工件
```

### 会话持久化

```typescript
// utils/sessionStorage.ts

export async function saveSession(
  sessionId: SessionId,
  data: SessionData,
): Promise<void> {
  const sessionDir = getSessionDir(sessionId)
  await mkdir(sessionDir, { recursive: true })

  // 保存主会话文件
  const sessionPath = join(sessionDir, 'session.json')
  await writeFile(sessionPath, jsonStringify(data))

  // 追加到消息流
  const messagesPath = join(sessionDir, 'messages.jsonl')
  for (const message of data.messages) {
    await fsAppendFile(messagesPath, jsonStringify(message) + '\n')
  }
}

export async function loadSession(
  sessionId: SessionId,
): Promise<SessionData | null> {
  const sessionPath = getSessionPath(sessionId, 'session.json')

  if (!existsSync(sessionPath)) {
    return null
  }

  return jsonParse(await readFile(sessionPath, 'utf-8'))
}
```

### 会话恢复

```typescript
// utils/sessionRestore.ts

export async function restoreSession(
  sessionId: SessionId,
): Promise<RestoreResult> {
  // 1. 加载会话数据
  const session = await loadSession(sessionId)

  if (!session) {
    return { success: false, error: 'Session not found' }
  }

  // 2. 验证工作目录
  if (!existsSync(session.metadata.workingDirectory)) {
    return {
      success: false,
      error: 'Working directory no longer exists',
      session,
    }
  }

  // 3. 恢复环境
  await restoreWorkingDirectory(session.metadata.workingDirectory)

  // 4. 恢复消息
  const messages = await loadMessages(sessionId)

  return {
    success: true,
    session,
    messages,
  }
}
```

---

## 九十四、记忆类型详解

### User 记忆

```markdown
# Type: user
# Scope: always private

## 保存内容
- 用户角色和职责
- 用户偏好
- 用户知识水平
- 用户目标

## 使用场景
当需要根据用户背景定制回答时

## 示例
user: I'm a data scientist investigating what logging we have in place
assistant: [saves private user memory: user is a data scientist,
           currently focused on observability/logging]
```

### Feedback 记忆

```markdown
# Type: feedback
# Scope: default to private, team when project-wide convention

## 保存内容
- 用户指导 (避免什么 / 继续做什么)
- 成功和失败的反馈
- 风格偏好

## 结构
Lead with the rule itself, then:
- **Why:** 原因
- **How to apply:** 如何应用

## 示例
user: don't mock the database in these tests — we got burned
      last quarter when mocked tests passed but prod failed
assistant: [saves team feedback memory: integration tests must
           hit a real database. Reason: mock/prod divergence
           masked a broken migration]
```

### Project 记忆

```markdown
# Type: project
# Scope: private or team, strongly bias toward team

## 保存内容
- 正在进行的工作
- 目标和截止日期
- 主动推进的问题

## 示例
user: we're freezing all non-critical merges after Thursday
assistant: [saves team project memory: merge freeze begins
           2026-03-05 for mobile release cut]
```

### Reference 记忆

```markdown
# Type: reference
# Scope: usually team

## 保存内容
- 外部系统指针
- 资源位置
- 信息查找方向

## 示例
user: check the Linear project "INGEST" for pipeline bugs
assistant: [saves team reference memory: pipeline bugs are
           tracked in Linear project "INGEST"]
```

---

## 九十五、重要设计模式

### 1. 压缩边界标记

```typescript
// 添加压缩边界消息
function addCompactBoundary(
  messages: Message[],
  summary: CompactSummary,
): Message[] {
  const boundary: SystemCompactBoundaryMessage = {
    type: 'system_compact_boundary',
    id: generateMessageId(),
    timestamp: Date.now(),
    summary: summary.content,
    originalMessageCount: summary.messageCount,
    tokensSaved: summary.tokensSaved,
    models: summary.models,
  }

  return [
    ...messages.filter(m => !shouldExclude(m)),
    boundary,
  ]
}
```

### 2. 懒加载模块

```typescript
// 特性标志懒加载
const sessionTranscriptModule = feature('KAIROS')
  ? require('../sessionTranscript/sessionTranscript.js')
  : null

// 使用
if (sessionTranscriptModule) {
  await sessionTranscriptModule.loadTranscript(sessionId)
}
```

### 3. 记忆文件扫描

```typescript
// 扫描记忆目录
async function scanMemoryDirectory(): Promise<MemoryFile[]> {
  const memoryRoot = getMemoryRoot()
  const files: MemoryFile[] = []

  for (const type of MEMORY_TYPES) {
    const typeDir = join(memoryRoot, type)

    if (!existsSync(typeDir)) continue

    const entries = readdirSync(typeDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await readFile(join(typeDir, entry.name), 'utf-8')
        files.push(parseMemoryFile(content, type))
      }
    }
  }

  return files
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **压缩** | `services/compact/compact.ts` | 上下文压缩 |
| **自动压缩** | `services/compact/autoCompact.ts` | 自动触发 |
| **内存目录** | `memdir/memdir.ts` | 记忆入口 |
| **记忆类型** | `memdir/memoryTypes.ts` | 4种记忆 |
| **记忆查找** | `memdir/findRelevantMemories.ts` | 语义搜索 |
| **会话存储** | `utils/sessionStorage.ts` | 会话持久化 |
| **会话恢复** | `utils/sessionRestore.ts` | 会话恢复 |
| **成本追踪** | `cost-tracker.ts` | 成本统计 |