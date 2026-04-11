# Claude Code 源码深度学习笔记 (第三十三部分)

> 二进制检测·生成器·Early Input·优雅关闭·指纹

---

## 一百九十七、二进制检测

### 命令是否存在

```typescript
// utils/binaryCheck.ts

const binaryCache = new Map<string, boolean>()

export async function isBinaryInstalled(command: string): Promise<boolean> {
  if (!command?.trim()) return false

  // 缓存查找
  const cached = binaryCache.get(command.trim())
  if (cached !== undefined) return cached

  // 使用 which 查找
  let exists = false
  if (await which(command.trim()).catch(() => null)) {
    exists = true
  }

  binaryCache.set(command.trim(), exists)
  return exists
}

export function clearBinaryCache(): void {
  binaryCache.clear()
}
```

---

## 一百九十八、AsyncGenerator 生成器

### 并发生成器

```typescript
// utils/generators.ts

// 获取生成器的最后一个值
export async function lastX<A>(as: AsyncGenerator<A>): Promise<A> {
  let lastValue: A | typeof NO_VALUE = NO_VALUE
  for await (const a of as) {
    lastValue = a
  }
  if (lastValue === NO_VALUE) {
    throw new Error('No items in generator')
  }
  return lastValue
}

// 并发运行多个生成器
export async function* all<A>(
  generators: AsyncGenerator<A, void>[],
  concurrencyCap = Infinity,
): AsyncGenerator<A, void> {
  const next = (gen: AsyncGenerator<A, void>) => {
    const promise = gen.next().then(({ done, value }) => ({
      done, value, generator: gen, promise,
    }))
    return promise
  }

  const waiting = [...generators]
  const promises = new Set<Promise<QueuedGenerator<A>>>()

  // 启动初始批次
  while (promises.size < concurrencyCap && waiting.length > 0) {
    promises.add(next(waiting.shift()!))
  }

  while (promises.size > 0) {
    const { done, value, generator, promise } = await Promise.race(promises)
    promises.delete(promise)

    if (!done) {
      promises.add(next(generator))
      if (value !== undefined) yield value
    } else if (waiting.length > 0) {
      // 一个完成时启动新的
      promises.add(next(waiting.shift()!))
    }
  }
}

// 转换为数组
export async function toArray<A>(
  generator: AsyncGenerator<A, void>,
): Promise<A[]> {
  const result: A[] = []
  for await (const a of generator) {
    result.push(a)
  }
  return result
}
```

---

## 一百九十九、Early Input 捕获

### 启动时输入捕获

```typescript
// utils/earlyInput.ts

let earlyInputBuffer = ''
let isCapturing = false

// 开始捕获早期输入
export function startCapturingEarlyInput(): void {
  // 仅在 TTY 模式下捕获
  if (
    !process.stdin.isTTY ||
    isCapturing ||
    process.argv.includes('-p') ||
    process.argv.includes('--print')
  ) {
    return
  }

  isCapturing = true

  try {
    process.stdin.setRawMode(true)

    readableHandler = () => {
      let chunk = process.stdin.read()
      while (chunk !== null) {
        if (typeof chunk === 'string') {
          processChunk(chunk)
        }
        chunk = process.stdin.read()
      }
    }

    process.stdin.on('readable', readableHandler)
  } catch {
    isCapturing = false
  }
}

// 处理输入块
function processChunk(str: string): void {
  for (const char of str) {
    const code = char.charCodeAt(0)

    // Ctrl+C - 停止捕获并退出
    if (code === 3) {
      process.exit(130)
    }

    // Ctrl+D - 发送 EOF
    if (code === 4) {
      consumeEarlyInput()
      return
    }

    // Enter - 完成输入
    if (code === 13 || code === 10) {
      const input = earlyInputBuffer
      consumeEarlyInput()
      // 处理完整输入...
      return
    }

    // 其他字符添加到缓冲区
    earlyInputBuffer += char
  }
}

// 消费早期输入
export function consumeEarlyInput(): string {
  stopCapturingEarlyInput()
  const result = earlyInputBuffer
  earlyInputBuffer = ''
  return result
}

export function stopCapturingEarlyInput(): void {
  if (readableHandler) {
    process.stdin.removeListener('readable', readableHandler)
    readableHandler = null
  }
  process.stdin.setRawMode(false)
  isCapturing = false
}
```

---

## 二百、优雅关闭

### 清理注册表

```typescript
// utils/cleanupRegistry.ts

const cleanupFunctions = new Set<() => Promise<void>>()

export function registerCleanup(cleanupFn: () => Promise<void>): () => void {
  cleanupFunctions.add(cleanupFn)
  return () => cleanupFunctions.delete(cleanupFn)
}

export async function runCleanupFunctions(): Promise<void> {
  await Promise.all(
    Array.from(cleanupFunctions).map(fn => fn())
  )
}
```

### 终端模式清理

```typescript
// utils/gracefulShutdown.ts

function cleanupTerminalModes(): void {
  if (!process.stdout.isTTY) return

  // 按顺序禁用终端模式
  writeSync(1, DISABLE_MOUSE_TRACKING)
  writeSync(1, EXIT_ALT_SCREEN)
  writeSync(1, SHOW_CURSOR)
  writeSync(1, DISABLE_KITTY_KEYBOARD)
}

// 信号退出处理
import { onExit } from 'signal-exit'

onExit((code, signal) => {
  cleanupTerminalModes()
  await runCleanupFunctions()
})
```

---

## 二百零一、空闲超时

### SDK 模式空闲超时

```typescript
// utils/idleTimeout.ts

export function createIdleTimeoutManager(isIdle: () => boolean): {
  start: () => void
  stop: () => void
} {
  const exitAfterStopDelay = process.env.CLAUDE_CODE_EXIT_AFTER_STOP_DELAY
  const delayMs = exitAfterStopDelay ? parseInt(exitAfterStopDelay, 10) : null
  const isValidDelay = delayMs && !isNaN(delayMs) && delayMs > 0

  let timer: NodeJS.Timeout | null = null
  let lastIdleTime = 0

  return {
    start() {
      if (timer) clearTimeout(timer)

      if (isValidDelay) {
        lastIdleTime = Date.now()
        timer = setTimeout(() => {
          const idleDuration = Date.now() - lastIdleTime
          if (isIdle() && idleDuration >= delayMs) {
            gracefulShutdownSync()
          }
        }, delayMs)
      }
    },

    stop() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
```

---

## 二百零二、指纹计算

### 消息指纹

```typescript
// utils/fingerprint.ts

export const FINGERPRINT_SALT = '59cf53e54c78'

// 从消息提取文本
export function extractFirstMessageText(
  messages: (UserMessage | AssistantMessage)[],
): string {
  const firstUserMessage = messages.find(msg => msg.type === 'user')
  if (!firstUserMessage) return ''

  const content = firstUserMessage.message.content

  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    const textBlock = content.find(block => block.type === 'text')
    if (textBlock?.type === 'text') return textBlock.text
  }

  return ''
}

// 计算指纹: SHA256(SALT + chars[4,7,20] + version)[:3]
export function computeFingerprint(
  messageText: string,
  version: string,
): string {
  // 提取索引 [4, 7, 20] 的字符
  const indices = [4, 7, 20]
  const chars = indices.map(i => messageText[i] || '0').join('')

  const input = `${FINGERPRINT_SALT}${chars}${version}`
  const hash = createHash('sha256').update(input).digest('hex')

  return hash.slice(0, 3)
}
```

---

## 二百零三、ANSI 切片

### 正确处理 ANSI 的字符串切片

```typescript
// utils/sliceAnsi.ts

import { tokenize } from '@alcalzone/ansi-tokenize'

export default function sliceAnsi(
  str: string,
  start: number,
  end?: number,
): string {
  const tokens = tokenize(str)
  let activeCodes: AnsiCode[] = []
  let position = 0
  let result = ''
  let include = false

  for (const token of tokens) {
    // 计算显示宽度
    const width = token.type === 'ansi'
      ? 0
      : token.fullWidth ? 2 : stringWidth(token.value)

    // 超出范围，停止
    if (end !== undefined && position >= end) {
      if (token.type === 'ansi' || width > 0 || !include) break
    }

    if (token.type === 'ansi') {
      activeCodes.push(token)
      if (include) {
        result += token.code  // 发出 ANSI 代码
      }
    } else {
      if (!include && position >= start) {
        // 开始包含
        if (start > 0 && width === 0) continue  // 跳过前导零宽字符
        include = true
        activeCodes = filterStartCodes(reduceAnsiCodes(activeCodes))
        result = ansiCodesToString(activeCodes)
      }

      if (include) {
        result += token.value
        position += width
      }
    }
  }

  // 添加结束 ANSI 序列
  if (include) {
    result += ansiCodesToString(undoAnsiCodes(activeCodes))
  }

  return result
}
```

---

## 二百零四、Crypto 适配

### 浏览器构建适配

```typescript
// utils/crypto.ts

// 间接点用于 package.json "browser" 字段
// 当 bun 构建 browser-sdk.js 时，这个文件会被替换为 crypto.browser.ts
// 避免 ~500KB 的 crypto-browserify polyfill

import { randomUUID } from 'crypto'

// 注意: `export { randomUUID } from 'crypto'` (重新导出语法)
// 在 bun-internal 的字节码编译下会出错
// 必须使用显式导入再导出
export { randomUUID }
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **二进制检测** | `utils/binaryCheck.ts` | which 命令 |
| **生成器** | `utils/generators.ts` | AsyncGenerator |
| **Early Input** | `utils/earlyInput.ts` | 启动时输入捕获 |
| **清理注册表** | `utils/cleanupRegistry.ts` | 清理函数 |
| **优雅关闭** | `utils/gracefulShutdown.ts` | 信号处理 |
| **空闲超时** | `utils/idleTimeout.ts` | SDK 超时 |
| **指纹** | `utils/fingerprint.ts` | 归因指纹 |
| **ANSI 切片** | `utils/sliceAnsi.ts` | ANSI 感知切片 |
| **Crypto** | `utils/crypto.ts` | 浏览器构建适配 |