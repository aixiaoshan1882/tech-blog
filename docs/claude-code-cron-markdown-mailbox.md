# Claude Code 源码深度学习笔记 (第二十五部分)

> Cron 调度 · Markdown 渲染 · Mailbox 模式 · 消息队列 · Teleport

---

## 一百三十四、Cron 调度系统

### Cron 表达式解析

```typescript
// utils/cron.ts

export type CronFields = {
  minute: number[]
  hour: number[]
  dayOfMonth: number[]
  month: number[]
  dayOfWeek: number[]
}

// 字段范围
const FIELD_RANGES = [
  { min: 0, max: 59 },   // minute
  { min: 0, max: 23 },  // hour
  { min: 1, max: 31 },  // dayOfMonth
  { min: 1, max: 12 },  // month
  { min: 0, max: 6 },   // dayOfWeek (0=周日)
]

// 解析单个字段
function expandField(field: string, range: FieldRange): number[] | null {
  // 支持: wildcard, N, */N, N-M, N,M,O
  const out = new Set<number>()

  for (const part of field.split(',')) {
    // */N 步长
    const stepMatch = part.match(/^\*(?:\/(\d+))?$/)
    if (stepMatch) {
      const step = stepMatch[1] ? parseInt(stepMatch[1], 10) : 1
      for (let i = min; i <= max; i += step) out.add(i)
      continue
    }

    // N-M 范围
    const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/)
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1]!)
      const hi = parseInt(rangeMatch[2]!)
      const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1
      for (let i = lo; i <= hi; i += step) out.add(i)
      continue
    }

    // 单个值
    const singleMatch = part.match(/^\d+$/)
    if (singleMatch) {
      out.add(parseInt(part, 10))
      continue
    }

    return null
  }

  return Array.from(out).sort((a, b) => a - b)
}

// 解析完整表达式
export function parseCronExpression(expr: string): CronFields | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null

  return {
    minute: expandField(parts[0]!, FIELD_RANGES[0]),
    hour: expandField(parts[1]!, FIELD_RANGES[1]),
    dayOfMonth: expandField(parts[2]!, FIELD_RANGES[2]),
    month: expandField(parts[3]!, FIELD_RANGES[3]),
    dayOfWeek: expandField(parts[4]!, FIELD_RANGES[4]),
  }
}
```

### 调度器

```typescript
// utils/cronScheduler.ts

export class CronScheduler {
  private tasks: Map<string, CronTask> = new Map()
  private timer: NodeJS.Timeout | null = null

  constructor(private timezone: string = 'local') {}

  addTask(id: string, cron: string, callback: () => void): void {
    const fields = parseCronExpression(cron)
    if (!fields) {
      throw new Error(`Invalid cron expression: ${cron}`)
    }

    this.tasks.set(id, {
      id,
      cron: fields,
      callback,
      nextRun: this.getNextRun(fields),
    })

    this.schedule()
  }

  removeTask(id: string): void {
    this.tasks.delete(id)
    this.schedule()
  }

  private getNextRun(fields: CronFields): Date {
    const now = new Date()
    // 计算下一个匹配的时间
    // ...
    return nextDate
  }

  private schedule(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    const nextTask = this.getNextTask()
    if (nextTask) {
      const delay = nextTask.nextRun.getTime() - Date.now()
      this.timer = setTimeout(() => {
        nextTask.callback()
        nextTask.nextRun = this.getNextRun(nextTask.cron)
        this.schedule()
      }, delay)
    }
  }
}
```

### 持久化 Cron

```typescript
// utils/cronTasks.ts

// 持久化任务到磁盘
export async function saveCronTask(task: CronTask): Promise<void> {
  const tasks = await loadCronTasks()
  tasks.push(task)
  await writeFile(
    join(getTasksDir(), 'scheduled_tasks.json'),
    jsonStringify(tasks),
  )
}

// 加载持久化任务
export async function loadCronTasks(): Promise<CronTask[]> {
  const path = join(getTasksDir(), 'scheduled_tasks.json')
  if (!existsSync(path)) {
    return []
  }
  return jsonParse(await readFile(path, 'utf-8'))
}
```

---

## 一百三十五、Markdown 渲染

### Markdown 组件

```typescript
// components/Markdown.tsx

// 标记缓存 (避免重复解析)
const TOKEN_CACHE_MAX = 500
const tokenCache = new Map<string, Token[]>()

// 检测是否包含 Markdown 语法
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. /

function hasMarkdownSyntax(s: string): boolean {
  // 只检查前 500 个字符
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s)
}

// 缓存的词法分析器
function cachedLexer(content: string): Token[] {
  // 纯文本快速路径
  if (!hasMarkdownSyntax(content)) {
    return [{
      type: 'paragraph',
      text: content,
      tokens: [{ type: 'text', text: content }],
    }]
  }

  const key = hashContent(content)
  const hit = tokenCache.get(key)

  if (hit) {
    // 移到末尾 (MRU)
    tokenCache.delete(key)
    tokenCache.set(key, hit)
    return hit
  }

  const tokens = marked.lexer(content)

  // LRU 淘汰
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    const first = tokenCache.keys().next().value
    if (first !== undefined) tokenCache.delete(first)
  }

  tokenCache.set(key, tokens)
  return tokens
}
```

### Marked 配置

```typescript
// utils/markdown.ts

import { marked, type Token, type Tokens } from 'marked'

export function configureMarked(): void {
  marked.setOptions({
    gfm: true,       // GitHub Flavored Markdown
    breaks: true,     // 换行符转换为 <br>
  })
}

// 格式化 Token
export function formatToken(token: Token): React.ReactNode {
  switch (token.type) {
    case 'heading':
      return <Text bold>{token.text}</Text>
    case 'paragraph':
      return <Text>{token.text}</Text>
    case 'code':
      return <Ansi>{token.text}</Ansi>
    case 'list':
      return token.items.map((item, i) => (
        <Box key={i}>
          <Text>• {item.text}</Text>
        </Box>
      ))
    case 'table':
      return <MarkdownTable token={token} />
    default:
      return <Text>{token.text}</Text>
  }
}
```

---

## 一百三十六、Mailbox 模式

### Mailbox 实现

```typescript
// utils/mailbox.ts

export type Message = {
  id: string
  source: 'user' | 'teammate' | 'system' | 'tick' | 'task'
  content: string
  from?: string
  color?: string
  timestamp: string
}

export class Mailbox {
  private queue: Message[] = []
  private waiters: Array<{
    fn: (msg: Message) => boolean
    resolve: (msg: Message) => void
  }> = []
  private changed = createSignal()

  send(msg: Message): void {
    // 检查是否有等待的匹配者
    const idx = this.waiters.findIndex(w => w.fn(msg))
    if (idx !== -1) {
      const waiter = this.waiters.splice(idx, 1)[0]
      waiter.resolve(msg)
      this.changed.emit()
      return
    }
    this.queue.push(msg)
    this.changed.emit()
  }

  // 同步获取 (立即返回)
  poll(fn: (msg: Message) => boolean = () => true): Message | undefined {
    const idx = this.queue.findIndex(fn)
    return idx !== -1 ? this.queue.splice(idx, 1)[0] : undefined
  }

  // 异步等待
  receive(fn: (msg: Message) => boolean = () => true): Promise<Message> {
    const idx = this.queue.findIndex(fn)
    if (idx !== -1) {
      return Promise.resolve(this.queue.splice(idx, 1)[0]!)
    }

    return new Promise(resolve => {
      this.waiters.push({ fn, resolve })
    })
  }

  subscribe = this.changed.subscribe
}
```

### Mailbox 使用

```typescript
// 团队消息 Mailbox
const teammateMailbox = new Mailbox()

// 发送消息
teammateMailbox.send({
  id: generateUUID(),
  source: 'teammate',
  content: 'Task completed',
  from: 'worker-1',
  color: 'green',
  timestamp: new Date().toISOString(),
})

// 等待特定消息
const msg = await teammateMailbox.receive(m =>
  m.source === 'teammate' && m.content.includes('completed')
)

// 轮询
const pending = teammateMailbox.poll(m => m.source === 'task')
```

---

## 一百三十七、消息队列

### 命令队列

```typescript
// utils/messageQueueManager.ts

type QueuedCommand = {
  id: string
  type: 'user' | 'task' | 'permission'
  content: string
  priority: 'now' | 'next' | 'later'
  timestamp: number
}

const commandQueue: QueuedCommand[] = []
let snapshot: readonly QueuedCommand[] = Object.freeze([])
const queueChanged = createSignal()

// 添加命令
export function enqueueCommand(cmd: QueuedCommand): void {
  commandQueue.push(cmd)
  commandQueue.sort((a, b) => {
    // 按优先级排序
    const priorityOrder = { now: 0, next: 1, later: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
  snapshot = Object.freeze([...commandQueue])
  queueChanged.emit()
}

// 获取下一个命令
export function dequeueCommand(): QueuedCommand | undefined {
  return commandQueue.shift()
}

// 订阅变化
export const subscribeToCommandQueue = queueChanged.subscribe
export const getCommandQueueSnapshot = () => snapshot
```

### 队列操作

```typescript
// 队列操作类型
type QueueOperation =
  | 'enqueue'
  | 'dequeue'
  | 'clear'
  | 'reorder'

// 记录操作
function logOperation(operation: QueueOperation, content?: string): void {
  const queueOp: QueueOperationMessage = {
    type: 'queue-operation',
    operation,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    ...(content !== undefined && { content }),
  }
  void recordQueueOperation(queueOp)
}
```

---

## 一百三十八、Teleport API

### 重试机制

```typescript
// utils/teleport/api.ts

const TELEPORT_RETRY_DELAYS = [2000, 4000, 8000, 16000]
const MAX_TELEPORT_RETRIES = 4

// 瞬时网络错误检测
export function isTransientNetworkError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false

  // 无响应 = 网络错误
  if (!error.response) return true

  // 5xx = 服务端错误，可重试
  if (error.response.status >= 500) return true

  // 4xx = 客户端错误，不重试
  return false
}

// 带重试的 GET 请求
export async function axiosGetWithRetry<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  for (let attempt = 0; attempt <= MAX_TELEPORT_RETRIES; attempt++) {
    try {
      return await axios.get<T>(url, config)
    } catch (error) {
      if (!isTransientNetworkError(error)) throw error
      if (attempt >= MAX_TELEPORT_RETRIES) throw error

      const delay = TELEPORT_RETRY_DELAYS[attempt] ?? 2000
      await sleep(delay)
    }
  }
  throw new Error('Unreachable')
}
```

---

## 一百三十九、重要设计模式

### 1. LRU 缓存

```typescript
// Map 保持插入顺序，删除最早的
const CACHE_MAX = 500
const cache = new Map<string, Token[]>()

function get(key: string): Token[] | undefined {
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)      // 删除
    cache.set(key, hit)    // 重新插入末尾
    return hit
  }
  return undefined
}

function set(key: string, value: Token[]): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  cache.set(key, value)
}
```

### 2. Promise 等待队列

```typescript
// Mailbox 的异步等待
class Mailbox<T> {
  private waiters: Array<{
    predicate: (msg: T) => boolean
    resolve: (msg: T) => void
  }> = []

  receive(predicate: (msg: T) => boolean): Promise<T> {
    // 检查队列
    const idx = this.queue.findIndex(predicate)
    if (idx !== -1) {
      return Promise.resolve(this.queue.splice(idx, 1)[0]!)
    }

    // 等待
    return new Promise(resolve => {
      this.waiters.push({ predicate, resolve })
    })
  }

  send(msg: T): void {
    // 唤醒匹配的等待者
    const idx = this.waiters.findIndex(w => w.predicate(msg))
    if (idx !== -1) {
      const waiter = this.waiters.splice(idx, 1)[0]
      waiter.resolve(msg)
    } else {
      this.queue.push(msg)
    }
  }
}
```

### 3. 优先级队列

```typescript
// 多优先级队列
class PriorityQueue<T> {
  private queues: {
    now: T[]
    next: T[]
    later: T[]
  } = { now: [], next: [], later: [] }

  enqueue(item: T, priority: 'now' | 'next' | 'later'): void {
    this.queues[priority].push(item)
  }

  dequeue(): T | undefined {
    if (this.queues.now.length > 0) {
      return this.queues.now.shift()
    }
    if (this.queues.next.length > 0) {
      return this.queues.next.shift()
    }
    return this.queues.later.shift()
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Cron 解析** | `utils/cron.ts` | Cron 表达式解析 |
| **Cron 调度** | `utils/cronScheduler.ts` | 任务调度 |
| **Cron 持久化** | `utils/cronTasks.ts` | 磁盘存储 |
| **Markdown 渲染** | `components/Markdown.tsx` | Markdown → React |
| **Markdown 配置** | `utils/markdown.ts` | Marked 配置 |
| **Mailbox** | `utils/mailbox.ts` | 消息邮箱 |
| **消息队列** | `utils/messageQueueManager.ts` | 命令队列 |
| **Teleport API** | `utils/teleport/api.ts` | 远程 API |