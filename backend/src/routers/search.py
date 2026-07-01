"""搜索路由 - 安全增强版"""
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import JSONResponse
from ..database import db
from ..utils.ratelimit import search_limiter

router = APIRouter(prefix="/search", tags=["搜索"])


@router.get("")
async def search_posts(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
) -> dict:
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
    
    offset = (page - 1) * limit
    keyword = f"%{clean_q}%"

    total_result = await db.first(
        """
        SELECT COUNT(*) as count
        FROM posts
        WHERE is_public = 1
          AND deleted_at IS NULL
          AND (title LIKE ? OR excerpt LIKE ? OR content LIKE ?)
        """,
        [keyword, keyword, keyword],
    )
    total = total_result["count"] if total_result else 0

    # 标题/摘要/内容搜索（使用参数化查询防止 SQL 注入）
    posts = await db.select(
        """
        SELECT p.id, p.title, p.slug, p.excerpt, p.cover, p.category_id,
               p.is_public, p.view_count, p.like_count, p.created_at, p.updated_at,
               c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_public = 1
          AND p.deleted_at IS NULL
          AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
        """,
        [keyword, keyword, keyword, limit, offset],
    )

    for post in posts:
        tags = await db.select(
            "SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ?",
            [post["id"]],
        )
        post["tags"] = tags

    return {
        "code": 200,
        "data": {
            "items": posts,
            "total": total,
            "page": page,
            "limit": limit,
            "hasMore": offset + len(posts) < total,
        },
    }
