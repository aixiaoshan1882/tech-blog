# 个人技术博客项目

基于 PRD-full.md 需求文档构建的技术笔记博客系统。

## 项目结构

```
tech-blog/
├── front/           # 前端项目 (React + Vite + TypeScript)
├── backend/         # 后端项目 (Cloudflare Workers Python)
├── database/        # 数据库脚本
└── docs/          # 文档
```

## 快速开始

### 前端开发
```bash
cd front
npm install
npm run dev
```

### 后端开发
```bash
cd backend
pip install -r requirements.txt
wrangler dev
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite 5 + TypeScript |
| 状态 | Zustand |
| 样式 | Tailwind CSS |
| 后端 | Cloudflare Workers Python |
| 数据库 | Cloudflare D1 (SQLite) |
| 认证 | JWT |