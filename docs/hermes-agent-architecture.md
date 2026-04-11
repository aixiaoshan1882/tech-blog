# Hermes Agent 源码架构详解

> Hermes Agent — 开源 AI Agent 框架，支持多模型、多工具、自主规划

---

## 一、项目概览

Hermes Agent 是一个生产级的 AI Agent 框架，代码规模约 **50万行 Python**，支持：
- **多模型**：OpenRouter、OpenAI、Anthropic、本地 Ollama 等
- **多工具**：Terminal、Browser、File、Memory、MCPTool、MCPServer 等
- **多平台**：CLI、Gateway（HTTP API）、Telegram、Discord 等
- **高级特性**：子 Agent、轨迹压缩、上下文管理、渐进式推理、凭证池等

### 核心入口文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `run_agent.py` | ~9,700 | **AIAgent 主类**，对话循环、工具执行、API 调用 |
| `cli.py` | ~8,500 | CLI 入口，命令解析，交互式 TUI |
| `gateway/` | 多文件 | HTTP API 服务，支持 WebSocket |
| `batch_runner.py` | ~1,100 | 批量任务运行器 |
| `model_tools.py` | ~600 | 工具定义注册与调用分发 |

---

## 二、核心类：`AIAgent`

位于 `run_agent.py`，是整个框架的心脏。

### 2.1 初始化关键参数

```python
class AIAgent:
    def __init__(
        self,
        base_url: str = None,        # API 端点
        api_key: str = None,         # API 密钥
        model: str = "anthropic/claude-opus-4.6",  # 默认模型
        max_iterations: int = 90,    # 最大迭代次数
        tool_delay: float = 1.0,     # 工具调用延迟
        enabled_toolsets: List[str] = None,  # 启用的工具集
        disabled_toolsets: List[str] = None, # 禁用的工具集
        api_mode: str = "chat_completions",   # API 模式
        # ... 更多参数
    )
```

### 2.2 API 模式支持

```python
# 三种 API 模式自动检测：
if api_mode == "chat_completions":
    # OpenAI / OpenRouter 兼容
elif api_mode == "codex_responses":
    # OpenAI Codex Responses API
elif api_mode == "anthropic_messages":
    # Anthropic Messages API (原生 / 第三方兼容)
```

### 2.3 对话循环核心逻辑

```python
def run_conversation(self, user_message, system_message=None, conversation_history=None):
    messages = list(conversation_history) if conversation_history else []
    messages.append({"role": "user", "content": user_message})
    
    while True:
        # 1. 构建 API 消息
        api_messages = self._build_api_messages(messages)
        
        # 2. 调用 LLM
        response = self._interruptible_streaming_api_call(api_kwargs)
        
        # 3. 处理响应
        if response.tool_calls:
            # 执行工具
            results = self._execute_tool_calls(response.tool_calls)
            messages.append(response)
            messages.extend(results)
        else:
            # 结束
            return response
```

---

## 三、工具系统

### 3.1 工具注册与分发

`model_tools.py` 是工具系统的核心：

```python
# 工具定义注册表
TOOL_DEFINITIONS = {
    "terminal": {...},      # 执行 shell 命令
    "read_file": {...},     # 读取文件
    "write_file": {...},    # 写入文件
    "browser_tool": {...},  # 浏览器控制
    "memory": {...},        # 记忆存储
    "delegate": {...},      # 子 Agent 委托
    # ... 50+ 工具
}

def handle_function_call(tool_name, arguments, context):
    """工具调用分发器"""
    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(f"Unknown tool: {tool_name}")
    return TOOL_DEFINITIONS[tool_name]["handler"](arguments, context)
```

### 3.2 核心工具一览

| 工具 | 文件 | 功能 |
|------|------|------|
| `terminal_tool` | `tools/terminal_tool.py` | Shell 命令执行、环境管理 |
| `file_tools` | `tools/file_tools.py` | 文件读写、搜索、打补丁 |
| `browser_tool` | `tools/browser_tool.py` | 浏览器自动化控制 |
| `memory_tool` | `tools/memory_tool.py` | 持久化记忆 (MEMORY.md) |
| `delegate_tool` | `tools/delegate_tool.py` | 子 Agent 委托 |
| `mcp_tool` | `tools/mcp_tool.py` | MCP (Model Context Protocol) 工具 |
| `skills_tool` | `tools/skills_tool.py` | Agent Skills 管理 |
| `session_search` | `tools/session_search_tool.py` | 历史会话搜索 |
| `vision_tools` | `tools/vision_tools.py` | 图片分析 |
| `web_tools` | `tools/web_tools.py` | 网页搜索/抓取 |

### 3.3 工具并发控制

```python
# 工具分类 - 确定哪些可以并行
_PARALLEL_SAFE_TOOLS = frozenset({
    "ha_get_state", "ha_list_entities", "read_file",
    "search_files", "session_search", "skill_view", ...
})

_PATH_SCOPED_TOOLS = frozenset({"read_file", "write_file", "patch"})

_NEVER_PARALLEL_TOOLS = frozenset({"clarify"})  # 交互式工具必须串行

# 破坏性命令检测
_DESTRUCTIVE_PATTERNS = re.compile(
    r"""(?:^|\s|&&|\|\||;|`)(?:
        rm\s|rmdir\s|mv\s|sed\s+-i|
        dd\s|shred\s|git\s+(?:reset|clean|checkout)\s
    )""", re.VERBOSE)
```

---

## 四、上下文管理

### 4.1 上下文压缩器

`agent/context_compressor.py` — 当对话接近模型上下文窗口时自动压缩：

```python
class ContextCompressor:
    def __init__(
        self,
        model: str,
        threshold_percent: float = 0.50,  # 50% 时触发
        protect_first_n: int = 3,         # 保护前N条消息
        protect_last_n: int = 20,         # 保护后N条消息
        summary_target_ratio: float = 0.20,  # 压缩到20%
    )
    
    def compress(self, messages, system_prompt):
        # 1. 保留首尾消息
        # 2. 对中间消息生成摘要
        # 3. 返回压缩后的消息列表
```

### 4.2 Anthropic Prompt Caching

当通过 OpenRouter 使用 Claude 模型时，自动启用提示缓存：

```python
# 自动检测并应用缓存
if self._use_prompt_caching:
    api_messages = apply_anthropic_cache_control(
        api_messages, 
        cache_ttl="5m",  # 5分钟 TTL
        native_anthropic=(self.api_mode == 'anthropic_messages')
    )
```

---

## 五、子 Agent 委托

`delegate_tool.py` — 支持创建子 Agent 处理复杂任务：

```python
def delegate_task(agent, task, mode="once"):
    """委托任务给子 Agent
    
    mode:
    - "once": 单次执行
    - "session": 持续会话
    - "background": 后台执行
    """
    sub_agent = AIAgent(
        base_url=agent.base_url,
        model=agent.fallback_model or agent.model,
        tools=agent.tools,  # 继承父 Agent 工具
    )
    result = sub_agent.run_conversation(task)
    return result
```

---

## 六、记忆系统

### 6.1 多层记忆架构

```
┌─────────────────────────────────────────────┐
│  Memory Provider (插件式)                    │
│  - 内置: MEMORY.md / USER.md                 │
│  - 外部: Honcho, 数据库等                     │
├─────────────────────────────────────────────┤
│  MemoryManager (agent/memory_manager.py)     │
│  - 多 provider 管理                          │
│  - 统一工具 schema 注入                       │
├─────────────────────────────────────────────┤
│  Session DB (SQLite)                        │
│  - 短期会话记忆                              │
│  - /session_search 搜索                      │
└─────────────────────────────────────────────┘
```

### 6.2 记忆触发机制

```python
# 每隔 N 轮提醒模型回顾重要信息
self._memory_nudge_interval = 10  # 配置
self._turns_since_memory += 1
if self._turns_since_memory >= self._memory_nudge_interval:
    # 在系统提示中注入记忆提醒
```

---

## 七、模型路由与容错

### 7.1 多模型支持

`agent/model_metadata.py` — 模型元数据获取与缓存：

```python
def fetch_model_metadata():
    """从 OpenRouter API 获取模型信息（价格、上下文长度等）"""
    
def estimate_tokens_rough(text: str) -> int:
    """粗略估算 token 数量"""
    
def is_local_endpoint(url: str) -> bool:
    """检测是否本地模型（Ollama 等）"""
```

### 7.2 错误分类与重试

`agent/error_classifier.py` — API 错误自动分类：

```python
class FailoverReason(Enum):
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    AUTH_ERROR = "auth_error"
    CONTEXT_OVERFLOW = "context_overflow"
    MODEL_UNAVAILABLE = "model_unavailable"
    NETWORK_ERROR = "network_error"

def classify_api_error(error) -> Tuple[FailoverReason, str]:
    """分类错误并返回处理建议"""
```

### 7.3 凭证池

`agent/credential_pool.py` — 支持多个 API 密钥轮换：

```python
class CredentialPool:
    """多凭证管理，用于绕过单 Provider 限流"""
    def __init__(self, credentials: List[Dict]):
        self._credentials = credentials
        self._current_index = 0
        
    def get_next(self) -> str:
        """获取下一个可用凭证"""
```

---

## 八、CLI 与网关

### 8.1 CLI 架构

`cli.py` — 交互式命令行界面：

```python
# 命令结构
hermes                    # 交互模式
hermes --chat "问题"      # 单次对话
hermes --batch tasks.txt  # 批量任务
hermes --gateway         # 启动 HTTP 网关
```

关键组件：
- `curses_ui.py` — 终端 TUI 界面
- `auth.py` — API 密钥认证
- `config.py` — YAML 配置管理

### 8.2 Gateway HTTP API

`gateway/` — REST API 服务：

```
POST /v1/chat/completions   # 聊天接口
POST /v1/agents/run         # 运行 Agent
GET  /v1/sessions/{id}     # 获取会话
WebSocket /ws              # 流式响应
```

---

## 九、高级特性

### 9.1 渐进式推理 (Thinking)

```python
# 支持 OpenRouter 的 thinking 扩展
reasoning_config = {
    "enabled": True,
    "effort": "medium",    # low/medium/high
    "max_tokens": 5000,
}

# 推理内容通过 response.reasoning_content 返回
```

### 9.2 轨迹保存

`agent/trajectory.py` — 将对话轨迹保存为 JSONL：

```python
def save_trajectory(messages, session_id, metadata):
    """保存完整轨迹用于分析和训练"""
    path = f"trajectories/{session_id}.jsonl"
    with open(path, 'a') as f:
        f.write(json.dumps({"messages": messages, **metadata}))
```

### 9.3 批次运行器

`batch_runner.py` — 并行执行多个任务：

```python
# 配置示例
tasks = [
    {"input": "任务1", "expected": "输出1"},
    {"input": "任务2", "expected": "输出2"},
]

runner = BatchRunner(max_workers=4)
results = runner.run(tasks)
```

### 9.4 VCR / 影子模式

支持录制和回放工具调用，用于：
- 测试
- 离线运行
- 成本节省

---

## 十、插件系统

`plugins/` — 扩展框架功能：

```python
# 插件结构
plugins/
  memory/           # 记忆 provider
    honcho/
  browser/          # 浏览器 provider
  tools/            # 额外工具
```

### 钩子接口

```python
# 支持的生命周期钩子
on_session_start    # 会话开始
on_session_end      # 会话结束
pre_llm_call        # LLM 调用前
post_llm_call       # LLM 调用后
pre_tool_call       # 工具调用前
```

---

## 十一、安全机制

### 11.1 路径验证

```python
# 防止路径遍历攻击
def validate_path(path: str, allowed_dirs: List[str]) -> bool:
    resolved = Path(path).resolve()
    for allowed in allowed_dirs:
        if resolved.is_relative_to(Path(allowed)):
            return True
    return False
```

### 11.2 破坏性命令检测

```python
# 执行危险命令前要求确认
if _is_destructive_command(cmd):
    await request_approval(f"执行破坏性命令: {cmd}")
```

### 11.3 URL 安全

`tools/url_safety.py` — 检测恶意 URL

---

## 十二、关键设计模式

### 12.1 生产者-消费者

```
┌─────────────┐    消息队列    ┌─────────────┐
│   LLM API   │ ───────────▶  │  工具执行   │
│  (流式响应)  │               │   线程池    │
└─────────────┘               └─────────────┘
```

### 12.2 状态机

对话循环是一个状态机：

```
IDLE → RUNNING → TOOL_CALL → WAITING → RUNNING → ...
                                      ↓
                                  COMPLETE
```

### 12.3 策略模式

工具执行策略：
- 串行：破坏性工具
- 并行：读操作、独立路径
- 混合：智能选择

---

## 十三、文件结构总览

```
hermes-agent-main/
├── run_agent.py          # AIAgent 核心 (~9700 行)
├── cli.py                # CLI 入口 (~8500 行)
├── model_tools.py        # 工具系统
├── toolsets.py           # 工具集定义
│
├── tools/                # 50+ 工具实现
│   ├── terminal_tool.py
│   ├── browser_tool.py
│   ├── file_tools.py
│   ├── memory_tool.py
│   ├── delegate_tool.py
│   ├── mcp_tool.py
│   └── ...
│
├── agent/                # Agent 核心模块
│   ├── context_compressor.py
│   ├── model_metadata.py
│   ├── error_classifier.py
│   ├── prompt_builder.py
│   ├── trajectory.py
│   ├── usage_pricing.py
│   └── ...
│
├── hermes_cli/           # CLI 子系统
│   ├── config.py
│   ├── auth.py
│   ├── gateway.py
│   └── ...
│
├── gateway/              # HTTP API
├── batch_runner.py       # 批量运行
├── trajectory_compressor.py
└── plugins/              # 插件系统
```

---

## 十四、配置系统

`cli-config.yaml.example` — YAML 配置文件：

```yaml
model:
  name: anthropic/claude-sonnet-4
  max_tokens: 8192
  
memory:
  memory_enabled: true
  memory_char_limit: 2200
  nudge_interval: 10
  
compression:
  enabled: true
  threshold: 0.50
  protect_last_n: 20

providers:
  openrouter:
    api_key: ${OPENROUTER_API_KEY}
```

---

## 十五、与 Claude Code 的架构对比

| 维度 | Claude Code | Hermes Agent |
|------|-------------|--------------|
| 语言 | TypeScript | Python |
| 规模 | ~800K 行 | ~500K 行 |
| 主要场景 | 编码助手 | 通用 Agent |
| 工具系统 | 内置 | 插件化 |
| API 模式 | Anthropic 原生 | 多模式支持 |
| 子 Agent | 基本 | 完整支持 |
| 记忆 | 简单文件 | 多层架构 |

---

## 总结

Hermes Agent 是一个**生产级别的开源 AI Agent 框架**，核心特点：

1. **模块化设计**：清晰的层次结构，易于扩展
2. **多模型支持**：统一的抽象层支持多种 API
3. **强大的工具系统**：50+ 内置工具，支持 MCP
4. **智能上下文管理**：自动压缩、提示缓存
5. **容错与恢复**：完善的错误分类、重试、备用方案
6. **丰富的平台支持**：CLI、HTTP Gateway、多消息平台

这个框架展示了构建企业级 Agent 系统所需的所有关键设计模式。
