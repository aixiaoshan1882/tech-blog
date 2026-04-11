# Claude Code 源码深度学习笔记 (第二十三部分)

> 协调器模式 · 权限系统 · Git 操作 · 后台清理 · GrowthBook

---

## 一百二十二、协调器模式

### 协调器开关

```typescript
// coordinator/coordinatorMode.ts

export function isCoordinatorMode(): boolean {
  if (feature('COORDINATOR_MODE')) {
    return isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)
  }
  return false
}

// 协调器用户上下文
export function getCoordinatorUserContext(
  scratchpadDir: string,
): CoordinatorContext {
  return {
    scratchpadDir,
    // 协调器特定配置
  }
}
```

### 模式切换

```typescript
// 匹配会话模式
export function matchSessionMode(
  sessionMode: 'coordinator' | 'normal' | undefined,
): string | undefined {
  if (!sessionMode) return undefined

  const currentIsCoordinator = isCoordinatorMode()
  const sessionIsCoordinator = sessionMode === 'coordinator'

  if (currentIsCoordinator === sessionIsCoordinator) {
    return undefined
  }

  // 切换环境变量
  if (sessionIsCoordinator) {
    process.env.CLAUDE_CODE_COORDINATOR_MODE = '1'
  } else {
    delete process.env.CLAUDE_CODE_COORDINATOR_MODE
  }

  return sessionIsCoordinator
    ? 'Entered coordinator mode to match resumed session.'
    : 'Exited coordinator mode to match resumed session.'
}
```

---

## 一百二十三、权限系统

### 危险命令模式

```typescript
// utils/permissions/dangerousPatterns.ts

// 跨平台代码执行入口
export const CROSS_PLATFORM_CODE_EXEC = [
  // 解释器
  'python', 'python3', 'node', 'deno', 'tsx',
  'ruby', 'perl', 'php', 'lua',
  // 包运行器
  'npx', 'npm run', 'yarn run', 'pnpm run', 'bun run',
  // Shell
  'bash', 'sh', 'ssh',
]

// 危险 Bash 模式
export const DANGEROUS_BASH_PATTERNS = [
  ...CROSS_PLATFORM_CODE_EXEC,
  'zsh', 'fish', 'eval', 'exec', 'env', 'xargs', 'sudo',
  // Anthropic 内部模式 (ant-only)
  ...(process.env.USER_TYPE === 'ant' ? [
    'fa run', 'coo', 'gh', 'gh api',
    'curl', 'wget', 'git', 'kubectl', 'aws', 'gcloud', 'gsutil',
  ] : []),
]
```

### 权限检查流程

```typescript
// utils/permissions/permissions.ts

export async function hasPermissionsToUseTool(
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
): Promise<PermissionResult> {
  // 1. 获取工具名称
  const toolName = getToolNameForPermissionCheck(tool.name)

  // 2. 检查分类器决策 (如果启用)
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    const classifierResult = await checkClassifierDecision(tool, input)
    if (classifierResult.behavior === 'allow') {
      return classifierResult
    }
  }

  // 3. 检查规则匹配
  const rule = matchPermissionRule(toolName, input)
  if (rule) {
    return applyRule(rule)
  }

  // 4. 检查沙箱设置
  if (shouldUseSandbox(toolName)) {
    return checkSandboxPermissions(toolName, input)
  }

  // 5. 返回询问结果
  return { behavior: 'ask', reason: 'no_matching_rule' }
}
```

### 文件系统权限

```typescript
// utils/permissions/filesystem.ts

// 危险文件
export const DANGEROUS_FILES = [
  '.gitconfig', '.gitmodules',
  '.bashrc', '.bash_profile', '.zshrc', '.zprofile', '.profile',
  '.ripgreprc', '.mcp.json', '.claude.json',
]

// 危险目录
export const DANGEROUS_DIRECTORIES = [
  '.git', '.vscode', '.idea', '.claude',
]

// 规范化路径比较 (大小写不敏感)
export function normalizeCaseForComparison(path: string): string {
  return path.toLowerCase()
}
```

---

## 一百二十四、Git 操作

### Git 根目录查找

```typescript
// utils/git.ts

const findGitRootImpl = memoizeWithLRU(
  (startPath: string): string | typeof GIT_ROOT_NOT_FOUND => {
    let current = resolve(startPath)
    const root = current.substring(0, current.indexOf(sep) + 1) || sep

    while (current !== root) {
      const gitPath = join(current, '.git')
      try {
        const stat = statSync(gitPath)
        if (stat.isDirectory() || stat.isFile()) {
          return current.normalize('NFC')
        }
      } catch {
        // 继续向上查找
      }
      current = dirname(current)
    }

    return GIT_ROOT_NOT_FOUND
  },
  path => path,
  50,  // LRU 缓存大小
)
```

### Git 缓存操作

```typescript
// utils/git/gitFilesystem.ts

// 获取缓存的 Git 信息
export function getCachedBranch(): string | null {
  const cache = gitInfoCache.get(getCwd())
  return cache?.branch ?? null
}

// 获取远程 URL
export function getCachedRemoteUrl(): string | null {
  const cache = gitInfoCache.get(getCwd())
  return cache?.remoteUrl ?? null
}

// Git 信息缓存
interface GitInfoCache {
  branch: string | null
  defaultBranch: string | null
  head: string | null
  remoteUrl: string | null
  isShallow: boolean
}
```

---

## 一百二十五、后台清理

### 清理任务

```typescript
// utils/backgroundHousekeeping.ts

export function startBackgroundHousekeeping(): void {
  // 初始化服务
  void initMagicDocs()
  void initSkillImprovement()
  void initExtractMemories()
  initAutoDream()

  // 自动更新市场插件
  void autoUpdateMarketplacesAndPluginsInBackground()

  // 注册协议
  if (feature('LODESTONE') && getIsInteractive()) {
    void ensureDeepLinkProtocolRegistered()
  }

  // 延迟执行慢操作
  setTimeout(runVerySlowOps, DELAY_VERY_SLOW_OPERATIONS).unref()
}

async function runVerySlowOps(): Promise<void> {
  // 如果用户最近有活动，延迟执行
  if (getIsInteractive() && getLastInteractionTime() > Date.now() - 60000) {
    setTimeout(runVerySlowOps, DELAY_VERY_SLOW_OPERATIONS).unref()
    return
  }

  await cleanupOldMessageFilesInBackground()
  await cleanupOldVersions()
}
```

### 清理配置

```typescript
// utils/cleanup.ts

const DEFAULT_CLEANUP_PERIOD_DAYS = 30

export function getCutoffDate(): Date {
  const settings = getSettings_DEPRECATED() || {}
  const cleanupPeriodDays =
    settings.cleanupPeriodDays ?? DEFAULT_CLEANUP_PERIOD_DAYS
  const cleanupPeriodMs = cleanupPeriodDays * 24 * 60 * 60 * 1000
  return new Date(Date.now() - cleanupPeriodMs)
}

// 清理过期文件
async function cleanupOldFilesInDirectory(
  dirPath: string,
  cutoffDate: Date,
): Promise<CleanupResult> {
  const files = await readdir(dirPath)
  const result: CleanupResult = { messages: 0, errors: 0 }

  for (const file of files) {
    const timestamp = convertFileNameToDate(file.name)
    if (timestamp < cutoffDate) {
      await unlink(join(dirPath, file.name))
      result.messages++
    }
  }

  return result
}
```

---

## 一百二十六、GrowthBook 特性标志

### GrowthBook 客户端

```typescript
// services/analytics/growthbook.ts

let client: GrowthBook | null = null

export function initGrowthBook(): void {
  client = new GrowthBook({
    apiHost: 'https://cdn.growthbook.io',
    clientKey: getGrowthBookClientKey(),
    enableDevMode: process.env.NODE_ENV === 'development',
  })

  // 设置用户属性
  client.setAttributes({
    id: getUserID(),
    sessionId: getSessionId(),
    platform: getPlatform(),
    userType: getUserType(),
  })

  // 加载特性
  client.loadFeatures()
}

// 获取特性值 (带缓存)
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  featureName: string,
  defaultValue: T,
): T {
  const cached = featureCache.get(featureName)
  if (cached !== undefined) {
    return cached as T
  }

  if (!client) {
    return defaultValue
  }

  const value = client.isOn(featureName)
  featureCache.set(featureName, value)
  return value ? defaultValue : defaultValue
}
```

### 事件日志

```typescript
// services/analytics/firstPartyEventLogger.ts

// 事件采样配置
export function getEventSamplingConfig(): EventSamplingConfig {
  return getDynamicConfig_CACHED_MAY_BE_STALE<EventSamplingConfig>(
    'tengu_event_sampling_config',
    {},
  )
}

// 采样判断
export function shouldSampleEvent(eventName: string): number | null {
  const config = getEventSamplingConfig()
  const eventConfig = config[eventName]

  if (!eventConfig) return null  // 100% 采样

  const sampleRate = eventConfig.sample_rate
  if (sampleRate <= 0) return 0   // 丢弃
  if (sampleRate >= 1) return null // 全部

  return sampleRate
}
```

---

## 一百二十七、重要设计模式

### 1. LRU 缓存

```typescript
// utils/memoizeWithLRU.ts

export function memoizeWithLRU<T extends (...args: any[]) => any>(
  fn: T,
  keyFn: (...args: Parameters<T>) => string,
  maxSize: number,
): T {
  const cache = new Map<string, { result: ReturnType<T>; key: string }>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args)

    if (cache.has(key)) {
      const entry = cache.get(key)!
      // 移动到末尾 (最近使用)
      cache.delete(key)
      cache.set(key, entry)
      return entry.result
    }

    const result = fn(...args)
    cache.set(key, { result, key })

    // 淘汰最旧的
    if (cache.size > maxSize) {
      const oldest = cache.keys().next().value
      cache.delete(oldest)
    }

    return result
  }) as T
}
```

### 2. 后台任务延迟

```typescript
// 延迟慢操作，避免影响用户体验
function delaySlowOperations(
  fn: () => Promise<void>,
  delayMs: number,
): void {
  setTimeout(async () => {
    // 如果用户最近有活动，再次延迟
    if (getIsInteractive() && getLastInteractionTime() > Date.now() - 60000) {
      setTimeout(fn, delayMs).unref()
      return
    }

    await fn()
  }, delayMs).unref()  // .unref() 不阻止进程退出
}
```

### 3. 特性标志懒加载

```typescript
// 懒加载特性模块
const extractMemoriesModule = feature('EXTRACT_MEMORIES')
  ? require('../services/extractMemories/extractMemories.js')
  : null

// 使用
if (extractMemoriesModule) {
  extractMemoriesModule.initExtractMemories()
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **协调器** | `coordinator/coordinatorMode.ts` | 多 Agent 协调 |
| **权限检查** | `utils/permissions/permissions.ts` | 权限验证 |
| **危险模式** | `utils/permissions/dangerousPatterns.ts` | 危险命令 |
| **文件系统** | `utils/permissions/filesystem.ts` | 文件权限 |
| **Git 操作** | `utils/git.ts` | Git 根目录查找 |
| **Git 缓存** | `utils/git/gitFilesystem.ts` | Git 信息缓存 |
| **后台清理** | `utils/backgroundHousekeeping.ts` | 后台任务 |
| **清理工具** | `utils/cleanup.ts` | 过期文件清理 |
| **GrowthBook** | `services/analytics/growthbook.ts` | 特性标志 |
| **事件日志** | `services/analytics/firstPartyEventLogger.ts` | 事件采样 |