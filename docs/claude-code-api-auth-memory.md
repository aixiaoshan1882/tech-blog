# Claude Code 源码深度学习笔记 (第十五部分)

> API 客户端 · 认证系统 · 会话记忆 · 服务生态

---

## 八十、API 客户端

### 多后端支持

```typescript
// services/api/client.ts

export async function getAnthropicClient({
  apiKey,
  maxRetries,
  model,
  source,
}: {
  apiKey?: string
  maxRetries: number
  model?: string
  source?: string
}): Promise<Anthropic> {
  // 支持的 API 提供商:
  // 1. Direct Anthropic API
  // 2. AWS Bedrock
  // 3. Azure Foundry
  // 4. Google Vertex AI

  const provider = getAPIProvider()

  switch (provider) {
    case 'aws':
      return createBedrockClient(model)
    case 'azure':
      return createFoundryClient(model)
    case 'vertex':
      return createVertexClient(model)
    default:
      return createAnthropicClient(apiKey, maxRetries)
  }
}
```

### 环境变量配置

```typescript
// Direct API
ANTHROPIC_API_KEY=sk-...

// AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

// Azure Foundry
ANTHROPIC_FOUNDRY_RESOURCE=my-resource
ANTHROPIC_FOUNDRY_API_KEY=...

// Vertex AI
VERTEX_REGION_CLAUDE_3_5_SONNET=us-east5
ANTHROPIC_VERTEX_PROJECT_ID=my-project
```

### 请求重试

```typescript
// services/api/withRetry.ts

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry,
  } = options ?? {}

  let lastError: Error | undefined
  let delay = initialDelayMs

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (i === maxRetries || !shouldRetry?.(error)) {
        throw error
      }

      // 指数退避
      await sleep(delay)
      delay = Math.min(delay * backoffMultiplier, maxDelayMs)
    }
  }

  throw lastError
}
```

---

## 八十一、认证系统

### OAuth 流程

```typescript
// services/oauth/client.ts

// 构建授权 URL
export function buildAuthUrl({
  codeChallenge,
  state,
  port,
  isManual,
  loginWithClaudeAi,
  inferenceOnly,
}: {
  codeChallenge: string
  state: string
  port: number
  isManual: boolean
  loginWithClaudeAi?: boolean
  inferenceOnly?: boolean
}): string {
  const authUrl = new URL(getOauthConfig().CLAUDE_AI_AUTHORIZE_URL)
  authUrl.searchParams.append('client_id', getOauthConfig().CLIENT_ID)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('redirect_uri', `http://localhost:${port}/callback`)
  authUrl.searchParams.append('scope', ALL_OAUTH_SCOPES.join(' '))
  authUrl.searchParams.append('code_challenge', codeChallenge)
  authUrl.searchParams.append('code_challenge_method', 'S256')
  authUrl.searchParams.append('state', state)

  return authUrl.toString()
}

// Token 交换
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<OAuthTokens> {
  const response = await axios.post(getOauthConfig().TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: getOauthConfig().CLIENT_ID,
  })

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  }
}
```

### Token 刷新

```typescript
// utils/auth.ts

export async function checkAndRefreshOAuthTokenIfNeeded(): Promise<OAuthTokens | null> {
  const tokens = getClaudeAIOAuthTokens()

  if (!tokens) return null

  // 检查是否即将过期 (5分钟前)
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000

  if (tokens.expiresAt > fiveMinutesFromNow) {
    return tokens
  }

  // 刷新 token
  const newTokens = await refreshOAuthToken(tokens.refreshToken)
  saveOAuthTokens(newTokens)

  return newTokens
}

async function refreshOAuthToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await axios.post(getOauthConfig().TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: getOauthConfig().CLIENT_ID,
  })

  return {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  }
}
```

### API Key 获取

```typescript
// utils/auth.ts

export function getAnthropicApiKey(): string | undefined {
  // 优先级:
  // 1. 环境变量
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY
  }

  // 2. 全局配置
  const globalConfig = getGlobalConfig()
  if (globalConfig.apiKey) {
    return globalConfig.apiKey
  }

  // 3. OAuth token
  const oauthTokens = getClaudeAIOAuthTokens()
  if (oauthTokens?.accessToken) {
    return oauthTokens.accessToken
  }

  return undefined
}
```

---

## 八十二、会话记忆 (SessionMemory)

### 记忆提取

```typescript
// services/SessionMemory/sessionMemory.ts

export interface MemoryEntry {
  id: string
  type: 'fact' | 'preference' | 'context' | 'learning'
  content: string
  confidence: number
  extractedAt: number
  source?: string
}

export async function extractMemories(
  messages: Message[],
): Promise<MemoryEntry[]> {
  const memories: MemoryEntry[] = []

  for (const message of messages) {
    if (message.type === 'user') {
      // 从用户消息中提取记忆
      const extracted = await extractFromUserMessage(message.content)
      memories.push(...extracted)
    }
  }

  // 去重和合并
  return deduplicateAndMerge(memories)
}

// 记忆类型
export type MemoryType = 'fact' | 'preference' | 'context' | 'learning'

const memoryExtractors: Record<MemoryType, MemoryExtractor> = {
  fact: extractFacts,
  preference: extractPreferences,
  context: extractContext,
  learning: extractLearnings,
}
```

### 记忆存储

```typescript
// services/SessionMemory/sessionMemoryUtils.ts

export async function saveMemoryToFile(
  memories: MemoryEntry[],
): Promise<void> {
  const memoryFile = getMemoryFilePath()

  const existing = await readMemoryFile(memoryFile)
  const merged = mergeMemories(existing, memories)

  await writeFile(memoryFile, jsonStringify(merged, null, 2))
}

export async function loadMemories(): Promise<MemoryEntry[]> {
  const memoryFile = getMemoryFilePath()

  if (!existsSync(memoryFile)) {
    return []
  }

  return jsonParse(await readFile(memoryFile, 'utf-8'))
}

function mergeMemories(
  existing: MemoryEntry[],
  newOnes: MemoryEntry[],
): MemoryEntry[] {
  // 按内容哈希去重
  const byHash = new Map<string, MemoryEntry>()

  for (const memory of [...existing, ...newOnes]) {
    const hash = hashContent(memory.content)
    const existing = byHash.get(hash)

    if (!existing || memory.confidence > existing.confidence) {
      byHash.set(hash, memory)
    }
  }

  return Array.from(byHash.values())
}
```

---

## 八十三、服务生态总览

### 核心服务

```
services/
├── api/                    # API 客户端
│   ├── client.ts          # 多后端支持
│   ├── withRetry.ts       # 重试机制
│   ├── claude.ts          # Claude API
│   └── filesApi.ts        # 文件上传
├── analytics/             # 分析服务
│   ├── index.ts           # 事件追踪
│   └── firstPartyEventLogger.ts
├── oauth/                 # OAuth 认证
│   ├── client.ts          # OAuth 流程
│   └── getOauthProfile.ts  # 获取用户信息
├── mcp/                   # MCP 协议
│   ├── client.ts          # MCP 客户端
│   └── types.ts           # 类型定义
├── lsp/                   # 语言服务器
│   ├── manager.ts         # LSP 管理
│   └── LSPServerInstance.ts
├── compact/               # 上下文压缩
├── plugins/               # 插件系统
├── SessionMemory/         # 会话记忆
├── PromptSuggestion/      # 提示建议
├── AgentSummary/          # Agent 摘要
├── toolUseSummary/        # 工具使用摘要
├── voice/                 # 语音服务
├── notifier.ts            # 通知服务
└── rateLimitMessages.ts   # 限流消息
```

### 自动做梦 (AutoDream)

```typescript
// services/autoDream/autoDream.ts

export interface DreamConfig {
  enabled: boolean
  intervalMinutes: number
  model?: string
  prompt?: string
}

export async function runAutoDream(): Promise<DreamResult> {
  const config = getDreamConfig()

  if (!config.enabled) {
    return { skipped: true }
  }

  // 生成梦想内容
  const dream = await generateDream({
    model: config.model ?? 'claude-sonnet-4',
    prompt: config.prompt ?? DEFAULT_DREAM_PROMPT,
  })

  // 保存梦想
  await saveDream(dream)

  return { dream, skipped: false }
}
```

### 摘要服务 (AgentSummary)

```typescript
// services/AgentSummary/agentSummary.ts

export async function summarizeMessages(
  messages: Message[],
  options?: SummaryOptions,
): Promise<string> {
  const {
    maxTokens = 500,
    model = 'claude-sonnet-4',
  } = options ?? {}

  const prompt = buildSummaryPrompt(messages)

  const response = await callModel({
    model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
  })

  return response.content[0].text
}

// 用于上下文压缩前的摘要
export async function summarizeForCompact(
  messages: Message[],
): Promise<CompactableSummary> {
  const summary = await summarizeMessages(messages, {
    maxTokens: 1000,
  })

  return {
    summary,
    keyFacts: extractKeyFacts(messages),
    decisions: extractDecisions(messages),
  }
}
```

---

## 八十四、重要设计模式

### 1. 多后端抽象

```typescript
// 统一的 API 客户端接口
interface AIProvider {
  createClient(config: ProviderConfig): Client
  getModel(model: string): ModelConfig
  estimateTokens(text: string): number
  calculateCost(inputTokens: number, outputTokens: number): number
}

// 提供商注册表
const providers: Record<string, AIProvider> = {
  anthropic: new AnthropicProvider(),
  aws: new AWSBedrockProvider(),
  azure: new AzureFoundryProvider(),
  vertex: new VertexProvider(),
}

export function getProvider(name: string): AIProvider {
  return providers[name] ?? providers.anthropic
}
```

### 2. Token 刷新自动处理

```typescript
// 装饰器模式自动刷新 token
async function withTokenRefresh<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const tokens = await checkAndRefreshOAuthTokenIfNeeded()

  try {
    return await fn()
  } catch (error) {
    if (isTokenExpiredError(error)) {
      // 刷新并重试
      await refreshAndRetryToken()
      return fn()
    }
    throw error
  }
}
```

### 3. 记忆去重合并

```typescript
// 基于内容哈希的去重
function deduplicateAndMerge(memories: MemoryEntry[]): MemoryEntry[] {
  const byHash = new Map<string, MemoryEntry[]>()

  for (const memory of memories) {
    const hash = hashContent(memory.content)
    const existing = byHash.get(hash) ?? []
    existing.push(memory)
    byHash.set(hash, existing)
  }

  // 合并冲突的记忆
  const result: MemoryEntry[] = []
  for (const [, group] of byHash) {
    if (group.length === 1) {
      result.push(group[0])
    } else {
      // 多条相似记忆: 保留置信度最高的
      result.push(group.reduce((a, b) =>
        a.confidence >= b.confidence ? a : b,
      ))
    }
  }

  return result
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **API 客户端** | `services/api/client.ts` | 多后端 API |
| **重试** | `services/api/withRetry.ts` | 指数退避 |
| **OAuth** | `services/oauth/client.ts` | OAuth 流程 |
| **Token** | `utils/auth.ts` | Token 管理 |
| **会话记忆** | `services/SessionMemory/` | 记忆提取存储 |
| **自动做梦** | `services/autoDream/` | 定时梦想生成 |
| **摘要** | `services/AgentSummary/` | 消息摘要 |
| **通知** | `services/notifier.ts` | 系统通知 |