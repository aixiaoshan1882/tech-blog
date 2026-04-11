"""
API 版本控制
支持 /api/v1 和 /api/v2 版本

使用方式:
    from .routers.v1 import router as v1_router
    app.include_router(v1_router, prefix="/api/v1")
"""

from fastapi import APIRouter

# V1 路由 (当前版本)
# v1_router = APIRouter(prefix="/api/v1", tags=["v1"])

# V2 路由 (未来版本)
# v2_router = APIRouter(prefix="/api/v2", tags=["v2"])


# API 版本信息
API_VERSIONS = {
    "v1": {
        "version": "1.0.0",
        "status": "current",
        "description": "初始版本",
        "endpoints": {
            "auth": "/api/auth",
            "posts": "/api/posts",
            "categories": "/api/categories",
            "tags": "/api/tags",
            "comments": "/api/comments",
            "users": "/api/users",
            "stats": "/api/stats",
        },
    },
    # v2 可以添加更多端点或修改现有端点
}


def get_api_version_info() -> dict:
    """获取 API 版本信息"""
    return {
        "versions": list(API_VERSIONS.keys()),
        "current": "v1",
        "deprecated": [],
    }
