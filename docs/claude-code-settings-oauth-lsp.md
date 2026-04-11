# Claude Code 源码深度学习笔记 (第三十八部分)

> SettingsSync·OAuth·LSP·Bash安全·FileEdit·VSCode集成

---

## 二百三十六、Settings Sync 服务

### 跨环境设置同步

```typescript
// services/settingsSync/index.ts

/**
 * 在不同 Claude Code 环境间同步用户设置和记忆文件
 *
 * - 交互式 CLI: 上传本地设置到远程 (增量，仅上传变更条目)
 * - CCR: 在插件安装前下载远程设置到本地
 */

// 同步超时
const SETTINGS_SYNC_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RETRIES = 3
const MAX_FILE_SIZE_BYTES = 500 * 1024  // 500 KB

// 上传用户设置 (交互式 CLI)
export async function uploadUserSettingsInBackground(): Promise<void> {
  if (!feature('UPLOAD_USER_SETTINGS')) return
  if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_enable_settings_sync_push', false)) return
  if (!getIsInteractive()) return
  if (!isUsingOAuth()) return

  // 获取本地设置变更
  const result = await fetchUserSettings()
  if (!result.success) return

  // 增量上传
  const localChanges = await getChangedSettingsSince(result.lastSync)
  await uploadSettingsIncremental(localChanges)
}

// 下载用户设置 (CCR)
export async function downloadUserSettingsInBackground(): Promise<void> {
  if (!feature('DOWNLOAD_USER_SETTINGS')) return

  // 获取远程设置
  const remoteSettings = await fetchUserSettings()
  if (!remoteSettings.success) return

  // 合并到本地
  await mergeRemoteSettings(remoteSettings.data)
}
```

---

## 二百三十七、OAuth 服务

### PKCE 授权码流程

```typescript
// services/oauth/index.ts

/**
 * OAuth 2.0 授权码流程 + PKCE
 *
 * 支持两种获取授权码方式:
 * 1. 自动: 打开浏览器，重定向到 localhost 捕获代码
 * 2. 手动: 用户手动复制粘贴代码 (用于无浏览器环境)
 */

export class OAuthService {
  private codeVerifier: string
  private authCodeListener: AuthCodeListener | null = null
  private port: number | null = null

  constructor() {
    this.codeVerifier = crypto.generateCodeVerifier()
  }

  async startOAuthFlow(
    authURLHandler: (url: string, automaticUrl?: string) => Promise<void>,
    options?: {
      loginWithClaudeAi?: boolean
      inferenceOnly?: boolean
      orgUUID?: string
      loginHint?: string
      skipBrowserOpen?: boolean  // SDK 模式
    },
  ): Promise<OAuthTokens> {
    // 启动本地回调监听器
    this.authCodeListener = new AuthCodeListener()
    this.port = await this.authCodeListener.start()

    // 生成 PKCE 值
    const codeChallenge = crypto.generateCodeChallenge(this.codeVerifier)
    const state = crypto.generateState()

    // 构建认证 URL
    const manualFlowUrl = client.buildAuthUrl({ codeChallenge, state, isManual: true })
    const automaticFlowUrl = client.buildAuthUrl({ codeChallenge, state, isManual: false })

    // 等待授权码
    return await this.waitForAuthorizationCode(state, async () => {
      await authURLHandler(manualFlowUrl, automaticFlowUrl)
    })
  }
}
```

---

## 二百三十八、Auth Code 监听器

### 本地 OAuth 回调

```typescript
// services/oauth/auth-code-listener.ts

/**
 * 临时 localhost HTTP 服务器，监听 OAuth 授权码重定向
 *
 * 用户在浏览器授权后，OAuth 提供商重定向到:
 * http://localhost:[port]/callback?code=AUTH_CODE&state=STATE
 */

export class AuthCodeListener {
  private localServer: Server
  private port: number = 0
  private expectedState: string | null = null  // CSRF 保护

  async start(port?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.localServer.listen(port ?? 0, 'localhost', () => {
        const address = this.localServer.address() as AddressInfo
        this.port = address.port
        resolve(this.port)
      })
    })
  }

  async waitForAuthorization(
    state: string,
    onReady: () => Promise<void>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.expectedState = state
      this.promiseResolver = resolve
      this.promiseRejecter = reject

      // 处理回调请求
      this.localServer.on('request', (req, res) => {
        const url = new URL(req.url, `http://localhost:${this.port}`)

        if (url.pathname === this.callbackPath) {
          const code = url.searchParams.get('code')
          const returnedState = url.searchParams.get('state')

          // 验证 state (CSRF 保护)
          if (returnedState !== this.expectedState) {
            reject(new Error('OAuth state mismatch'))
            return
          }

          // 重定向到成功页面
          res.writeHead(302, { Location: '/success' })
          res.end()

          resolve(code!)
        }
      })
    })
  }
}
```

---

## 二百三十九、LSP 客户端

### 语言服务器协议

```typescript
// services/lsp/LSPClient.ts

/**
 * LSP 客户端封装，使用 vscode-jsonrpc
 * 通过 stdio 与 LSP 服务器进程通信
 */

export type LSPClient = {
  readonly capabilities: ServerCapabilities | undefined
  readonly isInitialized: boolean
  start: (command: string, args: string[], options?: { env?, cwd? }) => Promise<void>
  initialize: (params: InitializeParams) => Promise<InitializeResult>
  sendRequest: <TResult>(method: string, params: unknown) => Promise<TResult>
  sendNotification: (method: string, params: unknown) => Promise<void>
  onNotification: (method: string, handler: (params: unknown) => void) => void
  stop: () => Promise<void>
}

export function createLSPClient(
  serverName: string,
  onCrash?: (error: Error) => void,
): LSPClient {
  let process: ChildProcess | undefined
  let connection: MessageConnection | undefined
  let capabilities: ServerCapabilities | undefined
  let isInitialized = false

  return {
    async start(command, args, options) {
      // 启动 LSP 服务器进程
      process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...options?.env },
        cwd: options?.cwd,
      })

      // 创建 JSON-RPC 连接
      const reader = new StreamMessageReader(process.stdout)
      const writer = new StreamMessageWriter(process.stdin)
      connection = createMessageConnection(reader, writer)

      // 设置错误处理
      connection.onError(/* ... */)
      connection.onClose(() => {
        if (!isStopping) {
          onCrash?.(new Error('LSP server crashed'))
        }
      })
    },

    async initialize(params): Promise<InitializeResult> {
      const result = await connection.sendRequest('initialize', params)
      capabilities = result.capabilities
      isInitialized = true
      connection.sendNotification('initialized', {})
      return result
    },

    async sendRequest<TResult>(method, params): Promise<TResult> {
      return await connection.sendRequest(method, params)
    },

    async stop(): Promise<void> {
      isStopping = true
      connection?.sendNotification('shutdown', {})
      connection?.end()
      process?.kill()
    },
  }
}
```

---

## 二百四十、Bash 安全

### 危险命令检测

```typescript
// tools/BashTool/bashSecurity.ts

// 命令替换模式
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /=\(/, message: 'Zsh process substitution =()' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\$\{/, message: '${} parameter substitution' },
  { pattern: /\$\[/, message: '$[] legacy arithmetic expansion' },
]

// Zsh 危险命令
const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload',    // 加载危险模块
  'emulate',     // eval 等价
  'sysopen',     // 文件访问 (zsh/system)
  'syswrite',    // 文件写入 (zsh/system)
  'zpty',        // 伪终端执行 (zsh/zpty)
  'ztcp',        // TCP 连接 (zsh/net/tcp)
  'zf_rm',       // 内置 rm (zsh/files)
])

// Bash 安全检查
const BASH_SECURITY_CHECK_IDS = {
  INCOMPLETE_COMMANDS: 1,
  JQ_SYSTEM_FUNCTION: 2,
  JQ_FILE_ARGUMENTS: 3,
  PROCESS_SUBSTITUTION: 4,
  COMMAND_SUBSTITUTION: 5,
}

// 验证危险模式
export function validateDangerousPatterns(
  command: string,
): PermissionResult {
  // 检查 process substitution
  if (COMMAND_SUBSTITUTION_PATTERNS.some(p => p.pattern.test(command))) {
    return { allowed: false, reason: 'Process substitution not allowed' }
  }

  // 检查 Zsh 危险命令
  const baseCommand = extractBaseCommand(command)
  if (ZSH_DANGEROUS_COMMANDS.has(baseCommand)) {
    return { allowed: false, reason: `Zsh command '${baseCommand}' not allowed` }
  }

  // 检查 jq --slurpfile 等文件参数
  if (/jq.*--slurpfile/.test(command)) {
    return { allowed: false, reason: 'jq file arguments not allowed' }
  }

  return { allowed: true }
}
```

---

## 二百四十一、FileEdit 工具

### 智能文件编辑

```typescript
// tools/FileEditTool/FileEditTool.ts

/**
 * 文件编辑工具 - 支持:
 * - 搜索替换编辑
 * - 行号编辑
 * - heredoc 写入
 * - 创建新文件
 */

// 文件编辑输入 schema
const inputSchema = z.object({
  // 编辑类型
  edit_type: z.enum(['search_replace', 'line_number', 'create', 'insert']),

  // 搜索替换
  old_string: z.string().describe('Text to search for').optional(),
  new_string: z.string().describe('Replacement text').optional(),

  // 行号编辑
  line_number: z.number().optional(),
  insert_after_line: z.number().optional(),

  // 文件路径
  file_path: z.string().describe('Path to file'),
})

// 执行文件编辑
export async function executeFileEdit(
  input: FileEditInput,
  context: ToolUseContext,
): Promise<FileEditOutput> {
  // 1. 验证路径
  const validatedPath = await validatePath(input.file_path)

  // 2. 检查文件是否存在
  const fileExists = await pathExists(validatedPath)

  if (input.edit_type === 'create') {
    // 创建新文件
    if (fileExists) {
      throw new Error(`File already exists: ${validatedPath}`)
    }
    await writeTextContent(validatedPath, input.new_string)
  } else {
    // 编辑现有文件
    if (!fileExists) {
      throw new Error(`File not found: ${validatedPath}`)
    }

    // 读取文件
    const { content, metadata } = await readFileSyncWithMetadata(validatedPath)

    // 执行编辑
    const newContent = applyEdit(content, input)

    // 写入文件
    await writeTextContent(validatedPath, newContent)
  }

  // 3. 通知 LSP 服务器
  notifyVscodeFileUpdated(validatedPath)

  // 4. 清除诊断缓存
  clearDeliveredDiagnosticsForFile(validatedPath)

  // 5. 跟踪文件历史
  fileHistoryTrackEdit(validatedPath)

  return {
    success: true,
    path: validatedPath,
    diff: computeDiff(content, newContent),
  }
}

// 应用编辑
function applyEdit(content: string, input: FileEditInput): string {
  switch (input.edit_type) {
    case 'search_replace':
      return content.replace(input.old_string, input.new_string)
    case 'line_number':
      return applyLineNumberEdit(content, input)
    case 'insert':
      return applyInsertEdit(content, input)
    default:
      throw new Error(`Unknown edit type: ${input.edit_type}`)
  }
}
```

---

## 二百四十二、VSCode SDK MCP

### VSCode 集成

```typescript
// services/mcp/vscodeSdkMcp.ts

/**
 * VSCode SDK MCP 集成
 * 允许 Claude Code 与 VSCode 插件通信
 */

// 通知 VSCode 文件已更新
export function notifyVscodeFileUpdated(filePath: string): void {
  // 发送 MCP 通知到 VSCode
  sendMcpNotification('vscode/fileUpdated', { path: filePath })
}

// 获取 VSCode 选择
export async function getVscodeSelection(): Promise<TextSelection | null> {
  const response = await sendMcpRequest('vscode/getSelection', {})
  return response.selection
}

// 获取 VSCode 活动编辑器
export async function getVscodeActiveEditor(): Promise<EditorInfo | null> {
  const response = await sendMcpRequest('vscode/getActiveEditor', {})
  return response.editor
}
```

---

## 架构总结

| 模块 | 核心文件 | 职责 |
|------|----------|------|
| **Settings Sync** | `services/settingsSync/` | 跨环境设置同步 |
| **OAuth** | `services/oauth/` | OAuth 2.0 + PKCE |
| **Auth Listener** | `services/oauth/auth-code-listener.ts` | 本地回调监听 |
| **LSP Client** | `services/lsp/LSPClient.ts` | 语言服务器协议 |
| **Bash Security** | `tools/BashTool/bashSecurity.ts` | 危险命令检测 |
| **FileEdit** | `tools/FileEditTool/` | 智能文件编辑 |
| **VSCode MCP** | `services/mcp/vscodeSdkMcp.ts` | VSCode 集成 |