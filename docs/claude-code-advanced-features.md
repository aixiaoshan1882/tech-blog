# Claude Code 源码深度学习笔记 (附加部分 - 高级特性)

> AutoCompact·Worktree·Swarm·VCR·Cron·Diff·MCP Auth

---

## 一、Auto Compact 自动压缩

### 自动压缩系统

```typescript
// services/compact/autoCompact.ts

/**
 * 自动压缩
 * 当上下文窗口接近满时自动压缩对话历史
 */

// 有效上下文窗口大小
export function getEffectiveContextWindowSize(model: string): number {
  const reservedTokensForSummary = Math.min(
    getMaxOutputTokensForModel(model),
    MAX_OUTPUT_TOKENS_FOR_SUMMARY, // 20,000
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

  return contextWindow - reservedTokensForSummary
}

// 自动压缩阈值
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000
export const MANUAL_COMPACT_BUFFER_TOKENS = 3_000

// 最大连续失败次数 (电路断路器)
const MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3

// 获取自动压缩阈值
export function getAutoCompactThreshold(model: string): number {
  const effectiveContextWindow = getEffectiveContextWindowSize(model)
  return effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
}
```

### 压缩触发流程

```typescript
// 检查是否需要压缩
async function checkAndCompact(
  messages: Message[],
  model: string,
): Promise<CompactionResult | null> {
  const tokenCount = await tokenCountWithEstimation(messages)
  const threshold = getAutoCompactThreshold(model)

  if (tokenCount < threshold) {
    return null
  }

  // 执行压缩
  return await compactConversation(messages, {
    model,
    maxTokens: getEffectiveContextWindowSize(model),
  })
}
```

---

## 二、Worktree Git 工作树

### 工作树管理

```typescript
// utils/worktree.ts

/**
 * Git Worktree 管理
 * 支持并行开发多个功能分支
 */

// 验证工作树名称
const VALID_WORKTREE_SLUG_SEGMENT = /^[a-zA-Z0-9._-]+$/
const MAX_WORKTREE_SLUG_LENGTH = 64

export function validateWorktreeSlug(slug: string): void {
  if (slug.length > MAX_WORKTREE_SLUG_LENGTH) {
    throw new Error(`Invalid worktree name: must be ${MAX_WORKTREE_SLUG_LENGTH} characters or fewer`)
  }

  // 验证每个路径段
  for (const segment of slug.split('/')) {
    if (segment === '.' || segment === '..') {
      throw new Error(`Invalid worktree name "${slug}": must not contain "." or ".." path segments`)
    }
    if (!VALID_WORKTREE_SLUG_SEGMENT.test(segment)) {
      throw new Error(`Invalid worktree name: contains invalid characters`)
    }
  }
}

// 创建工作树
export async function createWorktree(
  path: string,
  branch: string,
  options: { create?: boolean; track?: boolean } = {},
): Promise<WorktreeResult> {
  const slug = basename(path)
  validateWorktreeSlug(slug)

  const args = ['worktree', 'add']
  if (options.create) args.push('-b', branch)
  if (options.track) args.push('--track')

  args.push(path)
  if (branch) args.push(branch)

  const result = await execFileNoThrow(gitExe(), args)
  return { path, branch, result }
}

// 列出工作树
export async function listWorktrees(): Promise<Worktree[]> {
  const result = await execFileNoThrow(gitExe(), [
    'worktree', 'list', '--porcelain'
  ])

  return parseWorktreeList(result.stdout)
}
```

---

## 三、Swarm 团队协作

### 多 Agent 团队系统

```typescript
// utils/swarm/constants.ts

/**
 * Swarm 团队协作常量
 */

export const TEAM_LEAD_NAME = 'team-lead'
export const SWARM_SESSION_NAME = 'claude-swarm'
export const SWARM_VIEW_WINDOW_NAME = 'swarm-view'
export const TMUX_COMMAND = 'tmux'
export const HIDDEN_SESSION_NAME = 'claude-hidden'

// 获取 Swarm Socket 名称
export function getSwarmSocketName(): string {
  return `claude-swarm-${process.pid}`
}

// 环境变量
export const TEAMMATE_COMMAND_ENV_VAR = 'CLAUDE_CODE_TEAMMATE_COMMAND'
export const TEAMMATE_COLOR_ENV_VAR = 'CLAUDE_CODE_AGENT_COLOR'
export const PLAN_MODE_REQUIRED_ENV_VAR = 'CLAUDE_CODE_PLAN_MODE_REQUIRED'
```

### 团队成员系统提示

```typescript
// utils/swarm/teammatePromptAddendum.ts

export const TEAMMATE_SYSTEM_PROMPT_ADDENDUM = `
# Agent Teammate Communication

IMPORTANT: You are running as an agent in a team. To communicate with anyone on your team:
- Use the SendMessage tool with \`to: "<name>"\` to send messages to specific teammates
- Use the SendMessage tool with \`to: "*"\` sparingly for team-wide broadcasts

Just writing a response in text is not visible to others on your team - you MUST use the SendMessage tool.

The user interacts primarily with the team lead. Your work is coordinated through the task system and teammate messaging.
`
```

### 团队创建工具

```typescript
// tools/TeamCreateTool/TeamCreateTool.ts

/**
 * 创建团队工具
 */

export const TeamCreateTool: Tool<InputSchema, Output> = buildTool({
  name: TEAM_CREATE_TOOL_NAME,
  searchHint: 'create a multi-agent swarm team',

  async handle(input: Input): Promise<Output> {
    // 1. 验证团队名称唯一性
    const teamName = generateUniqueTeamName(input.team_name)

    // 2. 创建团队文件
    const teamFile: TeamFile = {
      name: teamName,
      description: input.description,
      leadAgentId: formatAgentId(TEAM_LEAD_NAME),
      createdAt: Date.now(),
    }

    // 3. 写入团队文件
    await writeTeamFileAsync(teamName, teamFile)

    // 4. 注册清理
    registerTeamForSessionCleanup(teamName)

    // 5. 初始化任务目录
    await ensureTasksDir(teamName)
    resetTaskList(teamName)

    return {
      team_name: teamName,
      team_file_path: getTeamFilePath(teamName),
      lead_agent_id: teamFile.leadAgentId,
    }
  }
})
```

---

## 四、VCR 测试系统

### 录制回放测试

```typescript
// services/vcr.ts

/**
 * VCR 测试系统
 * 基于 Fixture 的录制回放测试
 */

function shouldUseVCR(): boolean {
  if (process.env.NODE_ENV === 'test') return true
  if (process.env.USER_TYPE === 'ant' && isEnvTruthy(process.env.FORCE_VCR)) {
    return true
  }
  return false
}

// Fixture 管理
async function withFixture<T>(
  input: unknown,
  fixtureName: string,
  f: () => Promise<T>,
): Promise<T> {
  if (!shouldUseVCR()) {
    return await f()
  }

  // 创建输入哈希作为 fixture 文件名
  const hash = createHash('sha1')
    .update(jsonStringify(input))
    .digest('hex')
    .slice(0, 12)

  const filename = join(
    process.env.CLAUDE_CODE_TEST_FIXTURES_ROOT ?? getCwd(),
    `fixtures/${fixtureName}-${hash}.json`,
  )

  // 尝试读取缓存的 fixture
  try {
    const cached = jsonParse(
      await readFile(filename, { encoding: 'utf8' }),
    ) as T
    return cached
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code !== 'ENOENT') throw e
  }

  // CI 环境下必须已有 fixture
  if ((env.isCI || process.env.CI) && !isEnvTruthy(process.env.VCR_RECORD)) {
    throw new Error(
      `Fixture missing: ${filename}. Re-run tests with VCR_RECORD=1, then commit the result.`,
    )
  }

  // 录制新 fixture
  const result = await f()
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, jsonStringify(result), 'utf-8')

  return result
}
```

---

## 五、Cron 定时任务

### Cron 表达式解析

```typescript
// utils/cron.ts

/**
 * Cron 表达式解析
 * 支持标准 5 字段: minute hour day-of-month month day-of-week
 */

// 字段范围
const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 },   // minute
  { min: 0, max: 23 },   // hour
  { min: 1, max: 31 },   // dayOfMonth
  { min: 1, max: 12 },   // month
  { min: 0, max: 6 },    // dayOfWeek (0=Sun, 7=Sun alias)
]

// 解析单个字段
function expandField(field: string, range: FieldRange): number[] | null {
  const { min, max } = range
  const out = new Set<number>()

  for (const part of field.split(',')) {
    // 通配符或步进: */5, *
    const stepMatch = part.match(/^\*(?:\/(\d+))?$/)
    if (stepMatch) {
      const step = stepMatch[1] ? parseInt(stepMatch[1], 10) : 1
      for (let i = min; i <= max; i += step) out.add(i)
      continue
    }

    // 范围: 1-5, 9-17
    const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/)
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1]!, 10)
      const hi = parseInt(rangeMatch[2]!, 10)
      const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1
      for (let i = lo; i <= hi; i += step) out.add(i)
      continue
    }

    // 单值: 30
    const singleMatch = part.match(/^\d+$/)
    if (singleMatch) {
      const n = parseInt(part, 10)
      if (n < min || n > max) return null
      out.add(n)
      continue
    }

    return null
  }

  return Array.from(out).sort((a, b) => a - b)
}

// 解析完整 cron 表达式
export function parseCronExpression(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  const minute = expandField(parts[0]!, FIELD_RANGES[0])
  const hour = expandField(parts[1]!, FIELD_RANGES[1])
  const dayOfMonth = expandField(parts[2]!, FIELD_RANGES[2])
  const month = expandField(parts[3]!, FIELD_RANGES[3])
  const dayOfWeek = expandField(parts[4]!, FIELD_RANGES[4])

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    return null
  }

  return { minute, hour, dayOfMonth, month, dayOfWeek }
}
```

### Cron 创建工具

```typescript
// tools/ScheduleCronTool/CronCreateTool.ts

/**
 * Cron 创建工具
 */

const MAX_JOBS = 50

const inputSchema = lazySchema(() =>
  z.strictObject({
    cron: z.string().describe(
      'Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "*/5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once).',
    ),
    prompt: z.string().describe('The prompt to enqueue at each fire time.'),
    recurring: semanticBoolean(z.boolean().optional()).describe(
      'true (default) = fire on every cron match until deleted. false = fire once then auto-delete.',
    ),
    durable: semanticBoolean(z.boolean().optional()).describe(
      'true = persist to .claude/scheduled_tasks.json and survive restarts. false = in-memory only.',
    ),
  }),
)

// 计算下次执行时间
export function nextCronRunMs(cron: CronFields): number {
  const now = new Date()

  // 找到下一个匹配的时间
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const date = addMinutes(now, i)
    if (matchesCron(date, cron)) {
      return date.getTime()
    }
  }

  return -1
}
```

---

## 六、Diff 工具

### 文件差异计算

```typescript
// utils/diff.ts

/**
 * Diff 工具
 * 计算和应用文件差异
 */

export const CONTEXT_LINES = 3
export const DIFF_TIMEOUT_MS = 5_000

// 调整 hunk 行号偏移
export function adjustHunkLineNumbers(
  hunks: StructuredPatchHunk[],
  offset: number,
): StructuredPatchHunk[] {
  if (offset === 0) return hunks
  return hunks.map(h => ({
    ...h,
    oldStart: h.oldStart + offset,
    newStart: h.newStart + offset,
  }))
}

// 转义特殊字符
const AMPERSAND_TOKEN = '<<:AMPERSAND_TOKEN:>>'
const DOLLAR_TOKEN = '<<:DOLLAR_TOKEN:>>'

function escapeForDiff(s: string): string {
  return s.replaceAll('&', AMPERSAND_TOKEN).replaceAll('$', DOLLAR_TOKEN)
}

function unescapeFromDiff(s: string): string {
  return s.replaceAll(AMPERSAND_TOKEN, '&').replaceAll(DOLLAR_TOKEN, '$')
}

// 计算变更行数
export function countLinesChanged(
  patch: StructuredPatchHunk[],
  newFileContent?: string,
): void {
  let numAdditions = 0
  let numRemovals = 0

  if (patch.length === 0 && newFileContent) {
    // 新文件，所有行都是新增
    numAdditions = newFileContent.split(/\r?\n/).length
  } else {
    numAdditions = patch.reduce(
      (acc, hunk) => acc + count(hunk.lines, _ => _.startsWith('+')),
      0,
    )
    numRemovals = patch.reduce(
      (acc, hunk) => acc + count(hunk.lines, _ => _.startsWith('-')),
      0,
    )
  }

  addToTotalLinesChanged(numAdditions, numRemovals)
  logEvent('tengu_file_changed', {
    lines_added: numAdditions,
    lines_removed: numRemovals,
  })
}
```

---

## 七、Treeify 工具

### 对象树形渲染

```typescript
// utils/treeify.ts

/**
 * Treeify 工具
 * 将对象渲染为树形结构
 */

export type TreeNode = {
  [key: string]: TreeNode | string | undefined
}

export type TreeifyOptions = {
  showValues?: boolean
  hideFunctions?: boolean
  useColors?: boolean
  themeName?: ThemeName
  treeCharColors?: {
    treeChar?: keyof Theme
    key?: keyof Theme
    value?: keyof Theme
  }
}

// 树形字符
const DEFAULT_TREE_CHARS: TreeCharacters = {
  branch: figures.lineUpDownRight,  // '├'
  lastBranch: figures.lineUpRight,  // '└'
  line: figures.lineVertical,       // '│'
  empty: ' ',
}

// 渲染树
export function treeify(obj: TreeNode, options: TreeifyOptions = {}): string {
  const lines: string[] = []
  const visited = new WeakSet<object>()

  function growBranch(
    node: TreeNode | string,
    prefix: string,
    isLast: boolean,
    depth: number = 0,
  ): void {
    if (typeof node === 'string') {
      lines.push(prefix + node)
      return
    }

    if (typeof node !== 'object' || node === null) {
      lines.push(prefix + String(node))
      return
    }

    // 检测循环引用
    if (visited.has(node)) {
      lines.push(prefix + '[Circular]')
      return
    }
    visited.add(node)

    const keys = Object.keys(node)
    keys.forEach((key, index) => {
      const isLastKey = index === keys.length - 1
      const connector = isLastKey ? chars.lastBranch : chars.branch
      const childPrefix = prefix + (isLastKey ? chars.empty : chars.line) + ' '

      lines.push(`${prefix}${connector} ${key}`)
      growBranch(node[key] as TreeNode, childPrefix, isLastKey, depth + 1)
    })
  }

  growBranch(obj, '', true)
  return lines.join('\n')
}
```

---

## 八、MCP OAuth 认证

### MCP 服务器认证

```typescript
// services/mcp/auth.ts

/**
 * MCP OAuth 认证
 * 支持 OAuth 2.0 和 PKCE 流程
 */

// OAuth 超时
const AUTH_REQUEST_TIMEOUT_MS = 30000

// 刷新失败原因
type MCPRefreshFailureReason =
  | 'metadata_discovery_failed'
  | 'no_client_info'
  | 'no_tokens_returned'
  | 'invalid_grant'
  | 'transient_retries_exhausted'
  | 'request_failed'

// 发现授权服务器元数据
async function discoverAuthorizationServerMetadata(
  serverUrl: string,
): Promise<AuthorizationServerMetadata | null> {
  try {
    return await discoverOAuthServerInfo(serverUrl, { fetch: axios })
  } catch (error) {
    logError(`Failed to discover OAuth server: ${errorMessage(error)}`)
    return null
  }
}

// 执行 OAuth 授权码流程
async function performOAuthFlow(
  config: McpSSEServerConfig,
): Promise<OAuthTokens> {
  // 1. 发现服务器元数据
  const metadata = await discoverAuthorizationServerMetadata(config.url)
  if (!metadata) {
    throw new Error('Failed to discover OAuth server metadata')
  }

  // 2. 生成 PKCE 代码挑战
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // 3. 启动本地回调服务器
  const { server, port } = await startCallbackServer()
  const redirectUri = `http://localhost:${port}/callback`

  // 4. 打开浏览器进行授权
  const authUrl = buildAuthorizationUrl({
    metadata,
    clientId: config.oauth.clientId,
    redirectUri,
    codeChallenge,
    scopes: config.oauth.scopes,
  })

  await openBrowser(authUrl)

  // 5. 等待回调
  const callback = await waitForCallback(server)
  const code = callback.code

  // 6. 交换令牌
  const tokens = await exchangeCodeForTokens({
    metadata,
    clientId: config.oauth.clientId,
    code,
    codeVerifier,
    redirectUri,
  })

  return tokens
}

// 刷新访问令牌
async function refreshAccessToken(
  config: McpSSEServerConfig,
  refreshToken: string,
): Promise<OAuthTokens> {
  try {
    const result = await sdkRefreshAuthorization({
      clientId: config.oauth.clientId,
      clientSecret: config.oauth.clientSecret,
      refreshToken,
      endpoint: metadata.token_endpoint,
    })

    return result
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      // 刷新令牌无效，需要重新授权
      return performOAuthFlow(config)
    }
    throw error
  }
}
```

---

## 架构总结

| 模块 | 文件 | 核心功能 |
|------|------|----------|
| **AutoCompact** | `services/compact/autoCompact.ts` | 自动压缩对话历史 |
| **Worktree** | `utils/worktree.ts` | Git 多分支并行开发 |
| **Swarm** | `utils/swarm/*.ts` | 多 Agent 团队协作 |
| **VCR** | `services/vcr.ts` | Fixture 录制回放测试 |
| **Cron** | `utils/cron.ts` | 定时任务调度 |
| **Diff** | `utils/diff.ts` | 文件差异计算 |
| **Treeify** | `utils/treeify.ts` | 对象树形渲染 |
| **MCP Auth** | `services/mcp/auth.ts` | OAuth 认证流程 |