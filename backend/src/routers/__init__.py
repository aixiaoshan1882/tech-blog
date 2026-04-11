"""路由模块"""
from .auth import router as auth_router
from .posts import router as posts_router
from .categories import router as categories_router
from .tags import router as tags_router
from .comments import router as comments_router
from .search import router as search_router
from .stats import router as stats_router
from .notifications import router as notifications_router

__all__ = [
    "auth_router",
    "posts_router",
    "categories_router",
    "tags_router",
    "comments_router",
    "search_router",
    "stats_router",
    "notifications_router",
]