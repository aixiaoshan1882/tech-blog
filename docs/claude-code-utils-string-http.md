# Claude Code 源码深度学习笔记 (第三十部分)

> 字符串工具·数组工具·HTTP 工具·键盘快捷键·路径截断

---

## 一百七十一、字符串工具

### 字符串处理

```typescript
// utils/stringUtils.ts

// 转义正则特殊字符
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 首字母大写
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// 复数形式
export function plural(
  n: number,
  word: string,
  pluralWord = word + 's',
): string {
  return n === 1 ? word : pluralWord
}

// 获取第一行
export function firstLineOf(s: string): string {
  const nl = s.indexOf('\n')
  return nl === -1 ? s : s.slice(0, nl)
}

// 统计字符出现次数
export function countCharInString(
  str: { indexOf(search: string, start?: number): number },
  char: string,
  start = 0,
): number {
  let count = 0
  let i = str.indexOf(char, start)
  while (i !== -1) {
    count++
    i = str.indexOf(char, i + 1)
  }
  return count
}

// 全角数字转半角
export function normalizeFullWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  )
}
```

---

## 一百七十二、数组工具

### 数组操作

```typescript
// utils/array.ts

// 插入分隔符
export function intersperse<A>(as: A[], separator: (index: number) => A): A[] {
  return as.flatMap((a, i) => (i ? [separator(i), a] : [a]))
}

// 计数
export function count<T>(arr: readonly T[], pred: (x: T) => unknown): number {
  let n = 0
  for (const x of arr) n += +!!pred(x)
  return n
}

// 去重
export function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)]
}
```

### 对象分组

```typescript
// utils/objectGroupBy.ts

export function objectGroupBy<T, K extends PropertyKey>(
  items: Iterable<T>,
  keySelector: (item: T, index: number) => K,
): Partial<Record<K, T[]>> {
  const result = Object.create(null) as Partial<Record<K, T[]>>
  let index = 0

  for (const item of items) {
    const key = keySelector(item, index++)
    if (result[key] === undefined) {
      result[key] = []
    }
    result[key].push(item)
  }

  return result
}

// 使用示例
const users = [
  { name: 'Alice', role: 'admin' },
  { name: 'Bob', role: 'user' },
  { name: 'Charlie', role: 'admin' },
]

const grouped = objectGroupBy(users, u => u.role)
// { admin: [Alice, Charlie], user: [Bob] }
```

---

## 一百七十三、路径截断

### 中间截断

```typescript
// utils/truncate.ts

// 从中间截断路径，保留目录和文件名
export function truncatePathMiddle(path: string, maxLength: number): string {
  if (stringWidth(path) <= maxLength) {
    return path
  }

  if (maxLength < 5) {
    return truncateToWidth(path, maxLength)
  }

  // 分离目录和文件名
  const lastSlash = path.lastIndexOf('/')
  const filename = lastSlash >= 0 ? path.slice(lastSlash) : path
  const directory = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
  const filenameWidth = stringWidth(filename)

  // 文件名太长，从头截断
  if (filenameWidth >= maxLength - 1) {
    return truncateStartToWidth(path, maxLength)
  }

  // 计算可用目录宽度
  const availableForDir = maxLength - 1 - filenameWidth

  if (availableForDir <= 0) {
    return truncateStartToWidth(filename, maxLength)
  }

  // 截断目录并组合
  const truncatedDir = truncateToWidthNoEllipsis(directory, availableForDir)
  return truncatedDir + '…' + filename
}

// 宽度感知的截断
export function truncateToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= 1) return '…'

  let width = 0
  let result = ''

  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = stringWidth(segment)
    if (width + segWidth > maxWidth - 1) break
    result += segment
    width += segWidth
  }

  return result + '…'
}

// 从开头截断
export function truncateStartToWidth(text: string, maxWidth: number): string {
  // 实现类似，从末尾截断
}
```

---

## 一百七十四、键盘快捷键

### macOS Option 键

```typescript
// utils/keyboardShortcuts.ts

// macOS Option+key 产生的特殊字符
export const MACOS_OPTION_SPECIAL_CHARS = {
  '†': 'alt+t',  // Option+T -> thinking toggle
  'π': 'alt+p',  // Option+P -> model picker
  'ø': 'alt+o',  // Option+O -> fast mode
} as const

export function isMacosOptionChar(
  char: string,
): char is keyof typeof MACOS_OPTION_SPECIAL_CHARS {
  return char in MACOS_OPTION_SPECIAL_CHARS
}
```

---

## 一百七十五、HTTP 工具

### User-Agent

```typescript
// utils/http.ts

export function getUserAgent(): string {
  const agentSdkVersion = process.env.CLAUDE_AGENT_SDK_VERSION
    ? `, agent-sdk/${process.env.CLAUDE_AGENT_SDK_VERSION}`
    : ''

  const clientApp = process.env.CLAUDE_AGENT_SDK_CLIENT_APP
    ? `, client-app/${process.env.CLAUDE_AGENT_SDK_CLIENT_APP}`
    : ''

  const workload = getWorkload()
  const workloadSuffix = workload ? `, workload/${workload}` : ''

  return `claude-cli/${VERSION} (` +
    `${process.env.USER_TYPE}, ` +
    `${process.env.CLAUDE_CODE_ENTRYPOINT ?? 'cli'}` +
    `${agentSdkVersion}` +
    `${clientApp}` +
    `${workloadSuffix}` +
    `)`
}

// WebFetch 的 User-Agent
export function getWebFetchUserAgent(): string {
  return `Claude-User (${getClaudeCodeUserAgent()}; +https://support.anthropic.com/)`
}
```

### 认证头

```typescript
// utils/http.ts

export function getAuthHeaders(): AuthHeaders {
  // OAuth 用户 (Max/Pro)
  if (isClaudeAISubscriber()) {
    const oauthTokens = getClaudeAIOAuthTokens()
    return {
      headers: {
        Authorization: `Bearer ${oauthTokens.accessToken}`,
      },
    }
  }

  // API Key 用户
  const apiKey = getAnthropicApiKey()
  return {
    headers: {
      'x-api-key': apiKey,
    },
  }
}
```

---

## 一百七十六、UUID 生成

### UUID 工具

```typescript
// utils/uuid.ts

import { randomUUID } from 'crypto'

export function generateUUID(): string {
  return randomUUID()
}

export function shortUUID(): string {
  return randomUUID().replace(/-/g, '')
}
```

---

## 一百七十七、Slug 生成

### Slug 工具

```typescript
// utils/slug.ts

export function createSlug(text: string, maxLength = 50): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // 移除变音符号
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
}
```

---

## 一百七十八、URL 处理

### URL 工具

```typescript
// utils/url.ts

export function isUrl(s: string): boolean {
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

export function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}
```

---

## 一百七十九、Intl 国际化

### 数字格式化

```typescript
// utils/intl.ts

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const formatter = new Intl.NumberFormat('en-US', options)
  return formatter.format(value)
}

export function formatRelativeTime(date: Date, locale = 'en-US'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

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
| **字符串** | `utils/stringUtils.ts` | 转义/截断/复数 |
| **数组** | `utils/array.ts` | intersperse/count/uniq |
| **分组** | `utils/objectGroupBy.ts` | 按 key 分组 |
| **路径** | `utils/truncate.ts` | 路径截断 |
| **键盘** | `utils/keyboardShortcuts.ts` | macOS 快捷键 |
| **HTTP** | `utils/http.ts` | User-Agent/认证 |
| **UUID** | `utils/uuid.ts` | UUID 生成 |
| **Slug** | `utils/slug.ts` | URL 友好字符串 |
| **URL** | `utils/url.ts` | URL 处理 |
| **Intl** | `utils/intl.ts` | 国际化 |