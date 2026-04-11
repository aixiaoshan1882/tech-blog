# 技术笔记博客

一个现代化的技术博客系统，支持文章发布、评论互动、用户管理、数据分析等功能。

## ✨ 特性

### 核心功能
- 📝 **文章管理** - 支持 Markdown 写作、定时发布、回收站
- 💬 **评论系统** - 嵌套评论、点赞、通知提醒
- 👤 **用户系统** - 注册登录、角色权限、个人资料
- 🏷️ **分类标签** - 灵活的分类和标签管理
- ❤️ **收藏点赞** - 用户互动功能
- 📊 **数据分析** - 访问统计、趋势分析、排行榜
- 🔔 **系统公告** - 站内通知
- 📋 **操作日志** - 审计追踪

### 技术特性
- 🔐 **安全加固** - SQL/XSS 防护、JWT/API Key 认证、Rate Limiting
- 🚀 **性能优化** - Redis 缓存、数据库索引
- 📦 **部署简单** - Docker/Docker Compose 一键部署
- 🔄 **CI/CD** - GitHub Actions 自动构建
- 📡 **订阅支持** - RSS/Atom 订阅源、Sitemap
- 🖼️ **图片上传** - 支持拖拽上传、批量上传

### Admin 管理后台
- 📈 数据分析仪表盘
- 📝 文章/分类/标签管理
- 👥 用户管理
- 💬 评论审核
- 📢 公告管理
- 📋 操作日志
- 🗑️ 回收站
- 📖 API 文档

## 🛠️ 技术栈

### 后端
- **框架**: FastAPI
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **缓存**: Redis
- **认证**: JWT + API Key

### 前端
- **框架**: React 18
- **构建**: Vite
- **路由**: React Router 6
- **样式**: Tailwind CSS
- **状态**: Zustand

## 🚀 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- npm 或 yarn

### 本地开发

```bash
# 克隆项目
git clone <repo-url>
cd tech-blog

# 后端设置
cd backend
cp .env.example .env
pip install -r requirements.txt
python src/main.py

# 前端设置 (新终端)
cd front
npm install
npm run dev
```

### Docker 部署

```bash
# 使用 SQLite (简单部署)
docker-compose up -d

# 使用 PostgreSQL + Redis (生产推荐)
docker-compose --profile full up -d
```

### 环境变量

```env
# 后端 (.env)
DATABASE_URL=sqlite:///./blog.db  # 或 PostgreSQL
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# 前端 (.env)
VITE_API_URL=http://localhost:8787/api
```

## 📁 项目结构

```
tech-blog/
├── backend/
│   ├── src/
│   │   ├── routers/       # API 路由
│   │   │   ├── posts.py    # 文章接口
│   │   │   ├── auth.py     # 认证接口
│   │   │   ├── comments.py # 评论接口
│   │   │   └── ...
│   │   ├── utils/         # 工具函数
│   │   │   ├── auth.py     # JWT 认证
│   │   │   ├── cache.py    # Redis 缓存
│   │   │   └── ...
│   │   ├── migrations/     # 数据库迁移
│   │   └── main.py        # 应用入口
│   ├── scripts/           # 脚本
│   └── requirements.txt
├── front/
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── pages/         # 页面
│   │   │   └── Admin/     # 管理后台
│   │   ├── api/           # API 客户端
│   │   └── hooks/         # React Hooks
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🔌 API 文档

启动后访问: http://localhost:8787/api/docs

### 主要接口

| 模块 | 路径 | 说明 |
|------|------|------|
| 认证 | `/api/auth/*` | 登录/注册/密码重置 |
| 文章 | `/api/posts/*` | CRUD/收藏/点赞 |
| 评论 | `/api/comments/*` | 评论/回复/点赞 |
| 用户 | `/api/users/*` | 用户管理 |
| 统计 | `/api/stats/*` | 数据统计 |
| 订阅 | `/feed.xml` | RSS 订阅源 |

## 🧪 测试

```bash
# 后端测试
cd backend
pytest

# 前端测试
cd front
npm test
```

## 📝 数据库迁移

```bash
cd backend

# 查看迁移状态
python -m migrations.cli status

# 执行迁移
python -m migrations.cli up

# 回滚迁移
python -m migrations.cli down [N]
```

## 🔒 安全配置

### 生产环境必做

1. **修改 SECRET_KEY**
   ```env
   SECRET_KEY=<随机字符串>
   ```

2. **启用 HTTPS**
   - 配置 Nginx SSL 证书
   - 更新 CORS_ORIGINS

3. **数据库安全**
   - 使用 PostgreSQL 替代 SQLite
   - 设置强密码
   - 定期备份

4. **邮件服务**
   - 配置 SMTP 用于发送通知
   - 建议使用 SendGrid/AWS SES

## 📈 性能优化

- ✅ Redis 缓存已启用
- ✅ 数据库索引已添加
- ✅ 图片懒加载
- ✅ Gzip 压缩
- ⚠️ 考虑使用 CDN 加速静态资源

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Python Web 框架
- [React](https://react.dev/) - 用户界面库
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先 CSS 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
