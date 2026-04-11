# Hermes Agent 模块详解

---

## 一、Skills 技能系统

### 1.1 概述

Hermes Agent 的 Skills 是一种结构化的任务指南格式，存储在 `skills/` 目录下。每个 Skill 是一个 Markdown 文件，定义：

- **触发条件**：何时使用该技能
- **执行步骤**：详细的操作指南
- **代码模板**：可复用的代码示例
- **最佳实践**：行业标准方法论

### 1.2 技能分类

```
skills/
├── software-development/     # 软件开发
│   ├── writing-plans/       # 编写实现计划
│   ├── test-driven-development/
│   ├── systematic-debugging/
│   └── subagent-driven-development/
├── data-science/            # 数据科学
├── devops/                  # 运维
├── github/                  # GitHub 集成
├── autonomous-ai-agents/    # AI Agent 设计
└── ...（30+ 分类）
```

### 1.3 Skill 格式

```markdown
---
name: skill-name
description: Use when you need to do X
version: 1.0.0
author: Hermes Agent
---

# Title

## Overview
简介

## When to Use
触发条件

## Step-by-Step
1. 步骤一
2. 步骤二

## Examples
代码示例
```

### 1.4 技能管理

`tools/skills_tool.py` 和 `tools/skill_manager_tool.py` 管理技能：

```python
class SkillManager:
    def list_skills(self) -> List[Skill]:
        """列出所有可用技能"""
        
    def get_skill(self, name: str) -> Skill:
        """获取指定技能"""
        
    def sync_skills(self):
        """从远程同步技能"""
        
    def create_skill(self, skill_data: Dict):
        """创建新技能"""
```

---

## 二、Gateway HTTP API

### 2.1 核心模块

```
gateway/
├── run.py              # 主入口
├── config.py          # 网关配置
├── session.py         # 会话管理
├── delivery.py        # 消息投递
├── stream_consumer.py # 流式响应
├── hooks.py           # 生命周期钩子
├── pairing.py         # 设备配对
├── mirror.py          # 镜像模式
├── status.py          # 状态管理
├── platforms/         # 平台适配器
│   ├── telegram.py
│   ├── discord.py
│   └── ...
└── builtin_hooks/     # 内置钩子
```

### 2.2 核心端点

```python
# REST API
POST /v1/chat/completions      # 聊天完成
POST /v1/agents/run             # 运行 Agent
GET  /v1/sessions/{id}         # 获取会话
GET  /v1/sessions/{id}/history # 会话历史
DELETE /v1/sessions/{id}       # 删除会话

# WebSocket
WS  /ws                         # 流式响应
```

### 2.3 会话管理

```python
class Session:
    def __init__(self, session_id: str, agent: AIAgent):
        self.session_id = session_id
        self.agent = agent
        self.messages = []
        self.metadata = {}
        
    def add_message(self, role: str, content: str):
        """添加消息到会话"""
        
    def get_history(self) -> List[Dict]:
        """获取会话历史"""
        
    def clear(self):
        """清空会话"""
```

---

## 三、Cron 定时任务

### 3.1 模块结构

```
cron/
├── scheduler.py    # 调度器
└── jobs.py         # 作业定义
```

### 3.2 调度器

```python
class CronScheduler:
    def __init__(self, agent: AIAgent):
        self.agent = agent
        self.jobs = []
        
    def add_job(self, schedule: str, task: str, **kwargs):
        """添加定时任务
        
        schedule: cron 表达式
        task: 要执行的任务描述
        """
        
    def start(self):
        """启动调度器"""
        
    def stop(self):
        """停止调度器"""
```

### 3.3 使用示例

```python
scheduler = CronScheduler(agent)

# 每天早上 9 点发送摘要
scheduler.add_job(
    schedule="0 9 * * *",
    task="总结昨天的工作并发送摘要"
)

# 每小时检查一次
scheduler.add_job(
    schedule="0 * * * *",
    task="检查是否有紧急事项"
)

scheduler.start()
```

---

## 四、Batch Runner 批量运行

### 4.1 概述

`batch_runner.py` — 并行执行大量任务的批处理系统。

### 4.2 核心功能

```python
# 关键参数
--dataset_file       # 输入数据集 (JSONL)
--batch_size         # 每批大小
--run_name           # 运行名称
--resume             # 恢复中断的运行
--distribution       # 工具集分布
--max_workers        # 最大并行数
```

### 4.3 数据格式

```jsonl
{"input": "任务描述1", "expected": "期望输出1"}
{"input": "任务描述2", "expected": "期望输出2"}
```

### 4.4 轨迹保存

```python
# 保存格式
{
    "from": "user input",
    "value": "agent response",
    "trajectory": [...],  # 完整对话轨迹
    "tool_stats": {...},  # 工具使用统计
    "metadata": {...}     # 元数据
}
```

---

## 五、Agent 子模块详解

### 5.1 ContextCompressor 上下文压缩

```python
agent/context_compressor.py

class ContextCompressor:
    def compress(self, messages, system_prompt):
        """
        压缩策略：
        1. 保留前3条消息（系统、初始用户等）
        2. 保留最后20条消息
        3. 对中间消息生成摘要
        """
        
    def estimate_tokens(self, messages):
        """估算 token 数量"""
        
    def should_compress(self, messages) -> bool:
        """判断是否需要压缩"""
```

### 5.2 ModelMetadata 模型元数据

```python
agent/model_metadata.py

# 从 OpenRouter API 获取模型信息
MODEL_METADATA_CACHE = {}  # 1小时缓存

def fetch_model_metadata(model: str, base_url: str) -> Dict:
    """获取模型元数据（价格、上下文长度等）"""
    
def estimate_tokens_rough(text: str) -> int:
    """粗略估算 token"""
    
def parse_context_limit_from_error(error) -> Optional[int]:
    """从错误信息解析上下文限制"""
```

### 5.3 ErrorClassifier 错误分类

```python
agent/error_classifier.py

class FailoverReason(Enum):
    RATE_LIMIT         # 限流
    TIMEOUT            # 超时
    AUTH_ERROR         # 认证错误
    CONTEXT_OVERFLOW   # 上下文溢出
    MODEL_UNAVAILABLE  # 模型不可用
    NETWORK_ERROR      # 网络错误

def classify_api_error(error) -> Tuple[FailoverReason, str]:
    """分类 API 错误"""
```

### 5.4 Trajectory 轨迹管理

```python
agent/trajectory.py

def save_trajectory(messages, session_id, metadata):
    """保存轨迹到 JSONL"""
    
def load_trajectory(session_id):
    """加载轨迹"""
    
def compress_trajectory(trajectory):
    """压缩轨迹（用于训练数据）"""
```

### 5.5 PromptBuilder 提示构建

```python
agent/prompt_builder.py

# 系统提示模板
DEFAULT_AGENT_IDENTITY = """你是 Hermes，一个有用的 AI 助手。"""

# 构建系统提示
def build_system_prompt(
    user_profile: Dict = None,
    memory_context: str = None,
    skills: List[str] = None,
) -> str:
    """构建完整的系统提示"""
```

### 5.6 UsagePricing 用量计价

```python
agent/usage_pricing.py

def estimate_usage_cost(model, usage, provider, base_url, api_key):
    """估算 API 使用成本"""
    
# 支持的模型定价
MODELS_PRICING = {
    "claude-opus-4": {"input": 15, "output": 75},  # $/M tokens
    "gpt-4o": {"input": 5, "output": 15},
    # ...
}
```

---

## 六、工具详解

### 6.1 TerminalTool 终端工具

```python
tools/terminal_tool.py

class TerminalTool:
    def execute(self, command: str, timeout: int = 30) -> ToolResult:
        """执行 shell 命令"""
        
    def get_env(self) -> Dict[str, str]:
        """获取当前环境变量"""
        
    def cleanup(self):
        """清理环境资源"""
```

### 6.2 BrowserTool 浏览器工具

```python
tools/browser_tool.py

class BrowserTool:
    def navigate(self, url: str):
        """导航到 URL"""
        
    def screenshot(self) -> bytes:
        """截图"""
        
    def click(self, selector: str):
        """点击元素"""
        
    def type(self, selector: str, text: str):
        """输入文本"""
```

### 6.3 FileTools 文件工具

```python
tools/file_tools.py

# 工具定义
FILE_TOOL_DEFINITIONS = {
    "read_file": {
        "description": "读取文件内容",
        "parameters": {
            "path": {"type": "string", "required": True},
            "offset": {"type": "integer", "default": 0},
            "limit": {"type": "integer", "default": None},
        }
    },
    "write_file": {
        "description": "写入文件",
        "parameters": {
            "path": {"type": "string", "required": True},
            "content": {"type": "string", "required": True},
        }
    },
    "search_files": {...},
    "patch": {...},
}
```

### 6.4 DelegateTool 委托工具

```python
tools/delegate_tool.py

def delegate_task(
    task: str,
    mode: str = "once",  # once/session/background
    model: str = None,
    tools: List[str] = None,
) -> Dict:
    """委托任务给子 Agent"""
    
# 子 Agent 继承父 Agent 的：
# - 工具集
# - 会话历史
# - 记忆上下文
```

---

## 七、Plugin 插件系统

### 7.1 插件结构

```
plugins/
├── memory/           # 记忆 provider
│   └── honcho/      # Honcho 集成
├── browser/         # 浏览器 provider
└── tools/           # 额外工具
```

### 7.2 钩子系统

```python
# 支持的钩子
HOOKS = [
    "on_session_start",   # 会话开始
    "on_session_end",     # 会话结束
    "pre_llm_call",       # LLM 调用前
    "post_llm_call",      # LLM 调用后
    "pre_tool_call",      # 工具调用前
    "post_tool_call",     # 工具调用后
]

# 定义钩子
def my_hook(session_id, **kwargs):
    # 处理逻辑
    return {"context": "additional context"}

# 注册钩子
register_hook("pre_llm_call", my_hook)
```

### 7.3 记忆 Provider

```python
# 内置记忆
class MemoryToolProvider:
    """基于文件的记忆 (MEMORY.md)"""
    
# 插件记忆 (Honcho)
class HonchoMemoryProvider:
    """Honcho API 记忆服务"""
```

---

## 八、CLI 子系统

### 8.1 命令结构

```
hermes [command] [options]

Commands:
  hermes                  # 交互模式
  hermes --chat "问题"    # 单次对话
  hermes batch           # 批量模式
  hermes shell           # Shell 模式
  hermes skills          # 技能管理
  hermes config          # 配置管理
  hermes auth            # 认证管理
  hermes gateway          # 启动网关
```

### 8.2 配置管理

`hermes_cli/config.py` — YAML 配置：

```python
class Config:
    def __init__(self, config_path: str = None):
        self.data = self._load_config(config_path)
        
    def get(self, key: str, default=None):
        """获取配置项"""
        
    def set(self, key: str, value):
        """设置配置项"""
        
    def save(self):
        """保存配置"""
```

### 8.3 认证管理

`hermes_cli/auth.py` — API 密钥管理：

```python
class AuthManager:
    def add_api_key(self, provider: str, key: str):
        """添加 API 密钥"""
        
    def get_api_key(self, provider: str) -> str:
        """获取 API 密钥"""
        
    def remove_api_key(self, provider: str):
        """移除 API 密钥"""
```

---

## 九、环境与部署

### 9.1 Docker 部署

```dockerfile
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "hermes_cli", "gateway"]
```

### 9.2 系统要求

```
Python: 3.10+
Memory: 4GB+
Disk: 10GB+
OS: Linux/macOS/Windows
```

### 9.3 环境变量

```bash
# 必需
OPENROUTER_API_KEY=sk-...

# 可选
HERMES_HOME=~/.hermes
HERMES_CONFIG=~/.hermes/config.yaml
LOG_LEVEL=INFO
```

---

## 十、测试系统

### 10.1 测试结构

```
tests/
├── unit/           # 单元测试
├── integration/    # 集成测试
├── agent/          # Agent 测试
├── tools/          # 工具测试
└── fixtures/       # 测试数据
```

### 10.2 运行测试

```bash
# 运行所有测试
pytest tests/

# 运行特定模块
pytest tests/agent/

# 带覆盖率
pytest tests/ --cov=. --cov-report=html
```

---

## 十一、数据流总览

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLI / Gateway                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Interative │  │   REST API  │  │ WebSocket    │       │
│  │  TUI Mode   │  │   /v1/*     │  │  /ws         │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      AIAgent.run_conversation()            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 构建消息 (messages + system prompt)              │   │
│  │ 2. 上下文压缩检查                                    │   │
│  │ 3. 插件钩子 (pre_llm_call)                          │   │
│  │ 4. 调用 LLM API                                     │   │
│  │ 5. 处理响应                                          │   │
│  │    - 工具调用 → 执行工具 → 添加结果 → 继续循环       │   │
│  │    - 普通响应 → 结束                                 │   │
│  │ 6. 插件钩子 (post_llm_call)                        │   │
│  │ 7. 记忆更新                                          │   │
│  │ 8. 会话持久化                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Tool System                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Terminal │ │  Browser  │ │  Files   │ │ Memory   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Delegate │ │  Skills  │ │   MCP    │ │   Web    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ OpenRouter│ │  Browser │ │   File   │                   │
│  │  / OpenAI │ │ Provider │ │  System  │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 总结

Hermes Agent 的架构设计非常成熟：

1. **清晰的分层**：CLI → Agent → Tools → Providers
2. **模块化**：每个模块职责单一，易于测试和维护
3. **可扩展**：插件系统支持自定义功能
4. **生产级**：完善的错误处理、日志、监控
5. **多模式**：支持交互、API、批量等多种使用方式
