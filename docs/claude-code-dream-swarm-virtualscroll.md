# Claude Code 源码深度学习笔记 (第三十六部分 - 续)

> DreamTask·Swarm·TeamMemory·VirtualScroll·AutoCompact·Model Strings

---

## 二百二十一、DreamTask 梦幻任务

### 自动记忆整合

```typescript
// tasks/DreamTask/DreamTask.ts

// 自动记忆整合子 agent的后台任务
// 使原本不可见的 fork agent 在 footer pill 和 Shift+Down 对话框中可见

export type DreamPhase = 'starting' | 'updating'

export type DreamTaskState = TaskStateBase & {
  type: 'dream'
  phase: DreamPhase
  sessionsReviewing: number
  filesTouched: string[]  // 观察到的文件
  turns: DreamTurn[]      // 助手的回复，工具调用被折叠
  abortController?: AbortController
  priorMtime: number
}

// 注册梦幻任务
export function registerDreamTask(
  setAppState: SetAppState,
  opts: {
    sessionsReviewing: number
    priorMtime: number
    abortController: AbortController
  },
): string {
  const id = generateTaskId('dream')
  const task: DreamTaskState = {
    ...createTaskStateBase(id, 'dream', 'dreaming'),
    type: 'dream',
    status: 'running',
    phase: 'starting',
    sessionsReviewing: opts.sessionsReviewing,
    filesTouched: [],
    turns: [],
    abortController: opts.abortController,
    priorMtime: opts.priorMtime,
  }
  registerTask(task, setAppState)
  return id
}
```

---

## 二百二十二、AutoDream 服务

### 自动记忆整合服务

```typescript
// services/autoDream/autoDream.ts

/**
 * 后台记忆整合。当时间门通过且足够多的会话累积时，
 * 将 /dream 提示作为 fork 子 agent 触发。
 *
 * 门顺序 (最便宜到最贵):
 * 1. 时间: hours since lastConsolidatedAt >= minHours
 * 2. 会话: 超过 lastConsolidatedAt 的 transcript 数量 >= minSessions
 * 3. 锁: 没有其他进程正在整合
 */

type AutoDreamConfig = {
  minHours: number      // 默认 24 小时
  minSessions: number   // 默认 5 个会话
}

// 检查是否应该触发 dream
async function shouldTriggerDream(): Promise<boolean> {
  // 1. 时间门检查
  const lastConsolidated = await readLastConsolidatedAt()
  const hoursSince = (Date.now() - lastConsolidated) / (1000 * 60 * 60)
  if (hoursSince < config.minHours) {
    return false
  }

  // 2. 会话门检查
  const sessionsSince = await listSessionsTouchedSince(lastConsolidated)
  if (sessionsSince < config.minSessions) {
    return false
  }

  // 3. 锁检查
  const lock = await tryAcquireConsolidationLock()
  if (!lock) {
    return false
  }

  return true
}

// 运行 dream
async function runDream(): Promise<void> {
  const prompt = await buildConsolidationPrompt()
  const result = await runForkedAgent({
    prompt,
    name: 'dream',
    agent: 'dream',
  })

  // 更新任务状态
  addDreamTurn(result.turn, result.touchedPaths, setAppState)
}
```

---

## 二百二十三、Swarm 常量

### Swarm 配置

```typescript
// utils/swarm/constants.ts

export const TEAM_LEAD_NAME = 'team-lead'
export const SWARM_SESSION_NAME = 'claude-swarm'
export const SWARM_VIEW_WINDOW_NAME = 'swarm-view'
export const TMUX_COMMAND = 'tmux'
export const HIDDEN_SESSION_NAME = 'claude-hidden'

// 获取 swarm socket 名称
export function getSwarmSocketName(): string {
  // 隔离 swarm 操作与用户的 tmux 会话
  return `claude-swarm-${process.pid}`
}

// 环境变量
export const TEAMMATE_COMMAND_ENV_VAR = 'CLAUDE_CODE_TEAMMATE_COMMAND'
export const TEAMMATE_COLOR_ENV_VAR = 'CLAUDE_CODE_AGENT_COLOR'
export const PLAN_MODE_REQUIRED_ENV_VAR = 'CLAUDE_CODE_PLAN_MODE_REQUIRED'
```

---

## 二百二十四、Team Memory Sync

### 团队记忆同步

```typescript
// services/teamMemorySync/index.ts

/**
 * 在本地文件系统和服务器 API 之间同步团队记忆文件。
 * 团队记忆按 repo 范围 (由 git remote hash 标识)，在所有认证的 org 成员间共享。
 *
 * API 契约:
 * GET  /api/claude_code/team_memory?repo={owner/repo}
 * PUT  /api/claude_code/team_memory?repo={owner/repo}
 */

// 同步语义:
// - Pull: 服务器内容覆盖本地文件 (服务器胜出)
// - Push: 仅上传内容哈希与服务器不同的键 (增量上传)
// - 文件删除不传播

const TEAM_MEMORY_SYNC_TIMEOUT_MS = 30_000
const MAX_FILE_SIZE_BYTES = 250_000

// 拉取团队记忆
export async function pullTeamMemory(
  repo: string,
  state: SyncState,
): Promise<TeamMemoryData> {
  const etag = state.etag
  const headers = etag ? { 'If-None-Match': etag } : {}

  const response = await axios.get(
    `/api/claude_code/team_memory?repo=${repo}`,
    { headers, timeout: TEAM_MEMORY_SYNC_TIMEOUT_MS }
  )

  // 更新 ETag
  state.etag = response.headers.etag

  // 写入本地文件
  for (const [key, entry] of Object.entries(response.data.entries)) {
    await writeFile(join(getTeamMemPath(), key), entry.content)
  }

  return response.data
}

// 推送团队记忆
export async function pushTeamMemory(
  repo: string,
  state: SyncState,
): Promise<void> {
  // 计算增量上传
  const localFiles = await listTeamMemFiles()
  const uploadEntries: TeamMemoryEntry[] = []

  for (const file of localFiles) {
    const content = await readFile(file.path)
    const localHash = sha256(content)

    // 仅上传不同的文件
    if (localHash !== state.serverChecksums[file.key]) {
      uploadEntries.push({ key: file.key, content })
    }
  }

  await axios.put(
    `/api/claude_code/team_memory?repo=${repo}`,
    { entries: uploadEntries },
    { timeout: TEAM_MEMORY_SYNC_TIMEOUT_MS }
  )
}
```

---

## 二百二十五、虚拟滚动 (VirtualScroll)

### 虚拟滚动实现

```typescript
// hooks/useVirtualScroll.ts

const DEFAULT_ESTIMATE = 3          // 未测量项的估计高度
const OVERSCAN_ROWS = 80            // 视口上下的额外行
const COLD_START_COUNT = 30         // 冷启动时的项数
const SCROLL_QUANTUM = OVERSCAN_ROWS >> 1  // 滚动量化
const PESSIMISTIC_HEIGHT = 1        // 未测量项的最坏情况高度
const MAX_MOUNTED_ITEMS = 300       // 挂载项上限
const SLIDE_STEP = 25               // 单次提交的新项数

export type VirtualScrollResult = {
  // 半开区间 [startIndex, endIndex)
  range: readonly [number, number]
  topSpacer: number      // 顶部空白高度
  bottomSpacer: number   // 底部空白高度
  measureRef: (key: string) => (el: DOMElement | null) => void
  spacerRef: RefObject<DOMElement | null>
}

// 使用
function VirtualList({ items, rowHeight }) {
  const {
    range,
    topSpacer,
    bottomSpacer,
    measureRef,
    spacerRef,
  } = useVirtualScroll(items, rowHeight)

  const [start, end] = range

  return (
    <ScrollBox>
      <Box height={topSpacer} />
      {items.slice(start, end).map((item, i) => (
        <MessageRow
          key={item.id}
          item={item}
          ref={measureRef(item.id)}
        />
      ))}
      <Box height={bottomSpacer} />
    </ScrollBox>
  )
}
```

---

## 二百二十六、自动压缩 (AutoCompact)

### 自动上下文压缩

```typescript
// services/compact/autoCompact.ts

// 保留用于压缩期间输出的 token 数
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000

// 获取有效上下文窗口大小
export function getEffectiveContextWindowSize(model: string): number {
  const reservedTokens = Math.min(
    getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY,
  )
  let contextWindow = getContextWindowForModel(model, getSdkBetas())

  // 环境变量覆盖
  const autoCompactWindow = process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW
  if (autoCompactWindow) {
    const parsed = parseInt(autoCompactWindow, 10)
    if (!isNaN(parsed) && parsed > 0) {
      contextWindow = Math.min(contextWindow, parsed)
    }
  }

  return contextWindow - reservedTokens
}

export const AUTOCOMPACT_BUFFER_TOKENS = 13_000
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000

// 最大连续压缩失败次数 (超过后停止重试)
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// 是否应该自动压缩
export function shouldAutoCompact(
  model: string,
  currentTokens: number,
): AutoCompactDecision {
  const threshold = getAutoCompactThreshold(model)

  if (currentTokens >= threshold + ERROR_THRESHOLD_BUFFER_TOKENS) {
    return { action: 'error', reason: 'context_too_large' }
  }

  if (currentTokens >= threshold + WARNING_THRESHOLD_BUFFER_TOKENS) {
    return { action: 'warn', reason: 'approaching_limit' }
  }

  if (currentTokens >= threshold) {
    return { action: 'compact', reason: 'threshold_reached' }
  }

  return { action: 'none' }
}
```

---

## 二百二十七、Model Strings

### 模型字符串映射

```typescript
// utils/model/modelStrings.ts

/**
 * 将每个模型版本映射到特定于 provider 的模型 ID 字符串。
 * 从 ALL_MODEL_CONFIGS 派生 - 在那里添加模型会扩展此类型。
 */

// 获取内置模型字符串
function getBuiltinModelStrings(provider: APIProvider): ModelStrings {
  const out = {} as ModelStrings
  for (const key of MODEL_KEYS) {
    out[key] = ALL_MODEL_CONFIGS[key][provider]
  }
  return out
}

// 获取 Bedrock 模型字符串
async function getBedrockModelStrings(): Promise<ModelStrings> {
  const fallback = getBuiltinModelStrings('bedrock')
  const profiles = await getBedrockInferenceProfiles()

  // 在用户的推理配置文件列表中搜索canonical substring
  // 例如 "claude-opus-4-6" 匹配 "eu.anthropic.claude-opus-4-6-v1"
  const out = {} as ModelStrings
  for (const key of MODEL_KEYS) {
    const needle = ALL_MODEL_CONFIGS[key].firstParty
    out[key] = findFirstMatch(profiles, needle) || fallback[key]
  }
  return out
}

// 应用模型覆盖
function applyModelOverrides(ms: ModelStrings): ModelStrings {
  const overrides = getInitialSettings().modelOverrides
  if (!overrides) return ms

  const out = { ...ms }
  for (const [canonicalId, override] of Object.entries(overrides)) {
    const key = CANONICAL_ID_TO_KEY[canonicalId]
    if (key && override) {
      out[key] = override
    }
  }
  return out
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **DreamTask** | `tasks/DreamTask/` | 自动记忆整合 UI |
| **AutoDream** | `services/autoDream/` | 记忆整合服务 |
| **Swarm** | `utils/swarm/` | Swarm 配置 |
| **TeamMemory** | `services/teamMemorySync/` | 团队记忆同步 |
| **VirtualScroll** | `hooks/useVirtualScroll.ts` | 虚拟滚动 |
| **AutoCompact** | `services/compact/autoCompact.ts` | 上下文自动压缩 |
| **Model Strings** | `utils/model/modelStrings.ts` | 模型 ID 映射 |