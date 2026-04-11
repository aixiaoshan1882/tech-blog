"""通知路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db
from .auth import require_admin, get_user_by_id

router = APIRouter(prefix="/notifications", tags=["通知"])


@router.get("")
async def get_notifications(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """获取当前用户的通知列表"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    
    offset = (page - 1) * limit
    
    # 查询通知
    notifications = await db.select(
        """
        SELECT * FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        [user_id, limit, offset]
    )
    
    # 获取未读数量
    unread_result = await db.first(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
        [user_id]
    )
    unread_count = unread_result["count"] if unread_result else 0
    
    # 获取总数
    total_result = await db.first(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ?",
        [user_id]
    )
    total = total_result["count"] if total_result else 0
    
    return {
        "code": 200,
        "data": {
            "items": notifications,
            "unread_count": unread_count,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/unread-count")
async def get_unread_count(request: Request) -> dict:
    """获取未读通知数量"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    
    result = await db.first(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
        [user_id]
    )
    count = result["count"] if result else 0
    
    return {"code": 200, "data": {"count": count}}


@router.put("/{id}/read")
async def mark_as_read(request: Request, id: int) -> dict:
    """标记通知为已读"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    
    # 检查通知是否属于当前用户
    notification = await db.first(
        "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
        [id, user_id]
    )
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    await db.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ?",
        [id]
    )
    
    return {"code": 200, "msg": "已标记为已读"}


@router.put("/read-all")
async def mark_all_as_read(request: Request) -> dict:
    """标记所有通知为已读"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    
    await db.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
        [user_id]
    )
    
    return {"code": 200, "msg": "已标记全部为已读"}


@router.delete("/{id}")
async def delete_notification(request: Request, id: int) -> dict:
    """删除通知"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    
    # 检查通知是否属于当前用户
    notification = await db.first(
        "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
        [id, user_id]
    )
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    await db.execute("DELETE FROM notifications WHERE id = ?", [id])
    
    return {"code": 200, "msg": "删除成功"}


# ============= 内部函数：创建通知 =============

async def create_notification(
    user_id: int,
    notification_type: str,
    title: str,
    content: str = None,
    related_id: int = None
) -> int:
    """创建通知 (内部函数)"""
    result = await db.execute(
        """
        INSERT INTO notifications (user_id, type, title, content, related_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        [user_id, notification_type, title, content, related_id]
    )
    return result.get("last_row_id", 0)
