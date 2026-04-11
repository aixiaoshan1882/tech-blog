# Claude Code 源码深度学习笔记 (第二十四部分)

> 图像处理 · VCR 系统 · 终端录制 · 信号模式 · 剪贴板

---

## 一百二十八、图像处理

### 图像调整

```typescript
// utils/imageResizer.ts

// 图像限制常量
const IMAGE_MAX_WIDTH = 1800
const IMAGE_MAX_HEIGHT = 1800
const IMAGE_TARGET_RAW_SIZE = 500_000  // 500KB

// 调整图像大小
export async function resizeImageIfNeeded(
  buffer: Buffer,
  options?: ResizeOptions,
): Promise<Buffer> {
  const {
    maxWidth = IMAGE_MAX_WIDTH,
    maxHeight = IMAGE_MAX_HEIGHT,
    targetSize = IMAGE_TARGET_RAW_SIZE,
  } = options ?? {}

  // 1. 获取图像信息
  const image = await getImageProcessor()
  const metadata = await image.metadata(buffer)

  // 2. 检查是否需要调整
  if (
    metadata.width <= maxWidth &&
    metadata.height <= maxHeight &&
    buffer.length <= targetSize
  ) {
    return buffer
  }

  // 3. 计算新尺寸
  let width = metadata.width ?? maxWidth
  let height = metadata.height ?? maxHeight

  if (width > maxWidth) {
    height = Math.round(height * (maxWidth / width))
    width = maxWidth
  }

  if (height > maxHeight) {
    width = Math.round(width * (maxHeight / height))
    height = maxHeight
  }

  // 4. 调整大小
  const resized = await image
    .resize(width, height, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer()

  // 5. 如果还是太大，进一步压缩
  if (resized.length > targetSize) {
    return await compressFurther(resized, targetSize)
  }

  return resized
}
```

### 图像验证

```typescript
// utils/imageValidation.ts

// 验证图像格式
export function validateImageFormat(
  buffer: Buffer,
): ImageMediaType | null {
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return 'image/png'
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif'
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/webp'
  }

  return null
}
```

---

## 一百二十九、VCR 系统

### VCR 概述

```typescript
// services/vcr.ts

// VCR 用于测试录制和回放
function shouldUseVCR(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return true
  }
  if (process.env.USER_TYPE === 'ant' && isEnvTruthy(process.env.FORCE_VCR)) {
    return true
  }
  return false
}

// 使用 fixture
async function withFixture<T>(
  input: unknown,
  fixtureName: string,
  f: () => Promise<T>,
): Promise<T> {
  if (!shouldUseVCR()) {
    return await f()
  }

  // 创建输入的哈希作为 fixture 文件名
  const hash = createHash('sha1')
    .update(jsonStringify(input))
    .digest('hex')
    .slice(0, 12)

  const filename = join(getFixturesDir(), `${fixtureName}-${hash}.json`)

  // 尝试读取缓存的 fixture
  try {
    const cached = jsonParse(await readFile(filename, 'utf-8')) as T
    return cached
  } catch (e) {
    if (code !== 'ENOENT') throw e
  }

  // 创建新 fixture
  const result = await f()
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, jsonStringify(result))

  return result
}
```

---

## 一百三十、终端录制 (Asciicast)

### 录制状态

```typescript
// utils/asciicast.ts

const recordingState: { filePath: string | null; timestamp: number } = {
  filePath: null,
  timestamp: 0,
}

// 获取录制文件路径
export function getRecordFilePath(): string | null {
  if (recordingState.filePath !== null) {
    return recordingState.filePath
  }

  // 仅对内部用户启用
  if (process.env.USER_TYPE !== 'ant') {
    return null
  }

  if (!isEnvTruthy(process.env.CLAUDE_CODE_TERMINAL_RECORDING)) {
    return null
  }

  // 录制文件放在 transcript 旁边
  const projectDir = join(
    getClaudeConfigHomeDir(),
    'projects',
    sanitizePath(getOriginalCwd()),
  )

  recordingState.timestamp = Date.now()
  recordingState.filePath = join(
    projectDir,
    `${getSessionId()}-${recordingState.timestamp}.cast`,
  )

  return recordingState.filePath
}
```

### 会话录制路径

```typescript
// 获取当前会话的所有录制文件
export function getSessionRecordingPaths(): string[] {
  const sessionId = getSessionId()
  const projectDir = join(getProjectsDir(), sanitizePath(getOriginalCwd()))

  try {
    const entries = getFsImplementation().readdirSync(projectDir)
    const files = entries
      .filter(f => f.startsWith(sessionId) && f.endsWith('.cast'))
      .sort()

    return files.map(f => join(projectDir, f))
  } catch {
    return []
  }
}
```

---

## 一百三十一、剪贴板处理

### 剪贴板命令

```typescript
// utils/imagePaste.ts

// 平台特定的剪贴板命令
const commands = {
  darwin: {
    checkImage: `osascript -e 'the clipboard as «class PNGf»'`,
    saveImage: `osascript -e 'set png_data to (the clipboard as «class PNGf»)' ...`,
    getPath: `osascript -e 'get POSIX path of (the clipboard as «class furl»)'`,
    deleteFile: `rm -f "${screenshotPath}"`,
  },
  linux: {
    checkImage: `xclip -selection clipboard -t TARGETS -o 2>/dev/null | grep image/...`,
    saveImage: `xclip -selection clipboard -t image/png -o > "${screenshotPath}" ...`,
    getPath: `xclip -selection clipboard -t text/plain -o 2>/dev/null || wl-paste`,
    deleteFile: `rm -f "${screenshotPath}"`,
  },
  win32: {
    checkImage: `powershell -Command "(Get-Clipboard -Format Image) -ne $null"`,
    saveImage: `powershell -Command "$img = Get-Clipboard -Format Image; if ($img) { $img.Save(...) }"`,
    getPath: `powershell -Command "Get-Clipboard"`,
    deleteFile: `del /f "${screenshotPath}"`,
  },
}
```

### 图像粘贴处理

```typescript
// 检查剪贴板是否有图像
async function checkClipboardForImage(): Promise<Buffer | null> {
  const platform = process.platform as SupportedPlatform
  const checkCmd = commands[platform].checkImage

  const { exitCode, stdout } = await execFileNoThrowWithCwd(
    'bash',
    ['-c', checkCmd],
  )

  if (exitCode !== 0) {
    return null  // 没有图像
  }

  // 保存图像到临时文件
  const { exitCode: saveExit } = await execFileNoThrowWithCwd(
    'bash',
    ['-c', commands[platform].saveImage],
  )

  if (saveExit !== 0) {
    return null
  }

  // 读取临时文件
  return readFile(screenshotPath)
}
```

---

## 一百三十二、Signal 模式

### Signal 实现

```typescript
// utils/signal.ts

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
      return () => listeners.delete(listener)  // 取消订阅
    },

    emit(...args) {
      for (const listener of listeners) {
        listener(...args)
      }
    },

    clear() {
      listeners.clear()
    },
  }
}
```

### Signal 使用

```typescript
// 创建信号
const settingChanged = createSignal<[SettingSource]>()

// 导出订阅函数
export const subscribeToSettingChanges = settingChanged.subscribe

// 发出信号
settingChanged.emit('userSettings')

// 订阅
const unsubscribe = subscribeToSettingChanges((source) => {
  console.log('Setting changed:', source)
})

// 取消订阅
unsubscribe()
```

---

## 一百三十三、重要设计模式

### 1. Fixture 管理

```typescript
// VCR fixture 模式
async function withFixture<T>(
  input: unknown,
  fixtureName: string,
  producer: () => Promise<T>,
): Promise<T> {
  const hash = hashInput(input)
  const fixturePath = getFixturePath(fixtureName, hash)

  // 尝试加载缓存
  if (await exists(fixturePath)) {
    return loadFixture(fixturePath)
  }

  // 生成并保存
  const result = await producer()
  await saveFixture(fixturePath, result)

  return result
}
```

### 2. 平台检测

```typescript
// 平台特定的命令
type PlatformCommands = {
  darwin: PlatformCommand
  linux: PlatformCommand
  win32: PlatformCommand
}

function getClipboardCommand(
  platform: NodeJS.Platform,
  action: 'checkImage' | 'saveImage' | 'getText',
): string {
  const commands: PlatformCommands = { ... }
  return commands[platform]?.[action] ?? commands.linux[action]
}
```

### 3. 事件信号

```typescript
// 简单的事件发射器
class EventEmitter<T extends Record<string, unknown[]>> {
  private listeners: Map<keyof T, Set<(...args: any[]) => void>> = new Map()

  on<K extends keyof T>(event: K, handler: (...args: T[K]) => void): () => void {
    const handlers = this.listeners.get(event) ?? new Set()
    handlers.add(handler)
    this.listeners.set(event, handlers)

    return () => handlers.delete(handler)
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **图像调整** | `utils/imageResizer.ts` | 图像大小/压缩 |
| **图像验证** | `utils/imageValidation.ts` | 格式检测 |
| **VCR** | `services/vcr.ts` | 测试录制回放 |
| **终端录制** | `utils/asciicast.ts` | Asciicast 格式 |
| **剪贴板** | `utils/imagePaste.ts` | 跨平台剪贴板 |
| **Signal** | `utils/signal.ts` | 事件信号 |
| **Signal** | `bootstrap/state.ts` | 全局状态 |