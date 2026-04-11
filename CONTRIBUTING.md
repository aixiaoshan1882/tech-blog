# 贡献指南

感谢您对技术博客项目的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境设置

### 前置要求
- Python 3.10+
- Node.js 18+
- npm 或 yarn

### 克隆项目
```bash
git clone <repo-url>
cd tech-blog
```

### 后端开发
```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 运行开发服务器
python src/main.py
```

### 前端开发
```bash
cd front

# 安装依赖
npm install

# 运行开发服务器
npm run dev
```

## 代码规范

### Python (后端)
- 遵循 PEP 8
- 使用 `black` 格式化代码
- 使用 `isort` 排序导入
- 所有新模块应包含 docstring

```bash
# 格式化代码
cd backend
black src/
isort src/

# 类型检查
mypy src/
```

### TypeScript/React (前端)
- 遵循 ESLint 规则
- 使用 Prettier 格式化
- 组件使用函数式组件 + Hooks

```bash
# 检查代码
cd front
npm run lint

# 格式化代码
npm run format
```

## Git 工作流

### 1. 创建功能分支
```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-description
```

### 2. 提交代码
```bash
# 暂存文件
git add .

# 提交（使用语义化提交信息）
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复问题"
git commit -m "docs: 更新文档"
```

#### 提交信息格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type):**
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档变更
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具变更

### 3. 推送分支
```bash
git push origin feature/your-feature-name
```

### 4. 创建 Pull Request
1. Fork 本仓库
2. 创建 PR 到 `main` 分支
3. 描述您的更改
4. 等待代码审查

## 测试

### 后端测试
```bash
cd backend
pytest tests/ -v
```

### 前端测试
```bash
cd front
npm test
```

## 报告问题

请使用 GitHub Issues 报告问题，包含：
- 清晰的标题和描述
- 复现步骤
- 预期行为 vs 实际行为
- 环境信息（操作系统、Python/Node 版本等）

## License

贡献的代码将采用与项目相同的 MIT License。
