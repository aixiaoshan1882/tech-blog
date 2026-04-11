"""用户管理路由"""
from fastapi import APIRouter, Request, HTTPException, Query
from ..database import db
from .auth import require_admin, get_user_by_id

router = APIRouter(prefix="/users", tags=["用户管理"])


@router.get("")
async def get_users(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: str = None,
    keyword: str = None,
) -> dict:
    """获取用户列表 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    offset = (page - 1) * limit
    
    # 构建查询条件
    where_clauses = []
    params = []
    
    if role:
        where_clauses.append("u.role = ?")
        params.append(role)
    
    if keyword:
        where_clauses.append("(u.email LIKE ? OR u.nickname LIKE ?)")
        params.extend([f"%{keyword}%", f"%{keyword}%"])
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    # 查询用户列表
    users = await db.select(
        f"""
        SELECT u.id, u.email, u.nickname, u.role, u.avatar, u.bio, u.created_at,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count,
               (SELECT COUNT(*) FROM comments WHERE email = u.email) as comment_count
        FROM users u
        WHERE {where_sql}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [limit, offset]
    )
    
    # 获取总数
    total_result = await db.first(
        f"SELECT COUNT(*) as count FROM users u WHERE {where_sql}",
        params
    )
    total = total_result["count"] if total_result else 0
    
    return {
        "code": 200,
        "data": {
            "items": users,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get("/{user_id}")
async def get_user_detail(
    request: Request,
    user_id: int,
) -> dict:
    """获取用户详情 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    # 查询用户
    user = await db.first(
        """
        SELECT u.id, u.email, u.nickname, u.role, u.avatar, u.bio, u.created_at
        FROM users u
        WHERE u.id = ?
        """,
        [user_id]
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 获取用户统计
    stats = await db.first(
        """
        SELECT 
            (SELECT COUNT(*) FROM posts WHERE user_id = ?) as post_count,
            (SELECT COUNT(*) FROM comments WHERE email = (SELECT email FROM users WHERE id = ?)) as comment_count
        """,
        [user_id, user_id]
    )
    
    user["post_count"] = stats["post_count"] if stats else 0
    user["comment_count"] = stats["comment_count"] if stats else 0
    
    return {"code": 200, "data": user}


@router.put("/{user_id}/role")
async def update_user_role(
    request: Request,
    user_id: int,
) -> dict:
    """更新用户角色 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    body = await request.json()
    new_role = body.get("role")
    
    if new_role not in ["admin", "reader"]:
        raise HTTPException(status_code=400, detail="无效的角色")
    
    # 不能修改自己
    current_user = await get_user_by_id(getattr(request.state, "user_id", None))
    if current_user and current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="不能修改自己的角色")
    
    # 不能修改最后一个管理员
    if new_role != "admin":
        admin_count = await db.first("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
        if admin_count and admin_count["count"] <= 1:
            user = await db.first("SELECT role FROM users WHERE id = ?", [user_id])
            if user and user["role"] == "admin":
                raise HTTPException(status_code=400, detail="不能修改最后一个管理员")
    
    await db.execute(
        "UPDATE users SET role = ? WHERE id = ?",
        [new_role, user_id]
    )
    
    return {"code": 200, "msg": "角色更新成功"}


@router.delete("/{user_id}")
async def delete_user(
    request: Request,
    user_id: int,
) -> dict:
    """删除用户 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    # 不能删除自己
    current_user = await get_user_by_id(getattr(request.state, "user_id", None))
    if current_user and current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    
    # 不能删除最后一个管理员
    admin_count = await db.first("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    if admin_count and admin_count["count"] <= 1:
        user = await db.first("SELECT role FROM users WHERE id = ?", [user_id])
        if user and user["role"] == "admin":
            raise HTTPException(status_code=400, detail="不能删除最后一个管理员")
    
    # 删除用户 (关联数据会 CASCADE 删除)
    await db.execute("DELETE FROM users WHERE id = ?", [user_id])
    
    return {"code": 200, "msg": "用户已删除"}


@router.get("/stats/overview")
async def get_user_stats(
    request: Request,
) -> dict:
    """获取用户统计 (管理员专用)"""
    # 检查管理员权限
    await require_admin(request)
    
    # 用户总数
    total_users = await db.first("SELECT COUNT(*) as count FROM users")
    
    # 管理员数量
    admin_count = await db.first("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    
    # 普通用户数量
    reader_count = await db.first("SELECT COUNT(*) as count FROM users WHERE role = 'reader'")
    
    # 今日新增用户
    today_users = await db.first(
        "SELECT COUNT(*) as count FROM users WHERE date(created_at) = date('now')"
    )
    
    return {
        "code": 200,
        "data": {
            "total_users": total_users["count"] if total_users else 0,
            "admin_count": admin_count["count"] if admin_count else 0,
            "reader_count": reader_count["count"] if reader_count else 0,
            "today_users": today_users["count"] if today_users else 0,
        },
    }
