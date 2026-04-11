# Claude Code 源码深度学习笔记 (第十二部分)

> Ink 终端 UI · React Hooks · REPL 屏幕

---

## 六十三、Ink 终端 UI 框架

### Ink 概述

Claude Code 使用 **Ink** (React for CLI) 来构建终端 UI，而不是传统的 Web React。

```typescript
// ink.ts - Ink 入口点
import inkRender from './ink/root.js'

export async function render(
  node: ReactNode,
  options?: RenderOptions,
): Promise<Instance> {
  return inkRender(node, options)
}

// 主题包装
function withTheme(node: ReactNode): ReactNode {
  return createElement(ThemeProvider, null, node)
}
```

### Ink 组件

```typescript
// ink.ts 导出
export { Box } from './components/design-system/ThemedBox.js'
export { Text } from './components/design-system/ThemedText.js'
export { Button } from './components/Button.js'
export { Link } from './components/Link.js'
export { Spacer } from './components/Spacer.js'
export { Ansi } from './Ansi.js'
export { RawAnsi } from './components/RawAnsi.js'
```

### 核心 Hooks

```typescript
// 输入处理
export { useInput } from './hooks/use-input.js'

// 终端焦点
export { useTerminalFocus } from './hooks/use-terminal-focus.js'

// 终端大小
export { useTerminalSize } from './hooks/use-terminal-size.js'

// 终端视口
export { useTerminalViewport } from './hooks/use-terminal-viewport.js'

// 主题
export { useTheme, useThemeSetting } from './components/design-system/ThemeProvider.js'
```

---

## 六十四、REPL 主屏幕

### REPL 结构

```typescript
// screens/REPL.tsx

export function REPL(): React.ReactNode {
  // 核心组件
  const [
    messages,
    setMessages,
    inputValue,
    setInputValue,
  ] = useState<Message[]>([])

  return (
    <Box flexDirection="column">
      {/* 消息列表 */}
      <MessageList messages={messages} />

      {/* 提示输入 */}
      <PromptInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
      />

      {/* 任务列表 */}
      <TaskListV2 tasks={tasks} />

      {/* 权限请求 */}
      <PermissionRequest
        permission={currentPermission}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </Box>
  )
}
```

### 权限处理

```typescript
// hooks/useCanUseTool.tsx

export type CanUseToolFn = (
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
  forceDecision?: PermissionDecision,
) => Promise<PermissionDecision>

function useCanUseTool() {
  const decisionPromise = hasPermissionsToUseTool(
    tool,
    input,
    toolUseContext,
    assistantMessage,
    toolUseID,
  )

  return decisionPromise.then(result => {
    switch (result.behavior) {
      case 'allow':
        // 允许执行
        return buildAllow(result.updatedInput ?? input)

      case 'deny':
        // 拒绝
        return buildDeny(result.reason)

      case 'ask':
        // 显示权限对话框
        return showPermissionDialog(tool, description)
    }
  })
}
```

---

## 六十五、核心 Hooks

### 工具合并 (useMergedTools)

```typescript
// hooks/useMergedTools.ts

export function useMergedTools(): Tools {
  const baseTools = useBaseTools()
  const mcpTools = useMCPTools()
  const pluginTools = usePluginTools()

  // 合并并去重
  return useMemo(() => {
    const merged = [...baseTools]

    for (const tool of mcpTools) {
      if (!merged.find(t => t.name === tool.name)) {
        merged.push(tool)
      }
    }

    for (const tool of pluginTools) {
      if (!merged.find(t => t.name === tool.name)) {
        merged.push(tool)
      }
    }

    return merged
  }, [baseTools, mcpTools, pluginTools])
}
```

### 命令合并 (useMergedCommands)

```typescript
// hooks/useMergedCommands.ts

export function useMergedCommands(): Command[] {
  const builtinCommands = useBuiltinCommands()
  const pluginCommands = usePluginCommands()

  return useMemo(() => {
    return [...builtinCommands, ...pluginCommands]
  }, [builtinCommands, pluginCommands])
}
```

### 设置变更 (useSettingsChange)

```typescript
// hooks/useSettingsChange.ts

export function useSettingsChange(
  key: string,
  callback: (value: unknown) => void,
): void {
  useEffect(() => {
    const unsubscribe = settings.subscribe(key, callback)
    return () => unsubscribe()
  }, [key, callback])
}
```

### 任务列表 (useTasksV2)

```typescript
// hooks/useTasksV2.ts

export function useTasksV2(): {
  tasks: TaskState[]
  createTask: (task: TaskConfig) => string
  updateTask: (id: string, updates: Partial<TaskState>) => void
  deleteTask: (id: string) => void
} {
  const [tasks, setTasks] = useState<TaskState[]>([])

  const createTask = useCallback((config: TaskConfig): string => {
    const id = generateTaskId()
    setTasks(prev => [...prev, { id, ...config, status: 'pending' }])
    return id
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<TaskState>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  return { tasks, createTask, updateTask, deleteTask }
}
```

---

## 六十六、输入处理

### 快捷键处理

```typescript
// hooks/useGlobalKeybindings.tsx

export function GlobalKeybindingHandlers(): React.ReactNode {
  useInput((input, key) => {
    // Ctrl+C - 中断
    if (key.ctrl && key.name === 'c') {
      handleInterrupt()
    }

    // Ctrl+Z - 后台
    if (key.ctrl && key.name === 'z') {
      handleBackground()
    }

    // Tab - 自动补全
    if (key.name === 'tab') {
      handleAutocomplete()
    }

    // 方向键 - 历史
    if (key.name === 'up') {
      navigateHistory('up')
    }
    if (key.name === 'down') {
      navigateHistory('down')
    }
  })

  return null
}
```

### 剪贴板处理

```typescript
// hooks/useClipboardImageHint.ts

export function useClipboardImageHint(): {
  hasImage: boolean
  imageData: string | null
} {
  const [hasImage, setHasImage] = useState(false)
  const [imageData, setImageData] = useState<string | null>(null)

  useEffect(() => {
    const checkClipboard = async () => {
      const text = await readClipboard()
      if (text?.startsWith('data:image/')) {
        setHasImage(true)
        setImageData(text)
      }
    }

    // 定期检查剪贴板
    const interval = setInterval(checkClipboard, 1000)
    return () => clearInterval(interval)
  }, [])

  return { hasImage, imageData }
}
```

---

## 六十七、后台任务

### 后台任务导航

```typescript
// hooks/useBackgroundTaskNavigation.ts

export function useBackgroundTaskNavigation(): {
  navigateToTask: (taskId: string) => void
  returnToMain: () => void
} {
  const [currentTask, setCurrentTask] = useState<string | null>(null)

  const navigateToTask = useCallback((taskId: string) => {
    setCurrentTask(taskId)
    // 切换到任务视图
  }, [])

  const returnToMain = useCallback(() => {
    setCurrentTask(null)
    // 切换回主视图
  }, [])

  return { navigateToTask, returnToMain }
}
```

### 后台任务监视

```typescript
// hooks/useTaskListWatcher.ts

export function useTaskListWatcher(
  tasks: TaskState[],
  onUpdate: (task: TaskState) => void,
): void {
  useEffect(() => {
    for (const task of tasks) {
      if (task.status === 'running') {
        // 监视运行中的任务
        watchTask(task.id, onUpdate)
      }
    }
  }, [tasks, onUpdate])
}
```

---

## 六十八、重要设计模式

### 1. React Hooks 封装

```typescript
// 自定义 Hook 模式
export function useSubscription<T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
): T {
  const [value, setValue] = useState(() => getSnapshot())

  useEffect(() => {
    const callback = () => {
      const nextValue = getSnapshot()
      setValue(nextValue)
    }

    const unsubscribe = subscribe(callback)
    return unsubscribe
  }, [subscribe, getSnapshot])

  return value
}
```

### 2. 状态提升

```typescript
// 权限状态在顶层管理
function REPL(): React.ReactNode {
  const [permissionQueue, setPermissionQueue] = useState<Permission[]>([])

  return (
    <PermissionProvider queue={permissionQueue} setQueue={setPermissionQueue}>
      <ToolExecutor />
      <PermissionDialog />
    </PermissionProvider>
  )
}
```

### 3. 副作用清理

```typescript
// useEffect 清理
function useTaskWatch(taskId: string): TaskState | null {
  const [state, setState] = useState<TaskState | null>(null)

  useEffect(() => {
    const unsubscribe = watchTask(taskId, setState)
    return () => unsubscribe()  // 清理订阅
  }, [taskId])

  return state
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Ink** | `ink.ts` | Ink 框架入口 |
| **Ink 组件** | `components/design-system/` | 终端 UI 组件 |
| **REPL** | `screens/REPL.tsx` | 主交互界面 |
| **权限** | `hooks/useCanUseTool.tsx` | 权限检查 |
| **工具合并** | `hooks/useMergedTools.ts` | 工具合并 |
| **命令合并** | `hooks/useMergedCommands.ts` | 命令合并 |
| **任务** | `hooks/useTasksV2.ts` | 任务管理 |
| **快捷键** | `hooks/useGlobalKeybindings.tsx` | 全局快捷键 |
| **后台任务** | `hooks/useBackgroundTaskNavigation.ts` | 任务导航 |