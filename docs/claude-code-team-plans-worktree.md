# Claude Code 源码深度学习笔记 (第十三部分)

> 团队协作 · 计划系统 · Worktree

---

## 六十九、团队协作系统 (Swarm)

### 团队架构

```typescript
// utils/swarm/teamHelpers.ts

export type TeamFile = {
  name: string
  description?: string
  createdAt: number
  leadAgentId: string
  leadSessionId?: string  // 领导者会话 UUID

  // 团队允许的路径 (所有成员可编辑)
  teamAllowedPaths?: TeamAllowedPath[]

  members: Array<{
    agentId: string
    name: string
    agentType?: string
    model?: string
    prompt?: string
    color?: string
    tmuxPaneId: string
    cwd: string
    worktreePath?: string
    sessionId?: string
    subscriptions: string[]     // 订阅的消息类型
    backendType?: BackendType    // 进程内还是远程
    isActive?: boolean          // 是否活跃
    mode?: PermissionMode       // 权限模式
  }>
}

export type TeamAllowedPath = {
  path: string           // 目录路径
  toolName: string      // 适用的工具 (Edit, Write)
  addedBy: string       // 添加规则的 Agent
  addedAt: number       // 添加时间
}
```

### 团队操作

```typescript
// utils/swarm/teamHelpers.ts

export const inputSchema = z.strictObject({
  operation: z.enum(['spawnTeam', 'cleanup']),
  agent_type: z.string().optional(),
  team_name: z.string().optional(),
  description: z.string().optional(),
})

// 创建团队
export async function spawnTeam(
  teamName: string,
  agentType: string,
  description?: string,
): Promise<SpawnTeamOutput> {
  const teamFile = {
    name: teamName,
    createdAt: Date.now(),
    leadAgentId: generateAgentId(),
    members: [],
  }

  await writeFile(getTeamFilePath(teamName), jsonStringify(teamFile))

  return {
    team_name: teamName,
    team_file_path: getTeamFilePath(teamName),
    lead_agent_id: teamFile.leadAgentId,
  }
}

// 清理团队
export async function cleanupTeam(teamName: string): Promise<CleanupOutput> {
  // 删除团队文件和任务目录
  await rm(getTeamFilePath(teamName))
  await rm(getTasksDir(teamName))
  return { success: true, message: 'Team cleaned up', team_name: teamName }
}
```

### 团队后端

```typescript
// utils/swarm/backends/types.ts

export type BackendType =
  | 'pane'      // 面板 (Ink UI)
  | 'iterm2'    // iTerm2 窗格
  | 'process'  // 独立进程
  | 'bridge'    // Bridge 远程

export interface Backend {
  type: BackendType
  spawn(options: SpawnOptions): Promise<void>
  sendMessage(message: TeamMessage): Promise<void>
  receiveMessage(): AsyncGenerator<TeamMessage>
  terminate(): Promise<void>
}
```

### 权限同步

```typescript
// utils/swarm/permissionSync.ts

export async function syncPermissionToWorkers(
  teamName: string,
  permission: PermissionState,
): Promise<void> {
  const team = await loadTeamFile(teamName)

  for (const member of team.members) {
    if (member.backendType === 'bridge') {
      // 通过 Bridge 发送权限
      await sendPermissionViaBridge(member.sessionId, permission)
    } else if (member.backendType === 'process') {
      // 进程内直接更新
      await updateInProcessPermission(member.agentId, permission)
    }
  }
}
```

---

## 七十、计划系统 (Plans)

### 计划文件管理

```typescript
// utils/plans.ts

export function getPlanSlug(sessionId?: SessionId): string {
  const cache = getPlanSlugCache()
  let slug = cache.get(sessionId)

  if (!slug) {
    // 生成单词 slug
    for (let i = 0; i < MAX_SLUG_RETRIES; i++) {
      slug = generateWordSlug()
      const filePath = join(plansDir, `${slug}.md`)
      if (!existsSync(filePath)) {
        break
      }
    }
    cache.set(sessionId, slug)
  }

  return slug
}

// 获取计划目录
export const getPlansDirectory = memoize(function getPlansDirectory(): string {
  const settings = getInitialSettings()

  if (settings.plansDirectory) {
    // 相对于项目根目录
    const resolved = resolve(getCwd(), settings.plansDirectory)
    // 验证路径不能超出项目根目录
    if (!resolved.startsWith(getCwd() + sep)) {
      throw new Error('plansDirectory must be within project root')
    }
    return resolved
  }

  // 默认: ~/.claude/plans
  return join(getClaudeConfigHomeDir(), 'plans')
})
```

### 计划文件操作

```typescript
// utils/plans.ts

// 创建计划文件
export async function createPlanFile(
  sessionId: SessionId,
  content: string,
): Promise<string> {
  const slug = getPlanSlug(sessionId)
  const filePath = join(getPlansDirectory(), `${slug}.md`)

  await writeFile(filePath, content)
  return filePath
}

// 读取计划文件
export async function readPlanFile(sessionId: SessionId): Promise<string | null> {
  const slug = getPlanSlug(sessionId)
  const filePath = join(getPlansDirectory(), `${slug}.md`)

  if (!existsSync(filePath)) {
    return null
  }

  return readFile(filePath, 'utf-8')
}

// 更新计划
export async function updatePlan(
  sessionId: SessionId,
  content: string,
): Promise<void> {
  const slug = getPlanSlug(sessionId)
  const filePath = join(getPlansDirectory(), `${slug}.md`)

  await writeFile(filePath, content)
}
```

---

## 七十一、Worktree 支持

### Git Worktree

```typescript
// utils/worktree.ts

export function validateWorktreeSlug(slug: string): void {
  // 长度检查
  if (slug.length > MAX_WORKTREE_SLUG_LENGTH) {
    throw new Error(`Worktree name too long: max ${MAX_WORKTREE_SLUG_LENGTH}`)
  }

  // 检查路径遍历
  for (const segment of slug.split('/')) {
    if (segment === '.' || segment === '..') {
      throw new Error('Invalid worktree name: no . or .. segments')
    }

    if (!VALID_WORKTREE_SLUG_SEGMENT.test(segment)) {
      throw new Error(`Invalid worktree name: invalid characters`)
    }
  }
}

// 创建 worktree
export async function createWorktree(
  name: string,
  ref: string,
  options?: { createBranch?: boolean },
): Promise<Worktree> {
  validateWorktreeSlug(name)

  const worktreePath = join(getWorktreesDir(), name)

  // 执行 git worktree add
  const args = ['worktree', 'add']
  if (options?.createBranch) {
    args.push('-b', name)
  }
  args.push(worktreePath, ref)

  const { exitCode, stderr } = await execFileNoThrow(gitExe(), args)

  if (exitCode !== 0) {
    throw new Error(`Failed to create worktree: ${stderr}`)
  }

  return {
    path: worktreePath,
    name,
    branch: ref,
  }
}

// 列出 worktrees
export async function listWorktrees(): Promise<Worktree[]> {
  const { stdout } = await execFileNoThrow(gitExe(), ['worktree', 'list', '--porcelain'])

  return parseWorktreeList(stdout)
}
```

### Worktree 目录结构

```
.claude/
├── worktrees/
│   ├── feature-1/
│   ├── feature-2/
│   └── bugfix-3/
├── plans/
│   ├── happy-dog.md
│   └── quick-fox.md
└── teams/
    ├── research-team.json
    └── dev-team.json
```

---

## 七十二、进度追踪

### Token 预算

```typescript
// utils/tokenBudget.ts

export interface TokenBudget {
  total: number
  used: number
  remaining: number
  percentUsed: number
}

// 获取当前 Turn 的 Token 预算
export function getCurrentTurnTokenBudget(): TokenBudget {
  const total = getTurnBudget()
  const used = getTurnInputTokens() + getTurnOutputTokens()
  const remaining = Math.max(0, total - used)
  const percentUsed = (used / total) * 100

  return { total, used, remaining, percentUsed }
}

// 检查是否接近预算限制
export function isNearBudgetLimit(threshold = 80): boolean {
  const { percentUsed } = getCurrentTurnTokenBudget()
  return percentUsed >= threshold
}
```

### Turn 统计

```typescript
// bootstrap/state.ts

export interface TurnStats {
  inputTokens: number
  outputTokens: number
  toolCalls: number
  toolDuration: number
  hookDuration: number
  classifierDuration: number
  turnNumber: number
}

export function resetTurnStats(): void {
  setTurnInputTokens(0)
  setTurnOutputTokens(0)
  setTurnToolCount(0)
  setTurnToolDuration(0)
  setTurnHookCount(0)
  setTurnHookDuration(0)
  setTurnClassifierCount(0)
  setTurnClassifierDuration(0)
}

export function getTurnStats(): TurnStats {
  return {
    inputTokens: getTurnInputTokens(),
    outputTokens: getTurnOutputTokens(),
    toolCalls: getTurnToolCount(),
    toolDuration: getTurnToolDurationMs(),
    hookDuration: getTurnHookDurationMs(),
    classifierDuration: getTurnClassifierDurationMs(),
    turnNumber: getCurrentTurnNumber(),
  }
}
```

---

## 七十三、重要设计模式

### 1. 团队消息订阅

```typescript
// 成员订阅特定类型的消息
interface TeamMember {
  agentId: string
  subscriptions: string[]  // ['file_changes', 'task_completed', 'error']
}

// 消息路由
function routeTeamMessage(team: TeamFile, message: TeamMessage): void {
  for (const member of team.members) {
    if (member.subscriptions.includes(message.type)) {
      deliverToMember(member, message)
    }
  }
}
```

### 2. Slug 生成

```typescript
// 生成人类可读的单词 slug
export function generateWordSlug(): string {
  const words = DICTIONARY.filter(w => w.length <= 8)
  const part1 = words[Math.floor(Math.random() * words.length)]
  const part2 = words[Math.floor(Math.random() * words.length)]
  return `${part1}-${part2}`
}

// 示例: happy-dog, quick-fox, brave-lion
```

### 3. 路径验证

```typescript
// 防止路径遍历
export function validatePathTraversal(path: string, base: string): boolean {
  const resolved = resolve(base, path)
  return resolved.startsWith(base + sep) || resolved === base
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **团队** | `utils/swarm/teamHelpers.ts` | 团队管理 |
| **团队** | `utils/swarm/permissionSync.ts` | 权限同步 |
| **团队** | `utils/swarm/backends/types.ts` | 后端类型 |
| **计划** | `utils/plans.ts` | 计划文件 |
| **Worktree** | `utils/worktree.ts` | Git worktree |
| **预算** | `utils/tokenBudget.ts` | Token 预算 |
| **统计** | `bootstrap/state.ts` | Turn 统计 |