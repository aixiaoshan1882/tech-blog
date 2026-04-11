# Claude Code 源码深度学习笔记 (第三十九部分)

> CircularBuffer·Signal·Mailbox·Memoize·Cron·UUID·Hash·TokenBudget

---

## 二百四十三、CircularBuffer 环形缓冲

### 固定大小循环缓冲区

```typescript
// utils/CircularBuffer.ts

/**
 * 固定大小环形缓冲区，自动驱逐最旧的元素
 * 用于维护滚动窗口数据
 */
export class CircularBuffer<T> {
  private buffer: T[]
  private head = 0
  private size = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  // 添加元素，满时自动驱逐最旧的
  add(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) {
      this.size++
    }
  }

  // 获取最近的 N 个元素
  getRecent(count: number): T[] {
    const result: T[] = []
    const start = this.size < this.capacity ? 0 : this.head
    const available = Math.min(count, this.size)

    for (let i = 0; i < available; i++) {
      const index = (start + this.size - available + i) % this.capacity
      result.push(this.buffer[index]!)
    }
    return result
  }

  // 获取所有元素 (从旧到新)
  toArray(): T[] {
    if (this.size === 0) return []
    const result: T[] = []
    const start = this.size < this.capacity ? 0 : this.head
    for (let i = 0; i < this.size; i++) {
      const index = (start + i) % this.capacity
      result.push(this.buffer[index]!)
    }
    return result
  }
}
```

---

## 二百四十四、Signal 事件发射器

### 轻量级事件信号

```typescript
// utils/signal.ts

/**
 * 纯事件信号的小型监听器集原语
 * 与 Store 不同 - 没有快照，没有 getState
 * 用于订阅者只需要知道"某事发生"的情况
 */

export type Signal<Args extends unknown[] = []> = {
  subscribe: (listener: (...args: Args) => void) => () => void
  emit: (...args: Args) => void
  clear: () => void
}

export function createSignal<Args extends unknown[] = []>(): Signal<Args> {
  const listeners = new Set<(...args: Args) => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(...args) {
      for (const listener of listeners) listener(...args)
    },
    clear() {
      listeners.clear()
    },
  }
}

// 使用示例
const changed = createSignal<[SettingSource]>()
export const subscribe = changed.subscribe
changed.emit('userSettings')
```

---

## 二百四十五、Mailbox 邮箱模式

### 异步消息等待

```typescript
// utils/mailbox.ts

/**
 * 邮箱模式 - 异步消息等待
 * 支持 poll (轮询) 和 receive (等待)
 */

export type MessageSource = 'user' | 'teammate' | 'system' | 'tick' | 'task'

export type Message = {
  id: string
  source: MessageSource
  content: string
  from?: string
  color?: string
  timestamp: string
}

export class Mailbox {
  private queue: Message[] = []
  private waiters: Waiter[] = []
  private changed = createSignal()
  private _revision = 0

  // 发送消息 - 匹配等待者则立即交付，否则入队
  send(msg: Message): void {
    this._revision++
    const idx = this.waiters.findIndex(w => w.fn(msg))
    if (idx !== -1) {
      const waiter = this.waiters.splice(idx, 1)[0]
      waiter?.resolve(msg)
    } else {
      this.queue.push(msg)
    }
    this.notify()
  }

  // 轮询消息
  poll(fn: (msg: Message) => boolean = () => true): Message | undefined {
    const idx = this.queue.findIndex(fn)
    return idx !== -1 ? this.queue.splice(idx, 1)[0] : undefined
  }

  // 等待消息
  receive(fn: (msg: Message) => boolean = () => true): Promise<Message> {
    const idx = this.queue.findIndex(fn)
    if (idx !== -1) {
      return Promise.resolve(this.queue.splice(idx, 1)[0])
    }
    return new Promise<Message>(resolve => {
      this.waiters.push({ fn, resolve })
    })
  }
}
```

---

## 二百四十六、AbortController 工具

### 弱引用子控制器

```typescript
// utils/abortController.ts

/**
 * 创建子 AbortController，父中止时自动中止
 * 使用 WeakRef 防止内存泄漏
 */

export function createChildAbortController(
  parent: AbortController,
  maxListeners?: number,
): AbortController {
  const child = createAbortController(maxListeners)

  // 快速路径: 父已中止
  if (parent.signal.aborted) {
    child.abort(parent.signal.reason)
    return child
  }

  // WeakRef 防止父保留废弃的子
  const weakParent = new WeakRef(parent)
  const weakChild = new WeakRef(child)

  const handler = () => {
    const p = weakParent.deref()
    const c = weakChild.deref()
    if (c) {
      c.abort(p?.signal.reason)
    }
  }

  parent.signal.addEventListener('abort', handler, { once: true })

  return child
}
```

---

## 二百四十七、Memoize 缓存

### TTL + LRU 缓存

```typescript
// utils/memoize.ts

/**
 * 带 TTL 的记忆化函数
 * - 缓存新鲜: 立即返回
 * - 缓存过期: 返回过期值但后台刷新
 * - 无缓存: 阻塞计算
 */
export function memoizeWithTTL<Args extends unknown[], Result>(
  f: (...args: Args) => Result,
  cacheLifetimeMs: number = 5 * 60 * 1000,
): MemoizedFunction<Args, Result> {
  const cache = new Map<string, CacheEntry<Result>>()

  const memoized = (...args: Args): Result => {
    const key = jsonStringify(args)
    const cached = cache.get(key)
    const now = Date.now()

    // 无缓存 - 计算并存储
    if (!cached) {
      const value = f(...args)
      cache.set(key, { value, timestamp: now, refreshing: false })
      return value
    }

    // 缓存过期 - 后台刷新
    if (now - cached.timestamp > cacheLifetimeMs && !cached.refreshing) {
      cached.refreshing = true
      Promise.resolve().then(() => {
        const newValue = f(...args)
        if (cache.get(key) === cached) {
          cache.set(key, { value: newValue, timestamp: Date.now(), refreshing: false })
        }
      }).catch(() => cache.delete(key))
    }

    return cached.value
  }

  memoized.cache = { clear: () => cache.clear() }
  return memoized
}
```

---

## 二百四十八、Cron 解析

### 5 字段 Cron 表达式

```typescript
// utils/cron.ts

/**
 * 最小化 cron 表达式解析
 * 支持: wildcard, N, */N (step), N-M (range), N,M,... (list)
 * 字段: minute hour dayOfMonth month dayOfWeek
 */

const FIELD_RANGES = [
  { min: 0, max: 59 },  // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // dayOfMonth
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 },  // dayOfWeek (0=Sun, 7=Sun alias)
]

// 解析单个字段
function expandField(field: string, range: FieldRange): number[] | null {
  const out = new Set<number>()

  for (const part of field.split(',')) {
    // */N (step)
    const stepMatch = part.match(/^\*(?:\/(\d+))?$/)
    if (stepMatch) {
      const step = stepMatch[1] ? parseInt(stepMatch[1], 10) : 1
      for (let i = min; i <= max; i += step) out.add(i)
      continue
    }

    // N-M (range)
    const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/)
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10)
      const hi = parseInt(rangeMatch[2], 10)
      const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1
      for (let i = lo; i <= hi; i += step) out.add(i)
      continue
    }

    // N (single)
    const singleMatch = part.match(/^\d+$/)
    if (singleMatch) {
      let n = parseInt(part, 10)
      if (min === 0 && max === 6 && n === 7) n = 0  // 7 = Sunday alias
      out.add(n)
    }
  }

  return out.size > 0 ? Array.from(out).sort((a, b) => a - b) : null
}

// 解析完整 cron 表达式
export function parseCron(expression: string): CronFields | null {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return null

  return {
    minute: expandField(fields[0], FIELD_RANGES[0]),
    hour: expandField(fields[1], FIELD_RANGES[1]),
    dayOfMonth: expandField(fields[2], FIELD_RANGES[2]),
    month: expandField(fields[3], FIELD_RANGES[3]),
    dayOfWeek: expandField(fields[4], FIELD_RANGES[4]),
  }
}
```

---

## 二百四十九、UUID 工具

### UUID 验证和生成

```typescript
// utils/uuid.ts

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 验证 UUID
export function validateUuid(maybeUuid: unknown): UUID | null {
  if (typeof maybeUuid !== 'string') return null
  return uuidRegex.test(maybeUuid) ? maybeUuid as UUID : null
}

// 创建 Agent ID
export function createAgentId(label?: string): AgentId {
  const suffix = randomBytes(8).toString('hex')
  return (label ? `a${label}-${suffix}` : `a${suffix}`) as AgentId
}
```

---

## 二百五十、Hash 工具

### djb2/SHA256/wyhash

```typescript
// utils/hash.ts

// djb2 字符串哈希 - 快速非加密哈希
export function djb2Hash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

// 内容哈希 - Bun.hash 比 sha256 快 100x
export function hashContent(content: string): string {
  if (typeof Bun !== 'undefined') {
    return Bun.hash(content).toString()
  }
  return crypto.createHash('sha256').update(content).digest('hex')
}

// 哈希对 - 无需拼接字符串
export function hashPair(a: string, b: string): string {
  if (typeof Bun !== 'undefined') {
    return Bun.hash(b, Bun.hash(a)).toString()
  }
  return crypto.createHash('sha256').update(a).update('\0').update(b).digest('hex')
}
```

---

## 二百五十一、Token Budget

### Token 预算解析

```typescript
// utils/tokenBudget.ts

const SHORTHAND_START_RE = /^\s*\+(\d+(?:\.\d+)?)\s*(k|m|b)\b/i
const SHORTHAND_END_RE = /\s\+(\d+(?:\.\d+)?)\s*(k|m|b)\s*[.!?]?\s*$/i
const VERBOSE_RE = /\b(?:use|spend)\s+(\d+(?:\.\d+)?)\s*(k|m|b)\s*tokens?\b/i

const MULTIPLIERS = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }

// 解析 "+500k" 或 "use 2M tokens" 格式
export function parseTokenBudget(text: string): number | null {
  // 优先匹配行首的简写格式
  const startMatch = text.match(SHORTHAND_START_RE)
  if (startMatch) return parseBudgetMatch(startMatch[1], startMatch[2])

  // 匹配行尾的简写格式
  const endMatch = text.match(SHORTHAND_END_RE)
  if (endMatch) return parseBudgetMatch(endMatch[1], endMatch[2])

  // 匹配详细格式
  const verboseMatch = text.match(VERBOSE_RE)
  if (verboseMatch) return parseBudgetMatch(verboseMatch[1], verboseMatch[2])

  return null
}

// 获取预算继续消息
export function getBudgetContinuationMessage(
  pct: number,
  turnTokens: number,
  budget: number,
): string {
  return `Stopped at ${pct}% of token target (${fmt(turnTokens)} / ${fmt(budget)}). Keep working — do not summarize.`
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **CircularBuffer** | `utils/CircularBuffer.ts` | 固定大小循环缓冲 |
| **Signal** | `utils/signal.ts` | 轻量级事件发射器 |
| **Mailbox** | `utils/mailbox.ts` | 异步消息等待 |
| **AbortController** | `utils/abortController.ts` | 弱引用子控制器 |
| **Memoize** | `utils/memoize.ts` | TTL + LRU 缓存 |
| **Cron** | `utils/cron.ts` | 5 字段 cron 解析 |
| **UUID** | `utils/uuid.ts` | UUID 验证生成 |
| **Hash** | `utils/hash.ts` | djb2/SHA256/wyhash |
| **TokenBudget** | `utils/tokenBudget.ts` | Token 预算解析 |