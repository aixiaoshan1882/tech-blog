# Claude Code 源码深度学习笔记 (第二十七部分)

> 执行函数·路径处理·JSON 解析·XML 转义·Memoize 缓存

---

## 一百四十九、execFile 执行封装

### execa 封装

```typescript
// utils/execFileNoThrow.ts

import { execa } from 'execa'

type ExecFileOptions = {
  abortSignal?: AbortSignal
  timeout?: number
  preserveOutputOnError?: boolean
  useCwd?: boolean
  env?: NodeJS.ProcessEnv
  stdin?: 'ignore' | 'inherit' | 'pipe'
  input?: string
}

export async function execFileNoThrow(
  file: string,
  args: string[],
  options: ExecFileOptions = {
    timeout: 10 * 60 * 1000,  // 默认 10 分钟
    preserveOutputOnError: true,
    useCwd: true,
  },
): Promise<{
  stdout: string
  stderr: string
  code: number
  error?: string
}> {
  try {
    const result = await execa(file, args, {
      cwd: options.useCwd ? getCwd() : undefined,
      signal: options.abortSignal,
      timeout: options.timeout,
      env: options.env,
      stdin: options.stdin,
      input: options.input,
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.exitCode,
    }
  } catch (e) {
    if (e instanceof Error && 'exitCode' in e) {
      return {
        stdout: (e as ExecaError).stdout ?? '',
        stderr: (e as ExecaError).stderr ?? '',
        code: (e as ExecaError).exitCode ?? 1,
        error: getErrorMessage(e as ExecaError),
      }
    }
    return { stdout: '', stderr: '', code: 1, error: String(e) }
  }
}

// 提取错误消息
function getErrorMessage(result: ExecaResultWithError, errorCode: number): string {
  if (result.shortMessage) return result.shortMessage
  if (result.signal) return result.signal
  return `exit code ${errorCode}`
}
```

---

## 一百五十、路径处理

### 路径展开

```typescript
// utils/path.ts

export function expandPath(path: string, baseDir?: string): string {
  const actualBaseDir = baseDir ?? getCwd()

  // 空检查
  const trimmedPath = path.trim()
  if (!trimmedPath) {
    return normalize(actualBaseDir).normalize('NFC')
  }

  // ~ 展开
  if (trimmedPath === '~') {
    return homedir().normalize('NFC')
  }

  if (trimmedPath.startsWith('~/')) {
    return join(homedir(), trimmedPath.slice(2)).normalize('NFC')
  }

  // Windows POSIX 路径转换
  if (getPlatform() === 'windows' && trimmedPath.match(/^\/[a-z]\//i)) {
    processedPath = posixPathToWindowsPath(trimmedPath)
  }

  // 绝对路径
  if (isAbsolute(processedPath)) {
    return normalize(processedPath).normalize('NFC')
  }

  // 相对路径
  return normalize(join(actualBaseDir, processedPath)).normalize('NFC')
}
```

### 路径安全检查

```typescript
// 安全检查
if (path.includes('\0')) {
  throw new Error('Path contains null bytes')
}
```

---

## 一百五十一、JSON 解析

### JSONC 解析 (带注释)

```typescript
// utils/json.ts

import { parse as parseJsonc } from 'jsonc-parser'

// JSONC 解析 (VS Code 配置格式)
export function safeParseJSONC(json: string | null | undefined): unknown {
  if (!json) return null

  try {
    // 去除 BOM (PowerShell 5.x 会添加)
    return parseJsonc(stripBOM(json))
  } catch (e) {
    logError(e)
    return null
  }
}

// LRU 缓存的 JSON 解析
const PARSE_CACHE_MAX_KEY_BYTES = 8 * 1024  // 8KB 上限

const parseJSONCached = memoizeWithLRU(
  parseJSONUncached,
  json => json,
  50  // 最多 50 条
)

export const safeParseJSON = Object.assign(
  function safeParseJSON(json, shouldLogError = true): unknown {
    if (!json) return null

    // 大文件不缓存
    if (json.length > PARSE_CACHE_MAX_KEY_BYTES) {
      return parseJSONUncached(json, shouldLogError)
    }

    return parseJSONCached(json, shouldLogError)
  },
  { cache: parseJSONCached.cache }
)
```

### JSON 修改

```typescript
// utils/json.ts

export function jsonAddToArray(
  content: string,
  newItem: unknown,
  path: string,
): string {
  const edits = modify(content, [...parsePath(path), -1], newItem, {
    isArrayInsertion: true,
  })
  return applyEdits(content, edits)
}
```

---

## 一百五十二、XML 转义

### XML/HTML 转义

```typescript
// utils/xml.ts

// 元素文本转义
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 属性值转义
export function escapeXmlAttr(s: string): string {
  return escapeXml(s)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
```

---

## 一百五十三、Memoize 缓存

### TTL 缓存

```typescript
// utils/memoize.ts

type CacheEntry<T> = {
  value: T
  timestamp: number
  refreshing: boolean
}

// TTL 缓存实现
export function memoizeWithTTL<Args extends unknown[], Result>(
  f: (...args: Args) => Result,
  cacheLifetimeMs: number = 5 * 60 * 1000,  // 默认 5 分钟
): MemoizedFunction<Args, Result> {
  const cache = new Map<string, CacheEntry<Result>>()

  const memoized = (...args: Args): Result => {
    const key = jsonStringify(args)
    const cached = cache.get(key)
    const now = Date.now()

    // 无缓存
    if (!cached) {
      const value = f(...args)
      cache.set(key, { value, timestamp: now, refreshing: false })
      return value
    }

    // 缓存过期，后台刷新
    if (now - cached.timestamp > cacheLifetimeMs && !cached.refreshing) {
      cached.refreshing = true

      Promise.resolve().then(() => {
        const newValue = f(...args)
        if (cache.get(key) === cached) {
          cache.set(key, {
            value: newValue,
            timestamp: Date.now(),
            refreshing: false,
          })
        }
      }).catch(() => {
        cache.delete(key)
      })

      return cached.value  // 返回过期值
    }

    return cached.value
  }

  memoized.cache = {
    clear: () => cache.clear(),
  }

  return memoized
}
```

### LRU 缓存

```typescript
// utils/memoize.ts

import { LRUCache } from 'lru-cache'

// LRU 缓存
export function memoizeWithLRU<Args extends unknown[], Result>(
  f: (...args: Args) => Result,
  keyFn: (...args: Args) => string,
  maxSize: number,
): LRUMemoizedFunction<Args, Result> {
  const lru = new LRUCache<string, Result>({ maxSize })

  const memoized = (...args: Args): Result => {
    const key = keyFn(...args)
    const cached = lru.get(key)
    if (cached !== undefined) {
      return cached
    }

    const value = f(...args)
    lru.set(key, value)
    return value
  }

  memoized.cache = {
    clear: () => lru.clear(),
    size: () => lru.size,
    delete: (key: string) => lru.delete(key),
    get: (key: string) => lru.get(key),
    has: (key: string) => lru.has(key),
  }

  return memoized
}
```

---

## 一百五十四、Slug 生成

### Slug 工具

```typescript
// utils/slug.ts

export function createSlug(text: string, maxLength = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')      // 非字母数字变 -
    .replace(/^-+|-+$/g, '')          // 去除首尾 -
    .slice(0, maxLength)
}
```

---

## 一百五十五、UUID 生成

### UUID 工具

```typescript
// utils/uuid.ts

import { randomUUID } from 'crypto'

// 生成 UUID
export function generateUUID(): string {
  return randomUUID()
}

// 短 UUID (无破折号)
export function shortUUID(): string {
  return randomUUID().replace(/-/g, '')
}
```

---

## 一百五十六、URL 处理

### URL 工具

```typescript
// utils/url.ts

// 检查是否为 URL
export function isUrl(s: string): boolean {
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

// 安全 URL 构建
export function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}
```

---

## 一百五十七、Intl 格式化

### 国际化数字格式化

```typescript
// utils/intl.ts

let numberFormatterForConsistentDecimals: Intl.NumberFormat | null = null
let numberFormatterForInconsistentDecimals: Intl.NumberFormat | null = null

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  // 缓存格式化器
  const formatter = new Intl.NumberFormat('en-US', options)
  return formatter.format(value)
}

// 相对时间格式化
export function formatRelativeTime(
  date: Date,
  locale = 'en-US',
): string {
  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  })

  const diff = date.getTime() - Date.now()
  const diffSeconds = Math.round(diff / 1000)
  const diffMinutes = Math.round(diffSeconds / 60)
  const diffHours = Math.round(diffMinutes / 60)
  const diffDays = Math.round(diffHours / 24)

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, 'second')
  }
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }
  return rtf.format(diffDays, 'day')
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **执行** | `utils/execFileNoThrow.ts` | execa 封装 |
| **路径** | `utils/path.ts` | 路径展开/安全 |
| **JSON** | `utils/json.ts` | JSON/JSONC 解析 |
| **XML** | `utils/xml.ts` | XML 转义 |
| **Memoize** | `utils/memoize.ts` | TTL/LRU 缓存 |
| **Slug** | `utils/slug.ts` | URL 友好字符串 |
| **UUID** | `utils/uuid.ts` | UUID 生成 |
| **URL** | `utils/url.ts` | URL 处理 |
| **Intl** | `utils/intl.ts` | 国际化 |