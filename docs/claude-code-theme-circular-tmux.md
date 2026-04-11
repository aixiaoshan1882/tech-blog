# Claude Code 源码深度学习笔记 (第三十一部分)

> 主题系统·国际化·CircularBuffer·AbortController·TMUX 隔离

---

## 一百八十、主题系统

### Theme 类型定义

```typescript
// utils/theme.ts

export type Theme = {
  // 基础颜色
  autoAccept: string
  bashBorder: string
  claude: string
  claudeShimmer: string
  permission: string
  permissionShimmer: string
  planMode: string
  ide: string
  text: string
  inverseText: string
  inactive: string
  subtle: string

  // 语义颜色
  success: string
  error: string
  warning: string
  merged: string

  // Diff 颜色
  diffAdded: string
  diffRemoved: string
  diffAddedDimmed: string
  diffRemovedDimmed: string
  diffAddedWord: string
  diffRemovedWord: string

  // Agent 颜色
  red_FOR_SUBAGENTS_ONLY: string
  blue_FOR_SUBAGENTS_ONLY: string
  green_FOR_SUBAGENTS_ONLY: string
  yellow_FOR_SUBAGENTS_ONLY: string
  purple_FOR_SUBAGENTS_ONLY: string
  orange_FOR_SUBAGENTS_ONLY: string
  pink_FOR_SUBAGENTS_ONLY: string
  cyan_FOR_SUBAGENTS_ONLY: string

  // UI 颜色
  clawd_body: string
  clawd_background: string
  userMessageBackground: string
  selectionBg: string

  // 其他
  rate_limit_fill: string
  rate_limit_empty: string
  fastMode: string

  // 彩虹色 (ultrathink)
  rainbow_red: string
  rainbow_orange: string
  rainbow_yellow: string
  rainbow_green: string
  rainbow_blue: string
  rainbow_indigo: string
  // ...
}
```

---

## 一百八十一、字符串宽度计算

### 终端宽度计算

```typescript
// ink/stringWidth.ts

// 使用 eastAsianWidth 计算字符宽度
function stringWidthJavaScript(str: string): number {
  // 快速路径: 纯 ASCII
  let isPureAscii = true
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 127 || code === 0x1b) {  // ANSI escape
      isPureAscii = false
      break
    }
  }
  if (isPureAscii) {
    return str.length
  }

  // 去除 ANSI
  if (str.includes('\x1b')) {
    str = stripAnsi(str)
  }

  // 逐字符计算宽度
  let width = 0
  for (const char of str) {
    const codePoint = char.codePointAt(0)!
    if (!isZeroWidth(codePoint)) {
      width += eastAsianWidth(codePoint, { ambiguousAsWide: false })
    }
  }

  return width
}

// Emoji 宽度计算
function getEmojiWidth(grapheme: string): number {
  // Emoji 通常宽度为 2
  return 2
}
```

---

## 一百八十二、CircularBuffer 环形缓冲

### 环形缓冲实现

```typescript
// utils/CircularBuffer.ts

export class CircularBuffer<T> {
  private buffer: T[]
  private head = 0
  private size = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  // 添加元素 (自动淘汰最老的)
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

  // 转换为数组
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

  get length(): number {
    return this.size
  }
}

// 使用示例
const buffer = new CircularBuffer<string>(3)
buffer.add('a')  // [a]
buffer.add('b')  // [a, b]
buffer.add('c')  // [a, b, c]
buffer.add('d')  // [b, c, d] (a 被淘汰)
```

---

## 一百八十三、AbortController 工具

### 创建安全的 AbortController

```typescript
// utils/abortController.ts

import { setMaxListeners } from 'events'

// 设置最大监听器数量
export function createAbortController(
  maxListeners: number = 50,
): AbortController {
  const controller = new AbortController()
  setMaxListeners(maxListeners, controller.signal)
  return controller
}
```

### 创建子 AbortController

```typescript
// 创建子控制器，父中止时自动中止
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

  // WeakRef 防止内存泄漏
  const weakParent = new WeakRef(parent)
  const weakChild = new WeakRef(child)

  // 使用模块级函数避免闭包分配
  function propagate() {
    const p = weakParent.deref()
    const c = weakChild.deref()
    c?.abort(p?.signal.reason)

    // 移除监听器防止累积
    if (p && handler) {
      p.signal.removeEventListener('abort', handler)
    }
  }

  const handler = propagate
  parent.signal.addEventListener('abort', handler, { once: true })

  return child
}
```

---

## 一百八十四、TMUX 隔离

### TMUX Socket 隔离原理

```typescript
// utils/tmuxSocket.ts

/**
 * Claude 使用独立的 TMUX socket: `claude-<PID>`
 * 这样 Claude 的 tmux 命令不会影响用户的 tmux 会话
 *
 * 1. Claude 创建自己的 socket: `claude-<PID>`
 * 2. 所有 Tmux 工具命令使用 `-L` flag
 * 3. 所有 Bash 工具命令继承 TMUX env var 指向这个 socket
 */

// socket 名称格式
const CLAUDE_SOCKET_PREFIX = 'claude'
const socketName = `claude-${process.pid}`

// 执行 tmux 命令
async function execTmux(args: string[]): Promise<{ stdout; stderr; code }> {
  if (getPlatform() === 'windows') {
    // Windows: 通过 WSL 执行
    return execFileNoThrow('wsl', ['-e', 'tmux', ...args])
  }
  return execFileNoThrow('tmux', args)
}

// 初始化 socket
async function initializeTmuxSocket(): Promise<void> {
  const { stdout } = await execTmux([
    'new-session',
    '-d',
    '-s', socketName,
    '-L', socketName,
  ])

  // 解析 server PID
  const { stdout: info } = await execTmux([
    'display-message',
    '-p',
    '#{socket_path},#{pid}',
    '-L', socketName,
  ])

  const [socketPath, pid] = info.trim().split(',')
  serverPid = parseInt(pid)
}
```

---

## 一百八十五、代理和 mTLS

### 代理 URL 获取

```typescript
// utils/proxy.ts

// 获取代理 URL (优先小写)
export function getProxyUrl(env: EnvLike = process.env): string | undefined {
  return env.https_proxy || env.HTTPS_PROXY ||
         env.http_proxy || env.HTTP_PROXY
}

// 获取 NO_PROXY
export function getNoProxy(env: EnvLike = process.env): string | undefined {
  return env.no_proxy || env.NO_PROXY
}

// 检查是否应该绕过代理
export function shouldBypassProxy(url: string): boolean {
  const noProxy = getNoProxy()
  if (!noProxy) return false

  const hostname = new URL(url).hostname

  return noProxy.split(',').some(rule => {
    if (rule === '*') return true
    if (rule.startsWith('.')) {
      return hostname.endsWith(rule) || hostname === rule.slice(1)
    }
    return hostname === rule
  })
}
```

### mTLS 配置

```typescript
// utils/mtls.ts

export const getMTLSConfig = memoize((): MTLSConfig | undefined => {
  const config: MTLSConfig = {}

  // 从环境变量加载证书
  if (process.env.CLAUDE_CODE_CLIENT_CERT) {
    config.cert = readFileSync(
      process.env.CLAUDE_CODE_CLIENT_CERT,
      { encoding: 'utf8' }
    )
  }

  if (process.env.CLAUDE_CODE_CLIENT_KEY) {
    config.key = readFileSync(
      process.env.CLAUDE_CODE_CLIENT_KEY,
      { encoding: 'utf8' }
    )
  }

  if (process.env.CLAUDE_CODE_CLIENT_KEY_PASSPHRASE) {
    config.passphrase = process.env.CLAUDE_CODE_CLIENT_KEY_PASSPHRASE
  }

  return Object.keys(config).length > 0 ? config : undefined
})
```

---

## 一百八十六、CA 证书管理

### 证书加载

```typescript
// utils/caCerts.ts

export const getCACertificates = memoize((): string[] | undefined => {
  const useSystemCA =
    hasNodeOption('--use-system-ca') ||
    hasNodeOption('--use-openssl-ca')

  const extraCertsPath = process.env.NODE_EXTRA_CA_CERTS

  // 如果都没设置，使用运行时默认
  if (!useSystemCA && !extraCertsPath) {
    return undefined
  }

  const tls = require('tls')
  const certs: string[] = []

  if (useSystemCA) {
    // 加载系统 CA
    const systemCAs = tls.getCACertificates?.('system')
    if (systemCAs) {
      certs.push(...systemCAs)
    } else {
      // 回退到绑定的 Mozilla 根证书
      certs.push(...tls.rootCertificates)
    }
  } else {
    // 必须包含 Mozilla 根证书作为基础
    certs.push(...tls.rootCertificates)
  }

  // 添加额外的证书
  if (extraCertsPath) {
    const extra = readFileSync(extraCertsPath, 'utf8')
    certs.push(extra)
  }

  return certs
})
```

---

## 一百八十七、ActivityManager 活动管理

### 活动跟踪

```typescript
// utils/activityManager.ts

export class ActivityManager {
  private activeOperations = new Set<string>()
  private lastUserActivityTime: number = 0
  private lastCLIRecordedTime: number
  private isCLIActive: boolean = false

  private readonly USER_ACTIVITY_TIMEOUT_MS = 5000

  constructor(options?: ActivityManagerOptions) {
    this.getNow = options?.getNow ?? (() => Date.now())
    this.getActiveTimeCounter = options?.getActiveTimeCounter ??
      getActiveTimeCounterImpl
    this.lastCLIRecordedTime = this.getNow()
  }

  // 记录用户活动
  recordUserActivity(): void {
    if (!this.isCLIActive && this.lastUserActivityTime !== 0) {
      const timeSinceLastActivity =
        (this.getNow() - this.lastUserActivityTime) / 1000

      if (timeSinceLastActivity < this.USER_ACTIVITY_TIMEOUT_MS / 1000) {
        this.getActiveTimeCounter().add(timeSinceLastActivity, { type: 'user' })
      }
    }

    this.lastUserActivityTime = this.getNow()
  }

  // 启动 CLI 活动
  startCLIActivity(operationId: string): void {
    this.activeOperations.add(operationId)
    this.isCLIActive = true
  }

  // 结束 CLI 活动
  endCLIActivity(operationId: string): void {
    this.activeOperations.delete(operationId)
    if (this.activeOperations.size === 0) {
      this.isCLIActive = false
    }
  }
}
```

---

## 一百八十八、Desktop Deep Link

### Deep Link URL 构建

```typescript
// utils/desktopDeepLink.ts

const MIN_DESKTOP_VERSION = '1.1.2396'

// 构建 deep link URL
function buildDesktopDeepLink(sessionId: string): string {
  const protocol = isDevMode() ? 'claude-dev' : 'claude'
  const url = new URL(`${protocol}://resume`)
  url.searchParams.set('session', sessionId)
  url.searchParams.set('cwd', getCwd())
  return url.toString()
}

// 检查 Desktop 是否安装
async function isDesktopInstalled(): Promise<boolean> {
  if (isDevMode()) return true

  const platform = process.platform

  if (platform === 'darwin') {
    return pathExists('/Applications/Claude.app')
  }

  if (platform === 'linux') {
    const { code, stdout } = await execFileNoThrow('xdg-mime', [
      'query', 'default', 'x-scheme-handler/claude'
    ])
    return code === 0 && stdout.trim().length > 0
  }

  if (platform === 'win32') {
    const { code } = await execFileNoThrow('reg', [
      'query', 'HKEY_CLASSES_ROOT\\claude', '/ve'
    ])
    return code === 0
  }

  return false
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **主题** | `utils/theme.ts` | 颜色定义 |
| **字符串宽度** | `ink/stringWidth.ts` | CJK/Emoji 宽度 |
| **环形缓冲** | `utils/CircularBuffer.ts` | 固定大小缓冲 |
| **AbortController** | `utils/abortController.ts` | WeakRef 子控制器 |
| **TMUX 隔离** | `utils/tmuxSocket.ts` | Socket 隔离 |
| **代理** | `utils/proxy.ts` | HTTP 代理 |
| **mTLS** | `utils/mtls.ts` | 双向 TLS |
| **CA 证书** | `utils/caCerts.ts` | 证书管理 |
| **活动管理** | `utils/activityManager.ts` | 活动跟踪 |
| **Deep Link** | `utils/desktopDeepLink.ts` | Desktop 集成 |