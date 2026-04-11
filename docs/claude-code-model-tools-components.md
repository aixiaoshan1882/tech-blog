# Claude Code 源码深度学习笔记 (第十六部分)

> 模型系统 · 工具扩展 · 组件生态 · 实用工具

---

## 八十五、模型系统

### 模型选择优先级

```typescript
// utils/model/model.ts

export function getMainLoopModel(): ModelName {
  // 优先级顺序:
  // 1. 会话中覆盖 (/model 命令)
  // 2. 启动时覆盖 (--model 标志)
  // 3. 环境变量 (ANTHROPIC_MODEL)
  // 4. 设置文件 (settings.json)
  // 5. 内置默认值

  const model = getUserSpecifiedModelSetting()
  if (model !== undefined && model !== null) {
    return parseUserSpecifiedModel(model)
  }
  return getDefaultMainLoopModel()
}

// 获取小而快的模型 (用于简单任务)
export function getSmallFastModel(): ModelName {
  return process.env.ANTHROPIC_SMALL_FAST_MODEL || getDefaultHaikuModel()
}
```

### 模型别名解析

```typescript
// utils/model/aliases.ts

export type ModelAlias = 'sonnet' | 'opus' | 'haiku' | 'lightning'

export function resolveModelAlias(alias: ModelAlias): ModelName {
  switch (alias) {
    case 'sonnet':
      return 'claude-sonnet-4-20250514'
    case 'opus':
      return 'claude-opus-4-20250514'
    case 'haiku':
      return 'claude-haiku-4-20250730'
    case 'lightning':
      return 'claude-sonnet-4-latest'
  }
}

export function isModelAlias(value: string): value is ModelAlias {
  return ['sonnet', 'opus', 'haiku', 'lightning'].includes(value)
}
```

### 多后端提供商

```typescript
// utils/model/providers.ts

export type APIProvider = 'anthropic' | 'aws' | 'azure' | 'vertex'

export function getAPIProvider(): APIProvider {
  // 检测环境变量判断提供商
  if (process.env.VERTEX_AI_PROJECT_ID) {
    return 'vertex'
  }
  if (process.env.AWS_REGION || isAWSEnvironment()) {
    return 'aws'
  }
  if (process.env.ANTHROPIC_FOUNDRY_RESOURCE) {
    return 'azure'
  }
  return 'anthropic'
}

// 验证是否使用第一方 Anthropic URL
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseURL = process.env.ANTHROPIC_BASE_URL
  return !baseURL || baseURL.includes('anthropic.com')
}
```

---

## 八十六、任务创建工具

### TaskCreateTool

```typescript
// tools/TaskCreateTool/TaskCreateTool.ts

export const TaskCreateTool = buildTool({
  name: 'TaskCreate',
  searchHint: 'create a task in the task list',

  inputSchema: z.strictObject({
    subject: z.string().describe('任务标题'),
    description: z.string().describe('任务描述'),
    activeForm: z.string().optional().describe('进行时显示 (如 "Running tests")'),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),

  outputSchema: z.object({
    task: z.object({
      id: z.string(),
      subject: z.string(),
    }),
  }),

  async call({ subject, description, activeForm, metadata }, context) {
    // 1. 创建任务
    const task = await createTask({
      subject,
      description,
      activeForm,
      metadata,
    })

    // 2. 执行钩子
    await executeTaskCreatedHooks(task)

    return {
      task: {
        id: task.id,
        subject: task.subject,
      },
    }
  },
})
```

### 任务创建钩子

```typescript
// utils/hooks.ts

export async function executeTaskCreatedHooks(
  task: TaskState,
): Promise<void> {
  const hooks = getRegisteredHooks('task_created')

  for (const hook of hooks) {
    await hook.callback({
      task: {
        id: task.id,
        subject: task.subject,
        description: task.description,
      },
    })
  }
}
```

---

## 八十七、团队创建工具

### TeamCreateTool

```typescript
// tools/TeamCreateTool/TeamCreateTool.ts

export const TeamCreateTool = buildTool({
  name: 'TeamCreate',
  inputSchema: z.strictObject({
    team_name: z.string().describe('团队名称'),
    description: z.string().optional().describe('团队描述'),
    agent_type: z.string().optional().describe('Agent 类型'),
  }),

  async call({ team_name, description, agent_type }, context) {
    // 1. 验证团队名称
    const sanitizedName = sanitizeName(team_name)

    // 2. 创建团队文件
    const teamFile: TeamFile = {
      name: sanitizedName,
      description,
      createdAt: Date.now(),
      leadAgentId: generateAgentId(),
      members: [],
    }

    // 3. 初始化团队目录
    const teamDir = join(getTeamsDir(), sanitizedName)
    await mkdir(teamDir, { recursive: true })

    // 4. 保存团队文件
    const teamFilePath = join(teamDir, 'team.json')
    await writeFile(teamFilePath, jsonStringify(teamFile))

    // 5. 启动团队lead
    await spawnTeamLead(sanitizedName, agent_type)

    return {
      team_name: sanitizedName,
      team_file_path: teamFilePath,
      lead_agent_id: teamFile.leadAgentId,
    }
  },
})
```

---

## 八十八、组件生态 (146个组件)

### 核心组件

```
components/
├── Message.tsx              # 消息组件
├── MessageRow.tsx           # 消息行
├── MessageModel.tsx         # 消息模型
├── Messages.tsx             # 消息列表
├── VirtualMessageList.tsx  # 虚拟列表
├── PromptInput/            # 输入提示
│   ├── PromptInput.tsx
│   └── PromptInputQueuedCommands.tsx
├── TaskListV2.tsx          # 任务列表
├── StatusLine.tsx          # 状态栏
├── Spinner/                # 加载动画
├── permissions/            # 权限对话框
├── mcp/                    # MCP 对话框
├── design-system/         # 设计系统
│   ├── ThemedBox.tsx
│   ├── ThemedText.tsx
│   └── ThemeProvider.tsx
├── diff/                   # Diff 视图
├── HighlightedCode/       # 代码高亮
├── Markdown/              # Markdown 渲染
├── agents/                 # Agent 视图
├── teams/                 # 团队视图
└── memory/                # 记忆组件
```

### 虚拟消息列表

```typescript
// components/VirtualMessageList.tsx

export function VirtualMessageList({
  messages,
  estimatedItemSize = 100,
  overscan = 5,
}: {
  messages: Message[]
  estimatedItemSize?: number
  overscan?: number
}): React.ReactElement {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  // 计算可见范围
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0,
      Math.floor(scrollTop / estimatedItemSize) - overscan
    )
    const endIndex = Math.min(
      messages.length,
      Math.ceil((scrollTop + viewportHeight) / estimatedItemSize) + overscan
    )
    return { startIndex, endIndex }
  }, [scrollTop, viewportHeight])

  // 渲染可见消息
  const visibleMessages = useMemo(() =>
    messages.slice(visibleRange.startIndex, visibleRange.endIndex),
    [visibleRange]
  )

  return (
    <Box>
      {/* 滚动容器 */}
      <ScrollContainer onScroll={setScrollTop}>
        {/* 占位高度 */}
        <Box height={messages.length * estimatedItemSize}>
          {/* 绝对定位的可见消息 */}
          <Box position="absolute" top={visibleRange.startIndex * estimatedItemSize}>
            {visibleMessages.map(msg => (
              <MessageRow key={msg.id} message={msg} />
            ))}
          </Box>
        </Box>
      </ScrollContainer>
    </Box>
  )
}
```

### 设计系统

```typescript
// components/design-system/ThemeProvider.tsx

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = useThemeSetting()

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

// 主题类型
export type Theme = {
  colors: {
    primary: string
    secondary: string
    background: string
    foreground: string
    error: string
    warning: string
    success: string
    muted: string
  }
  fonts: {
    regular: string
    bold: string
    italic: string
    mono: string
  }
}
```

---

## 八十九、实用工具

### 环形缓冲区

```typescript
// utils/CircularBuffer.ts

export class CircularBuffer<T> {
  private buffer: T[]
  private head = 0
  private size = 0

  constructor(private capacity: number) {
    this.buffer = new Array(capacity)
  }

  add(item: T): void {
    this.buffer[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) {
      this.size++
    }
  }

  getRecent(count: number): T[] {
    // 返回最近 N 个元素
    const start = this.size < this.capacity ? 0 : this.head
    const available = Math.min(count, this.size)
    const result: T[] = []

    for (let i = 0; i < available; i++) {
      const index = (start + this.size - available + i) % this.capacity
      result.push(this.buffer[index]!)
    }

    return result
  }

  toArray(): T[] {
    // 从旧到新返回所有元素
    if (this.size === 0) return []

    const result: T[] = []
    const start = this.size < this.capacity ? 0 : this.head

    for (let i = 0; i < this.size; i++) {
      const index = (start + i) % this.capacity
      result.push(this.buffer[index]!)
    }

    return result
  }
}
```

### Promise.withResolvers

```typescript
// utils/withResolvers.ts

// ES2024 polyfill for Node 18+
export function withResolvers<T>(): PromiseWithResolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

// 使用示例
async function example(): Promise<string> {
  const { promise, resolve, reject } = withResolvers<string>()

  setTimeout(() => resolve('done'), 1000)

  return promise
}
```

### 单词 Slug 生成

```typescript
// utils/words.ts

const ADJECTIVES = [
  'abundant', 'ancient', 'bright', 'calm', 'cheerful',
  'clever', 'cozy', 'curious', 'dapper', 'dazzling',
  'delightful', 'eager', 'elegant', 'enchanted', 'fancy',
  // ... 100+ 形容词
]

const NOUNS = [
  'acorn', 'anchor', 'apple', 'arrow', 'basket',
  'beacon', 'butterfly', 'candle', 'castle', 'cloud',
  // ... 100+ 名词
]

export function generateWordSlug(): string {
  const adj = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(random() * NOUNS.length)]
  return `${adj}-${noun}`
}

// 示例: happy-dog, quick-fox, brave-lion, magical-unicorn
```

### 附件处理

```typescript
// utils/attachments.ts

export interface Attachment {
  type: 'image' | 'file' | 'video' | 'audio'
  path?: string
  url?: string
  content?: string
  mimeType: string
  size?: number
  name?: string
}

export async function processAttachments(
  inputs: unknown[],
): Promise<Attachment[]> {
  const attachments: Attachment[] = []

  for (const input of inputs) {
    if (isImageInput(input)) {
      attachments.push(await processImage(input))
    } else if (isFileInput(input)) {
      attachments.push(await processFile(input))
    }
  }

  return attachments
}

export function isImageInput(input: unknown): boolean {
  // 检测图片输入
}
```

---

## 九十、重要设计模式

### 1. 工具构建器

```typescript
// Tool.ts

export function buildTool<T extends ToolImpl>(impl: T): T {
  return {
    ...impl,
    // 添加默认实现
    isConcurrencySafe: impl.isConcurrencySafe ?? (() => true),
    isReadOnly: impl.isReadOnly ?? (() => false),
    shouldDefer: impl.shouldDefer ?? false,
    maxResultSizeChars: impl.maxResultSizeChars ?? 100_000,
  }
}
```

### 2. 懒加载 Schema

```typescript
// utils/lazySchema.ts

export function lazySchema<T extends z.ZodType>(
  factory: () => T,
): () => T {
  let schema: T | undefined

  return () => {
    if (!schema) {
      schema = factory()
    }
    return schema
  }
}

// 使用: 避免循环依赖
const inputSchema = lazySchema(() =>
  z.strictObject({
    name: z.string(),
    // ... 引用其他可能尚未加载的类型
  })
)
```

### 3. 虚拟列表优化

```typescript
// 虚拟列表核心算法
function computeVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  estimatedItemSize: number,
  overscan: number,
): { startIndex: number; endIndex: number } {
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / estimatedItemSize) - overscan,
  )

  const endIndex = Math.min(
    itemCount,
    Math.ceil((scrollTop + viewportHeight) / estimatedItemSize) + overscan,
  )

  return { startIndex, endIndex }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **模型选择** | `utils/model/model.ts` | 模型优先级 |
| **别名解析** | `utils/model/aliases.ts` | sonnet/opus/haiku |
| **提供商** | `utils/model/providers.ts` | AWS/Azure/Vertex |
| **任务创建** | `tools/TaskCreateTool/` | 任务工具 |
| **团队创建** | `tools/TeamCreateTool/` | 团队工具 |
| **虚拟列表** | `components/VirtualMessageList.tsx` | 列表优化 |
| **设计系统** | `components/design-system/` | 主题/颜色 |
| **环形缓冲** | `utils/CircularBuffer.ts` | 固定大小缓冲 |
| **Slug生成** | `utils/words.ts` | 随机单词 |
| **附件** | `utils/attachments.ts` | 附件处理 |