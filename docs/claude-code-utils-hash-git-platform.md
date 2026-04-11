# Claude Code 源码深度学习笔记 (第二十六部分)

> 工具函数库：Hash · 格式化 · 平台检测 · Git · 错误处理 · 缓冲写入

---

## 一百四十、Hash 函数

### 多种 Hash 算法

```typescript
// utils/hash.ts

/**
 * djb2 hash — 快速非加密 hash，返回有符号 32 位整数。
 * 跨运行时确定 (Bun.hash 用 wyhash，不适合跨版本兼容)
 */
export function djb2Hash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * 内容 hash，用于变化检测。
 * Bun.hash 快 100 倍，适合 diff 检测 (非加密用途)
 */
export function hashContent(content: string): string {
  if (typeof Bun !== 'undefined') {
    return Bun.hash(content).toString()
  }
  // Node.js fallback
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * 两字符串组合 hash，无需分配临时字符串。
 * Bun: wyhash 链式 seed
 * Node: 增量 SHA-256
 */
export function hashPair(a: string, b: string): string {
  if (typeof Bun !== 'undefined') {
    return Bun.hash(b, Bun.hash(a)).toString()
  }
  const crypto = require('crypto')
  return crypto
    .createHash('sha256')
    .update(a)
    .update('\0')
    .update(b)
    .digest('hex')
}
```

---

## 一百四十一、格式化函数

### 文件大小格式化

```typescript
// utils/format.ts

export function formatFileSize(sizeInBytes: number): string {
  const kb = sizeInBytes / 1024
  if (kb < 1) return `${sizeInBytes} bytes`
  if (kb < 1024) return `${kb.toFixed(1).replace(/\.0$/, '')}KB`

  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1).replace(/\.0$/, '')}MB`

  const gb = mb / 1024
  return `${gb.toFixed(1).replace(/\.0$/, '')}GB`
}
```

### 时长格式化

```typescript
export function formatDuration(
  ms: number,
  options?: { hideTrailingZeros?: boolean; mostSignificantOnly?: boolean },
): string {
  // < 1分钟
  if (ms < 60000) {
    if (ms === 0) return '0s'
    if (ms < 1) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 1000)}s`
  }

  // 分解天/时/分/秒
  let days = Math.floor(ms / 86400000)
  let hours = Math.floor((ms % 86400000) / 3600000)
  let minutes = Math.floor((ms % 3600000) / 60000)
  let seconds = Math.round((ms % 60000) / 1000)

  // 进位处理
  if (seconds === 60) { seconds = 0; minutes++ }
  if (minutes === 60) { minutes = 0; hours++ }
  if (hours === 24) { hours = 0; days++ }

  // 按 mostSignificantOnly 选择输出
  if (options?.mostSignificantOnly) {
    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return `${seconds}s`
  }

  // 完整格式
  if (days > 0) {
    if (hideTrailingZeros && hours === 0) return `${days}d`
    return `${days}d ${hours}h ${minutes}m`
  }
  // ...
}
```

---

## 一百四十二、平台检测

### 平台类型

```typescript
// utils/platform.ts

export type Platform = 'macos' | 'windows' | 'wsl' | 'linux' | 'unknown'

export const getPlatform = memoize((): Platform => {
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'win32') return 'windows'

  if (process.platform === 'linux') {
    // 检测 WSL
    try {
      const procVersion = readFileSync('/proc/version', 'utf8')
      if (procVersion.toLowerCase().includes('microsoft')) {
        return 'wsl'
      }
    } catch {}
    return 'linux'
  }

  return 'unknown'
})

// WSL 版本检测
export const getWslVersion = memoize((): string | undefined => {
  if (process.platform !== 'linux') return undefined

  try {
    const procVersion = readFileSync('/proc/version', 'utf8')

    // 显式版本 (WSL2, WSL3)
    const wslVersionMatch = procVersion.match(/WSL(\d+)/i)
    if (wslVersionMatch?.[1]) return wslVersionMatch[1]

    // WSL1 隐式标记
    if (procVersion.toLowerCase().includes('microsoft')) {
      return '1'
    }
  } catch {}

  return undefined
})
```

---

## 一百四十三、Git 操作

### 查找 Git 根目录

```typescript
// utils/git.ts

const GIT_ROOT_NOT_FOUND = Symbol('git-root-not-found')

const findGitRootImpl = memoizeWithLRU(
  (startPath: string): string | typeof GIT_ROOT_NOT_FOUND => {
    let current = resolve(startPath)
    const root = current.substring(0, current.indexOf(sep) + 1) || sep
    let statCount = 0

    while (current !== root) {
      try {
        const gitPath = join(current, '.git')
        statCount++
        const stat = statSync(gitPath)
        // .git 可以是目录或文件 (worktree/submodule)
        if (stat.isDirectory() || stat.isFile()) {
          return current.normalize('NFC')
        }
      } catch {}

      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }

    // 检查根目录
    try {
      const gitPath = join(root, '.git')
      if (statSync(gitPath).isDirectory()) {
        return root.normalize('NFC')
      }
    } catch {}

    return GIT_ROOT_NOT_FOUND
  }
)
```

---

## 一百四十四、错误处理

### 错误类型层次

```typescript
// utils/errors.ts

export class ClaudeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class AbortError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'AbortError'
  }
}

// 判断是否为 abort 错误
export function isAbortError(e: unknown): boolean {
  return (
    e instanceof AbortError ||
    e instanceof APIUserAbortError ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

export class ShellError extends Error {
  constructor(
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly code: number,
    public readonly interrupted: boolean,
  ) {
    super('Shell command failed')
    this.name = 'ShellError'
  }
}

export class TeleportOperationError extends Error {
  constructor(
    message: string,
    public readonly formattedMessage: string,
  ) {
    super(message)
    this.name = 'TeleportOperationError'
  }
}
```

---

## 一百四十五、缓冲写入

### BufferedWriter 实现

```typescript
// utils/bufferedWriter.ts

export type BufferedWriter = {
  write: (content: string) => void
  flush: () => void
  dispose: () => void
}

export function createBufferedWriter({
  writeFn,
  flushIntervalMs = 1000,
  maxBufferSize = 100,
  maxBufferBytes = Infinity,
  immediateMode = false,
}: {
  writeFn: WriteFn
  flushIntervalMs?: number
  maxBufferSize?: number
  maxBufferBytes?: number
  immediateMode?: boolean
}): BufferedWriter {
  let buffer: string[] = []
  let pendingOverflow: string[] | null = null

  // 定时刷新
  function scheduleFlush(): void {
    flushTimer = setTimeout(flush, flushIntervalMs)
  }

  // 同步刷新 (立即写入)
  function flush(): void {
    if (buffer.length === 0) return
    writeFn(buffer.join(''))
    buffer = []
    bufferBytes = 0
    clearTimer()
  }

  // 异步刷新 (分离 buffer，避免阻塞)
  function flushDeferred(): void {
    const detached = buffer
    buffer = []
    bufferBytes = 0
    setImmediate(() => {
      if (detached) writeFn(detached.join(''))
    })
  }

  return {
    write(content: string) {
      buffer.push(content)
      if (buffer.length >= maxBufferSize) {
        flushDeferred()
      } else {
        scheduleFlush()
      }
    },
    flush,
    dispose() {
      flush()
    },
  }
}
```

---

## 一百四十六、Debug 系统

### Debug 模式检测

```typescript
// utils/debug.ts

export type DebugLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<DebugLogLevel, number> = {
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
}

// 最小日志级别
export const getMinDebugLogLevel = memoize((): DebugLogLevel => {
  const raw = process.env.CLAUDE_CODE_DEBUG_LOG_LEVEL?.toLowerCase().trim()
  if (raw && Object.hasOwn(LEVEL_ORDER, raw)) {
    return raw as DebugLogLevel
  }
  return 'debug'
})

// Debug 模式检测
export const isDebugMode = memoize((): boolean => {
  return (
    runtimeDebugEnabled ||
    isEnvTruthy(process.env.DEBUG) ||
    isEnvTruthy(process.env.DEBUG_SDK) ||
    process.argv.includes('--debug') ||
    process.argv.includes('-d') ||
    getDebugFilePath() !== null
  )
})

// 中途启用 debug
export function enableDebugLogging(): boolean {
  const wasActive = isDebugMode() || process.env.USER_TYPE === 'ant'
  runtimeDebugEnabled = true
  isDebugMode.cache.clear?.()
  return wasActive
}
```

---

## 一百四十七、Sleep 与超时

### 可中断的 Sleep

```typescript
// utils/sleep.ts

export function sleep(
  ms: number,
  signal?: AbortSignal,
  opts?: { throwOnAbort?: boolean; abortError?: () => Error; unref?: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 先检查是否已中止
    if (signal?.aborted) {
      if (opts?.throwOnAbort || opts?.abortError) {
        void reject(opts.abortError?.() ?? new Error('aborted'))
      } else {
        void resolve()
      }
      return
    }

    const timer = setTimeout(resolve, ms)

    function onAbort(): void {
      clearTimeout(timer)
      if (opts?.throwOnAbort || opts?.abortError) {
        void reject(opts.abortError?.() ?? new Error('aborted'))
      } else {
        void resolve()
      }
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    if (opts?.unref) {
      timer.unref()
    }
  })
}

// 超时包装
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ])
}
```

---

## 一百四十八、Lockfile 文件锁

### 懒加载锁文件

```typescript
// utils/lockfile.ts

// proper-lockfile 在 require 时会 monkey-patch 所有 fs 方法 (~8ms)
// 静态导入会拖慢启动时间，即使不需要锁 (如 --help)

type Lockfile = typeof import('proper-lockfile')

let _lockfile: Lockfile | undefined

function getLockfile(): Lockfile {
  if (!_lockfile) {
    _lockfile = require('proper-lockfile') as Lockfile
  }
  return _lockfile
}

export function lock(
  file: string,
  options?: LockOptions,
): Promise<() => Promise<void>> {
  return getLockfile().lock(file, options)
}

export function unlock(file: string, options?: UnlockOptions): Promise<void> {
  return getLockfile().unlock(file, options)
}

export function check(file: string, options?: CheckOptions): Promise<boolean> {
  return getLockfile().check(file, options)
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Hash** | `utils/hash.ts` | djb2/sha256/wyhash |
| **格式化** | `utils/format.ts` | 文件大小/时长 |
| **平台** | `utils/platform.ts` | macOS/Windows/WSL/Linux |
| **Git** | `utils/git.ts` | Git 根目录查找 |
| **错误** | `utils/errors.ts` | 错误类型层次 |
| **缓冲写入** | `utils/bufferedWriter.ts` | 批量写入 |
| **Debug** | `utils/debug.ts` | 调试日志 |
| **Sleep** | `utils/sleep.ts` | 可中断延迟 |
| **Lockfile** | `utils/lockfile.ts` | 文件锁 |
| **Markdown** | `utils/markdown.ts` | Markdown 渲染 |