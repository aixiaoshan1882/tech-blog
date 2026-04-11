"""搜索路由"""
from fastapi import APIRouter, Request, Query
from ..database import db

router = APIRouter(prefix="/search", tags=["搜索"])


@router.get("")
async def search_posts(request: Request, q: str = Query(..., min_length=1)) -> dict:
    """搜索文章"""
    # 标题搜索
    posts = await db.select(
        """
        SELECT id, title, slug, excerpt, created_at
        FROM posts
        WHERE is_public = 1 AND title LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
        """,
        [f"%{q}%"],
    )

    return {"code": 200, "data": posts}