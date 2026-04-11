# Claude Code 源码深度学习笔记 (第二十九部分)

> 命令系统·任务类型·后台任务·登录流程·命令注册

---

## 一百六十五、命令系统

### 命令目录结构

```
commands/
├── login/          # 登录命令
├── logout/         # 登出命令
├── tasks/          # 任务管理
├── debug-tool-call/ # 调试命令
├── session/        # 会话管理
├── resume/         # 恢复会话
├── compact/        # 压缩会话
├── mcp/           # MCP 服务器
├── permissions/   # 权限管理
├── agent/         # Agent 管理
└── ... (80+ 更多命令)
```

### 命令类型定义

```typescript
// types/command.ts

export type LocalJSXCommandOnDone = (
  result: string,
  model: MainLoopModel,
) => void

export type LocalJSXCommandContext = {
  getAppState: () => AppState
  setAppState: (updater: (prev: AppState) => AppState) => void
  getMessages: () => Message[]
  setMessages: (messages: Message[]) => void
  onChangeAPIKey: () => void
}

export type LocalJSXCommand = (
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
) => Promise<React.ReactNode>

export type Command = {
  name: string
  description: string
  run: LocalJSXCommand
}
```

### 命令调用流程

```typescript
// commands/init.ts

export async function callCommand(
  commandName: string,
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<void> {
  const command = commands.get(commandName)
  if (!command) {
    throw new Error(`Unknown command: ${commandName}`)
  }

  const result = await command.run(onDone, context)
  if (result) {
    // 渲染 JSX 结果
    render(result)
  }
}
```

---

## 一百六十六、任务系统

### 任务类型联合

```typescript
// tasks/types.ts

export type TaskState =
  | LocalShellTaskState       // 本地 Shell
  | LocalAgentTaskState       // 本地 Agent
  | RemoteAgentTaskState      // 远程 Agent
  | InProcessTeammateTaskState // 进程内队友
  | LocalWorkflowTaskState    // 本地工作流
  | MonitorMcpTaskState       // MCP 监控
  | DreamTaskState            // 梦境任务

export type BackgroundTaskState =
  | LocalShellTaskState
  | LocalAgentTaskState
  | RemoteAgentTaskState
  | InProcessTeammateTaskState
  | LocalWorkflowTaskState
  | MonitorMcpTaskState
  | DreamTaskState

// 判断是否为后台任务
export function isBackgroundTask(task: TaskState): boolean {
  if (task.status !== 'running' && task.status !== 'pending') {
    return false
  }

  // 前台任务不显示
  if ('isBackgrounded' in task && task.isBackgrounded === false) {
    return false
  }

  return true
}
```

### Shell 任务状态

```typescript
// components/tasks/ShellProgress.ts

export type ShellProgressProps = {
  shell: LocalShellTaskState
}

export function ShellProgress({ shell }: ShellProgressProps) {
  const statusText = getStatusText(shell.status)
  const progress = getProgress(shell)

  return (
    <Text dimColor>
      {statusText} {progress}
    </Text>
  )
}

function getStatusText(status: string): string {
  switch (status) {
    case 'running': return 'running'
    case 'pending': return 'pending'
    case 'completed': return 'done'
    case 'failed': return 'failed'
    default: return status
  }
}
```

### 远程会话进度

```typescript
// components/tasks/RemoteSessionProgress.ts

export type RemoteSessionProgressProps = {
  session: RemoteAgentTaskState
}

export function RemoteSessionProgress({ session }: RemoteSessionProgressProps) {
  if (session.isRemoteReview) {
    return <Text>Reviewing</Text>
  }

  const running = session.status === 'running' || session.status === 'pending'
  const icon = running ? DIAMOND_OPEN : DIAMOND_FILLED

  return (
    <Text dimColor>
      {icon} {session.title}
    </Text>
  )
}
```

---

## 一百六十七、登录流程

### 登录命令

```typescript
// commands/login/login.tsx

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <Login onDone={async success => {
    // 通知 API Key 变化
    context.onChangeAPIKey()

    // 清除签名块 (绑定到旧 Key)
    context.setMessages(stripSignatureBlocks)

    if (success) {
      // 重置成本状态
      resetCostState()

      // 刷新远程管理设置
      void refreshRemoteManagedSettings()

      // 刷新策略限制
      void refreshPolicyLimits()

      // 清除用户缓存
      resetUserCache()

      // 刷新 GrowthBook (获取新功能开关)
      refreshGrowthBookAfterAuthChange()

      // 清除旧的可信设备令牌
      clearTrustedDeviceToken()

      // 注册为可信设备
      void enrollTrustedDevice()

      // 重置权限绕过检查
      resetBypassPermissionsCheck()

      // 触发重新获取认证相关数据
      context.setAppState(prev => ({
        ...prev,
        authVersion: prev.authVersion + 1,
      }))
    }

    onDone(success ? 'Login successful' : 'Login interrupted')
  }} />
}
```

### OAuth 流程

```typescript
// components/ConsoleOAuthFlow.tsx

export function ConsoleOAuthFlow({ onSuccess }) {
  const [step, setStep] = useState<'init' | 'waiting' | 'success'>('init')

  const handleStartOAuth = async () => {
    setStep('waiting')

    // 打开 OAuth 窗口
    const authUrl = await getOAuthAuthorizationUrl()

    openBrowser(authUrl)

    // 等待回调
    const result = await waitForOAuthCallback()

    if (result.success) {
      setStep('success')
      onSuccess()
    }
  }

  return (
    <Box>
      {step === 'init' && (
        <Button onClick={handleStartOAuth}>
          Sign in with claude.ai
        </Button>
      )}
      {step === 'waiting' && (
        <Text>Waiting for authentication...</Text>
      )}
    </Box>
  )
}
```

---

## 一百六十八、后台任务对话框

### 任务列表

```typescript
// components/tasks/BackgroundTasksDialog.tsx

export function BackgroundTasksDialog({ toolUseContext, onDone }) {
  const tasks = useBackgroundTasks()

  return (
    <Dialog title="Background Tasks">
      {tasks.length === 0 && (
        <Text dimColor>No active tasks</Text>
      )}

      {tasks.map(task => (
        <BackgroundTask
          key={task.id}
          task={task}
          maxActivityWidth={40}
        />
      ))}

      <Box marginTop={1}>
        <Text dimColor>
          {tasks.length} active task{tasks.length !== 1 ? 's' : ''}
        </Text>
      </Box>
    </Dialog>
  )
}
```

### 单个任务显示

```typescript
// components/tasks/BackgroundTask.tsx

export function BackgroundTask({ task, maxActivityWidth = 40 }) {
  switch (task.type) {
    case 'local_bash':
      const description = task.kind === 'monitor'
        ? task.description
        : truncate(task.command, maxActivityWidth, true)

      return (
        <Text>
          {description} <ShellProgress shell={task} />
        </Text>
      )

    case 'remote_agent':
      if (task.isRemoteReview) {
        return (
          <Text>
            <RemoteSessionProgress session={task} />
          </Text>
        )
      }

      const running = task.status === 'running' || task.status === 'pending'
      const icon = running ? DIAMOND_OPEN : DIAMOND_FILLED

      return (
        <Text dimColor={running}>
          {icon} {truncate(task.title, maxActivityWidth)}
        </Text>
      )

    default:
      return <Text>{task.type}</Text>
  }
}
```

---

## 一百六十九、任务状态工具

### 状态文本

```typescript
// components/tasks/taskStatusUtils.ts

export function describeTeammateActivity(task: TeammateTaskState): string {
  switch (task.type) {
    case 'in_process_teammate':
      return task.activity
    case 'local_agent':
      return task.description
    case 'remote_agent':
      return task.title
    default:
      return 'Working...'
  }
}

export function getTaskProgress(task: TaskState): number {
  switch (task.type) {
    case 'local_shell':
      return task.progress ?? 0
    case 'remote_agent':
      return task.progress ?? 0
    default:
      return 0
  }
}
```

---

## 一百七十、命令注册

### 全局命令注册表

```typescript
// commands.ts

type CommandRegistry = Map<string, Command>

const commands: CommandRegistry = new Map()

export function registerCommand(command: Command): void {
  commands.set(command.name, command)
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name)
}

export function listCommands(): Command[] {
  return Array.from(commands.values())
}
```

### 命令自动注册

```typescript
// commands/index.ts (自动导入)

import { registerCommand } from './commands'

// 动态导入所有命令
const commandModules = import.meta.glob('./**/index.ts')

for (const [path, loader] of Object.entries(commandModules)) {
  const module = await loader()
  if (module.default) {
    registerCommand(module.default)
  }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **命令注册** | `commands.ts` | 命令注册表 |
| **命令调用** | `commands/init.ts` | 命令执行流程 |
| **任务类型** | `tasks/types.ts` | 任务状态联合 |
| **Shell 任务** | `tasks/LocalShellTask/` | 本地 Shell |
| **远程任务** | `tasks/RemoteAgentTask/` | 远程 Agent |
| **登录** | `commands/login/` | OAuth 登录 |
| **后台任务 UI** | `components/tasks/` | 任务渲染 |