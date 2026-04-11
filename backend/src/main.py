"""技术笔记博客后端 - 主入口"""
import os
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .config import config
from .database import db
from .routers import (
    auth_router,
    posts_router,
    categories_router,
    tags_router,
    comments_router,
    search_router,
    stats_router,
)
from .utils.auth import decode_token

# 创建 FastAPI 应用
app = FastAPI(
    title="技术笔记博客 API",
    description="技术笔记博客后端 API",
    version="1.0.0",
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 认证中间件
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # 排除不需要认证的路径
    public_paths = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/posts",
        "/api/categories",
        "/api/tags",
        "/api/search",
        "/api/stats",
        "/api/health",
    ]

    # 检查 Token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        if payload:
            request.state.user_id = payload.get("user_id")

    response = await call_next(request)
    return response


# 注册路由
app.include_router(auth_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(tags_router, prefix="/api")
app.include_router(comments_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(stats_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# 本地开发服务器
if __name__ == "__main__":
    import uvicorn

    # 初始化数据库
    if not os.path.exists(config.DB_PATH):
        print("初始化数据库...")
        db.init_database()

    uvicorn.run(app, host="0.0.0.0", port=8787)