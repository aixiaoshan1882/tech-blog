# Claude Code 源码深度学习笔记 (第四十一部分)

> Bash·Git·Markdown·Diff·Config·Settings·Permissions

---

## 二百五十九、Bash Parser

### Pure-TypeScript Bash 解析器

```typescript
// utils/bash/bashParser.ts

/**
 * 纯 TypeScript bash 解析器，生成 tree-sitter-bash 兼容的 AST
 * startIndex/endIndex 是 UTF-8 字节偏移量
 */

// 50ms 超时限制 - 防止病态/对抗输入
const PARSE_TIMEOUT_MS = 50

// 节点预算上限 - 防止深层嵌套输入 OOM
const MAX_NODES = 50_000

type TokenType =
  | 'WORD' | 'NUMBER' | 'OP' | 'NEWLINE' | 'COMMENT'
  | 'DQUOTE' | 'SQUOTE' | 'ANSI_C' | 'DOLLAR'
  | 'DOLLAR_PAREN' | 'DOLLAR_BRACE' | 'DOLLAR_DPAREN'
  | 'BACKTICK' | 'LT_PAREN' | 'GT_PAREN' | 'EOF'

type Token = {
  type: TokenType
  value: string
  start: number  // UTF-8 字节偏移
  end: number    // UTF-8 字节偏移
}

// 解析命令
export function parseCommand(source: string): TsNode | null {
  const tokens = tokenize(source)
  return parseTokens(tokens)
}
```

---

## 二百六十、Shell Quote

### 安全引用包装

```typescript
// utils/bash/shellQuote.ts

/**
 * shell-quote 库的安全包装
 */

export type ShellParseResult =
  | { success: true; tokens: ParseEntry[] }
  | { success: false; error: string }

export function tryParseShellCommand(
  cmd: string,
  env?: Record<string, string | undefined>,
): ShellParseResult {
  try {
    const tokens = shellQuoteParse(cmd, env)
    return { success: true, tokens }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export function tryQuoteShellArgs(args: unknown[]): ShellQuoteResult {
  try {
    const validated: string[] = args.map((arg, index) => {
      if (arg === null || arg === undefined) return String(arg)
      if (typeof arg === 'string') return arg
      if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg)
      throw new Error(`Cannot quote argument at index ${index}: unsupported type`)
    })
    return { success: true, quoted: shellQuoteQuote(validated) }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

---

## 二百六十一、Heredoc 处理

### Here Document 提取和恢复

```typescript
// utils/bash/heredoc.ts

/**
 * Heredoc 提取和恢复工具
 * shell-quote 将 << 解析为两个 <，需要特殊处理
 */

// 支持的 heredoc 变体
// <<WORD         - 基本 heredoc
// <<'WORD'       - 单引号分隔符 (无变量展开)
// <<"WORD"       - 双引号分隔符 (有变量展开)
// <<-WORD        - dash 前缀 (去除前导 tab)
// <<-'WORD'      - 组合

const HEREDOC_START_PATTERN =
  /(?<!<)<<(?!<)(-)?[ \t]*(?:(['"])(\\?\w+)\2|\\?(\w+))/

export type HeredocInfo = {
  fullText: string
  delimiter: string
  operatorStartIndex: number
  operatorEndIndex: number
  contentStartIndex: number
  contentEndIndex: number
  hasDashPrefix: boolean
  quotedStyle: "'" | '"' | null
}

// 提取 heredoc
export function extractHeredocs(command: string): {
  extracted: string
  heredocs: HeredocInfo[]
  placeholders: Map<string, string>
} {
  const heredocs: HeredocInfo[] = []
  const placeholders = new Map<string, string>()

  // 查找所有 heredoc 开始
  const matches = command.matchAll(HEREDOC_START_PATTERN)

  for (const match of matches) {
    const delimiter = match[3] || match[4]
    const placeholder = `__HEREDOC_${generatePlaceholderSalt()}__`

    // 提取 heredoc 内容
    // ...

    placeholders.set(placeholder, heredocContent)
  }

  // 替换占位符
  const extracted = command
    .replace(HEREDOC_START_PATTERN, placeholder)
    .replace(/* 恢复 heredoc 内容 */)

  return { extracted, heredocs, placeholders }
}
```

---

## 二百六十二、Git 工具

### Git 根目录查找

```typescript
// utils/git.ts

const GIT_ROOT_NOT_FOUND = Symbol('git-root-not-found')

const findGitRootImpl = memoizeWithLRU(
  (startPath: string): string | typeof GIT_ROOT_NOT_FOUND => {
    let current = resolve(startPath)
    const root = current.substring(0, current.indexOf(sep) + 1) || sep

    while (current !== root) {
      try {
        const gitPath = join(current, '.git')
        const stat = statSync(gitPath)
        // .git 可以是目录 (普通仓库) 或文件 (worktree/子模块)
        if (stat.isDirectory() || stat.isFile()) {
          return current.normalize('NFC')
        }
      } catch {
        // .git 不存在，继续向上
      }
      current = dirname(current)
    }

    return GIT_ROOT_NOT_FOUND
  }
)

// 获取远程 URL
export function getRemoteUrl(repo: string): string | null {
  const gitRoot = findGitRoot(repo)
  const configPath = join(gitRoot, '.git', 'config')
  const config = readFileSync(configPath, 'utf-8')
  // 解析 remote.origin.url
  // ...
}

// 获取分支
export function getCurrentBranch(repo: string): string | null {
  // ...
}
```

---

## 二百六十三、Markdown 渲染

### marked 封装

```typescript
// utils/markdown.ts

/**
 * marked 渲染器封装
 * 支持代码高亮、链接、引用块
 */

// 禁用删除线解析 - 模型常用 ~ 表示"大约"
marked.use({
  tokenizer: {
    del() {
      return undefined
    },
  },
})

export function applyMarkdown(
  content: string,
  theme: ThemeName,
  highlight: CliHighlight | null = null,
): string {
  return marked
    .lexer(stripPromptXMLTags(content))
    .map(token => formatToken(token, theme, 0, null, null, highlight))
    .join('')
    .trim()
}

function formatToken(
  token: Token,
  theme: ThemeName,
  listDepth: number,
  orderedListNumber: number | null,
  parent: Token | null,
  highlight: CliHighlight | null,
): string {
  switch (token.type) {
    case 'blockquote': {
      // 引用块 - 前缀垂直条
      const bar = chalk.dim(BLOCKQUOTE_BAR)
      return inner
        .split(EOL)
        .map(line =>
          stripAnsi(line).trim() ? `${bar} ${chalk.italic(line)}` : line,
        )
        .join(EOL)
    }

    case 'code': {
      // 代码块 - 支持语法高亮
      if (highlight?.supportsLanguage(token.lang)) {
        return highlight.highlight(token.text, token.lang)
      }
      return chalk.cyan(token.text)
    }

    case 'link': {
      // 链接 - 支持超链接
      const url = token.href
      if (supportsHyperlinks()) {
        return createHyperlink(token.text, url)
      }
      return `${token.text} (${url})`
    }
  }
}
```

---

## 二百六十四、Diff 工具

### 结构化补丁

```typescript
// utils/diff.ts

const CONTEXT_LINES = 3
const DIFF_TIMEOUT_MS = 5_000

// 特殊字符转义
const AMPERSAND_TOKEN = '<<:AMPERSAND_TOKEN:>>'
const DOLLAR_TOKEN = '<<:DOLLAR_TOKEN:>>'

function escapeForDiff(s: string): string {
  return s.replaceAll('&', AMPERSAND_TOKEN).replaceAll('$', DOLLAR_TOKEN)
}

// 计算补丁的添加/删除行数
export function countLinesChanged(
  patch: StructuredPatchHunk[],
  newFileContent?: string,
): void {
  let numAdditions = 0
  let numRemovals = 0

  if (patch.length === 0 && newFileContent) {
    // 新文件 - 所有行都是添加
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
  logEvent('tengu_file_changed', { lines_added, lines_removed })
}

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
```

---

## 二百六十五、Treeify 工具

### 树结构格式化

```typescript
// utils/treeify.ts

/**
 * 自定义 treeify 实现，支持 Ink 主题颜色
 */

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

// 树字符
const DEFAULT_TREE_CHARS = {
  branch: figures.lineUpDownRight,  // '├'
  lastBranch: figures.lineUpRight,  // '└'
  line: figures.lineVertical,       // '│'
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
    // 递归构建树
    // 检测循环引用
    if (visited.has(node)) {
      lines.push(prefix + colorize('[Circular]', treeCharColors.value))
      return
    }
    visited.add(node)
    // ...
  }

  growBranch(obj, '', false)
  return lines.join(EOL)
}
```

---

## 二百六十六、Config 配置

### 全局配置管理

```typescript
// utils/config.ts

/**
 * 全局配置管理
 * 支持多个配置源: 用户、项目、托管
 */

export type ProjectConfig = {
  allowedTools: string[]
  mcpContextUris: string[]
  mcpServers?: Record<string, McpServerConfig>
  lastAPIDuration?: number
}

export type GlobalConfig = {
  apiKey?: string
  version?: string
  installId?: string
  // ...
}

// 加载配置
export function getGlobalConfig(): GlobalConfig {
  const configPath = getGlobalConfigPath()
  const content = readFileSync(configPath, 'utf-8')
  return jsonParse(content)
}

// 加载项目配置
export function getProjectConfig(cwd: string): ProjectConfig | null {
  const configPath = findConfigFile(cwd, ' CLAUDE.md')
  if (!configPath) return null
  const content = readFileSync(dirname(configPath), 'utf-8')
  return jsonParse(content)
}
```

---

## 二百六十七、Settings 设置

### 分层设置系统

```typescript
// utils/settings/settings.ts

/**
 * 分层设置系统
 * 托管设置 -> 项目设置 -> 用户设置
 */

// 加载托管文件设置
export function loadManagedFileSettings(): {
  settings: SettingsJson | null
  errors: ValidationError[]
} {
  // managed-settings.json 是基础 (最低优先级)
  // managed-settings.d/*.json 是 drop-in (按字母顺序合并)
  // 匹配 systemd/sudoers 的 drop-in 约定
}

// 合并设置
export function mergeSettings(
  base: SettingsJson,
  override: SettingsJson,
): SettingsJson {
  return mergeWith(base, override, (obj, src) => {
    if (Array.isArray(obj)) {
      return src  // 数组替换，不合并
    }
    // 对象递归合并
  })
}

// 获取设置路径
export function getSettingsFilePath(source: SettingSource): string {
  switch (source) {
    case 'user':
      return join(getClaudeConfigHomeDir(), 'settings.json')
    case 'project':
      return join(cwd, '.claude', 'settings.json')
    case 'managed':
      return join(getManagedFilePath(), 'managed-settings.json')
  }
}
```

---

## 二百六十八、Permissions 权限

### 权限检查系统

```typescript
// utils/permissions/permissions.ts

/**
 * 权限检查系统
 * 支持规则匹配、路径验证、分类器决策
 */

// 检查工具权限
export async function checkToolPermission(
  tool: Tool,
  input: unknown,
  context: ToolUseContext,
): Promise<PermissionResult> {
  // 1. 检查规则匹配
  const matchingRule = matchingRuleForInput(tool.name, input)
  if (matchingRule) {
    return matchingRule
  }

  // 2. 路径验证 (对于文件系统操作)
  if (isFileOperation(tool.name)) {
    const pathCheck = await checkPathSafety(input.path, tool.name)
    if (!pathCheck.allowed) {
      return { allowed: false, reason: pathCheck.decisionReason }
    }
  }

  // 3. 分类器决策
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    const classifierResult = await classifierDecision(input, context)
    if (classifierResult.allow) {
      return { allowed: true }
    }
  }

  // 4. 请求用户确认
  return { allowed: null, requiresUserConfirmation: true }
}

// 检查路径安全性
export function checkPathSafety(
  path: string,
  operation: FileOperationType,
): PathCheckResult {
  // 展开 ~
  path = expandTilde(path)

  // 解析绝对路径
  if (!isAbsolute(path)) {
    path = resolve(cwd, path)
  }

  // 检查不允许的路径
  if (path.startsWith(homedir())) {
    if (!pathInAllowedWorkingPath(path)) {
      return { allowed: false, reason: 'path_not_in_working_directory' }
    }
  }

  return { allowed: true }
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Bash Parser** | `utils/bash/bashParser.ts` | 纯 TS Bash AST |
| **Shell Quote** | `utils/bash/shellQuote.ts` | 安全引用包装 |
| **Heredoc** | `utils/bash/heredoc.ts` | HereDoc 提取 |
| **Git** | `utils/git.ts` | Git 根查找 |
| **Markdown** | `utils/markdown.ts` | marked 封装 |
| **Diff** | `utils/diff.ts` | 结构化补丁 |
| **Treeify** | `utils/treeify.ts` | 树格式化 |
| **Config** | `utils/config.ts` | 全局配置 |
| **Settings** | `utils/settings/settings.ts` | 分层设置 |
| **Permissions** | `utils/permissions/permissions.ts` | 权限检查 |