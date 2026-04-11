"""操作日志路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db
from .auth import require_admin

router = APIRouter(prefix="/logs", tags=["日志"])


@router.get("")
async def get_operation_logs(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: str = None,
    user_id: int = None,
) -> dict:
    """获取操作日志列表 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    offset = (page - 1) * limit
    
    # 构建查询条件
    where_clauses = []
    params = []
    
    if action:
        where_clauses.append("l.action = ?")
        params.append(action)
    
    if user_id:
        where_clauses.append("l.user_id = ?")
        params.append(user_id)
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # 查询日志
    logs = await db.select(
        f"""
        SELECT l.*, u.nickname as user_nickname, u.email as user_email
        FROM operation_logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE {where_sql}
        ORDER BY l.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset]
    )
    
    # 获取总数
    total_result = await db.first(
        f"SELECT COUNT(*) as count FROM operation_logs l WHERE {where_sql}",
        params
    )
    total = total_result["count"] if total_result else 0
    
    return {
        "code": 200,
        "data": {
            "items": logs,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/stats")
async def get_log_stats(request: Request) -> dict:
    """获取操作统计 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    # 统计各操作类型数量
    action_stats = await db.select(
        """
        SELECT action, COUNT(*) as count
        FROM operation_logs
        GROUP BY action
        ORDER BY count DESC
        """
    )
    
    # 统计今日操作
    today_stats = await db.first(
        """
        SELECT COUNT(*) as count
        FROM operation_logs
        WHERE date(created_at) = date('now')
        """
    )
    
    # 统计总操作数
    total_stats = await db.first(
        "SELECT COUNT(*) as count FROM operation_logs"
    )
    
    return {
        "code": 200,
        "data": {
            "action_stats": action_stats,
            "today_count": today_stats["count"] if today_stats else 0,
            "total_count": total_stats["count"] if total_stats else 0,
        },
    }


# ============= 内部函数：记录操作日志 =============

async def create_log(
    user_id: int = None,
    action: str = None,
    resource: str = None,
    resource_id: int = None,
    details: str = None,
    ip_address: str = None,
    user_agent: str = None,
) -> int:
    """创建操作日志 (内部函数)"""
    result = await db.execute(
        """
        INSERT INTO operation_logs (user_id, action, resource, resource_id, details, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [user_id, action, resource, resource_id, details, ip_address, user_agent]
    )
    return result.get("last_row_id", 0)


def get_client_ip(request: Request) -> str:
    """获取客户端 IP"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
