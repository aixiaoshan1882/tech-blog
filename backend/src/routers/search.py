"""搜索路由 - 安全增强版"""
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import JSONResponse
from ..database import db
from ..utils.ratelimit import search_limiter

router = APIRouter(prefix="/search", tags=["搜索"])


@router.get("")
async def search_posts(request: Request, q: str = Query(..., min_length=1, max_length=100)) -> dict:
    """搜索文章"""
    client_ip = request.client.host if request.client else "unknown"
    
    # 搜索速率限制
    allowed, remaining = search_limiter.is_allowed(client_ip)
    if not allowed:
        retry_after = search_limiter.get_retry_after(client_ip)
        return JSONResponse(
            status_code=429,
            content={"detail": f"搜索过于频繁，请 {retry_after} 秒后重试"},
            headers={"Retry-After": str(retry_after)}
        )
    
    # 清理搜索关键词 - 只保留安全的字符
    clean_q = ''.join(c for c in q.strip() if c.isalnum() or c in ' -_（）()（）').strip()[:50]
    
    if not clean_q:
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")
    
    # 标题搜索（使用参数化查询防止 SQL 注入）
    posts = await db.select(
        """
        SELECT id, title, slug, excerpt, created_at
        FROM posts
        WHERE is_public = 1 AND deleted_at IS NULL AND title LIKE ?
        ORDER BY created_at DESC
        LIMIT 20
        """,
        [f"%{clean_q}%"],
    )

    return {"code": 200, "data": posts}