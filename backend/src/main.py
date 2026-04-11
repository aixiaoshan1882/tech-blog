"""技术笔记博客后端 - 主入口"""
import os
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
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
    notifications_router,
    logs_router,
    users_router,
    announcements_router,
)
from .utils.auth import decode_token
from .utils.ratelimit import api_limiter

# 创建 FastAPI 应用
app = FastAPI(
    title="技术笔记博客 API",
    description="技术笔记博客后端 API",
    version="1.0.0",
)

# 安全中间件 - 隐藏服务器信息
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # 隐藏服务器信息
        response.headers["Server"] = "WebServer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


# CORS 中间件
app.add_middleware(SecurityHeadersMiddleware)
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


# 注册路由 (所有路由都在 /api 前缀下)
# 未来可以扩展为 /api/v1 和 /api/v2 实现版本控制
app.include_router(auth_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
app.include_router(categories_router, prefix="/api")
app.include_router(tags_router, prefix="/api")
app.include_router(comments_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(stats_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(logs_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(announcements_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "api_version": "v1",
    }


@app.get("/api/info")
async def api_info():
    """API 信息"""
    return {
        "name": "Tech Blog API",
        "version": "1.0.0",
        "description": "技术笔记博客后端 API",
        "endpoints": {
            "auth": "/api/auth",
            "posts": "/api/posts",
            "categories": "/api/categories",
            "tags": "/api/tags",
            "comments": "/api/comments",
            "search": "/api/search",
            "stats": "/api/stats",
            "notifications": "/api/notifications",
            "logs": "/api/logs",
            "users": "/api/users",
            "announcements": "/api/announcements",
        }
    }


# 本地开发服务器
if __name__ == "__main__":
    import uvicorn

    # 初始化数据库
    if not os.path.exists(config.DB_PATH):
        print("初始化数据库...")
        db.init_database()

    uvicorn.run(app, host="0.0.0.0", port=8787)