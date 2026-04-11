"""搜索路由"""
from fastapi import APIRouter, Request, Query, HTTPException
from ..database import db

router = APIRouter(prefix="/search", tags=["搜索"])


@router.get("")
async def search_posts(request: Request, q: str = Query(..., min_length=1, max_length=100)) -> dict:
    """搜索文章"""
    # 输入验证
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")
    
    # 转义特殊 LIKE 字符，防止 LIKE 注入
    safe_q = q.strip().replace("%", "\\%").replace("_", "\\_")
    
    # 标题搜索
    posts = await db.select(
        """
        SELECT id, title, slug, excerpt, created_at
        FROM posts
        WHERE is_public = 1 AND title LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
        """,
        [f"%{safe_q}%"],
    )

    return {"code": 200, "data": posts}