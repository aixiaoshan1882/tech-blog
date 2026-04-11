# Claude Code 源码深度学习笔记 (第十八部分)

> IDE 集成 · 语音服务 · 通知系统 · 提示系统

---

## 九十六、IDE 集成

### IDE 检测

```typescript
// utils/ide.ts

export async function detectIDE(): Promise<DetectedIDEInfo | null> {
  // 检测支持的 IDE:
  // - VS Code
  // - Cursor
  // - JetBrains (IntelliJ, WebStorm, etc.)
  // - Windsurf
  // - VS Code Insiders

  const lockfiles = await getSortedIdeLockfiles()

  for (const lockfile of lockfiles) {
    const info = parseIdeLockfile(lockfile)
    if (info && isCompatibleVersion(info)) {
      return {
        name: info.ideName,
        port: info.port,
        workspaceFolders: info.workspaceFolders,
        url: `http://localhost:${info.port}`,
        isValid: true,
        authToken: info.authToken,
      }
    }
  }

  return null
}

// 锁文件解析
interface IdeLockfileInfo {
  workspaceFolders: string[]
  port: number
  pid?: number
  ideName?: string
  useWebSocket: boolean
  runningInWindows: boolean
  authToken?: string
}
```

### IDE 通信协议

```typescript
// 通过 MCP 调用 IDE RPC
export async function callIdeRpc(
  method: string,
  params?: unknown,
): Promise<IdeRpcResult> {
  const ide = await getConnectedIdeClient()

  return ide.call(method, params)
}

// 可用的 IDE 方法
const IDE_METHODS = {
  'workspace/symbol': searchWorkspaceSymbols,
  'textDocument/definition': goToDefinition,
  'textDocument/hover': showHover,
  'textDocument/completion': getCompletions,
  'workspace/edit': applyEdit,
  'window/showMessage': showMessage,
}
```

### IDE 路径转换

```typescript
// utils/idePathConversion.ts

// WSL 和 Windows 之间的路径转换
export class WindowsToWSLConverter {
  constructor(wslDistro?: string) {
    this.wslDistro = wslDistro ?? 'Ubuntu'
  }

  toWSL(windowsPath: string): string {
    // C:\Users\... → /mnt/c/Users/...
    const normalized = windowsPath.replace(/\\+/g, '/')
    return `/mnt/${normalized.charAt(0).toLowerCase()}/${normalized.slice(2)}`
  }

  toWindows(wslPath: string): string {
    // /mnt/c/Users/... → C:\Users\...
    const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)/)
    if (!match) return wslPath
    return `${match[1]!.toUpperCase()}:\\${match[2]!.replace(/\//g, '\\')}`
  }
}
```

---

## 九十七、语音服务

### 音频录制

```typescript
// services/voice.ts

// 录音配置
const RECORDING_SAMPLE_RATE = 16000
const RECORDING_CHANNELS = 1
const SILENCE_DURATION_SECS = '2.0'
const SILENCE_THRESHOLD = '3%'

// 懒加载原生音频模块
type AudioNapi = typeof import('audio-capture-napi')
let audioNapi: AudioNapi | null = null
let audioNapiPromise: Promise<AudioNapi> | null = null

function loadAudioNapi(): Promise<AudioNapi> {
  audioNapiPromise ??= (async () => {
    const mod = await import('audio-capture-napi')
    mod.isNativeAudioAvailable()  // 触发延迟加载
    audioNapi = mod
    return mod
  })()
  return audioNapiPromise
}
```

### 录音实现

```typescript
// services/voice.ts

export async function startRecording(): Promise<RecordingHandle> {
  const platform = getPlatform()

  if (platform === 'darwin') {
    // macOS: 使用 CoreAudio
    const napi = await loadAudioNapi()
    return napi.startRecording({
      sampleRate: RECORDING_SAMPLE_RATE,
      channels: RECORDING_CHANNELS,
    })
  } else if (platform === 'linux') {
    // Linux: 尝试 native, 回退到 SoX/arecord
    if (await hasNativeAudio()) {
      const napi = await loadAudioNapi()
      return napi.startRecording({ ... })
    }
    return startSoxRecording() ?? startArecordRecording()
  }

  throw new Error(`Voice not supported on ${platform}`)
}

// SoX 录音
async function startSoxRecording(): Promise<RecordingHandle | null> {
  const hasRec = hasCommand('rec')
  if (!hasRec) return null

  return spawnRecordingProcess(
    ['rec', '-r', '16000', '-t', 'raw', '-'],
    { encoding: 'buffer' }
  )
}
```

### 语音转文字

```typescript
// services/voiceStreamSTT.ts

export async function transcribeAudio(
  audioData: Buffer,
  options?: TranscriptionOptions,
): Promise<string> {
  const {
    model = 'whisper-1',
    language,
    prompt,
  } = options ?? {}

  // 调用语音识别 API
  const response = await openAI.audio.transcriptions.create({
    model,
    file: new File([audioData], 'audio.raw', { type: 'audio/raw' }),
    language,
    prompt,
  })

  return response.text
}
```

---

## 九十八、通知系统

### 通知渠道

```typescript
// services/notifier.ts

export async function sendNotification(
  notif: NotificationOptions,
  terminal: TerminalNotification,
): Promise<void> {
  const config = getGlobalConfig()
  const channel = config.preferredNotifChannel

  await executeNotificationHooks(notif)
  await sendToChannel(channel, notif, terminal)
}

// 支持的渠道
type NotificationChannel =
  | 'auto'           // 自动检测
  | 'iterm2'         // iTerm2 通知
  | 'iterm2_with_bell'
  | 'kitty'          // Kitty 通知
  | 'ghostty'        // Ghostty 通知
  | 'terminal_bell'  // 终端铃声
  | 'notifications_disabled'
```

### iTerm2 通知

```typescript
// 发送 iTerm2 通知
async function notifyITerm2(opts: NotificationOptions): Promise<void> {
  terminal.notifyITerm2({
    title: opts.title || 'Claude Code',
    body: opts.message,
  })
}

// iTerm2 魔法注释格式
// \x1b]9;message\x07 - 显示通知
// \x1b]9;?\x07 - 查询通知支持
```

### 静默检测

```typescript
// 检测静默结束
async function detectSilence(
  audioStream: AudioStream,
  threshold: number = SILENCE_THRESHOLD,
): Promise<void> {
  let silenceStart: number | null = null

  for await (const chunk of audioStream) {
    const volume = calculateVolume(chunk)

    if (volume < threshold) {
      if (!silenceStart) {
        silenceStart = Date.now()
      } else if (Date.now() - silenceStart > SILENCE_DURATION_SECS * 1000) {
        // 静默超过阈值，停止录音
        await stopRecording()
        break
      }
    } else {
      silenceStart = null
    }
  }
}
```

---

## 九十九、提示系统

### 提示注册表

```typescript
// services/tips/tipRegistry.ts

export interface Tip {
  id: string
  title: string
  content: string
  category: 'feature' | 'shortcut' | 'config' | 'onboarding'
  conditions: TipCondition[]
  priority: number
  dismissible: boolean
}

export interface TipCondition {
  type: 'feature_flag' | 'setting' | 'model' | 'plugin' | 'ide' | 'file'
  name: string
  value?: unknown
}

// 提示示例
const TIPS: Tip[] = [
  {
    id: 'workspace-symbol',
    title: 'Quickly jump to symbols',
    content: 'Use Ctrl+T to search for function and variable names.',
    category: 'shortcut',
    conditions: [
      { type: 'ide', name: 'vscode' },
    ],
    priority: 10,
    dismissible: true,
  },
  // ...
]
```

### 提示调度

```typescript
// services/tips/tipScheduler.ts

export class TipScheduler {
  private shownTips: Set<string> = new Set()
  private lastShown: Map<string, number> = new Map()

  async getNextTip(context: TipContext): Promise<Tip | null> {
    const eligible = await this.getEligibleTips(context)

    // 排序并过滤
    const sorted = eligible
      .filter(t => !this.wasRecentlyShown(t.id))
      .sort((a, b) => b.priority - a.priority)

    return sorted[0] ?? null
  }

  async showTip(tip: Tip): Promise<void> {
    this.shownTips.add(tip.id)
    this.lastShown.set(tip.id, Date.now())

    await displayTipInUI(tip)
  }
}
```

### 提示条件

```typescript
// 检测提示条件
async function checkTipConditions(
  tip: Tip,
  context: TipContext,
): Promise<boolean> {
  for (const condition of tip.conditions) {
    switch (condition.type) {
      case 'feature_flag':
        if (!isFeatureEnabled(condition.name)) return false
        break
      case 'setting':
        if (!checkSetting(condition.name, condition.value)) return false
        break
      case 'model':
        if (!isModel(condition.name)) return false
        break
      case 'plugin':
        if (!isPluginInstalled(condition.name)) return false
        break
      case 'ide':
        if (!isIDE(condition.name)) return false
        break
    }
  }

  return true
}
```

---

## 一百、重要设计模式

### 1. 懒加载原生模块

```typescript
// 避免启动时阻塞
function loadAudioNapi(): Promise<AudioNapi> {
  audioNapiPromise ??= (async () => {
    const t0 = Date.now()
    const mod = await import('audio-capture-napi')
    // 触发延迟加载
    mod.isNativeAudioAvailable()
    audioNapi = mod
    logForDebugging(`[voice] loaded in ${Date.now() - t0}ms`)
    return mod
  })()
  return audioNapiPromise
}
```

### 2. 通知渠道自动检测

```typescript
// 'auto' 模式自动选择最佳渠道
async function sendAuto(
  opts: NotificationOptions,
  terminal: TerminalNotification,
): Promise<string> {
  // 按优先级尝试
  if (terminal.supportsITerm2()) {
    terminal.notifyITerm2(opts)
    return 'iterm2'
  }

  if (terminal.supportsKitty()) {
    terminal.notifyKitty(opts)
    return 'kitty'
  }

  // 回退到终端铃声
  terminal.notifyBell()
  return 'terminal_bell'
}
```

### 3. 提示优先级调度

```typescript
// 提示调度算法
async function scheduleTips(context: TipContext): Promise<void> {
  const scheduler = TipScheduler.getInstance()
  const tip = await scheduler.getNextTip(context)

  if (!tip) return

  // 检查冷却时间
  const cooldown = getTipCooldown(tip.id)
  if (Date.now() - cooldown < TIP_COOLDOWN_MS) {
    return
  }

  await scheduler.showTip(tip)
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **IDE 检测** | `utils/ide.ts` | IDE 识别 |
| **IDE 通信** | `services/mcp/client.ts` | IDE RPC |
| **路径转换** | `utils/idePathConversion.ts` | WSL 路径 |
| **语音录制** | `services/voice.ts` | 音频录制 |
| **语音转文字** | `services/voiceStreamSTS.ts` | STT |
| **通知** | `services/notifier.ts` | 多渠道通知 |
| **提示** | `services/tips/tipRegistry.ts` | 提示注册 |
| **提示调度** | `services/tips/tipScheduler.ts` | 提示排序 |