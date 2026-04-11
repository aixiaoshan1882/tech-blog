# Claude Code 源码深度学习笔记 (第三十四部分)

> Diff·Treeify·会话列表·文本高亮·自动更新·Plan Mode·Effort

---

## 二百零五、Diff 工具

### Diff 补丁生成

```typescript
// utils/diff.ts

import { structuredPatch } from 'diff'

export const CONTEXT_LINES = 3
export const DIFF_TIMEOUT_MS = 5_000

// 转义特殊字符
const AMPERSAND_TOKEN = '<<:AMPERSAND_TOKEN:>>'
const DOLLAR_TOKEN = '<<:DOLLAR_TOKEN:>>'

function escapeForDiff(s: string): string {
  return s.replaceAll('&', AMPERSAND_TOKEN).replaceAll('$', DOLLAR_TOKEN)
}

function unescapeFromDiff(s: string): string {
  return s.replaceAll(AMPERSAND_TOKEN, '&').replaceAll(DOLLAR_TOKEN, '$')
}

// 生成 unified diff
export function createPatch(
  filePath: string,
  oldContent: string,
  newContent: string,
): string {
  const escapedOld = escapeForDiff(oldContent)
  const escapedNew = escapeForDiff(newContent)

  const patch = structuredPatch(
    filePath,
    filePath,
    escapedOld,
    escapedNew,
    '',
    '',
    { context: CONTEXT_LINES },
  )

  return unescapeFromDiff(patch_toString(patch))
}

// 计算变更行数
export function countLinesChanged(
  patch: StructuredPatchHunk[],
  newFileContent?: string,
): void {
  let numAdditions = 0
  let numRemovals = 0

  if (patch.length === 0 && newFileContent) {
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

  // 更新统计
  addToTotalLinesChanged(numAdditions, numRemovals)
  getLocCounter()?.add(numAdditions, { type: 'added' })
  getLocCounter()?.add(numRemovals, { type: 'removed' })

  logEvent('tengu_file_changed', {
    lines_added: numAdditions,
    lines_removed: numRemovals,
  })
}
```

---

## 二百零六、Treeify 树形显示

### 对象转树形结构

```typescript
// utils/treeify.ts

import figures from 'figures'

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
const DEFAULT_TREE_CHARS = {
  branch: figures.lineUpDownRight,  // '├'
  lastBranch: figures.lineUpRight, // '└'
  line: figures.lineVertical,      // '│'
  empty: ' ',
}

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
      if (options.showValues) {
        lines.push(prefix + String(node))
      }
      return
    }

    // 检测循环引用
    if (visited.has(node)) {
      lines.push(prefix + '[Circular]')
      return
    }
    visited.add(node)

    // 处理对象键值对
    const entries = Object.entries(node)
    entries.forEach(([key, value], index) => {
      const isLastEntry = index === entries.length - 1
      const connector = isLastEntry ? chars.lastBranch : chars.branch
      const childPrefix = prefix + (isLastEntry ? chars.empty : chars.line) + ' '

      lines.push(prefix + connector + ' ' + key)
      growBranch(value as TreeNode, childPrefix, isLastEntry, depth + 1)
    })
  }

  growBranch(obj, '', false)
  return lines.join('\n')
}
```

---

## 二百零七、文本高亮

### 文本分段高亮

```typescript
// utils/textHighlighting.ts

export type TextHighlight = {
  start: number
  end: number
  color: keyof Theme | undefined
  dimColor?: boolean
  inverse?: boolean
  shimmerColor?: keyof Theme
  priority: number
}

export type TextSegment = {
  text: string
  start: number
  highlight?: TextHighlight
}

// 文本分段
export function segmentTextByHighlights(
  text: string,
  highlights: TextHighlight[],
): TextSegment[] {
  if (highlights.length === 0) {
    return [{ text, start: 0 }]
  }

  // 排序并去除重叠
  const sortedHighlights = [...highlights].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return b.priority - a.priority
  })

  const resolvedHighlights: TextHighlight[] = []
  const usedRanges: Array<{ start: number; end: number }> = []

  for (const highlight of sortedHighlights) {
    if (highlight.start === highlight.end) continue

    const overlaps = usedRanges.some(range =>
      (highlight.start >= range.start && highlight.start < range.end) ||
      (highlight.end > range.start && highlight.end <= range.end) ||
      (highlight.start <= range.start && highlight.end >= range.end)
    )

    if (!overlaps) {
      resolvedHighlights.push(highlight)
      usedRanges.push({ start: highlight.start, end: highlight.end })
    }
  }

  return new HighlightSegmenter(text).segment(resolvedHighlights)
}
```

---

## 二百零八、ANSI 切片

### 正确的 ANSI 感知切片

```typescript
// utils/sliceAnsi.ts

// 使用 @alcalzone/ansi-tokenize 正确处理 ANSI 转义序列

export default function sliceAnsi(
  str: string,
  start: number,
  end?: number,
): string {
  const tokens = tokenize(str)
  let activeCodes: AnsiCode[] = []
  let position = 0
  let result = ''
  let include = false

  for (const token of tokens) {
    // 计算显示宽度
    const width = token.type === 'ansi'
      ? 0
      : token.fullWidth ? 2 : stringWidth(token.value)

    // 超出范围，停止
    if (end !== undefined && position >= end) {
      if (token.type === 'ansi' || width > 0 || !include) break
    }

    if (token.type === 'ansi') {
      activeCodes.push(token)
      if (include) {
        result += token.code
      }
    } else {
      if (!include && position >= start) {
        // 跳过前导零宽字符
        if (start > 0 && width === 0) continue
        include = true
        activeCodes = filterStartCodes(reduceAnsiCodes(activeCodes))
        result = ansiCodesToString(activeCodes)
      }

      if (include) {
        result += token.value
        position += width
      }
    }
  }

  // 添加结束 ANSI 序列
  if (include) {
    result += ansiCodesToString(undoAnsiCodes(activeCodes))
  }

  return result
}
```

---

## 二百零九、会话列表

### 轻量级会话信息

```typescript
// utils/listSessionsImpl.ts

export type SessionInfo = {
  sessionId: string
  summary: string
  lastModified: number
  fileSize?: number
  customTitle?: string
  firstPrompt?: string
  gitBranch?: string
  cwd?: string
  tag?: string
  createdAt?: number
}

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeWorktrees?: boolean
}

// 列出所有会话
export async function listSessions(
  options: ListSessionsOptions = {},
): Promise<SessionInfo[]> {
  const { dir, limit = 50, offset = 0, includeWorktrees = true } = options

  const projectsDir = getProjectsDir()
  const projectDirs = dir ? [dir] : await getProjectDirs(projectsDir)

  const sessions: SessionInfo[] = []

  for (const projectDir of projectDirs) {
    const sessionFiles = await getSessionFiles(projectDir)

    for (const sessionFile of sessionFiles) {
      const info = await parseSessionInfoFromLite(sessionFile)
      if (info) {
        sessions.push(info)
      }
    }
  }

  // 排序并分页
  return sessions
    .sort((a, b) => b.lastModified - a.lastModified)
    .slice(offset, offset + limit)
}
```

---

## 二百一十、自动更新

### 版本检查和更新

```typescript
// utils/autoUpdater.ts

const GCS_BUCKET_URL =
  'https://storage.googleapis.com/claude-code-dist-.../claude-code-releases'

// 检查最小版本
export async function assertMinVersion(): Promise<void> {
  const versionConfig = await getDynamicConfig_BLOCKS_ON_INIT<{
    minVersion: string
  }>('tengu_version_config', { minVersion: '0.0.0' })

  if (lt(MACRO.VERSION, versionConfig.minVersion)) {
    throw new ClaudeError(
      `Claude Code ${versionConfig.minVersion} or later is required. ` +
      `Please run: claude update`
    )
  }
}

// 检查更新
export async function checkForUpdate(): Promise<AutoUpdaterResult> {
  try {
    const response = await axios.get(`${GCS_BUCKET_URL}/latest-version.json`)
    const latestVersion = response.data.version

    if (gt(latestVersion, MACRO.VERSION)) {
      return {
        version: latestVersion,
        status: 'update_available',
      }
    }

    return { version: null, status: 'up_to_date' }
  } catch (error) {
    return { version: null, status: 'check_failed' }
  }
}

// 执行更新
export async function performUpdate(version: string): Promise<AutoUpdaterResult> {
  // 下载新版本
  const downloadUrl = `${GCS_BUCKET_URL}/${version}/claude-code`
  const downloadPath = join(tmpdir(), 'claude-code-update')

  await axios.download(downloadUrl, downloadPath)

  // 替换当前二进制
  const installPath = getInstallPath()
  await chmod(downloadPath, 0o755)
  await rename(downloadPath, installPath)

  return { version, status: 'success' }
}
```

---

## 二百一十一、Plan Mode V2

### Plan Mode Agent 数量

```typescript
// utils/planModeV2.ts

export function getPlanModeV2AgentCount(): number {
  // 环境变量优先
  if (process.env.CLAUDE_CODE_PLAN_V2_AGENT_COUNT) {
    const count = parseInt(process.env.CLAUDE_CODE_PLAN_V2_AGENT_COUNT, 10)
    if (!isNaN(count) && count > 0 && count <= 10) {
      return count
    }
  }

  const subscriptionType = getSubscriptionType()
  const rateLimitTier = getRateLimitTier()

  // Max + 20x 限流 = 3 个 agent
  if (
    subscriptionType === 'max' &&
    rateLimitTier === 'default_claude_max_20x'
  ) {
    return 3
  }

  // 企业版/团队版 = 3 个 agent
  if (subscriptionType === 'enterprise' || subscriptionType === 'team') {
    return 3
  }

  return 1
}

export function getPlanModeV2ExploreAgentCount(): number {
  return 3
}

// Pewter Ledger - Plan 文件结构实验
export type PewterLedgerVariant = 'trim' | 'cut' | 'cap' | null
```

---

## 二百一十二、Effort 级别

### 模型 Effort 支持

```typescript
// utils/effort.ts

export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const

// 检查模型是否支持 effort 参数
export function modelSupportsEffort(model: string): boolean {
  const m = model.toLowerCase()

  // 支持 Opus 4.6 和 Sonnet 4.6
  if (m.includes('opus-4-6') || m.includes('sonnet-4-6')) {
    return true
  }

  // 排除旧模型
  if (m.includes('haiku') || m.includes('sonnet') || m.includes('opus')) {
    return false
  }

  // 第一方默认支持
  return getAPIProvider() === 'firstParty'
}

// 检查模型是否支持 max effort
export function modelSupportsMaxEffort(model: string): boolean {
  // 仅 Opus 4.6 支持 max
  if (model.toLowerCase().includes('opus-4-6')) {
    return true
  }

  return false
}

// 解析 effort 值
export function parseEffortValue(value: unknown): EffortValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value === 'number' && isValidNumericEffort(value)) {
    return value
  }

  const str = String(value).toLowerCase()
  if (isEffortLevel(str)) {
    return str
  }

  return undefined
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Diff** | `utils/diff.ts` | 统一 diff 生成 |
| **Treeify** | `utils/treeify.ts` | 对象转树形 |
| **高亮** | `utils/textHighlighting.ts` | 文本分段高亮 |
| **ANSI** | `utils/sliceAnsi.ts` | ANSI 感知切片 |
| **会话** | `utils/listSessionsImpl.ts` | 会话列表 |
| **更新** | `utils/autoUpdater.ts` | 版本更新 |
| **Plan** | `utils/planModeV2.ts` | Plan Mode V2 |
| **Effort** | `utils/effort.ts` | Effort 级别 |