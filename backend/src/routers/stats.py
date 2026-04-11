"""统计路由"""
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
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


@router.get("/trends")
async def get_trends(period: int = Query(default=30, ge=7, le=90)) -> dict:
    """获取趋势数据"""
    days = []
    for i in range(period):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        next_date = (datetime.now() - timedelta(days=i-1)).strftime("%Y-%m-%d") if i > 0 else None
        
        # 当天新增文章
        posts_count = await db.first(
            "SELECT COUNT(*) as count FROM posts WHERE DATE(created_at) = ?",
            [date]
        )
        
        # 当天新增评论
        comments_count = await db.first(
            "SELECT COUNT(*) as count FROM comments WHERE DATE(created_at) = ?",
            [date]
        )
        
        # 当天总浏览量（使用 post_stats 或累计）
        views_count = await db.first(
            "SELECT SUM(view_count) as total FROM posts WHERE DATE(updated_at) = ?",
            [date]
        )
        
        days.append({
            "date": date,
            "views": views_count["total"] if views_count and views_count["total"] else 0,
            "posts": posts_count["count"] if posts_count else 0,
            "comments": comments_count["count"] if comments_count else 0,
        })
    
    days.reverse()
    return {
        "code": 200,
        "data": {
            "daily": days,
            "period": period,
        },
    }
