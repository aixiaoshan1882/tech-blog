"""统计路由"""
from fastapi import APIRouter
from ..database import db

router = APIRouter(prefix="/stats", tags=["统计"])


@router.get("")
async def get_stats() -> dict:
    """获取统计数据"""
    # 文章总数
    posts_result = await db.first("SELECT COUNT(*) as count FROM posts WHERE is_public = 1")
    total_posts = posts_result["count"] if posts_result else 0

    # 总阅读量
    views_result = await db.first("SELECT SUM(view_count) as total FROM posts")
    total_views = views_result["total"] if views_result and views_result["total"] else 0

    # 评论总数
    comments_result = await db.first("SELECT COUNT(*) as count FROM comments")
    total_comments = comments_result["count"] if comments_result else 0

    # 分类总数
    categories_result = await db.first("SELECT COUNT(*) as count FROM categories")
    total_categories = categories_result["count"] if categories_result else 0

    # 标签总数
    tags_result = await db.first("SELECT COUNT(*) as count FROM tags")
    total_tags = tags_result["count"] if tags_result else 0

    return {
        "code": 200,
        "data": {
            "totalPosts": total_posts,
            "totalViews": total_views,
            "totalComments": total_comments,
            "totalCategories": total_categories,
            "totalTags": total_tags,
        },
    }
