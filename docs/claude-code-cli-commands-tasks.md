# Claude Code 源码深度学习笔记 (第十四部分)

> CLI 入口 · 启动流程 · 命令系统 · 任务系统

---

## 七十四、CLI 入口点

### 主函数结构

```typescript
// entrypoints/cli.tsx

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // --version 快速路径 (零模块加载)
  if (args[0] === '--version') {
    console.log(`${MACRO.VERSION} (Claude Code)`)
    return
  }

  // 加载启动分析器
  const { profileCheckpoint } = await import('../utils/startupProfiler.js')
  profileCheckpoint('cli_entry')

  // --dump-system-prompt (导出提示词)
  if (feature('DUMP_SYSTEM_PROMPT') && args[0] === '--dump-system-prompt') {
    const prompt = await getSystemPrompt([], model)
    console.log(prompt.join('\n'))
    return
  }

  // 各种子命令路由...
  if (args[0] === 'remote-control') { /* Bridge 模式 */ }
  if (args[0] === 'daemon') { /* 守护进程 */ }
  if (args[0] === 'ps' || args[0] === 'logs') { /* 会话管理 */ }
  if (args[0] === 'new' || args[0] === 'list') { /* 模板 */ }
  if (args[0] === 'environment-runner') { /* BYOC runner */ }
  if (args[0] === 'self-hosted-runner') { /* 自托管 runner */ }
}
```

### 快速路径设计

```
CLI 启动性能优化:
  ├── --version: 零模块加载
  ├── --dump-system-prompt: 仅加载配置+提示模块
  ├── remote-control: Bridge 专用路径
  ├── daemon: 守护进程专用路径
  ├── ps/logs/attach/kill: 会话管理
  └── new/list/reply: 模板命令

每个子命令都是懒加载，按需导入
```

---

## 七十五、初始化流程

### init() 函数

```typescript
// entrypoints/init.ts

export const init = memoize(async (): Promise<void> => {
  // 1. 启用配置系统
  enableConfigs()

  // 2. 应用安全的环境变量
  applySafeConfigEnvironmentVariables()

  // 3. 配置 TLS 证书
  applyExtraCACertsFromConfig()

  // 4. 设置优雅关闭
  setupGracefulShutdown()

  // 5. 初始化遥测 (延迟加载)
  const [fp, gb] = await Promise.all([
    import('../services/analytics/firstPartyEventLogger.js'),
    import('../services/analytics/growthbook.js'),
  ])
  fp.initialize1PEventLogging()

  // 6. 检测 Git 仓库
  const repo = detectCurrentRepository()

  // 7. 初始化 LSP 服务器
  const lspManager = getLspServerManager()

  // 8. 预连接 API
  preconnectAnthropicApi()

  // 9. 初始化远程托管设置
  initializeRemoteManagedSettingsLoadingPromise()

  // 10. 初始化策略限制
  initializePolicyLimitsLoadingPromise()
})
```

### 启动检查点

```typescript
// utils/startupProfiler.ts

export function profileCheckpoint(name: string): void {
  const now = Date.now()
  const checkpoints.push({ name, timestamp: now })

  // 记录到诊断日志
  logForDiagnosticsNoPII('info', 'startup_checkpoint', {
    checkpoint: name,
    duration_ms: now - startTime,
  })
}

// 检查点序列:
// cli_entry → init_configs_enabled → init_safe_env_vars_applied
// → init_after_graceful_shutdown → init_telemetry → ...
```

---

## 七十六、全局状态管理

### State 类型

```typescript
// bootstrap/state.ts

type State = {
  // 路径
  originalCwd: string
  projectRoot: string
  cwd: string

  // 成本追踪
  totalCostUSD: number
  totalAPIDuration: number
  totalToolDuration: number

  // Turn 统计
  turnHookDurationMs: number
  turnToolDurationMs: number
  turnClassifierDurationMs: number
  turnToolCount: number
  turnHookCount: number

  // 模型
  modelUsage: { [modelName: string]: ModelUsage }
  mainLoopModelOverride: ModelSetting | undefined

  // 会话
  sessionId: SessionId
  startTime: number
  lastInteractionTime: number

  // 遥测
  meter: Meter | null
  sessionCounter: AttributedCounter | null

  // SDK Hooks
  registeredHooks: Map<string, RegisteredHookMatcher>
}

// 使用 Signal 模式
export function createSignal<T>(initialValue: T): {
  get: () => T
  set: (value: T) => void
  update: (fn: (v: T) => T) => void
}
```

### 状态更新

```typescript
// 全局状态更新函数
export function updateTotalCost(usd: number): void {
  totalCostUSD += usd
}

export function recordTurnStats(stats: TurnStats): void {
  setTurnInputTokens(stats.inputTokens)
  setTurnOutputTokens(stats.outputTokens)
  setTurnToolCount(stats.toolCalls)
  setTurnToolDuration(stats.toolDuration)
}

export function updateLastInteractionTime(): void {
  lastInteractionTime = Date.now()
}
```

---

## 七十七、命令系统

### 命令定义

```typescript
// commands.ts

export type Command = {
  name: string
  description: string
  execute: (args: string[]) => Promise<void>
  shortcuts?: string[]
  category?: 'git' | 'file' | 'session' | 'config' | 'help'
}

// 示例命令
export const commands: Command[] = [
  {
    name: 'branch',
    description: 'List or switch branches',
    execute: async (args) => {
      const action = args[0]
      if (action === 'list') {
        await listBranches()
      } else if (action === 'switch') {
        await switchBranch(args[1])
      }
    },
    shortcuts: ['br', 'co'],
    category: 'git',
  },
]
```

### 命令处理器

```typescript
// 命令路由
export async function handleCommand(
  input: string,
): Promise<CommandResult> {
  const [name, ...args] = input.split(' ')

  const command = commands.find(
    c => c.name === name || c.shortcuts?.includes(name),
  )

  if (!command) {
    throw new Error(`Unknown command: ${name}`)
  }

  return command.execute(args)
}
```

### 内置命令 (103个)

```
Git 命令:
  branch, commit, diff, merge, pull, push, rebase, tag

文件命令:
  edit, read, write, rm, mv, cp, mkdir, ls, find, grep

会话命令:
  attach, detach, kill, logs, ps, resume, clear, reset

配置命令:
  config get, config set, config list, model, theme

插件命令:
  plugin install, plugin list, plugin remove, skills

MCP 命令:
  mcp list, mcp add, mcp remove, mcp start, mcp stop

调试命令:
  debug, heapdump, perf-issue, cost, stats

其他:
  help, exit, clear, env, doctor, rate-limit-options
```

---

## 七十八、任务系统

### 任务类型

```typescript
// tasks/types.ts

export type TaskState =
  | LocalShellTaskState       // 本地 Shell
  | LocalAgentTaskState       // 本地 Agent
  | RemoteAgentTaskState      // 远程 Agent
  | InProcessTeammateTaskState // 进程内队友
  | LocalWorkflowTaskState    // 本地工作流
  | MonitorMcpTaskState       // MCP 监控
  | DreamTaskState            // 梦想任务

// 判断是否为后台任务
export function isBackgroundTask(task: TaskState): boolean {
  if (task.status !== 'running' && task.status !== 'pending') {
    return false
  }
  // 前台任务 (isBackgrounded === false) 不是后台任务
  if ('isBackgrounded' in task && task.isBackgrounded === false) {
    return false
  }
  return true
}
```

### 任务状态机

```typescript
// Task 生命周期

interface TaskState {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  createdAt: number
  startedAt?: number
  completedAt?: number
  result?: TaskResult
  error?: Error
  isBackgrounded: boolean
}

// 状态转换
function createTask(config: TaskConfig): TaskState {
  return {
    id: generateTaskId(),
    status: 'pending',
    createdAt: Date.now(),
    isBackgrounded: config.background ?? false,
  }
}

async function runTask(task: TaskState): Promise<void> {
  task.status = 'running'
  task.startedAt = Date.now()

  try {
    task.result = await executeTask(task)
    task.status = 'completed'
  } catch (error) {
    task.error = error
    task.status = 'failed'
  } finally {
    task.completedAt = Date.now()
  }
}
```

### 任务目录

```
tasks/
├── DreamTask/           # 创意任务
├── InProcessTeammateTask/ # 进程内队友
├── LocalAgentTask/      # 本地 Agent
├── LocalMainSessionTask.ts # 主会话
├── LocalShellTask/      # Shell 任务
├── RemoteAgentTask/     # 远程 Agent
├── types.ts             # 类型定义
└── stopTask.ts          # 停止任务
```

---

## 七十九、重要设计模式

### 1. 延迟初始化

```typescript
// 使用 memoize 缓存初始化
export const init = memoize(async (): Promise<void> => {
  // 初始化逻辑 (只执行一次)
})

// 动态导入
if (args[0] === '--special-flag') {
  const { specialHandler } = await import('./specialHandler.js')
  return specialHandler(args)
}
```

### 2. 快速路径路由

```typescript
// 按参数快速分流
if (args.length === 1 && args[0] === '--version') {
  return handleVersion()
}

if (args[0] === 'daemon') {
  return handleDaemon(args.slice(1))
}

if (args[0] === 'ps' || args[0] === 'logs') {
  return handleSession(args)
}

// 默认: 完整初始化
return handleInteractive(args)
```

### 3. 命令注册表

```typescript
// 集中式命令注册
const commandRegistry = new Map<string, Command>()

export function registerCommand(command: Command): void {
  commandRegistry.set(command.name, command)
  for (const shortcut of command.shortcuts ?? []) {
    commandRegistry.set(shortcut, command)
  }
}

export function getCommand(name: string): Command | undefined {
  return commandRegistry.get(name)
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **CLI 入口** | `entrypoints/cli.tsx` | 命令路由 |
| **初始化** | `entrypoints/init.ts` | 启动初始化 |
| **状态** | `bootstrap/state.ts` | 全局状态 |
| **命令** | `commands.ts` | 命令定义 |
| **任务类型** | `tasks/types.ts` | 任务类型 |
| **Task** | `tasks/LocalAgentTask/` | 本地 Agent |
| **Task** | `tasks/RemoteAgentTask/` | 远程 Agent |
| **Task** | `tasks/InProcessTeammateTask/` | 队友任务 |