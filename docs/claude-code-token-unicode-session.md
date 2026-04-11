# Claude Code 源码深度学习笔记 (第三十二部分)

> Token 预算·上下文分析·Unicode 安全·会话恢复·环境验证

---

## 一百八十九、Token 预算解析

### 预算匹配

```typescript
// utils/tokenBudget.ts

// 简写格式: +500k, +2m, +1b
const SHORTHAND_START_RE = /^\s*\+(\d+(?:\.\d+)?)\s*(k|m|b)\b/i
const SHORTHAND_END_RE = /\s\+(\d+(?:\.\d+)?)\s*(k|m|b)\s*[.!?]?\s*$/i

// 详细格式: use 2M tokens, spend 500k tokens
const VERBOSE_RE = /\b(?:use|spend)\s+(\d+(?:\.\d+)?)\s*(k|m|b)\s*tokens?\b/i

const MULTIPLIERS = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
}

// 解析预算
export function parseTokenBudget(text: string): number | null {
  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) {
    return parseFloat(startMatch[1]!) * MULTIPLIERS[startMatch[2]!]
  }

  const endMatch = text.match(SHORTHAND_END_RE)
  if (endMatch) {
    return parseFloat(endMatch[1]!) * MULTIPLIERS[endMatch[2]!]
  }

  const verboseMatch = text.match(VERBOSE_RE)
  if (verboseMatch) {
    return parseFloat(verboseMatch[1]!) * MULTIPLIERS[verboseMatch[2]!]
  }

  return null
}

// 找到预算位置
export function findTokenBudgetPositions(
  text: string,
): Array<{ start: number; end: number }> {
  const positions: Array<{ start: number; end: number }> = []

  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) {
    positions.push({
      start: startMatch.index!,
      end: startMatch.index! + startMatch[0].length,
    })
  }

  // ...

  return positions
}
```

---

## 一百九十、Unicode 安全净化

### Unicode 攻击缓解

```typescript
// utils/sanitization.ts

/**
 * Unicode 隐藏字符攻击缓解
 *
 * 攻击方式:
 * - ASCII Smuggling: 使用不可见的 Unicode 字符隐藏指令
 * - Hidden Prompt Injection: 使用 Tag 字符注入隐藏指令
 *
 * 防护措施:
 * 1. NFKC 规范化
 * 2. 移除危险 Unicode 类别
 */

// 危险的 Unicode 类别
// Cf: Format characters
// Co: Private use
// Cn: Unassigned

export function partiallySanitizeUnicode(prompt: string): string {
  let current = prompt
  let previous = ''
  let iterations = 0
  const MAX_ITERATIONS = 10

  while (current !== previous && iterations < MAX_ITERATIONS) {
    previous = current

    // NFKC 规范化
    current = current.normalize('NFKC')

    // 方法 1: 移除危险 Unicode 属性类
    current = current.replace(/[\p{Cf}\p{Co}\p{Cn}]/gu, '')

    // 方法 2: 显式字符范围
    current = current
      // 零宽空格和方向控制符
      .replace(/[\u200B-\u200F]/g, '')
      // 双向格式字符
      .replace(/[\u202A-\u202E]/g, '')
      // 双向隔离符
      .replace(/[\u2066-\u2069]/g, '')
      // BOM
      .replace(/[\uFEFF]/g, '')
      // 私有使用区
      .replace(/[\uE000-\uF8FF]/g, '')

    iterations++
  }

  if (iterations >= MAX_ITERATIONS) {
    throw new Error('Unicode sanitization reached maximum iterations')
  }

  return current
}

// 递归净化复杂结构
export function recursivelySanitizeUnicode<T>(value: T): T {
  if (typeof value === 'string') {
    return partiallySanitizeUnicode(value) as T
  }

  if (Array.isArray(value)) {
    return value.map(recursivelySanitizeUnicode) as T
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = recursivelySanitizeUnicode(v)
    }
    return result as T
  }

  return value
}
```

---

## 一百九十一、环境变量验证

### 边界整数验证

```typescript
// utils/envValidation.ts

export type EnvVarValidationResult = {
  effective: number
  status: 'valid' | 'capped' | 'invalid'
  message?: string
}

export function validateBoundedIntEnvVar(
  name: string,
  value: string | undefined,
  defaultValue: number,
  upperLimit: number,
): EnvVarValidationResult {
  if (!value) {
    return { effective: defaultValue, status: 'valid' }
  }

  const parsed = parseInt(value, 10)

  if (isNaN(parsed) || parsed <= 0) {
    return {
      effective: defaultValue,
      status: 'invalid',
      message: `Invalid value "${value}" (using default: ${defaultValue})`,
    }
  }

  if (parsed > upperLimit) {
    return {
      effective: upperLimit,
      status: 'capped',
      message: `Capped from ${parsed} to ${upperLimit}`,
    }
  }

  return { effective: parsed, status: 'valid' }
}

// 使用示例
const result = validateBoundedIntEnvVar(
  'CLAUDE_CODE_MAX_TOKENS',
  process.env.CLAUDE_CODE_MAX_TOKENS,
  defaultValue = 4096,
  upperLimit = 100000
)
```

---

## 一百九十二、会话存储

### 会话日志管理

```typescript
// utils/sessionStorage.ts

// 会话目录结构
const SESSION_DIR = join(getClaudeConfigHomeDir(), 'sessions')

// 获取会话路径
export function getSessionDir(): string {
  return join(SESSION_DIR, sanitizePath(getOriginalCwd()))
}

// 加载完整日志
export async function loadFullLog(sessionId: SessionId): Promise<LogOption[]> {
  const logPath = getSessionLogPath(sessionId)
  const content = await readFile(logPath, 'utf-8')
  return content.split('\n')
    .filter(line => line.trim())
    .map(line => jsonParse(line))
}

// 保存消息
export async function appendToSessionLog(
  sessionId: SessionId,
  message: SerializedMessage,
): Promise<void> {
  const logPath = getSessionLogPath(sessionId)
  await appendFile(
    logPath,
    jsonStringify(message) + '\n',
  )
}

// 获取会话 ID 从日志
export function getSessionIdFromLog(log: LogOption): SessionId {
  return asSessionId(log.sessionId)
}
```

### 轻量级日志 (Lite)

```typescript
// 轻量级日志不加载消息内容
export function isLiteLog(log: LogOption): boolean {
  return log.isLite === true
}

// 加载轻量级日志
export function loadLiteLog(sessionId: SessionId): Promise<LogOption> {
  const logPath = getSessionLogPath(sessionId)
  return jsonParse(readFileSync(logPath, 'utf-8'))
}
```

---

## 一百九十三、会话恢复

### 对话链构建

```typescript
// utils/conversationRecovery.ts

// 构建对话链
export function buildConversationChain(
  logs: LogOption[],
): SerializedMessage[] {
  const messages: SerializedMessage[] = []

  for (const log of logs) {
    if (log.isLite) {
      // 轻量级日志需要额外加载
      const fullLog = await loadFullLogFromLite(log)
      messages.push(...fullLog.messages)
    } else {
      messages.push(...log.messages)
    }
  }

  return messages
}

// 检查恢复一致性
export function checkResumeConsistency(
  messages: SerializedMessage[],
): ConsistencyResult {
  const issues: string[] = []

  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i]
    const next = messages[i + 1]

    // 检查消息顺序
    if (current.timestamp > next.timestamp) {
      issues.push(`Out of order: ${current.timestamp} > ${next.timestamp}`)
    }

    // 检查缺失的工具结果
    if (current.type === 'assistant' && hasToolUse(current)) {
      const hasResult = next.type === 'user' && hasToolResult(next)
      if (!hasResult) {
        issues.push(`Missing tool result for ${current.id}`)
      }
    }
  }

  return {
    isConsistent: issues.length === 0,
    issues,
  }
}
```

---

## 一百九十四、上下文分析

### 消息 Token 计数

```typescript
// utils/analyzeContext.ts

// Token 计数的 API 开销
export const TOOL_TOKEN_COUNT_OVERHEAD = 500

async function countTokensWithFallback(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
  tools: Anthropic.Beta.Messages.BetaToolUnion[],
): Promise<number | null> {
  try {
    // 尝试使用 API 计数
    return await countMessagesTokensWithAPI(messages, tools)
  } catch (error) {
    // 回退到估算
    return countTokensViaHaikuFallback(messages)
  }
}

// 分析上下文
export function analyzeContext(
  messages: Message[],
  options: AnalyzeOptions,
): ContextAnalysis {
  const tokenCount = countTokensWithFallback(
    messages,
    options.tools,
  )

  const effectiveContextWindow = getEffectiveContextWindowSize(
    options.model,
    options.settings,
  )

  return {
    tokenCount,
    contextWindow: effectiveContextWindow,
    utilization: tokenCount / effectiveContextWindow,
    canContinue: tokenCount < effectiveContextWindow * 0.9,
    shouldCompact: tokenCount > effectiveContextWindow * 0.8,
  }
}
```

---

## 一百九十五、Semver 版本比较

### Bun.semver vs npm semver

```typescript
// utils/semver.ts

// Bun.semver.order() 比 npm semver 快 20 倍

export function gt(a: string, b: string): boolean {
  if (typeof Bun !== 'undefined') {
    return Bun.semver.order(a, b) === 1
  }
  return getNpmSemver().gt(a, b, { loose: true })
}

export function gte(a: string, b: string): boolean {
  if (typeof Bun !== 'undefined') {
    return Bun.semver.order(a, b) >= 0
  }
  return getNpmSemver().gte(a, b, { loose: true })
}

export function lt(a: string, b: string): boolean {
  if (typeof Bun !== 'undefined') {
    return Bun.semver.order(a, b) === -1
  }
  return getNpmSemver().lt(a, b, { loose: true })
}

export function satisfies(version: string, range: string): boolean {
  if (typeof Bun !== 'undefined') {
    return Bun.semver.satisfies(version, range)
  }
  return getNpmSemver().satisfies(version, range, { loose: true })
}

export function order(a: string, b: string): -1 | 0 | 1 {
  if (typeof Bun !== 'undefined') {
    return Bun.semver.order(a, b)
  }
  return getNpmSemver().compare(a, b, { loose: true })
}
```

---

## 一百九十六、Promise.withResolvers

### Polyfill 实现

```typescript
// utils/withResolvers.ts

/**
 * ES2024 Promise.withResolvers() polyfill
 * Node 18+ required
 */
export function withResolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

// 使用示例
async function delay(ms: number): Promise<string> {
  const { promise, resolve, reject } = withResolvers<string>()

  setTimeout(() => resolve('done'), ms)

  return promise
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Token 预算** | `utils/tokenBudget.ts` | 预算解析 |
| **Unicode 安全** | `utils/sanitization.ts` | 攻击缓解 |
| **环境验证** | `utils/envValidation.ts` | 变量验证 |
| **会话存储** | `utils/sessionStorage.ts` | 日志管理 |
| **会话恢复** | `utils/conversationRecovery.ts` | 对话恢复 |
| **上下文分析** | `utils/analyzeContext.ts` | Token 计数 |
| **Semver** | `utils/semver.ts` | 版本比较 |
| **withResolvers** | `utils/withResolvers.ts` | Promise polyfill |