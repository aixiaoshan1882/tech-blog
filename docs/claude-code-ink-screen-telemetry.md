# Claude Code 源码深度学习笔记 (第四十部分)

> Ink渲染·Screen·Reconciler·Telemetry·Keybindings

---

## 二百五十二、Ink 渲染引擎

### React Reconciler for Terminal

```typescript
// ink/ink.tsx

/**
 * Ink - React for CLIs
 * 基于 React Reconciler 的终端 UI 渲染引擎
 */

// 核心组件
export default class Ink {
  private readonly log: LogUpdate
  private readonly terminal: Terminal
  private scheduleRender: (() => void) & { cancel?: () => void }
  private reconciler: React.Reconciler
  private root: FiberRoot

  // 渲染帧
  private renderFrame(): void {
    // 更新 yoga 布局
    // diff 屏幕
    // 写入终端
  }

  // 挂载 React 组件
  render(element: ReactNode): void {
    if (!this.root) {
      this.root = this.reconciler.createContainer(/* ... */)
    }
    this.reconciler.updateContainer(element, this.root, null)
  }

  // 卸载
  unmount(): void {
    this.reconciler.updateContainer(null, this.root, null)
  }
}
```

---

## 二百五十三、Screen 屏幕管理

### 字符池和样式池

```typescript
// ink/screen.ts

/**
 * 屏幕池管理 - 字符、超链接、样式
 * 使用 interning 优化内存
 */

// 字符池 - 字符串驻留
export class CharPool {
  private strings: string[] = [' ', '']  // 0=空格, 1=空
  private stringMap = new Map<string, number>()
  private ascii: Int32Array  // ASCII 快速查找

  intern(char: string): number {
    // ASCII 快速路径
    if (char.length === 1) {
      const code = char.charCodeAt(0)
      if (code < 128) {
        const cached = this.ascii[code]
        if (cached !== -1) return cached
      }
    }
    // 通用路径
    const existing = this.stringMap.get(char)
    if (existing !== undefined) return existing
    const index = this.strings.length
    this.strings.push(char)
    this.stringMap.set(char, index)
    return index
  }
}

// 超链接池
export class HyperlinkPool {
  private strings: string[] = ['']  // 0=无链接
  private stringMap = new Map<string, number>()

  intern(hyperlink: string | undefined): number {
    if (!hyperlink) return 0
    // ...
  }
}

// 单元格
export type Cell = {
  char: number        // char pool index
  style: number       // style pool index
  hyperlink: number   // hyperlink pool index
}

// 屏幕
export interface Screen {
  width: number
  height: number
  cells: Cell[][]
  dirty: Rectangle[]
}
```

---

## 二百五十四、Reconciler 协调器

### React 渲染协调

```typescript
// ink/reconciler.ts

/**
 * React Reconciler 配置
 * 将 React 元素树协调到 Ink 的 DOM
 */

const reconciler = createReconciler({
  // 节点操作
  createInstance(type, props),
  createTextInstance(text),
  appendInitialChild(parent, child),
  appendChild(parent, child),
  insertChild(parent, child, beforeChild),
  removeChild(parent, child),

  // 更新
  prepareUpdate(instance, type, oldProps, newProps),

  // 提交
  commitMount(instance, type, props),
  commitUpdate(instance, newProps),
  commitTextUpdate(text, oldText, newText),
  commitDeletion(),

  // 文本样式
  hideTextInstance(text),
  unhideTextInstance(text),
})
```

---

## 二百五十五、Telemetry 遥测

### OpenTelemetry 集成

```typescript
// utils/telemetry/instrumentation.ts

/**
 * OpenTelemetry 仪器化
 * 支持 Traces, Metrics, Logs
 */

// OTLP/Prometheus 导出器动态导入
// 避免启动时加载所有 6 个导出器 (~1.2MB)

// 支持的协议
type ExportProtocol = 'otlp' | 'prometheus' | 'console'

// 初始化追踪
export function initTracing(config: TracingConfig): void {
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'claude-code',
      [ATTR_SERVICE_VERSION]: version,
    }),
  })

  // 选择导出器
  switch (config.protocol) {
    case 'otlp':
      // OTLP HTTP/gRPC
      provider.addSpanProcessor(new BatchSpanProcessor(
        new OTLPTraceExporter(config.endpoint)
      ))
      break
    case 'prometheus':
      // Prometheus
      // ...
    case 'console':
      // 控制台
      provider.addSpanProcessor(new BatchSpanProcessor(
        new ConsoleSpanExporter()
      ))
  }

  // 设置全局 provider
  trace.setGlobalTracerProvider(provider)
}

// 初始化指标
export function initMetrics(config: MetricsConfig): void {
  const provider = new MeterProvider({
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new PrometheusExporter(),
        exportIntervalMs: DEFAULT_METRICS_EXPORT_INTERVAL_MS,
      }),
    ],
  })
  metrics.setGlobalMeterProvider(provider)
}
```

---

## 二百五十六、Session Tracing

### 会话追踪

```typescript
// utils/telemetry/sessionTracing.ts

import { trace, context as otelContext } from '@opentelemetry/api'

// ALS 存储 SpanContext
const interactionContext = new AsyncLocalStorage<SpanContext | undefined>()
const toolContext = new AsyncLocalStorage<SpanContext | undefined>()

// 30 分钟 TTL
const SPAN_TTL_MS = 30 * 60 * 1000

type SpanContext = {
  span: Span
  startTime: number
  attributes: Record<string, string | number | boolean>
  ended?: boolean
}

// 开始交互 span
export function startInteractionSpan(
  attributes: Record<string, string | number | boolean>,
): SpanContext {
  const tracer = trace.getTracer('claude-code')
  const span = tracer.startSpan('interaction', {
    attributes: { 'interaction.id': generateUUID(), ...attributes },
  })

  const ctx: SpanContext = {
    span,
    startTime: Date.now(),
    attributes,
  }

  interactionContext.set(ctx)
  return ctx
}

// 开始工具 span
export function startToolSpan(
  toolName: string,
  inputAttributes: Record<string, string | number | boolean>,
): SpanContext {
  const tracer = trace.getTracer('claude-code')
  const span = tracer.startSpan('tool', {
    attributes: { 'tool.name': toolName, ...inputAttributes },
  })

  // 强引用防止 GC
  const spanId = generateUUID()
  strongSpans.set(spanId, ctx)

  return ctx
}
```

---

## 二百五十七、Keybindings 快捷键

### 默认快捷键定义

```typescript
// keybindings/defaultBindings.ts

/**
 * 默认快捷键绑定
 * 用户 keybindings.json 会覆盖这些
 */

// 平台特定的图像粘贴
const IMAGE_PASTE_KEY = getPlatform() === 'windows' ? 'alt+v' : 'ctrl+v'

// 平台特定模式循环
const MODE_CYCLE_KEY = SUPPORTS_TERMINAL_VT_MODE ? 'shift+tab' : 'meta+m'

export const DEFAULT_BINDINGS: KeybindingBlock[] = [
  {
    context: 'Global',
    bindings: {
      'ctrl+c': 'app:interrupt',      // 中断
      'ctrl+d': 'app:exit',           // 退出
      'ctrl+l': 'app:redraw',         // 重绘
      'ctrl+t': 'app:toggleTodos',   // 切换待办
      'ctrl+o': 'app:toggleTranscript', // 切换记录
      'ctrl+r': 'history:search',    // 历史搜索
    },
  },
  {
    context: 'Chat',
    bindings: {
      escape: 'chat:cancel',          // 取消
      'ctrl+x ctrl+k': 'chat:killAgents',  // 终止 Agent
      [MODE_CYCLE_KEY]: 'chat:cycleMode',   // 循环模式
      'meta+p': 'chat:modelPicker',  // 模型选择
      enter: 'chat:submit',          // 提交
      up: 'history:previous',        // 历史上一条
      down: 'history:next',          // 历史下一条
      'ctrl+_': 'chat:undo',         // 撤销
    },
  },
]

// 快捷键解析
export function parseShortcut(shortcut: string): KeyEvent[] {
  // 解析 "ctrl+shift+k" -> [ctrl, shift, k]
}

// 快捷键匹配
export function matchesBinding(
  event: KeyEvent,
  binding: Keybinding,
): boolean {
  return (
    event.ctrl === binding.ctrl &&
    event.shift === binding.shift &&
    event.meta === binding.meta &&
    event.key === binding.key
  )
}
```

---

## 二百五十八、Keybinding Resolver

### 快捷键解析器

```typescript
// keybindings/resolver.ts

/**
 * 快捷键解析和上下文管理
 */

export class KeybindingResolver {
  private bindings: Map<string, Keybinding[]>
  private contextStack: string[]

  // 解析按键
  resolve(event: KeyEvent): Action | null {
    const context = this.getActiveContext()

    for (const binding of this.bindings.get(context) ?? []) {
      if (matchesBinding(event, binding)) {
        return binding.action
      }
    }

    // 回退到全局上下文
    for (const binding of this.bindings.get('Global') ?? []) {
      if (matchesBinding(event, binding)) {
        return binding.action
      }
    }

    return null
  }

  // 推送上下文
  pushContext(name: string): void {
    this.contextStack.push(name)
  }

  // 弹出上下文
  popContext(): void {
    this.contextStack.pop()
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Ink** | `ink/ink.tsx` | React 终端渲染引擎 |
| **Screen** | `ink/screen.ts` | 字符/超链接/样式池 |
| **Reconciler** | `ink/reconciler.ts` | React 协调器配置 |
| **Telemetry** | `utils/telemetry/instrumentation.ts` | OpenTelemetry 初始化 |
| **SessionTracing** | `utils/telemetry/sessionTracing.ts` | 会话追踪 |
| **Keybindings** | `keybindings/defaultBindings.ts` | 默认快捷键 |
| **Resolver** | `keybindings/resolver.ts` | 快捷键解析 |