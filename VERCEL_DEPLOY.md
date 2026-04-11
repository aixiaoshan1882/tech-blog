# Vercel 部署指南

## 前端部署到 Vercel

### 1. 安装 Vercel CLI
```bash
npm i -g vercel
```

### 2. 登录
```bash
vercel login
```

### 3. 部署
```bash
cd front
vercel --prod
```

### 4. 配置环境变量
在 Vercel Dashboard 中设置：
- `VITE_API_URL`: 你的后端 API 地址

## 后端部署

### 方案 A: Cloudflare Workers (推荐)

```bash
cd backend/worker
wrangler deploy
```

### 方案 B: Railway (Python FastAPI)

1. 在 [railway.app](https://railway.app) 创建项目
2. 连接 GitHub 仓库
3. 设置启动命令: `cd backend && uvicorn src.main:app --host 0.0.0.0 --port $PORT`
4. 设置环境变量

### 方案 C: 保持本地开发

前端调用本地后端:
```
VITE_API_URL=http://localhost:8787/api
```
