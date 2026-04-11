"""公告路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db
from ..utils.sanitize import sanitize_html
from .auth import require_admin

router = APIRouter(prefix="/announcements", tags=["公告"])


@router.get("")
async def get_announcements(
    request: Request,
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    """获取公告列表 (公开)"""
    announcements = await db.select(
        """
        SELECT id, title, content, type, priority, is_pinned, created_at
        FROM announcements
        WHERE is_active = 1 
          AND datetime(start_time) <= datetime('now')
          AND (end_time IS NULL OR datetime(end_time) >= datetime('now'))
        ORDER BY is_pinned DESC, priority DESC, created_at DESC
        LIMIT ?
        """,
        [limit]
    )
    
    return {"code": 200, "data": announcements}


@router.get("/all")
async def get_all_announcements(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
) -> dict:
    """获取所有公告 (管理员)"""
    await require_admin(request)
    
    offset = (page - 1) * limit
    
    announcements = await db.select(
        """
        SELECT * FROM announcements
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        [limit, offset]
    )
    
    total_result = await db.first("SELECT COUNT(*) as count FROM announcements")
    total = total_result["count"] if total_result else 0
    
    return {
        "code": 200,
        "data": {
            "items": announcements,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.post("")
async def create_announcement(request: Request) -> dict:
    """创建公告 (管理员)"""
    await require_admin(request)
    
    body = await request.json()
    title = body.get("title")
    content = body.get("content")
    
    if not title or not content:
        raise HTTPException(status_code=400, detail="标题和内容不能为空")
    
    # XSS 防护
    title = sanitize_html(title)[:200]
    content = sanitize_html(content)[:2000]
    
    result = await db.execute(
        """
        INSERT INTO announcements (title, content, type, priority, is_pinned, is_active, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            title,
            content,
            body.get("type", "info"),
            body.get("priority", 0),
            body.get("is_pinned", 0),
            body.get("is_active", 1),
            body.get("start_time"),
            body.get("end_time"),
        ]
    )
    
    return {
        "code": 200,
        "msg": "公告创建成功",
        "data": {"id": result.get("last_row_id")},
    }


@router.put("/{id}")
async def update_announcement(request: Request, id: int) -> dict:
    """更新公告 (管理员)"""
    await require_admin(request)
    
    body = await request.json()
    
    updates = []
    params = []
    
    allowed_fields = ["title", "content", "type", "priority", "is_pinned", "is_active", "start_time", "end_time"]
    
    for field in allowed_fields:
        if field in body:
            value = body[field]
            if field in ["title", "content"]:
                value = sanitize_html(str(value))[:2000 if field == "content" else 200]
            updates.append(f"{field} = ?")
            params.append(value)
    
    if not updates:
        raise HTTPException(status_code=400, detail="没有要更新的字段")
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(id)
    
    await db.execute(
        f"UPDATE announcements SET {', '.join(updates)} WHERE id = ?",
        params
    )
    
    return {"code": 200, "msg": "公告更新成功"}


@router.delete("/{id}")
async def delete_announcement(request: Request, id: int) -> dict:
    """删除公告 (管理员)"""
    await require_admin(request)
    
    await db.execute("DELETE FROM announcements WHERE id = ?", [id])
    
    return {"code": 200, "msg": "公告删除成功"}
